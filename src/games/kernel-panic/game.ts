/**
 * game.ts - Kernel Panic
 *
 * Vertical shmup. Fly the kernel craft, shoot falling threats, last 60s or until HP is gone.
 */

declare const vscode: {
    postMessage(message: any): void;
};

declare const soundManager: {
    playById(id: string): void;
    setMuted(muted: boolean): void;
    isSoundMuted(): boolean;
    setVolume(volume: number): void;
    getVolume(): number;
    preloadAll(): void;
};

declare const initGameChrome: () => void;

declare const gameChrome: {
    refreshMuteUI(): void;
    applyZoom(zoom: number): void;
    setDifficultyBadge(label: string): void;
    refreshToolbarPhase(): void;
};

type EnemyKind = 'segfault' | 'zombie' | 'leak' | 'healthy';

interface PanicDifficulty {
    name: string;
    label: string;
    hp: number;
    spawnMs: number;
    speed: number;
    fireMs: number;
    panicWaves: boolean;
    pool: EnemyKind[];
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface Enemy extends Rect {
    kind: EnemyKind;
    vy: number;
    vx: number;
    hp: number;
    waveId: number;
    warned: boolean;
}

type TimedPowerKind = 'rapid' | 'spread' | 'shield' | 'weaker' | 'score';
type PowerKind = TimedPowerKind | 'health';

interface Bullet extends Rect {
    vy: number;
    vx: number;
}

interface Pickup extends Rect {
    vy: number;
    kind: PowerKind;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

interface Star {
    x: number;
    y: number;
    speed: number;
    size: number;
}

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 480;
const RUN_SECONDS = 60;
const HEALTHY_PENALTY = 25;
const WAVE_BONUS = 50;
const PAUSE_LABEL = 'Pause (P)';

const KIND_SCORE: Record<EnemyKind, number> = {
    segfault: 10,
    zombie: 15,
    leak: 20,
    healthy: 0
};

const KIND_COLOR: Record<EnemyKind, string> = {
    segfault: '#f48771',
    zombie: '#c586c0',
    leak: '#ce9178',
    healthy: '#4ec9b0'
};

const KIND_LABEL: Record<EnemyKind, string> = {
    segfault: 'segv',
    zombie: 'zombie',
    leak: 'leak',
    healthy: 'ok'
};

const DROP_CHANCE = 0.3;
const POWER_DURATION = 7;
const WEAKER_SPEED = 0.55;
const RAPID_FIRE = 0.45;

const POWER_KINDS: PowerKind[] = ['shield', 'rapid', 'spread', 'weaker', 'score', 'health'];
const TIMED_POWER_KINDS: TimedPowerKind[] = ['rapid', 'spread', 'shield', 'weaker', 'score'];

const POWERUP_COLORS: Record<PowerKind, string> = {
    shield: '#9e9e9e',
    rapid: '#f44336',
    spread: '#e040fb',
    weaker: '#42a5f5',
    score: '#ffeb3b',
    health: '#4caf50'
};

const POWERUP_LABELS: Record<PowerKind, string> = {
    shield: 'SH',
    rapid: 'RF',
    spread: 'SP',
    weaker: 'WK',
    score: '2x',
    health: '+'
};

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const scoreElement = document.getElementById('score') as HTMLElement;
const highScoreElement = document.getElementById('highScore') as HTMLElement;
const hpElement = document.getElementById('hp') as HTMLElement;
const timeElement = document.getElementById('timeLeft') as HTMLElement;
const gameOverElement = document.getElementById('gameOver') as HTMLElement;
const gameOverTitle = gameOverElement.querySelector('h2') as HTMLElement;
const finalScoreElement = document.getElementById('finalScore') as HTMLElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
const restartBtn = document.getElementById('restartBtn') as HTMLButtonElement;
const gameOverAlert = document.getElementById('gameOverAlert') as HTMLElement;
const alertTitle = gameOverAlert.querySelector('h2') as HTMLElement;
const alertScore = document.getElementById('alertScore') as HTMLElement;
const difficultySelection = document.getElementById('difficultySelection') as HTMLElement;
const gamePlay = document.getElementById('gamePlay') as HTMLElement;
const enterGameBtn = document.getElementById('enterGameBtn') as HTMLButtonElement;
const backToMenuBtn = document.getElementById('backToMenuBtn') as HTMLButtonElement;

const difficulties: Record<string, PanicDifficulty> = {
    easy: {
        name: 'Easy',
        label: 'Easy',
        hp: 3,
        spawnMs: 900,
        speed: 70,
        fireMs: 180,
        panicWaves: false,
        pool: ['segfault']
    },
    medium: {
        name: 'Medium',
        label: 'Medium',
        hp: 3,
        spawnMs: 620,
        speed: 95,
        fireMs: 160,
        panicWaves: false,
        pool: ['segfault', 'zombie']
    },
    hard: {
        name: 'Hard',
        label: 'Hard',
        hp: 2,
        spawnMs: 480,
        speed: 120,
        fireMs: 140,
        panicWaves: true,
        pool: ['segfault', 'zombie', 'leak', 'healthy']
    }
};

let selectedDifficulty = 'easy';
let currentDifficulty = difficulties.easy;
let score = 0;
let highScore = 0;
let hp = 3;
let maxHp = 3;
let timeLeft = RUN_SECONDS;
let isRunning = false;
let isPaused = false;
let survived = false;
let lastTs = 0;
let rafId = 0;
let spawnAcc = 0;
let fireAcc = 0;
let invuln = 0;
let warningLatched = false;
let waveId = 0;
let nextWaveAt = 18;
let killStreak = 0;
let killStreakAt = 0;
let killsSinceDrop = 0;
let player: Rect = { x: 168, y: 430, w: 24, h: 18 };
const keys = { left: false, right: false, up: false, down: false, fire: false };
let enemies: Enemy[] = [];
let bullets: Bullet[] = [];
let pickups: Pickup[] = [];
let particles: Particle[] = [];
let activeMods: Partial<Record<TimedPowerKind, number>> = {};
const stars: Star[] = Array.from({ length: 48 }, () => ({
    x: Math.random() * CANVAS_WIDTH,
    y: Math.random() * CANVAS_HEIGHT,
    speed: 20 + Math.random() * 50,
    size: Math.random() < 0.7 ? 1 : 2
}));

function playSound(id: string): void {
    if (typeof soundManager !== 'undefined') {
        soundManager.playById(id);
    }
}

function init(): void {
    if (typeof initGameChrome === 'function') {
        initGameChrome();
    }
    if (typeof soundManager !== 'undefined' && soundManager.preloadAll) {
        soundManager.preloadAll();
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    setupDifficultySelection();
    loadHighScore();
    updateHud();
    setupEventListeners();
    draw(0);
}

function setupDifficultySelection(): void {
    document.querySelectorAll('.difficulty-card[data-difficulty]').forEach(card => {
        card.addEventListener('click', () => {
            const difficulty = (card as HTMLElement).dataset.difficulty;
            if (difficulty) {
                selectDifficulty(difficulty);
            }
        });
    });

    enterGameBtn?.addEventListener('click', enterGame);
    backToMenuBtn?.addEventListener('click', backToMenu);
}

function selectDifficulty(difficulty: string): void {
    if (!difficulties[difficulty]) {
        return;
    }

    selectedDifficulty = difficulty;
    currentDifficulty = difficulties[difficulty];

    document.querySelectorAll('.difficulty-card').forEach(card => {
        card.classList.remove('active');
    });
    document.getElementById(`${difficulty}Card`)?.classList.add('active');

    loadHighScore();
    hp = currentDifficulty.hp;
    maxHp = currentDifficulty.hp;
    updateHud();
}

function enterGame(): void {
    currentDifficulty = difficulties[selectedDifficulty];
    loadHighScore();
    resetRun(false);

    difficultySelection.style.display = 'none';
    gamePlay.style.display = 'block';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(currentDifficulty.label);
        gameChrome.refreshToolbarPhase();
    }

    draw(0);
    notifyGameStateChanged();
}

function backToMenu(): void {
    stopLoop();
    isRunning = false;
    isPaused = false;
    keys.fire = false;

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';

    gamePlay.style.display = 'none';
    difficultySelection.style.display = 'block';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge('');
        gameChrome.refreshToolbarPhase();
    }

    notifyGameStateChanged();
}

function loadHighScore(): void {
    const saved = localStorage.getItem(`kernelPanicHighScore_${selectedDifficulty}`);
    highScore = saved ? parseInt(saved, 10) : 0;
    refreshDifficultyBestScores();
}

function saveHighScore(): void {
    localStorage.setItem(`kernelPanicHighScore_${selectedDifficulty}`, highScore.toString());
    refreshDifficultyBestScores();
}

function getStoredHighScore(difficulty: string): number {
    const saved = localStorage.getItem(`kernelPanicHighScore_${difficulty}`);
    return saved ? parseInt(saved, 10) : 0;
}

function refreshDifficultyBestScores(): void {
    document.querySelectorAll('[data-difficulty-best]').forEach(el => {
        const difficulty = (el as HTMLElement).dataset.difficultyBest;
        if (difficulty) {
            el.textContent = String(getStoredHighScore(difficulty));
        }
    });
}

function notifyGameStateChanged(): void {
    window.dispatchEvent(new CustomEvent('gameChrome:gameStateChanged'));
}

function setupEventListeners(): void {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    window.addEventListener('gameChrome:togglePause', () => {
        if (isRunning) {
            togglePause();
        }
    });

    window.addEventListener('gameChrome:start', () => {
        if (!isRunning && startBtn.style.display !== 'none') {
            startGame();
        }
    });

    window.addEventListener('gameChrome:restart', () => {
        gameOverElement.classList.remove('show');
        gameOverAlert.classList.remove('show');
        startGame();
    });
}

function resetRun(playing: boolean): void {
    currentDifficulty = difficulties[selectedDifficulty];
    maxHp = currentDifficulty.hp;
    hp = maxHp;
    score = 0;
    timeLeft = RUN_SECONDS;
    spawnAcc = 0;
    fireAcc = currentDifficulty.fireMs;
    invuln = 0;
    warningLatched = false;
    waveId = 0;
    nextWaveAt = 18;
    killStreak = 0;
    killStreakAt = 0;
    killsSinceDrop = 0;
    survived = false;
    enemies = [];
    bullets = [];
    pickups = [];
    particles = [];
    activeMods = {};
    player = { x: CANVAS_WIDTH / 2 - 12, y: CANVAS_HEIGHT - 50, w: 24, h: 18 };
    isPaused = false;
    isRunning = playing;
    updateHud();
}

function startGame(): void {
    playSound('popSound');
    stopLoop();
    resetRun(true);

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    pauseBtn.textContent = PAUSE_LABEL;

    lastTs = 0;
    rafId = requestAnimationFrame(loop);
    notifyGameStateChanged();
}

function stopLoop(): void {
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
    }
}

function loop(ts: number): void {
    if (!isRunning) {
        return;
    }

    if (lastTs === 0) {
        lastTs = ts;
    }
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    if (!isPaused) {
        update(dt);
    }
    draw(ts);
    rafId = requestAnimationFrame(loop);
}

function update(dt: number): void {
    timeLeft -= dt;
    if (timeLeft <= 0) {
        timeLeft = 0;
        survived = true;
        endGame();
        return;
    }

    invuln = Math.max(0, invuln - dt);
    tickMods(dt);
    spawnAcc += dt * 1000;
    fireAcc += dt * 1000;

    moveStars(dt);
    movePlayer(dt);

    if (keys.fire && fireAcc >= fireInterval()) {
        fire();
        fireAcc = 0;
    }

    if (spawnAcc >= currentDifficulty.spawnMs) {
        spawnEnemy(pickKind(), 0);
        spawnAcc = 0;
    }

    const elapsed = RUN_SECONDS - timeLeft;
    if (currentDifficulty.panicWaves && elapsed >= nextWaveAt) {
        startPanicWave();
        nextWaveAt += 18;
    }

    updateBullets(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateParticles(dt);
    collide();
    checkWarning();
    updateHud();
}

function moveStars(dt: number): void {
    for (const star of stars) {
        star.y += star.speed * dt;
        if (star.y > CANVAS_HEIGHT) {
            star.y = 0;
            star.x = Math.random() * CANVAS_WIDTH;
        }
    }
}

function movePlayer(dt: number): void {
    const speed = 240;
    if (keys.left) {
        player.x -= speed * dt;
    }
    if (keys.right) {
        player.x += speed * dt;
    }
    if (keys.up) {
        player.y -= speed * dt;
    }
    if (keys.down) {
        player.y += speed * dt;
    }
    player.x = Math.max(4, Math.min(CANVAS_WIDTH - player.w - 4, player.x));
    player.y = Math.max(40, Math.min(CANVAS_HEIGHT - player.h - 8, player.y));
}

function fireInterval(): number {
    return currentDifficulty.fireMs * (hasMod('rapid') ? RAPID_FIRE : 1);
}

function fire(): void {
    const cx = player.x + player.w / 2;
    const y = player.y - 8;
    const shots = hasMod('spread')
        ? [
            { x: cx - 1.5, vx: 0 },
            { x: cx - 7, vx: -95 },
            { x: cx + 4, vx: 95 }
        ]
        : [{ x: cx - 1.5, vx: 0 }];

    for (const shot of shots) {
        bullets.push({
            x: shot.x,
            y,
            w: 3,
            h: 10,
            vy: -420,
            vx: shot.vx
        });
    }
    playSound('shotSound');
}

function pickKind(): EnemyKind {
    const pool = currentDifficulty.pool;
    if (pool.length === 1) {
        return pool[0] ?? 'segfault';
    }

    if (currentDifficulty.panicWaves) {
        const roll = Math.random();
        if (roll < 0.18) {
            return 'healthy';
        }
        if (roll < 0.36) {
            return 'leak';
        }
        if (roll < 0.62) {
            return 'zombie';
        }
        return 'segfault';
    }

    return pool[Math.floor(Math.random() * pool.length)] ?? 'segfault';
}

function spawnEnemy(kind: EnemyKind, assignedWave: number): Enemy {
    const size = kind === 'leak' ? 28 : kind === 'healthy' ? 22 : 20;
    const enemy: Enemy = {
        kind,
        x: 8 + Math.random() * (CANVAS_WIDTH - size - 16),
        y: -size - 4,
        w: size,
        h: size,
        vy: currentDifficulty.speed * (0.85 + Math.random() * 0.4),
        vx: (Math.random() - 0.5) * 30,
        hp: 1,
        waveId: assignedWave,
        warned: false
    };
    enemies.push(enemy);
    return enemy;
}

function startPanicWave(): void {
    waveId += 1;
    const id = waveId;
    const count = 7;
    for (let i = 0; i < count; i++) {
        const kind: EnemyKind = i % 5 === 0 ? 'healthy' : i % 3 === 0 ? 'leak' : i % 2 === 0 ? 'zombie' : 'segfault';
        const enemy = spawnEnemy(kind, id);
        enemy.x = 12 + i * ((CANVAS_WIDTH - 40) / (count - 1));
        enemy.y = -18 - (i % 3) * 22;
        enemy.vy = currentDifficulty.speed * 1.25;
    }
}

function updateBullets(dt: number): void {
    for (const bullet of bullets) {
        bullet.y += bullet.vy * dt;
        bullet.x += bullet.vx * dt;
    }
    bullets = bullets.filter(
        bullet => bullet.y + bullet.h > 0 && bullet.x + bullet.w > 0 && bullet.x < CANVAS_WIDTH
    );
}

function updateEnemies(dt: number): void {
    const speedMul = hasMod('weaker') ? WEAKER_SPEED : 1;
    for (const enemy of enemies) {
        enemy.y += enemy.vy * dt * speedMul;
        enemy.x += enemy.vx * dt * speedMul;
        if (enemy.x < 4 || enemy.x + enemy.w > CANVAS_WIDTH - 4) {
            enemy.vx *= -1;
            enemy.x = Math.max(4, Math.min(CANVAS_WIDTH - enemy.w - 4, enemy.x));
        }

        if (enemy.kind === 'leak' && !enemy.warned && enemy.y > CANVAS_HEIGHT * 0.72) {
            playSound('warningSound');
            enemy.warned = true;
        }
    }

    const remaining: Enemy[] = [];
    for (const enemy of enemies) {
        if (enemy.y <= CANVAS_HEIGHT) {
            remaining.push(enemy);
            continue;
        }
        if (enemy.kind !== 'healthy') {
            hitPlayer();
        }
        maybeClearWave(enemy.waveId);
    }
    enemies = remaining;
}

function updatePickups(dt: number): void {
    const magnetR = 110;
    const scx = player.x + player.w / 2;
    const scy = player.y + player.h / 2;
    for (const pickup of pickups) {
        pickup.y += pickup.vy * dt;
        const pcx = pickup.x + pickup.w / 2;
        const pcy = pickup.y + pickup.h / 2;
        const dx = scx - pcx;
        const dy = scy - pcy;
        const dist = Math.hypot(dx, dy);
        if (dist < magnetR && dist > 1) {
            const pull = (1 - dist / magnetR) * 160;
            pickup.x += (dx / dist) * pull * dt;
            pickup.y += (dy / dist) * pull * dt;
        }
    }
    pickups = pickups.filter(pickup => pickup.y < CANVAS_HEIGHT + pickup.h);
}

function updateParticles(dt: number): void {
    for (const particle of particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
    }
    particles = particles.filter(particle => particle.life > 0);
}

function collide(): void {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (!aabb(bullet, enemy)) {
                continue;
            }
            hit = true;
            bullets.splice(i, 1);
            damageEnemy(enemy, j);
            break;
        }
        if (hit) {
            continue;
        }
    }

    if (invuln <= 0 && !hasMod('shield')) {
        for (const enemy of enemies) {
            if (aabb(player, enemy)) {
                if (enemy.kind === 'healthy') {
                    continue;
                }
                hitPlayer();
                destroyEnemy(enemy, false);
                break;
            }
        }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
        const pickup = pickups[i];
        if (aabb(player, pickup)) {
            pickups.splice(i, 1);
            applyPickup(pickup.kind);
            playSound('slurpSound');
        }
    }
}

function damageEnemy(enemy: Enemy, index: number): void {
    if (enemy.kind === 'healthy') {
        score = Math.max(0, score - HEALTHY_PENALTY);
        playSound('swapSound');
        spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, KIND_COLOR.healthy);
        enemies.splice(index, 1);
        maybeClearWave(enemy.waveId);
        return;
    }

    if (enemy.kind === 'leak') {
        splitLeak(enemy);
        score += threatScore('leak');
        playSound('explodeSound');
        spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, KIND_COLOR.leak);
        enemies.splice(index, 1);
        noteKill();
        maybeClearWave(enemy.waveId);
        maybeDropPickup(enemy);
        return;
    }

    score += threatScore(enemy.kind);
    playSound('explodeSound');
    spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, KIND_COLOR[enemy.kind]);
    enemies.splice(index, 1);
    noteKill();
    maybeClearWave(enemy.waveId);
    maybeDropPickup(enemy);
}

function splitLeak(enemy: Enemy): void {
    const childSize = 16;
    for (const dir of [-1, 1]) {
        enemies.push({
            kind: 'segfault',
            x: Math.max(4, Math.min(CANVAS_WIDTH - childSize - 4, enemy.x + dir * 18)),
            y: enemy.y + 6,
            w: childSize,
            h: childSize,
            vy: enemy.vy * 1.15,
            vx: dir * 55,
            hp: 1,
            waveId: enemy.waveId,
            warned: false
        });
    }
}

function destroyEnemy(enemy: Enemy, award: boolean): void {
    const index = enemies.indexOf(enemy);
    if (index < 0) {
        return;
    }
    if (award && enemy.kind !== 'healthy') {
        score += threatScore(enemy.kind);
        noteKill();
        maybeDropPickup(enemy);
    }
    playSound('explodeSound');
    spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, KIND_COLOR[enemy.kind]);
    enemies.splice(index, 1);
    maybeClearWave(enemy.waveId);
}

function maybeDropPickup(enemy: Enemy): void {
    killsSinceDrop += 1;
    const pity = selectedDifficulty === 'easy' ? 3 : selectedDifficulty === 'medium' ? 4 : 5;
    if (killsSinceDrop < pity && Math.random() > DROP_CHANCE) {
        return;
    }
    killsSinceDrop = 0;
    const kind = POWER_KINDS[Math.floor(Math.random() * POWER_KINDS.length)] ?? 'health';
    pickups.push({
        x: enemy.x + enemy.w / 2 - 9,
        y: enemy.y,
        w: 18,
        h: 18,
        vy: 48,
        kind
    });
}

function applyPickup(kind: PowerKind): void {
    if (kind === 'health') {
        heal(1);
        return;
    }
    activeMods[kind] = POWER_DURATION;
}

function heal(amount: number): void {
    hp = Math.min(maxHp, hp + amount);
}

function hasMod(kind: TimedPowerKind): boolean {
    return (activeMods[kind] ?? 0) > 0;
}

function tickMods(dt: number): void {
    for (const kind of TIMED_POWER_KINDS) {
        const remaining = activeMods[kind];
        if (remaining === undefined) {
            continue;
        }
        const next = remaining - dt;
        if (next <= 0) {
            delete activeMods[kind];
        } else {
            activeMods[kind] = next;
        }
    }
}

function threatScore(kind: EnemyKind): number {
    const base = KIND_SCORE[kind];
    return hasMod('score') ? base * 2 : base;
}

function noteKill(): void {
    const now = RUN_SECONDS - timeLeft;
    if (now - killStreakAt < 0.8) {
        killStreak += 1;
    } else {
        killStreak = 1;
    }
    killStreakAt = now;
    if (killStreak === 3) {
        playSound('comboSound');
        score += 15;
    }
}

function maybeClearWave(id: number): void {
    if (!id) {
        return;
    }
    if (enemies.some(enemy => enemy.waveId === id)) {
        return;
    }
    score += WAVE_BONUS;
    playSound('comboSound');
}

function hitPlayer(): void {
    if (invuln > 0 || !isRunning) {
        return;
    }
    hp -= 1;
    invuln = 1.1;
    playSound('lockSound');
    spawnBurst(player.x + player.w / 2, player.y + player.h / 2, '#4fc1ff');
    if (hp <= 0) {
        hp = 0;
        survived = false;
        endGame();
    }
}

function checkWarning(): void {
    const nearDeath = hp === 1;
    if (nearDeath && !warningLatched) {
        playSound('warningSound');
        warningLatched = true;
    } else if (!nearDeath) {
        warningLatched = false;
    }
}

function aabb(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function spawnBurst(x: number, y: number, color: string): void {
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * (40 + Math.random() * 60),
            vy: Math.sin(angle) * (40 + Math.random() * 60),
            life: 0.28 + Math.random() * 0.18,
            color
        });
    }
}

function togglePause(): void {
    if (!isRunning) {
        return;
    }

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : PAUSE_LABEL;

    window.dispatchEvent(new CustomEvent('gameChrome:pauseStateChanged', {
        detail: { isPaused }
    }));
}

function endGame(): void {
    if (!isRunning) {
        return;
    }

    playSound('crashSound');
    isRunning = false;
    isPaused = false;
    keys.fire = false;
    activeMods = {};
    stopLoop();

    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }

    updateHud();
    sendGameOver(score);
    showGameOverAlert();
    notifyGameStateChanged();

    const title = survived ? 'UPTIME COMPLETE' : 'KERNEL PANIC!';
    alertTitle.textContent = title;
    gameOverTitle.textContent = survived ? 'Uptime Complete' : 'Kernel Panic';

    setTimeout(() => {
        finalScoreElement.textContent = score.toString();
        gameOverElement.classList.add('show');
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        notifyGameStateChanged();
        draw(0);
    }, 2500);
}

function showGameOverAlert(): void {
    alertScore.textContent = `Score: ${score}`;
    gameOverAlert.classList.add('show');
    setTimeout(() => {
        gameOverAlert.classList.remove('show');
    }, 2000);
}

function handleKeyDown(event: KeyboardEvent): void {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
    }

    const key = event.key.toLowerCase();

    if (key === 'p') {
        event.preventDefault();
        togglePause();
        return;
    }

    if (event.key === ' ') {
        keys.fire = true;
        return;
    }

    if (!isRunning || isPaused) {
        return;
    }

    if (event.key === 'ArrowLeft' || key === 'a') {
        keys.left = true;
    }
    if (event.key === 'ArrowRight' || key === 'd') {
        keys.right = true;
    }
    if (event.key === 'ArrowUp' || key === 'w') {
        keys.up = true;
    }
    if (event.key === 'ArrowDown' || key === 's') {
        keys.down = true;
    }
}

function handleKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (event.key === ' ') {
        keys.fire = false;
    }
    if (event.key === 'ArrowLeft' || key === 'a') {
        keys.left = false;
    }
    if (event.key === 'ArrowRight' || key === 'd') {
        keys.right = false;
    }
    if (event.key === 'ArrowUp' || key === 'w') {
        keys.up = false;
    }
    if (event.key === 'ArrowDown' || key === 's') {
        keys.down = false;
    }
}

function updateHud(): void {
    scoreElement.textContent = score.toString();
    highScoreElement.textContent = highScore.toString();
    hpElement.textContent = hp.toString();
    timeElement.textContent = Math.ceil(timeLeft).toString();
}

function draw(_ts: number): void {
    ctx.fillStyle = '#111218';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#d4d4d4';
    for (const star of stars) {
        ctx.globalAlpha = 0.25 + star.size * 0.2;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    for (const enemy of enemies) {
        drawEnemy(enemy);
    }

    ctx.fillStyle = '#4fc1ff';
    for (const bullet of bullets) {
        ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
    }

    for (const pickup of pickups) {
        drawPickup(pickup);
    }

    const blink = invuln > 0 && Math.floor(invuln * 10) % 2 === 0;
    if (!blink) {
        drawShip(player.x, player.y, player.w, player.h);
    }

    for (const particle of particles) {
        ctx.globalAlpha = Math.max(0, particle.life * 3);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, 2, 2);
    }
    ctx.globalAlpha = 1;

    drawModHud();

    if (isPaused && isRunning) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#4fc1ff';
        ctx.font = '16px "Press Start 2P", cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
}

function isThrusting(): boolean {
    return isRunning && !isPaused && (keys.left || keys.right || keys.up || keys.down || keys.fire);
}

function drawPickup(pickup: Pickup): void {
    const color = POWERUP_COLORS[pickup.kind];
    const cx = pickup.x + pickup.w / 2;
    const cy = pickup.y + pickup.h / 2;
    const pulse = 1 + Math.sin(timeLeft * 10) * 0.12;
    const radius = (pickup.w / 2) * pulse;

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#1e1e1e';
    ctx.font = 'bold 9px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(POWERUP_LABELS[pickup.kind], cx, cy + 0.5);
}

function drawModHud(): void {
    const chips: { kind: TimedPowerKind; remaining: number }[] = [];
    for (const kind of TIMED_POWER_KINDS) {
        const remaining = activeMods[kind];
        if (remaining && remaining > 0) {
            chips.push({ kind, remaining });
        }
    }
    if (chips.length === 0) {
        return;
    }

    let x = 8;
    const y = 14;
    ctx.font = 'bold 9px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const chip of chips) {
        const label = `${POWERUP_LABELS[chip.kind]} ${Math.ceil(chip.remaining)}s`;
        const width = ctx.measureText(label).width + 10;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y - 8, width, 16);
        ctx.fillStyle = POWERUP_COLORS[chip.kind];
        ctx.fillText(label, x + 5, y);
        x += width + 6;
    }
}

function drawShip(x: number, y: number, w: number, h: number): void {
    const cx = x + w / 2;
    const by = y + h;
    const thrusting = isThrusting();

    ctx.save();

    if (hasMod('shield')) {
        ctx.strokeStyle = POWERUP_COLORS.shield;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, y + h / 2, 19, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    if (thrusting) {
        const flick = 6 + Math.random() * 5;
        for (const ox of [-6, 6]) {
            ctx.fillStyle = `rgba(126, 231, 255, ${0.55 + Math.random() * 0.45})`;
            ctx.beginPath();
            ctx.moveTo(cx + ox - 3.2, by);
            ctx.lineTo(cx + ox + 3.2, by);
            ctx.lineTo(cx + ox, by + flick);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.beginPath();
            ctx.moveTo(cx + ox - 1.4, by);
            ctx.lineTo(cx + ox + 1.4, by);
            ctx.lineTo(cx + ox, by + flick * 0.55);
            ctx.closePath();
            ctx.fill();
        }
    }

    ctx.fillStyle = '#165a82';
    ctx.beginPath();
    ctx.moveTo(cx - 4, y + 7);
    ctx.lineTo(cx - 21, y + 15);
    ctx.lineTo(cx - 19, y + 21);
    ctx.lineTo(cx - 3, y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 4, y + 7);
    ctx.lineTo(cx + 21, y + 15);
    ctx.lineTo(cx + 19, y + 21);
    ctx.lineTo(cx + 3, y + 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#3aa8e0';
    ctx.beginPath();
    ctx.moveTo(cx - 4, y + 7);
    ctx.lineTo(cx - 21, y + 15);
    ctx.lineTo(cx - 18, y + 15.5);
    ctx.lineTo(cx - 4, y + 9);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 4, y + 7);
    ctx.lineTo(cx + 21, y + 15);
    ctx.lineTo(cx + 18, y + 15.5);
    ctx.lineTo(cx + 4, y + 9);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(cx - 22, y + 14, 6, 3);
    ctx.fillRect(cx + 16, y + 14, 6, 3);
    ctx.fillStyle = '#4fc1ff';
    ctx.fillRect(cx - 21, y + 12, 3, 2);
    ctx.fillRect(cx + 18, y + 12, 3, 2);

    ctx.fillStyle = '#4fc1ff';
    ctx.beginPath();
    ctx.moveTo(cx, y - 5);
    ctx.lineTo(cx + 4.5, y + 3);
    ctx.lineTo(cx + 6, y + 11);
    ctx.lineTo(cx + 5, by - 1);
    ctx.lineTo(cx - 5, by - 1);
    ctx.lineTo(cx - 6, y + 11);
    ctx.lineTo(cx - 4.5, y + 3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#9ee7ff';
    ctx.fillRect(cx - 1.1, y + 1, 2.2, 13);

    ctx.fillStyle = '#0b3a52';
    ctx.fillRect(cx - 8.5, by - 5, 6.5, 5);
    ctx.fillRect(cx + 2, by - 5, 6.5, 5);
    ctx.fillStyle = '#7ee7ff';
    ctx.beginPath();
    ctx.arc(cx - 5.2, by - 1.2, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 5.2, by - 1.2, 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#072433';
    ctx.beginPath();
    ctx.moveTo(cx - 3.6, y + 4);
    ctx.lineTo(cx + 3.6, y + 4);
    ctx.lineTo(cx + 2.6, y + 11);
    ctx.lineTo(cx - 2.6, y + 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d7f7ff';
    ctx.beginPath();
    ctx.moveTo(cx - 2.2, y + 5);
    ctx.lineTo(cx + 2.2, y + 5);
    ctx.lineTo(cx + 1.5, y + 9.5);
    ctx.lineTo(cx - 1.5, y + 9.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawEnemy(enemy: Enemy): void {
    const color = KIND_COLOR[enemy.kind];
    const x = enemy.x;
    const y = enemy.y;
    const w = enemy.w;
    const h = enemy.h;

    if (enemy.kind === 'healthy') {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        ctx.restore();
    } else {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
    }

    ctx.fillStyle = enemy.kind === 'healthy' ? color : '#1e1e1e';
    ctx.font = 'bold 8px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(KIND_LABEL[enemy.kind], x + w / 2, y + h / 2);
}

function sendGameOver(finalScore: number): void {
    try {
        vscode.postMessage({
            command: 'gameOver',
            score: finalScore,
            difficulty: selectedDifficulty
        });
    } catch (error) {
        console.warn('Kernel Panic could not send message:', error);
    }
}

function setupButtons(): void {
    init();
    startBtn?.addEventListener('click', startGame);
    pauseBtn?.addEventListener('click', togglePause);
    restartBtn?.addEventListener('click', startGame);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButtons);
} else {
    setupButtons();
}
