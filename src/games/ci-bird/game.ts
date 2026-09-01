/**
 * game.ts - CI Bird
 *
 * One-button flyer with a character shop, collectibles, rush hour, and bug bots.
 */

import {
    botIsAttacking,
    botLaser,
    botOffscreen,
    BOT_SHOT_WINDOW,
    createBugBot,
    drawBugBot,
    drawRushBanner,
    updateBugBot,
    type BugBot
} from './bug-bot';
import { drawBird } from './characters';
import {
    BIRD_H,
    BIRD_W,
    BIRD_X,
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    COIN_RADIUS,
    DIAMOND_RADIUS,
    GATE_LABELS,
    INVULN_TIME,
    PAUSE_LABEL,
    PIPE_MARGIN,
    PIPE_WIDTH
} from './constants';
import {
    addCurrency,
    applyEconomy,
    getWallet,
    isUnlocked,
    persistNow,
    requestReady,
    selectOwned,
    spend
} from './economy';
import { formatCost, formatMods, getCharacter, CHARACTERS, type CharacterId } from './roster';
import {
    bugBotCount,
    buildFormation,
    FORMATION_ENTRY_X,
    FORMATION_SPACING,
    formationOriginY,
    pickFormation,
    rushDuration,
    rushInterval,
    type Collectible
} from './rush';

declare const vscode: {
    postMessage(message: Record<string, unknown>): void;
};

declare const soundManager: {
    playById(id: string): void;
    preloadAll(): void;
};

declare const initGameChrome: () => void;

declare const gameChrome: {
    setDifficultyBadge(label: string): void;
    refreshToolbarPhase(): void;
};

interface BirdDifficulty {
    name: string;
    label: string;
    gravity: number;
    flapImpulse: number;
    maxFall: number;
    scroll: number;
    gap: number;
    minGap: number;
    spacing: number;
    rushEvery: number;
    diamondChance: number;
}

interface Pipe {
    x: number;
    gapY: number;
    gapH: number;
    label: string;
    scored: boolean;
}

interface LineMark {
    x: number;
    n: number;
}

const difficulties: Record<string, BirdDifficulty> = {
    easy: {
        name: 'Easy',
        label: 'Easy',
        gravity: 980,
        flapImpulse: -310,
        maxFall: 420,
        scroll: 118,
        gap: 168,
        minGap: 124,
        spacing: 230,
        rushEvery: 20,
        diamondChance: 0.035
    },
    medium: {
        name: 'Medium',
        label: 'Medium',
        gravity: 1100,
        flapImpulse: -330,
        maxFall: 460,
        scroll: 148,
        gap: 146,
        minGap: 118,
        spacing: 210,
        rushEvery: 15,
        diamondChance: 0.05
    },
    hard: {
        name: 'Hard',
        label: 'Hard',
        gravity: 1280,
        flapImpulse: -350,
        maxFall: 520,
        scroll: 188,
        gap: 118,
        minGap: 108,
        spacing: 192,
        rushEvery: 10,
        diamondChance: 0.12
    }
};

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const previewCanvas = document.getElementById('characterPreview') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const previewCtx = previewCanvas?.getContext('2d') as CanvasRenderingContext2D | null;
const scoreElement = document.getElementById('score') as HTMLElement;
const highScoreElement = document.getElementById('highScore') as HTMLElement;
const goldHud = document.getElementById('goldHud') as HTMLElement;
const diamondHud = document.getElementById('diamondHud') as HTMLElement;
const livesHud = document.getElementById('livesHud') as HTMLElement;
const gameOverElement = document.getElementById('gameOver') as HTMLElement;
const finalScoreElement = document.getElementById('finalScore') as HTMLElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
const restartBtn = document.getElementById('restartBtn') as HTMLButtonElement;
const gameOverAlert = document.getElementById('gameOverAlert') as HTMLElement;
const alertScore = document.getElementById('alertScore') as HTMLElement;
const difficultySelection = document.getElementById('difficultySelection') as HTMLElement;
const characterSelection = document.getElementById('characterSelection') as HTMLElement;
const gamePlay = document.getElementById('gamePlay') as HTMLElement;
const enterGameBtn = document.getElementById('enterGameBtn') as HTMLButtonElement;
const backToMenuBtn = document.getElementById('backToMenuBtn') as HTMLButtonElement;
const charBackBtn = document.getElementById('charBackBtn') as HTMLButtonElement;
const charPrevBtn = document.getElementById('charPrevBtn') as HTMLButtonElement;
const charNextBtn = document.getElementById('charNextBtn') as HTMLButtonElement;
const charActionBtn = document.getElementById('charActionBtn') as HTMLButtonElement;
const charNameEl = document.getElementById('charName') as HTMLElement;
const charCostEl = document.getElementById('charCost') as HTMLElement;
const charModsEl = document.getElementById('charMods') as HTMLElement;
const walletGoldEl = document.getElementById('walletGold') as HTMLElement;
const walletDiamondsEl = document.getElementById('walletDiamonds') as HTMLElement;
const charLockedEl = document.getElementById('charLocked') as HTMLElement;

let selectedDifficulty = 'easy';
let currentDifficulty = difficulties.easy;
let score = 0;
let highScore = 0;
let isRunning = false;
let isPaused = false;
let lastTs = 0;
let rafId = 0;
let birdY = CANVAS_HEIGHT / 2;
let birdVy = 0;
let pipes: Pipe[] = [];
let nextLabelIndex = 0;
let lineMarks: LineMark[] = [];
let elapsed = 0;
let collectibles: Collectible[] = [];
let lives = 1;
let invuln = 0;
let browsingIndex = 0;
let inRush = false;
let rushT = 0;
let rushLeft = 0;
let nextRushAt = 20;
let pendingBots = 0;
let botCooldown = 0;
let warningLatched = false;
let formationCooldown = 0;
let bots: BugBot[] = [];
let runGold = 0;
let runDiamonds = 0;

function playSound(id: string): void {
    if (typeof soundManager !== 'undefined') {
        soundManager.playById(id);
    }
}

function selectedBird() {
    return getCharacter(getWallet().selected);
}

function mods() {
    return selectedBird().mods;
}

function gravity(): number {
    return currentDifficulty.gravity * (1 - mods().gravityReduce);
}

function flapImpulse(): number {
    return currentDifficulty.flapImpulse * (1 + mods().aerial);
}

function progressT(): number {
    return Math.min(1, elapsed / 90);
}

function worldScroll(): number {
    const t = progressT();
    const ramp = selectedDifficulty === 'hard' ? 0.22 * t : 0.55 * t;
    return currentDifficulty.scroll * (1 + ramp) * mods().speed;
}

function currentGap(): number {
    const t = selectedDifficulty === 'hard' ? progressT() * 0.35 : progressT();
    return currentDifficulty.gap + (currentDifficulty.minGap - currentDifficulty.gap) * t;
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
    if (previewCanvas) {
        previewCanvas.width = 220;
        previewCanvas.height = 160;
    }

    migrateHighScores();
    setupDifficultySelection();
    setupCharacterSelect();
    loadHighScore();
    updateHud();
    setupEventListeners();
    seedLineMarks();
    requestReady();
    refreshCharacterUi();
    draw(0);
}

function migrateHighScores(): void {
    if (localStorage.getItem('ciBirdScoreMigratedV2')) {
        return;
    }
    const oldHard = localStorage.getItem('ciBirdHighScore_hard');
    const oldVeryHard = localStorage.getItem('ciBirdHighScore_veryHard');
    if (oldHard && !localStorage.getItem('ciBirdHighScore_medium')) {
        localStorage.setItem('ciBirdHighScore_medium', oldHard);
    }
    if (oldVeryHard) {
        localStorage.setItem('ciBirdHighScore_hard', oldVeryHard);
    }
    localStorage.setItem('ciBirdScoreMigratedV2', '1');
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
    charBackBtn?.addEventListener('click', backToDifficulty);
}

function setupCharacterSelect(): void {
    charPrevBtn?.addEventListener('click', () => cycleCharacter(-1));
    charNextBtn?.addEventListener('click', () => cycleCharacter(1));
    charActionBtn?.addEventListener('click', onCharacterAction);
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
    updateHud();
}

function openCharacterSelect(): void {
    currentDifficulty = difficulties[selectedDifficulty];
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
        gameChrome.setDifficultyBadge(`${currentDifficulty.label} · ${selectedBird().name}`);
        gameChrome.refreshToolbarPhase();
    }

    draw(0);
    notifyGameStateChanged();
}

function backToCharacters(): void {
    stopLoop();
    isRunning = false;
    isPaused = false;

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';

    gamePlay.style.display = 'none';
    characterSelection.style.display = 'block';
    refreshCharacterUi();
    notifyGameStateChanged();
}

function browsingCharacter() {
    return CHARACTERS[browsingIndex] ?? CHARACTERS[0];
}

function cycleCharacter(delta: number): void {
    browsingIndex = (browsingIndex + delta + CHARACTERS.length) % CHARACTERS.length;
    refreshCharacterUi();
}

function onCharacterAction(): void {
    const character = browsingCharacter();
    if (isUnlocked(character.id)) {
        selectOwned(character.id);
        refreshCharacterUi();
        enterPlay();
        return;
    }

    const paid = spend(character.currency, character.cost, character.id);
    if (!paid) {
        charLockedEl.textContent = `Need ${formatCost(character)}.`;
        return;
    }
    playSound('comboSound');
    refreshCharacterUi();
}

function refreshCharacterUi(): void {
    const character = browsingCharacter();
    const wallet = getWallet();
    const owned = isUnlocked(character.id);
    charNameEl.textContent = character.name;
    charCostEl.textContent = owned ? 'Owned' : formatCost(character);
    charModsEl.textContent = formatMods(character);
    walletGoldEl.textContent = String(wallet.gold);
    walletDiamondsEl.textContent = String(wallet.diamonds);
    charActionBtn.textContent = owned ? 'Select' : `Buy · ${formatCost(character)}`;
    charActionBtn.disabled = !owned && (
        character.currency === 'gold'
            ? wallet.gold < character.cost
            : wallet.diamonds < character.cost
    );
    charLockedEl.textContent = owned
        ? (wallet.selected === character.id ? 'Selected' : '')
        : character.kind === 'exotic' ? 'Exotic' : 'Locked';

    drawPreview();
    updateHud();
}

function drawPreview(): void {
    if (!previewCtx || !previewCanvas) {
        return;
    }
    previewCtx.fillStyle = '#1e1e1e';
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    drawBird(previewCtx, browsingCharacter().id, previewCanvas.width / 2, previewCanvas.height / 2, -40, 2.2);
}

function loadHighScore(): void {
    const saved = localStorage.getItem(`ciBirdHighScore_${selectedDifficulty}`);
    highScore = saved ? parseInt(saved, 10) : 0;
    refreshDifficultyBestScores();
}

function saveHighScore(): void {
    localStorage.setItem(`ciBirdHighScore_${selectedDifficulty}`, highScore.toString());
    refreshDifficultyBestScores();
}

function getStoredHighScore(difficulty: string): number {
    const saved = localStorage.getItem(`ciBirdHighScore_${difficulty}`);
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

    canvas.addEventListener('mousedown', event => {
        event.preventDefault();
        flapFromInput();
    });

    canvas.addEventListener('touchstart', event => {
        event.preventDefault();
        flapFromInput();
    }, { passive: false });

    window.addEventListener('message', event => {
        const message = event.data;
        if (message?.command === 'ciBirdEconomy') {
            applyEconomy(message);
            const selectedId = getWallet().selected;
            const index = CHARACTERS.findIndex(character => character.id === selectedId);
            if (index >= 0) {
                browsingIndex = index;
            }
            refreshCharacterUi();
        }
    });

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

function seedLineMarks(): void {
    lineMarks = [];
    for (let i = 0; i < 12; i++) {
        lineMarks.push({
            x: (i * 42) % CANVAS_WIDTH,
            n: 10 + i * 7
        });
    }
}

function resetRun(playing: boolean): void {
    currentDifficulty = difficulties[selectedDifficulty];
    score = 0;
    runGold = 0;
    runDiamonds = 0;
    birdY = CANVAS_HEIGHT / 2;
    birdVy = 0;
    pipes = [];
    collectibles = [];
    bots = [];
    nextLabelIndex = 0;
    elapsed = 0;
    lives = 1 + mods().resurrection;
    invuln = 0;
    inRush = false;
    rushT = 0;
    rushLeft = 0;
    nextRushAt = currentDifficulty.rushEvery;
    pendingBots = 0;
    botCooldown = 0;
    warningLatched = false;
    formationCooldown = 0;
    isPaused = false;
    isRunning = playing;
    updateHud();
}

function startGame(): void {
    playSound('popSound');
    stopLoop();
    resetRun(true);
    spawnPipe(CANVAS_WIDTH + 40);

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

function nextLabel(): string {
    const label = GATE_LABELS[nextLabelIndex % GATE_LABELS.length];
    nextLabelIndex += 1;
    return label;
}

function spawnPipe(x: number): void {
    const gapH = currentGap();
    const minY = PIPE_MARGIN;
    const maxY = CANVAS_HEIGHT - PIPE_MARGIN - gapH;
    const gapY = minY + Math.random() * Math.max(1, maxY - minY);

    pipes.push({
        x,
        gapY,
        gapH,
        label: nextLabel(),
        scored: false
    });

    spawnPipeLoot(x + PIPE_WIDTH / 2, gapY, gapH);
}

function spawnPipeLoot(x: number, gapY: number, gapH: number): void {
    const goldCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < goldCount; i++) {
        collectibles.push({
            x: x + (Math.random() - 0.5) * 18,
            y: gapY + 16 + Math.random() * Math.max(8, gapH - 32),
            kind: 'gold',
            r: COIN_RADIUS,
            taken: false
        });
    }
    if (Math.random() < currentDifficulty.diamondChance) {
        collectibles.push({
            x,
            y: gapY + gapH / 2,
            kind: 'diamond',
            r: DIAMOND_RADIUS,
            taken: false
        });
    }
}

function birdHitbox(): { x: number; y: number; w: number; h: number } {
    return {
        x: BIRD_X - BIRD_W / 2 + 2,
        y: birdY - BIRD_H / 2 + 2,
        w: BIRD_W - 4,
        h: BIRD_H - 4
    };
}

function update(dt: number): void {
    elapsed += dt;
    invuln = Math.max(0, invuln - dt);
    birdVy = Math.min(currentDifficulty.maxFall, birdVy + gravity() * dt);
    birdY += birdVy * dt;

    const hit = birdHitbox();
    if (hit.y < 0 || hit.y + hit.h > CANVAS_HEIGHT) {
        onHit();
        return;
    }

    const scroll = worldScroll();
    updateRush(dt, scroll);

    if (!inRush) {
        for (const pipe of pipes) {
            pipe.x -= scroll * dt;
        }

        while (pipes.length > 0 && pipes[0].x + PIPE_WIDTH < -20) {
            pipes.shift();
        }

        const last = pipes[pipes.length - 1];
        if (!last || last.x < CANVAS_WIDTH - currentDifficulty.spacing) {
            spawnPipe(CANVAS_WIDTH + PIPE_WIDTH);
        }

        for (const pipe of pipes) {
            if (!pipe.scored && pipe.x + PIPE_WIDTH < BIRD_X) {
                pipe.scored = true;
                score += 1;
                updateHud();
            }

            if (invuln > 0) {
                continue;
            }

            const inX = hit.x + hit.w > pipe.x && hit.x < pipe.x + PIPE_WIDTH;
            if (!inX) {
                continue;
            }

            const inGap = hit.y >= pipe.gapY && hit.y + hit.h <= pipe.gapY + pipe.gapH;
            if (!inGap) {
                onHit();
                return;
            }
        }
    }

    for (const item of collectibles) {
        if (item.taken) {
            continue;
        }
        item.x -= scroll * dt;
        const dx = item.x - BIRD_X;
        const dy = item.y - birdY;
        if (dx * dx + dy * dy <= (item.r + 10) * (item.r + 10)) {
            item.taken = true;
            collectItem(item.kind);
        }
    }
    collectibles = collectibles.filter(item => !item.taken && item.x > -24);

    if (updateBots(dt, hit)) {
        return;
    }

    for (const mark of lineMarks) {
        mark.x -= scroll * 0.35 * dt;
        if (mark.x < -24) {
            mark.x += CANVAS_WIDTH + 48;
            mark.n += 12;
        }
    }

    updateHud();
}

function collectItem(kind: 'gold' | 'diamond'): void {
    playSound('slurpSound');
    if (kind === 'gold') {
        runGold += 1;
        addCurrency('gold', 1);
    } else {
        runDiamonds += 1;
        addCurrency('diamonds', 1);
    }
}

function updateRush(dt: number, scroll: number): void {
    if (inRush) {
        rushLeft -= dt;
        rushT += dt;
        maybeSpawnFormations(dt, scroll);
        maybeSpawnBots(dt);
        if (rushLeft <= 0) {
            pendingBots = 0;
            warningLatched = false;
            if (!bots.some(botIsAttacking)) {
                endRush();
            }
        }
        return;
    }

    if (elapsed >= nextRushAt) {
        startRush();
    }
}

function startRush(): void {
    inRush = true;
    rushT = 0;
    rushLeft = rushDuration(elapsed);
    pipes = [];
    warningLatched = false;
    pendingBots = bugBotCount(elapsed);
    botCooldown = 0;
    formationCooldown = 0.9;
    spawnRushFormation();
}

function spawnRushFormation(): void {
    const diamond = Math.random() < currentDifficulty.diamondChance * 2.2;
    collectibles.push(
        ...buildFormation(pickFormation(), diamond, FORMATION_ENTRY_X, formationOriginY())
    );
}

function maybeSpawnFormations(dt: number, scroll: number): void {
    if (rushLeft <= 0.9) {
        return;
    }

    formationCooldown -= dt;
    if (formationCooldown > 0) {
        return;
    }

    const rightmost = collectibles.reduce((max, item) => {
        return item.taken ? max : Math.max(max, item.x);
    }, -Infinity);

    if (Number.isFinite(rightmost) && rightmost > FORMATION_ENTRY_X - FORMATION_SPACING) {
        return;
    }

    spawnRushFormation();
    formationCooldown = FORMATION_SPACING / Math.max(90, scroll);
}

function endRush(): void {
    inRush = false;
    pendingBots = 0;
    warningLatched = false;
    nextRushAt = elapsed + rushInterval(currentDifficulty.rushEvery, elapsed);
    spawnPipe(CANVAS_WIDTH + 40);
}

function maybeSpawnBots(dt: number): void {
    if (pendingBots <= 0 || rushT < 1.4 || rushLeft <= 0) {
        return;
    }
    if (rushLeft < BOT_SHOT_WINDOW + 0.4) {
        return;
    }
    botCooldown -= dt;
    const lastBot = bots[bots.length - 1];
    if (lastBot && !botOffscreen(lastBot)) {
        return;
    }
    if (botCooldown > 0) {
        return;
    }
    if (!warningLatched) {
        playSound('warningSound');
        warningLatched = true;
        botCooldown = 0.4;
        return;
    }
    bots.push(createBugBot(birdY));
    pendingBots -= 1;
    warningLatched = false;
    botCooldown = 0.55;
}

function updateBots(dt: number, hit: { x: number; y: number; w: number; h: number }): boolean {
    for (const bot of bots) {
        const wasLaser = bot.laserActive;
        updateBugBot(bot, dt, birdY);
        if (!wasLaser && bot.laserActive) {
            playSound('shotSound');
        }
        const laser = botLaser(bot);
        if (laser && invuln <= 0 && !bot.hit) {
            const inY = hit.y < laser.y + 5 && hit.y + hit.h > laser.y - 5;
            const inX = hit.x < laser.x1;
            if (inY && inX) {
                bot.hit = true;
                playSound('explodeSound');
                onHit();
                return true;
            }
        }
    }
    bots = bots.filter(bot => !botOffscreen(bot));
    return false;
}

function onHit(): void {
    if (invuln > 0) {
        return;
    }
    if (lives > 1) {
        lives -= 1;
        invuln = INVULN_TIME;
        birdY = Math.max(48, Math.min(CANVAS_HEIGHT - 48, birdY));
        birdVy = flapImpulse() * 0.55;
        playSound('lockSound');
        updateHud();
        return;
    }
    endGame();
}

function flapFromInput(): void {
    if (!isRunning || isPaused) {
        return;
    }
    flap();
}

function flap(): void {
    birdVy = flapImpulse();
    playSound('popSound');
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
    persistNow();
    stopLoop();

    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }

    updateHud();
    sendGameOver(score);
    showGameOverAlert();
    notifyGameStateChanged();

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
    alertScore.textContent = `Checks: ${score} · Gold +${runGold} · ♦ +${runDiamonds}`;
    gameOverAlert.classList.add('show');
    setTimeout(() => {
        gameOverAlert.classList.remove('show');
    }, 2000);
}

function onCharacterScreen(): boolean {
    return characterSelection.style.display === 'block';
}

function handleKeyDown(event: KeyboardEvent): void {
    if (onCharacterScreen()) {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            cycleCharacter(-1);
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            cycleCharacter(1);
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            onCharacterAction();
        }
        return;
    }

    if (event.key === ' ') {
        event.preventDefault();
        flapFromInput();
        return;
    }

    if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        togglePause();
    }
}

function updateHud(): void {
    const wallet = getWallet();
    scoreElement.textContent = score.toString();
    highScoreElement.textContent = highScore.toString();
    goldHud.textContent = `${runGold} / ${wallet.gold}`;
    diamondHud.textContent = `${runDiamonds} / ${wallet.diamonds}`;
    livesHud.textContent = String(Math.max(0, lives));
}

function draw(ts: number): void {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawBackdrop();
    if (!inRush) {
        for (const pipe of pipes) {
            drawPipe(pipe);
        }
    }

    for (const item of collectibles) {
        drawCollectible(item);
    }

    for (const bot of bots) {
        drawBugBot(ctx, bot);
    }

    const drawY = isRunning
        ? birdY
        : CANVAS_HEIGHT / 2 + Math.sin((ts || 0) / 420) * 8;
    if (invuln <= 0 || Math.floor(invuln * 10) % 2 === 0) {
        drawBird(ctx, selectedBird().id as CharacterId, BIRD_X, drawY, isRunning ? birdVy : -40);
    }

    if (inRush) {
        drawRushBanner(ctx, Math.max(0, rushLeft));
    }

    if (isPaused && isRunning) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#4ec9b0';
        ctx.font = '16px "Press Start 2P", cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
}

function drawCollectible(item: Collectible): void {
    if (item.kind === 'gold') {
        ctx.fillStyle = '#dcdcaa';
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b8954a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        return;
    }

    ctx.fillStyle = '#f48771';
    ctx.beginPath();
    ctx.moveTo(item.x, item.y - item.r);
    ctx.lineTo(item.x + item.r * 0.7, item.y);
    ctx.lineTo(item.x, item.y + item.r);
    ctx.lineTo(item.x - item.r * 0.7, item.y);
    ctx.closePath();
    ctx.fill();
}

function drawBackdrop(): void {
    ctx.fillStyle = '#252526';
    ctx.fillRect(0, 0, 28, CANVAS_HEIGHT);

    ctx.fillStyle = '#3e3e42';
    ctx.fillRect(28, 0, 1, CANVAS_HEIGHT);

    ctx.fillStyle = '#6a6a6a';
    ctx.font = '9px Orbitron, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let row = 0; row < 16; row++) {
        const y = 18 + row * 30;
        ctx.fillText(String(row + 1).padStart(2, '0'), 24, y);
    }

    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (const mark of lineMarks) {
        ctx.beginPath();
        ctx.moveTo(mark.x, 0);
        ctx.lineTo(mark.x, CANVAS_HEIGHT);
        ctx.stroke();
    }
}

function drawPipe(pipe: Pipe): void {
    const topH = pipe.gapY;
    const bottomY = pipe.gapY + pipe.gapH;
    const bottomH = CANVAS_HEIGHT - bottomY;

    ctx.fillStyle = '#f48771';
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topH);
    ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, bottomH);

    ctx.fillStyle = '#d16969';
    ctx.fillRect(pipe.x, topH - 10, PIPE_WIDTH, 10);
    ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, 10);

    ctx.fillStyle = '#4ec9b0';
    ctx.fillRect(pipe.x, pipe.gapY, PIPE_WIDTH, 3);
    ctx.fillRect(pipe.x, bottomY - 3, PIPE_WIDTH, 3);

    ctx.fillStyle = '#1e1e1e';
    ctx.font = 'bold 9px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (topH > 28) {
        ctx.save();
        ctx.translate(pipe.x + PIPE_WIDTH / 2, topH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(pipe.label, 0, 0);
        ctx.restore();
    }

    if (bottomH > 28) {
        ctx.save();
        ctx.translate(pipe.x + PIPE_WIDTH / 2, bottomY + bottomH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(pipe.label, 0, 0);
        ctx.restore();
    }
}

function sendGameOver(finalScore: number): void {
    try {
        vscode.postMessage({
            command: 'gameOver',
            score: finalScore,
            difficulty: selectedDifficulty
        });
    } catch (error) {
        console.warn('CI Bird could not send message:', error);
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
