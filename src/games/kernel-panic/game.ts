/**
 * game.ts - Kernel Panic
 *
 * Vertical shmup with craft shop, gold/diamonds, rush alien, and bosses.
 */

import {
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    DIAMOND_CHANCE,
    FIRE_RATE_BONUS_MULT,
    LOOT_DIAMOND_R,
    LOOT_GOLD_R,
    PLAYER_BASE_SPEED
} from './constants';
import { drawCraft } from './characters';
import {
    addCurrency,
    applyEconomy,
    getWallet,
    isUnlocked,
    requestReady,
    selectOwned,
    spend
} from './economy';
import { CHARACTERS, formatCost, formatMods, getCharacter } from './roster';
import {
    createBoss,
    drawBoss,
    nextBossDelay,
    type BossEnemy
} from './boss';
import {
    createRushAlien,
    drawAlienLaser,
    drawRushAlien,
    hitRushAlien,
    rushAlienDone,
    rushEveryFor,
    updateRushAlien,
    type RushAlien
} from './rush';

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

type EnemyKind = 'segfault' | 'zombie' | 'leak' | 'healthy' | 'boss';

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

interface PanicRamp {
    zombieAt: number;
    leakAt: number;
    healthyAt: number;
    wavesAt: number;
    waveEvery: number;
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
    maxHp: number;
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

interface Loot extends Rect {
    vy: number;
    kind: 'gold' | 'diamond';
    amount: number;
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

const HEALTHY_PENALTY = 25;
const WAVE_BONUS = 50;
const PAUSE_LABEL = 'Pause (P)';

const KIND_SCORE: Record<EnemyKind, number> = {
    segfault: 10,
    zombie: 15,
    leak: 20,
    healthy: 0,
    boss: 100
};

const KIND_COLOR: Record<EnemyKind, string> = {
    segfault: '#f48771',
    zombie: '#c586c0',
    leak: '#ce9178',
    healthy: '#4ec9b0',
    boss: '#be5046'
};

const KIND_LABEL: Record<EnemyKind, string> = {
    segfault: 'segv',
    zombie: 'zombie',
    leak: 'leak',
    healthy: 'ok',
    boss: 'BOSS'
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
const previewCanvas = document.getElementById('characterPreview') as HTMLCanvasElement;
const previewCtx = previewCanvas?.getContext('2d') as CanvasRenderingContext2D | null;
const scoreElement = document.getElementById('score') as HTMLElement;
const highScoreElement = document.getElementById('highScore') as HTMLElement;
const goldHud = document.getElementById('goldHud') as HTMLElement;
const diamondHud = document.getElementById('diamondHud') as HTMLElement;
const hpElement = document.getElementById('hp') as HTMLElement;
const threatElement = document.getElementById('threatLevel') as HTMLElement;
const walletGold = document.getElementById('walletGold') as HTMLElement;
const walletDiamonds = document.getElementById('walletDiamonds') as HTMLElement;
const charName = document.getElementById('charName') as HTMLElement;
const charCost = document.getElementById('charCost') as HTMLElement;
const charMods = document.getElementById('charMods') as HTMLElement;
const charLocked = document.getElementById('charLocked') as HTMLElement;
const charActionBtn = document.getElementById('charActionBtn') as HTMLButtonElement;
const charPrevBtn = document.getElementById('charPrevBtn') as HTMLButtonElement;
const charNextBtn = document.getElementById('charNextBtn') as HTMLButtonElement;
const charBackBtn = document.getElementById('charBackBtn') as HTMLButtonElement;
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
const characterSelection = document.getElementById('characterSelection') as HTMLElement;
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

const RAMPS: Record<string, PanicRamp> = {
    easy: { zombieAt: 20, leakAt: 42, healthyAt: 58, wavesAt: 50, waveEvery: 20 },
    medium: { zombieAt: 0, leakAt: 24, healthyAt: 40, wavesAt: 30, waveEvery: 16 },
    hard: { zombieAt: 0, leakAt: 0, healthyAt: 0, wavesAt: 16, waveEvery: 14 }
};

let selectedDifficulty = 'easy';
let currentDifficulty = difficulties.easy!;
let browsingIndex = 0;
let score = 0;
let highScore = 0;
let hp = 3;
let maxHp = 3;
let elapsed = 0;
let isRunning = false;
let isPaused = false;
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
let loot: Loot[] = [];
let particles: Particle[] = [];
let activeMods: Partial<Record<TimedPowerKind, number>> = {};
let inRush = false;
let nextRushAt = 20;
let rushAlien: RushAlien | null = null;
let nextBossAt = 10;
let bossWarningT = 0;
let bossWarningFlashesLeft = 0;
let bossPending = false;
let activeBoss: BossEnemy | null = null;
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

function selectedCraft() {
    return getCharacter(getWallet().selected);
}

function craftMods() {
    return selectedCraft().mods;
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
    setupCharacterSelect();
    loadHighScore();
    updateHud();
    setupEventListeners();
    requestReady();
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

    enterGameBtn?.addEventListener('click', openCharacterSelect);
    backToMenuBtn?.addEventListener('click', backToCharacters);
}

function setupCharacterSelect(): void {
    charPrevBtn?.addEventListener('click', () => cycleCharacter(-1));
    charNextBtn?.addEventListener('click', () => cycleCharacter(1));
    charActionBtn?.addEventListener('click', onCharacterAction);
    charBackBtn?.addEventListener('click', backToDifficulty);
}

function selectDifficulty(difficulty: string): void {
    if (!difficulties[difficulty]) {
        return;
    }

    selectedDifficulty = difficulty;
    currentDifficulty = difficulties[difficulty]!;

    document.querySelectorAll('.difficulty-card').forEach(card => {
        card.classList.remove('active');
    });
    document.getElementById(`${difficulty}Card`)?.classList.add('active');

    loadHighScore();
    updateHud();
}

function openCharacterSelect(): void {
    currentDifficulty = difficulties[selectedDifficulty]!;
    loadHighScore();
    const selectedId = getWallet().selected;
    const index = CHARACTERS.findIndex(character => character.id === selectedId);
    browsingIndex = index >= 0 ? index : 0;

    difficultySelection.style.display = 'none';
    characterSelection.style.display = 'block';
    gamePlay.style.display = 'none';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(currentDifficulty.label);
        gameChrome.refreshToolbarPhase();
    }

    refreshCharacterUi();
    notifyGameStateChanged();
}

function backToDifficulty(): void {
    characterSelection.style.display = 'none';
    difficultySelection.style.display = 'block';
    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge('');
        gameChrome.refreshToolbarPhase();
    }
    notifyGameStateChanged();
}

function enterPlay(): void {
    resetRun(false);
    characterSelection.style.display = 'none';
    gamePlay.style.display = 'block';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(`${currentDifficulty.label} · ${selectedCraft().name}`);
        gameChrome.refreshToolbarPhase();
    }

    draw(0);
    notifyGameStateChanged();
}

function backToCharacters(): void {
    stopLoop();
    isRunning = false;
    isPaused = false;
    keys.fire = false;

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';

    gamePlay.style.display = 'none';
    characterSelection.style.display = 'block';
    refreshCharacterUi();

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(currentDifficulty.label);
        gameChrome.refreshToolbarPhase();
    }
    notifyGameStateChanged();
}

function cycleCharacter(delta: number): void {
    browsingIndex = (browsingIndex + delta + CHARACTERS.length) % CHARACTERS.length;
    refreshCharacterUi();
}

function onCharacterAction(): void {
    const character = CHARACTERS[browsingIndex]!;
    if (isUnlocked(character.id)) {
        selectOwned(character.id);
        enterPlay();
        return;
    }
    if (spend(character.currency, character.cost, character.id)) {
        refreshCharacterUi();
    }
}

function refreshCharacterUi(): void {
    const character = CHARACTERS[browsingIndex]!;
    const owned = isUnlocked(character.id);
    const wallet = getWallet();

    walletGold.textContent = String(wallet.gold);
    walletDiamonds.textContent = String(wallet.diamonds);
    charName.textContent = character.name;
    charCost.textContent = formatCost(character);
    charMods.textContent = formatMods(character);
    charLocked.textContent = owned ? (wallet.selected === character.id ? 'Selected' : 'Owned') : 'Locked';
    charActionBtn.textContent = owned ? 'Select' : `Buy · ${formatCost(character)}`;
    charActionBtn.disabled = !owned && (
        character.currency === 'gold' ? wallet.gold < character.cost : wallet.diamonds < character.cost
    );

    if (previewCtx && previewCanvas) {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        previewCtx.fillStyle = '#1e1e1e';
        previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
        drawCraft(previewCtx, character.id, previewCanvas.width / 2 - 12, previewCanvas.height / 2 - 9, 24, 18, true, false);
    }
}

function loadHighScore(): void {
    highScore = getStoredHighScore(selectedDifficulty);
    highScoreElement.textContent = highScore.toString();
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

    window.addEventListener('message', event => {
        const message = event.data;
        if (message?.command === 'kernelPanicEconomy') {
            applyEconomy(message);
            refreshCharacterUi();
            updateHud();
        }
    });

    window.addEventListener('gameChrome:requestPause', () => {
        if (isRunning && !isPaused) {
            togglePause();
        }
    });

    window.addEventListener('gameChrome:requestResume', () => {
        if (isRunning && isPaused) {
            togglePause();
        }
    });

    window.addEventListener('gameChrome:requestRestart', () => {
        if (gamePlay.style.display === 'block') {
            startGame();
        }
    });
}

function resetRun(playing: boolean): void {
    score = 0;
    const mods = craftMods();
    maxHp = currentDifficulty.hp + mods.hpBonus;
    hp = maxHp;
    elapsed = 0;
    spawnAcc = 0;
    fireAcc = currentDifficulty.fireMs;
    invuln = 0;
    warningLatched = false;
    waveId = 0;
    nextWaveAt = wavesUnlocked() ? 8 : currentRamp().wavesAt;
    killStreak = 0;
    killStreakAt = 0;
    killsSinceDrop = 0;
    enemies = [];
    bullets = [];
    pickups = [];
    loot = [];
    particles = [];
    activeMods = {};
    inRush = false;
    rushAlien = null;
    nextRushAt = rushEveryFor(selectedDifficulty);
    nextBossAt = nextBossDelay();
    bossWarningT = 0;
    bossWarningFlashesLeft = 0;
    bossPending = false;
    activeBoss = null;
    player = { x: 168, y: 430, w: 24, h: 18 };
    isPaused = false;
    isRunning = playing;
    lastTs = 0;
    pauseBtn.textContent = PAUSE_LABEL;
    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    updateHud();
}

function startGame(): void {
    resetRun(true);
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    stopLoop();
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
    if (!lastTs) {
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

function currentRamp(): PanicRamp {
    return RAMPS[selectedDifficulty] ?? RAMPS.easy!;
}

function spawnInterval(): number {
    return Math.max(180, currentDifficulty.spawnMs * (0.28 + 0.72 * Math.exp(-elapsed / 55)));
}

function threatSpeed(): number {
    return currentDifficulty.speed * (1 + Math.min(elapsed / 48, 1.7));
}

function threatLevel(): number {
    return Math.min(9, 1 + Math.floor(elapsed / 12));
}

function unlockedPool(): EnemyKind[] {
    const ramp = currentRamp();
    const pool: EnemyKind[] = ['segfault'];
    if (elapsed >= ramp.zombieAt) {
        pool.push('zombie');
    }
    if (elapsed >= ramp.leakAt) {
        pool.push('leak');
    }
    if (elapsed >= ramp.healthyAt) {
        pool.push('healthy');
    }
    return pool;
}

function wavesUnlocked(): boolean {
    return currentDifficulty.panicWaves || elapsed >= currentRamp().wavesAt;
}

function waveGap(): number {
    return Math.max(10, currentRamp().waveEvery - elapsed / 18);
}

function update(dt: number): void {
    elapsed += dt;
    if (invuln > 0) {
        invuln -= dt;
    }

    spawnAcc += dt * 1000;
    fireAcc += dt * 1000;
    moveStars(dt);
    movePlayer(dt);
    tickMods(dt);
    updateRush(dt);
    updateBossSchedule(dt);

    if (keys.fire && fireAcc >= fireInterval()) {
        fire();
        fireAcc = 0;
    }

    if (!inRush && spawnAcc >= spawnInterval()) {
        spawnAcc = 0;
        spawnEnemy(pickKind(), 0);
    }

    if (wavesUnlocked() && elapsed >= nextWaveAt) {
        startPanicWave();
        nextWaveAt = elapsed + waveGap();
    }

    updateBullets(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateLoot(dt);
    updateParticles(dt);
    collide();
    checkWarning();
    updateHud();
}

function updateRush(dt: number): void {
    if (!inRush && elapsed >= nextRushAt) {
        startRush();
    }

    if (!rushAlien) {
        return;
    }

    updateRushAlien(rushAlien, dt, player.x + player.w / 2);

    if (rushAlienDone(rushAlien)) {
        endRush();
    }
}

function startRush(): void {
    inRush = true;
    rushAlien = createRushAlien(player.x + player.w / 2);
    playSound('warningSound');
}

function endRush(): void {
    inRush = false;
    rushAlien = null;
    nextRushAt = elapsed + rushEveryFor(selectedDifficulty);
    spawnAcc = 0;
}

function updateBossSchedule(dt: number): void {
    if (bossWarningFlashesLeft > 0) {
        bossWarningT += dt;
        const period = 0.35;
        if (bossWarningT >= period) {
            bossWarningT = 0;
            bossWarningFlashesLeft -= 1;
            if (bossWarningFlashesLeft > 0) {
                playSound('warningSound');
            } else if (bossPending) {
                spawnBossNow();
            }
        }
        return;
    }

    if (activeBoss || bossPending) {
        return;
    }

    if (elapsed >= nextBossAt) {
        beginBossWarning();
    }
}

function beginBossWarning(): void {
    bossPending = true;
    bossWarningFlashesLeft = 3;
    bossWarningT = 0;
    playSound('warningSound');
}

function spawnBossNow(): void {
    bossPending = false;
    const boss = createBoss(threatSpeed());
    activeBoss = boss;
    enemies.push({
        kind: 'boss',
        x: boss.x,
        y: boss.y,
        w: boss.w,
        h: boss.h,
        vy: boss.vy,
        vx: boss.vx,
        hp: boss.hp,
        maxHp: boss.maxHp,
        waveId: 0,
        warned: false
    });
}

function hasActiveBoss(): boolean {
    return enemies.some(enemy => enemy.kind === 'boss');
}

function moveStars(dt: number): void {
    const starRush = 1 + Math.min(elapsed / 90, 1.2);
    for (const star of stars) {
        star.y += star.speed * starRush * dt;
        if (star.y > CANVAS_HEIGHT) {
            star.y = 0;
            star.x = Math.random() * CANVAS_WIDTH;
        }
    }
}

function movePlayer(dt: number): void {
    const speed = PLAYER_BASE_SPEED * craftMods().speed;
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
    let interval = currentDifficulty.fireMs;
    if (craftMods().fireRateBonus > 0) {
        interval *= FIRE_RATE_BONUS_MULT;
    }
    if (hasMod('rapid')) {
        interval *= RAPID_FIRE;
    }
    return interval;
}

function fire(): void {
    const cx = player.x + player.w / 2;
    const y = player.y - 8;
    const useSpread = hasMod('spread') || craftMods().spreadShot;
    const shots = useSpread
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
    const pool = unlockedPool();
    const heat = Math.min(elapsed / 80, 1);

    if (pool.includes('healthy') && Math.random() < 0.08 + heat * 0.12) {
        return 'healthy';
    }
    if (pool.includes('leak') && Math.random() < 0.12 + heat * 0.18) {
        return 'leak';
    }
    if (pool.includes('zombie') && Math.random() < 0.28 + heat * 0.15) {
        return 'zombie';
    }
    return 'segfault';
}

function spawnEnemy(kind: EnemyKind, assignedWave: number): Enemy {
    const size = kind === 'leak' ? 28 : kind === 'healthy' ? 22 : 20;
    const enemy: Enemy = {
        kind,
        x: 8 + Math.random() * (CANVAS_WIDTH - size - 16),
        y: -size - 4,
        w: size,
        h: size,
        vy: threatSpeed() * (0.85 + Math.random() * 0.4),
        vx: (Math.random() - 0.5) * (30 + Math.min(elapsed * 0.35, 40)),
        hp: 1,
        maxHp: 1,
        waveId: assignedWave,
        warned: false
    };
    enemies.push(enemy);
    return enemy;
}

function startPanicWave(): void {
    waveId += 1;
    const id = waveId;
    const pool = unlockedPool();
    const count = Math.min(11, 7 + Math.floor(elapsed / 35));
    for (let i = 0; i < count; i++) {
        let kind: EnemyKind = 'segfault';
        if (pool.includes('healthy') && i % 5 === 0) {
            kind = 'healthy';
        } else if (pool.includes('leak') && i % 3 === 0) {
            kind = 'leak';
        } else if (pool.includes('zombie') && i % 2 === 0) {
            kind = 'zombie';
        }
        const enemy = spawnEnemy(kind, id);
        enemy.x = 12 + i * ((CANVAS_WIDTH - 40) / Math.max(1, count - 1));
        enemy.y = -18 - (i % 3) * 22;
        enemy.vy = threatSpeed() * 1.25;
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
    const slow = hasMod('weaker') ? WEAKER_SPEED : 1;
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i]!;
        enemy.y += enemy.vy * slow * dt;
        enemy.x += enemy.vx * slow * dt;
        if (enemy.x < 4 || enemy.x + enemy.w > CANVAS_WIDTH - 4) {
            enemy.vx *= -1;
            enemy.x = Math.max(4, Math.min(CANVAS_WIDTH - enemy.w - 4, enemy.x));
        }

        if (enemy.kind === 'leak' && !enemy.warned && enemy.y > CANVAS_HEIGHT - 90) {
            playSound('warningSound');
            enemy.warned = true;
        }

        if (enemy.y > CANVAS_HEIGHT + 8) {
            if (enemy.kind !== 'healthy') {
                hitPlayer();
            }
            if (enemy.kind === 'boss') {
                activeBoss = null;
                nextBossAt = elapsed + nextBossDelay();
            }
            enemies.splice(i, 1);
            maybeClearWave(enemy.waveId);
        }
    }

    if (activeBoss && !hasActiveBoss()) {
        activeBoss = null;
    }
}

function updatePickups(dt: number): void {
    for (const pickup of pickups) {
        const dx = player.x + player.w / 2 - (pickup.x + pickup.w / 2);
        const dy = player.y + player.h / 2 - (pickup.y + pickup.h / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < 110 && dist > 0.1) {
            pickup.x += (dx / dist) * 140 * dt;
            pickup.y += (dy / dist) * 140 * dt;
        } else {
            pickup.y += pickup.vy * dt;
        }
    }
    pickups = pickups.filter(pickup => pickup.y < CANVAS_HEIGHT + 20);
}

function updateLoot(dt: number): void {
    for (const item of loot) {
        const dx = player.x + player.w / 2 - (item.x + item.w / 2);
        const dy = player.y + player.h / 2 - (item.y + item.h / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < 110 && dist > 0.1) {
            item.x += (dx / dist) * 150 * dt;
            item.y += (dy / dist) * 150 * dt;
        } else {
            item.y += item.vy * dt;
        }
    }
    loot = loot.filter(item => item.y < CANVAS_HEIGHT + 20);
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
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const bullet = bullets[bi]!;
        let hit = false;

        if (rushAlien && !rushAlien.destroyed) {
            for (const laser of rushAlien.lasers) {
                if (!laser.hit && aabb(bullet, laser)) {
                    laser.hit = true;
                    bullets.splice(bi, 1);
                    hit = true;
                    playSound('popSound');
                    break;
                }
            }
            if (hit) {
                continue;
            }
            if (aabb(bullet, rushAlien)) {
                bullets.splice(bi, 1);
                const destroyed = hitRushAlien(rushAlien);
                playSound('explodeSound');
                spawnBurst(rushAlien.x + rushAlien.w / 2, rushAlien.y + rushAlien.h / 2, '#4ec9b0');
                if (destroyed) {
                    dropRushReward(rushAlien.x + rushAlien.w / 2, rushAlien.y + rushAlien.h / 2);
                }
                continue;
            }
        }

        for (let ei = enemies.length - 1; ei >= 0; ei--) {
            const enemy = enemies[ei]!;
            if (aabb(bullet, enemy)) {
                bullets.splice(bi, 1);
                damageEnemy(enemy, ei);
                hit = true;
                break;
            }
        }
        if (hit) {
            continue;
        }
    }

    if (rushAlien) {
        for (const laser of rushAlien.lasers) {
            if (!laser.hit && aabb(player, laser)) {
                laser.hit = true;
                if (!hasMod('shield')) {
                    hitPlayer();
                }
            }
        }
    }

    if (invuln <= 0 && !hasMod('shield')) {
        for (const enemy of enemies) {
            if (enemy.kind === 'healthy') {
                continue;
            }
            if (aabb(player, enemy)) {
                hitPlayer();
                break;
            }
        }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
        const pickup = pickups[i]!;
        if (aabb(player, pickup)) {
            applyPickup(pickup.kind);
            playSound('slurpSound');
            pickups.splice(i, 1);
        }
    }

    for (let i = loot.length - 1; i >= 0; i--) {
        const item = loot[i]!;
        if (aabb(player, item)) {
            addCurrency(item.kind === 'gold' ? 'gold' : 'diamonds', item.amount);
            playSound('popSound');
            loot.splice(i, 1);
            updateHud();
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

    if (enemy.kind === 'boss') {
        enemy.hp -= 1;
        playSound('explodeSound');
        spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, KIND_COLOR.boss);
        if (enemy.hp > 0) {
            return;
        }
        score += threatScore('boss');
        noteKill();
        dropCurrencyLoot(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 6, 3);
        maybeDropPickup(enemy);
        enemies.splice(index, 1);
        activeBoss = null;
        nextBossAt = elapsed + nextBossDelay();
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
        dropKillLoot(enemy);
        maybeDropPickup(enemy);
        return;
    }

    score += threatScore(enemy.kind);
    playSound('explodeSound');
    spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, KIND_COLOR[enemy.kind]);
    enemies.splice(index, 1);
    noteKill();
    maybeClearWave(enemy.waveId);
    dropKillLoot(enemy);
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
            maxHp: 1,
            waveId: enemy.waveId,
            warned: false
        });
    }
}

function dropKillLoot(enemy: Enemy): void {
    spawnLoot(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 'gold', 1);
    const chance = DIAMOND_CHANCE[selectedDifficulty] ?? 0.1;
    if (Math.random() < chance) {
        spawnLoot(enemy.x + enemy.w / 2 + 10, enemy.y + enemy.h / 2 - 6, 'diamond', 1);
    }
}

function dropRushReward(x: number, y: number): void {
    if (Math.random() < 0.5) {
        spawnLoot(x, y, 'diamond', 1);
    } else {
        spawnLoot(x - 10, y, 'gold', 3);
    }
}

function dropCurrencyLoot(x: number, y: number, goldAmount: number, diamondAmount: number): void {
    spawnLoot(x - 12, y, 'gold', goldAmount);
    spawnLoot(x + 12, y - 8, 'diamond', diamondAmount);
}

function spawnLoot(x: number, y: number, kind: 'gold' | 'diamond', amount: number): void {
    const r = kind === 'gold' ? LOOT_GOLD_R : LOOT_DIAMOND_R;
    loot.push({
        x: x - r,
        y: y - r,
        w: r * 2,
        h: r * 2,
        vy: 55,
        kind,
        amount
    });
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
        const left = activeMods[kind];
        if (left === undefined) {
            continue;
        }
        const next = left - dt;
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
    const now = elapsed;
    if (now - killStreakAt < 0.8) {
        killStreak += 1;
    } else {
        killStreak = 1;
    }
    killStreakAt = now;
    if (killStreak >= 3) {
        killStreak = 0;
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

    alertTitle.textContent = 'KERNEL PANIC!';
    gameOverTitle.textContent = 'Kernel Panic';

    setTimeout(() => {
        finalScoreElement.textContent = score.toString();
        gameOverElement.classList.add('show');
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
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
    if (characterSelection.style.display === 'block') {
        return;
    }
    if (event.code === 'KeyP') {
        event.preventDefault();
        togglePause();
        return;
    }
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        keys.left = true;
    }
    if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        keys.right = true;
    }
    if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        keys.up = true;
    }
    if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        keys.down = true;
    }
    if (event.code === 'Space') {
        event.preventDefault();
        keys.fire = true;
    }
}

function handleKeyUp(event: KeyboardEvent): void {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        keys.left = false;
    }
    if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        keys.right = false;
    }
    if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        keys.up = false;
    }
    if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        keys.down = false;
    }
    if (event.code === 'Space') {
        keys.fire = false;
    }
}

function updateHud(): void {
    const wallet = getWallet();
    scoreElement.textContent = score.toString();
    highScoreElement.textContent = highScore.toString();
    if (goldHud) {
        goldHud.textContent = String(wallet.gold);
    }
    if (diamondHud) {
        diamondHud.textContent = String(wallet.diamonds);
    }
    hpElement.textContent = hp.toString();
    threatElement.textContent = threatLevel().toString();
}

function isThrusting(): boolean {
    return isRunning && !isPaused && (keys.left || keys.right || keys.up || keys.down || keys.fire);
}

function draw(_ts: number): void {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (const star of stars) {
        ctx.fillStyle = star.size > 1 ? '#9cdcfe' : '#569cd6';
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    const flashAlpha = bossWarningFlashesLeft > 0
        ? 0.22 + 0.18 * Math.sin((bossWarningT / 0.35) * Math.PI)
        : 0;
    if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(244, 135, 113, ${flashAlpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    for (const pickup of pickups) {
        drawPickup(pickup);
    }
    for (const item of loot) {
        drawLoot(item);
    }
    for (const enemy of enemies) {
        if (enemy.kind === 'boss') {
            drawBoss(ctx, enemy as BossEnemy);
        } else {
            drawEnemy(enemy);
        }
    }

    if (rushAlien) {
        drawRushAlien(ctx, rushAlien);
        for (const laser of rushAlien.lasers) {
            if (!laser.hit) {
                drawAlienLaser(ctx, laser);
            }
        }
    }

    for (const bullet of bullets) {
        ctx.fillStyle = '#7ee7ff';
        ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
    }

    for (const particle of particles) {
        ctx.globalAlpha = Math.max(0, particle.life * 3);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, 2, 2);
        ctx.globalAlpha = 1;
    }

    if (invuln <= 0 || Math.floor(invuln * 12) % 2 === 0) {
        drawCraft(ctx, getWallet().selected, player.x, player.y, player.w, player.h, isThrusting(), hasMod('shield'));
    }

    drawModHud();

    if (inRush) {
        ctx.fillStyle = 'rgba(244, 135, 113, 0.85)';
        ctx.font = 'bold 12px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('RUSH HOUR', CANVAS_WIDTH / 2, 18);
    }

    if (isPaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#d4d4d4';
        ctx.font = 'bold 20px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
}

function drawLoot(item: Loot): void {
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    if (item.kind === 'gold') {
        ctx.fillStyle = '#dcdcaa';
        ctx.beginPath();
        ctx.arc(cx, cy, item.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e1e1e';
        ctx.font = 'bold 8px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.amount > 1 ? String(item.amount) : 'G', cx, cy);
    } else {
        ctx.fillStyle = '#e06c75';
        ctx.beginPath();
        ctx.moveTo(cx, cy - item.h / 2);
        ctx.lineTo(cx + item.w / 2, cy);
        ctx.lineTo(cx, cy + item.h / 2);
        ctx.lineTo(cx - item.w / 2, cy);
        ctx.closePath();
        ctx.fill();
        if (item.amount > 1) {
            ctx.fillStyle = '#1e1e1e';
            ctx.font = 'bold 8px Orbitron, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(item.amount), cx, cy);
        }
    }
}

function drawPickup(pickup: Pickup): void {
    ctx.fillStyle = POWERUP_COLORS[pickup.kind];
    ctx.fillRect(pickup.x, pickup.y, pickup.w, pickup.h);
    ctx.fillStyle = '#1e1e1e';
    ctx.font = 'bold 9px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(POWERUP_LABELS[pickup.kind], pickup.x + pickup.w / 2, pickup.y + pickup.h / 2);
}

function drawModHud(): void {
    let x = 8;
    const y = 14;
    for (const kind of TIMED_POWER_KINDS) {
        const left = activeMods[kind];
        if (!left) {
            continue;
        }
        const label = `${POWERUP_LABELS[kind]} ${Math.ceil(left)}`;
        const width = 36;
        ctx.fillStyle = 'rgba(30, 30, 30, 0.75)';
        ctx.fillRect(x, y - 8, width, 16);
        ctx.fillStyle = POWERUP_COLORS[kind];
        ctx.font = 'bold 9px Orbitron, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + 5, y);
        x += width + 6;
    }
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
