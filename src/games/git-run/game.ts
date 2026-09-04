/**
 * game.ts - Git Run
 *
 * Single-lane side runner (Chrome-dino style): jump ground crates, duck overhead bars.
 */

import {
    BUG_BEHIND,
    BUG_CATCHUP_TIME,
    BUG_ENTER_X,
    BUG_FORM_EVERY,
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    GROUND_Y,
    HIT_INVULN,
    JUMP_DURATION,
    JUMP_LIFT,
    MAGNET_BASE_R,
    PLAYER_H,
    PLAYER_HIT_W,
    PLAYER_W,
    PLAYER_X,
    POWER_DURATION,
    SCROLL_BASE,
    SLIDE_DURATION,
    SWALLOW_DURATION
} from './constants';
import { drawBugMan, drawPreview, drawRunner, nextBugForm, type BugForm } from './characters';
import {
    buildSkyFormation,
    FORMATION_SPACING,
    JETPACK_ASCEND,
    JETPACK_DESCEND,
    JETPACK_FLY_MAX,
    JETPACK_FLY_MID,
    JETPACK_FLY_MIN,
    JETPACK_SKY,
    pickFormation
} from './jetpack';
import {
    createChase,
    isCaughtByMeter,
    onCoinLead,
    onHitSurvive,
    tickChase,
    vignetteAlpha,
    type ChaseState
} from './chase';
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
    createForcePush,
    rushBannerAlpha,
    rushEveryFor,
    shouldDualRush,
    spawnRushContent,
    tickForcePush,
    type ForcePush
} from './rush';
import {
    createObstacleChunk,
    drawLoot,
    drawObstacle,
    lootCenter,
    obstacleHitbox,
    offscreen,
    resetTrackIds,
    spawnGap,
    spawnX,
    tickObstacle,
    type PowerKind,
    type TrackLoot,
    type TrackObstacle
} from './track';

declare const vscode: {
    postMessage(message: Record<string, unknown>): void;
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

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

type TimedPowerKind = 'magnet' | 'x2';

const PAUSE_LABEL = 'Pause (P)';
const HP_CAP = 3;
const RUSH_BOOST = 7;
const TIMED_POWER_KINDS: TimedPowerKind[] = ['magnet', 'x2'];

const POWERUP_COLORS: Record<string, string> = {
    magnet: '#ce9178',
    shield: '#858585',
    jetpack: '#e8ecf0',
    boost: '#c586c0',
    x2: '#dcdcaa',
    health: '#4ec9b0'
};

const POWERUP_LABELS: Record<string, string> = {
    magnet: 'M',
    shield: 'SH',
    jetpack: 'JP',
    boost: 'B',
    x2: '2x',
    health: '+'
};

const DIFFICULTY_LABELS: Record<string, string> = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard'
};

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const previewCanvas = document.getElementById('characterPreview') as HTMLCanvasElement;
const previewCtx = previewCanvas?.getContext('2d') as CanvasRenderingContext2D | null;
const scoreElement = document.getElementById('score') as HTMLElement;
const highScoreElement = document.getElementById('highScore') as HTMLElement;
const coinsHud = document.getElementById('coinsHud') as HTMLElement;
const diamondHud = document.getElementById('diamondHud') as HTMLElement;
const hpElement = document.getElementById('hp') as HTMLElement;
const catchHud = document.getElementById('catchHud') as HTMLElement;
const walletCoins = document.getElementById('walletCoins') as HTMLElement;
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

let selectedDifficulty = 'easy';
let browsingIndex = 0;
let score = 0;
let highScore = 0;
let hp = 1;
let baseHp = 1;
let elapsed = 0;
let isRunning = false;
let isPaused = false;
let lastTs = 0;
let rafId = 0;
let invuln = 0;
let spawnAcc = 0;
let nextRushAt = 20;
let rushCount = 0;
let jumpT = 0;
let jumpDur = JUMP_DURATION;
let slideT = 0;
let hasShield = false;
let hasBoost = false;
let activeMods: Partial<Record<TimedPowerKind, number>> = {};
let obstacles: TrackObstacle[] = [];
let loot: TrackLoot[] = [];
let chase: ChaseState = createChase();
let forcePush: ForcePush | null = null;
let roadOffset = 0;
let isSwallowing = false;
let swallowT = 0;
let runnerEaten = false;
let bugX = BUG_ENTER_X;
let bugForm: BugForm = 'bug';
let bugFormTimer = BUG_FORM_EVERY;
let jetpack: { phase: 'ascend' | 'sky' | 'descend'; t: number; skyLeft: number; formAcc: number } | null =
    null;
let flyY = GROUND_Y;
let flyVel = 0;
let flyUp = false;
let flyDown = false;
let endGamePanelTimer = 0;
let endGameAlertTimer = 0;

function playSound(id: string): void {
    if (typeof soundManager !== 'undefined') {
        soundManager.playById(id);
    }
}

function selectedRunner() {
    return getCharacter(getWallet().selected);
}

function runnerMods() {
    return selectedRunner().mods;
}

function difficultyLabel(): string {
    return DIFFICULTY_LABELS[selectedDifficulty] ?? 'Easy';
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
    draw();
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
    if (!DIFFICULTY_LABELS[difficulty]) {
        return;
    }

    selectedDifficulty = difficulty;

    document.querySelectorAll('.difficulty-card').forEach(card => {
        card.classList.remove('active');
    });
    document.getElementById(`${difficulty}Card`)?.classList.add('active');

    loadHighScore();
    updateHud();
}

function openCharacterSelect(): void {
    loadHighScore();
    const selectedId = getWallet().selected;
    const index = CHARACTERS.findIndex(character => character.id === selectedId);
    browsingIndex = index >= 0 ? index : 0;

    difficultySelection.style.display = 'none';
    characterSelection.style.display = 'block';
    gamePlay.style.display = 'none';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(difficultyLabel());
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
        gameChrome.setDifficultyBadge(`${difficultyLabel()} · ${selectedRunner().name}`);
        gameChrome.refreshToolbarPhase();
    }

    draw();
    notifyGameStateChanged();
}

function backToCharacters(): void {
    stopLoop();
    isRunning = false;
    isPaused = false;
    isSwallowing = false;
    runnerEaten = false;
    jetpack = null;
    flyUp = false;
    flyDown = false;

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';

    gamePlay.style.display = 'none';
    characterSelection.style.display = 'block';
    refreshCharacterUi();

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(difficultyLabel());
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
        playSound('slurpSound');
        refreshCharacterUi();
    }
}

function refreshCharacterUi(): void {
    const character = CHARACTERS[browsingIndex]!;
    const owned = isUnlocked(character.id);
    const wallet = getWallet();

    walletCoins.textContent = String(wallet.coins);
    walletDiamonds.textContent = String(wallet.diamonds);
    charName.textContent = character.name;
    charCost.textContent = formatCost(character);
    charMods.textContent = formatMods(character);
    charLocked.textContent = owned
        ? wallet.selected === character.id
            ? 'Selected'
            : 'Owned'
        : 'Locked';
    charActionBtn.textContent = owned ? 'Select' : `Buy · ${formatCost(character)}`;
    charActionBtn.disabled =
        !owned &&
        (character.currency === 'coins'
            ? wallet.coins < character.cost
            : wallet.diamonds < character.cost);

    if (previewCtx && previewCanvas) {
        drawPreview(previewCtx, character.id, previewCanvas.width, previewCanvas.height);
    }
}

function loadHighScore(): void {
    highScore = getStoredHighScore(selectedDifficulty);
    highScoreElement.textContent = highScore.toString();
    refreshDifficultyBestScores();
}

function saveHighScore(): void {
    localStorage.setItem(`gitRunHighScore_${selectedDifficulty}`, highScore.toString());
    refreshDifficultyBestScores();
}

function getStoredHighScore(difficulty: string): number {
    const saved = localStorage.getItem(`gitRunHighScore_${difficulty}`);
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
        const message = event.data as Record<string, unknown> | null;
        if (message && message.command === 'gitRunEconomy') {
            applyEconomy({
                coins: typeof message.coins === 'number' ? message.coins : undefined,
                diamonds: typeof message.diamonds === 'number' ? message.diamonds : undefined,
                unlocked: Array.isArray(message.unlocked)
                    ? (message.unlocked as string[])
                    : undefined,
                selected: typeof message.selected === 'string' ? message.selected : undefined
            });
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

    window.addEventListener('gameChrome:restart', () => {
        if (gamePlay.style.display === 'block') {
            startGame();
        }
    });
    window.addEventListener('gameChrome:requestRestart', () => {
        if (gamePlay.style.display === 'block') {
            startGame();
        }
    });
}

function clearEndGameTimers(): void {
    if (endGamePanelTimer) {
        clearTimeout(endGamePanelTimer);
        endGamePanelTimer = 0;
    }
    if (endGameAlertTimer) {
        clearTimeout(endGameAlertTimer);
        endGameAlertTimer = 0;
    }
}

function resetRun(playing: boolean): void {
    const mods = runnerMods();
    baseHp = 1 + mods.hpBonus;
    hp = baseHp;
    score = 0;
    elapsed = 0;
    spawnAcc = 0;
    invuln = 0;
    jumpT = 0;
    slideT = 0;
    hasShield = false;
    hasBoost = false;
    activeMods = {};
    obstacles = [];
    loot = [];
    chase = createChase();
    forcePush = null;
    rushCount = 0;
    nextRushAt = rushEveryFor(selectedDifficulty);
    roadOffset = 0;
    isSwallowing = false;
    swallowT = 0;
    runnerEaten = false;
    bugX = BUG_ENTER_X;
    bugForm = 'bug';
    bugFormTimer = BUG_FORM_EVERY;
    jetpack = null;
    flyY = GROUND_Y;
    flyVel = 0;
    flyUp = false;
    flyDown = false;
    clearEndGameTimers();
    resetTrackIds();
    isPaused = false;
    isRunning = playing;
    lastTs = 0;
    pauseBtn.textContent = PAUSE_LABEL;
    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    updateHud();
}

function startGame(): void {
    clearEndGameTimers();
    resetRun(true);
    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    stopLoop();
    lastTs = 0;
    rafId = requestAnimationFrame(loop);
    notifyGameStateChanged();
    draw();
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
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.05) {
        dt = 0.05;
    }

    if (!isPaused) {
        update(dt);
    }
    draw();

    if (isRunning) {
        rafId = requestAnimationFrame(loop);
    }
}

function scrollSpeed(): number {
    const base = SCROLL_BASE[selectedDifficulty] ?? 160;
    const ramp = Math.min(110, elapsed * 1.15);
    let speed = base + ramp;
    if (forcePush) {
        speed *= 1.2;
    }
    if (jetpack?.phase === 'sky') {
        speed *= 0.92;
    }
    return speed;
}

function inJetpack(): boolean {
    return jetpack !== null;
}

/** 0 upright → 1 horizontal; eases during ascend/descend. */
function jetpackLean(): number {
    if (!jetpack) {
        return 0;
    }
    if (jetpack.phase === 'ascend') {
        const p = Math.min(1, jetpack.t / JETPACK_ASCEND);
        // Smoothstep for a soft tip into flight
        return p * p * (3 - 2 * p);
    }
    if (jetpack.phase === 'sky') {
        return 1;
    }
    // descend: ease back to upright
    const p = Math.min(1, jetpack.t / JETPACK_DESCEND);
    const eased = p * p * (3 - 2 * p);
    return 1 - eased;
}

function update(dt: number): void {
    if (isSwallowing) {
        tickSwallow(dt);
        return;
    }

    elapsed += dt;
    const mods = runnerMods();
    const scroll = scrollSpeed();
    roadOffset = (roadOffset + scroll * dt) % 40;
    score += scroll * dt * 0.12;

    tickPowers(dt);

    if (jetpack) {
        tickJetpack(dt, scroll);
        tickLootMagnet(dt, mods);
        tickLootCollisionsOnly();
        updateHud();
        return;
    }

    tickJumpSlide(dt);
    tickSpawn(scroll, dt);
    tickWorld(scroll, dt);
    tickLootMagnet(dt, mods);
    tickCollisions();
    tickRush(dt);
    tickBugChase(dt);

    chase.rushBoost = forcePush ? RUSH_BOOST : 0;
    tickChase(chase, dt, selectedDifficulty, {});

    if (invuln > 0) {
        invuln -= dt;
    }

    if (isCaughtByMeter(chase)) {
        beginSwallow();
        return;
    }

    updateHud();
}

function startJetpack(): void {
    if (jetpack) {
        // Refresh sky time if already flying
        if (jetpack.phase === 'sky') {
            jetpack.skyLeft = Math.max(jetpack.skyLeft, JETPACK_SKY * 0.75);
        }
        return;
    }
    jumpT = 0;
    slideT = 0;
    forcePush = null;
    obstacles = [];
    loot = loot.filter(item => !item.taken && item.kind !== 'coin' && item.kind !== 'diamond');
    flyY = GROUND_Y - jumpLift();
    flyVel = 0;
    jetpack = { phase: 'ascend', t: 0, skyLeft: JETPACK_SKY, formAcc: 0 };
    playSound('warningSound');
}

function tickJetpack(dt: number, scroll: number): void {
    if (!jetpack) {
        return;
    }
    jetpack.t += dt;

    if (jetpack.phase === 'ascend') {
        const p = Math.min(1, jetpack.t / JETPACK_ASCEND);
        const eased = 1 - (1 - p) * (1 - p);
        flyY = GROUND_Y - eased * (GROUND_Y + 50);
        // Drift leftover ground loot/obstacles away
        tickWorld(scroll * 1.4, dt);
        if (p >= 1) {
            jetpack.phase = 'sky';
            jetpack.t = 0;
            jetpack.skyLeft = JETPACK_SKY;
            jetpack.formAcc = FORMATION_SPACING * 0.35;
            flyY = JETPACK_FLY_MID;
            flyVel = 0;
            obstacles = [];
            loot = [];
        }
        return;
    }

    if (jetpack.phase === 'sky') {
        jetpack.skyLeft -= dt;
        const thrust = (flyUp ? 1 : 0) - (flyDown ? 1 : 0);
        flyVel += -thrust * 520 * dt;
        // Spring back toward middle altitude
        flyVel += (JETPACK_FLY_MID - flyY) * 2.4 * dt;
        flyVel *= Math.exp(-3.2 * dt);
        flyY += flyVel * dt;
        flyY = Math.max(JETPACK_FLY_MIN, Math.min(JETPACK_FLY_MAX, flyY));

        jetpack.formAcc += scroll * dt;
        while (jetpack.formAcc >= FORMATION_SPACING) {
            jetpack.formAcc -= FORMATION_SPACING;
            const cy =
                JETPACK_FLY_MIN +
                40 +
                Math.random() * Math.max(40, JETPACK_FLY_MAX - JETPACK_FLY_MIN - 80);
            loot.push(...buildSkyFormation(pickFormation(), Math.random() < 0.22, spawnX() + 20, cy));
        }

        for (const item of loot) {
            if (!item.taken) {
                item.x -= scroll * dt;
            }
        }
        loot = loot.filter(item => !item.taken && !offscreen(item.x, 40));

        // Soft lead while collecting in the sky
        onCoinLead(chase, dt * 0.8);

        if (jetpack.skyLeft <= 0) {
            jetpack.phase = 'descend';
            jetpack.t = 0;
            loot = loot.filter(item => item.kind !== 'coin' && item.kind !== 'diamond');
        }
        return;
    }

    // descend
    const p = Math.min(1, jetpack.t / JETPACK_DESCEND);
    const eased = p * p;
    flyY = JETPACK_FLY_MID + (GROUND_Y - JETPACK_FLY_MID) * eased;
    if (p >= 1) {
        jetpack = null;
        flyY = GROUND_Y;
        flyVel = 0;
        flyUp = false;
        flyDown = false;
        jumpT = 0;
        slideT = 0;
        invuln = HIT_INVULN * 0.6;
        spawnAcc = 0;
    }
}

function tickBugChase(dt: number): void {
    const targetX = PLAYER_X - BUG_BEHIND;
    if (elapsed < BUG_CATCHUP_TIME) {
        const p = Math.min(1, elapsed / BUG_CATCHUP_TIME);
        // Ease-out so it surges in then settles behind the runner
        const eased = 1 - (1 - p) * (1 - p);
        bugX = BUG_ENTER_X + (targetX - BUG_ENTER_X) * eased;
    } else {
        // Subtle bob toward / away with catch meter
        const pressure = (chase.meter / 100) * 10;
        bugX = targetX + Math.sin(elapsed * 3.2) * 2.5 + pressure * 0.15;
    }

    bugFormTimer -= dt;
    if (bugFormTimer <= 0) {
        bugForm = nextBugForm(bugForm);
        bugFormTimer = BUG_FORM_EVERY + Math.random() * 3;
    }
}

function tickSwallow(dt: number): void {
    swallowT += dt;
    elapsed += dt;
    const p = Math.min(1, swallowT / SWALLOW_DURATION);
    const targetX = PLAYER_X - 8;
    bugX += (targetX - bugX) * Math.min(1, dt * 6);

    if (p >= 1) {
        finishEndGame();
    }
}

function beginSwallow(): void {
    if (isSwallowing || !isRunning) {
        return;
    }
    isSwallowing = true;
    swallowT = 0;
    runnerEaten = false;
    isPaused = false;
    forcePush = null;
    jetpack = null;
    flyUp = false;
    flyDown = false;
    chase.meter = 100;
    chase.rushBoost = 0;
    jumpT = 0;
    slideT = 0;
    playSound('crashSound');
}

function tickPowers(dt: number): void {
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

function jumpLift(): number {
    if (jetpack) {
        return Math.max(0, GROUND_Y - flyY);
    }
    if (jumpT <= 0 || jumpDur <= 0) {
        return 0;
    }
    // Smooth arc: 0 → peak → 0 over the jump duration
    const progress = 1 - jumpT / jumpDur;
    return JUMP_LIFT * Math.sin(Math.PI * Math.min(1, Math.max(0, progress)));
}

function tickJumpSlide(dt: number): void {
    if (jumpT > 0) {
        jumpT -= dt;
        if (jumpT < 0) {
            jumpT = 0;
        }
    }
    if (slideT > 0) {
        slideT -= dt;
        if (slideT < 0) {
            slideT = 0;
        }
    }
}

function tryJump(): void {
    if (!isRunning || isPaused || isSwallowing || inJetpack()) {
        return;
    }
    // Interrupt duck — jump wins immediately
    slideT = 0;
    jumpDur = JUMP_DURATION * runnerMods().jumpHang;
    jumpT = jumpDur;
    playSound('popSound');
}

function trySlide(): void {
    if (!isRunning || isPaused || isSwallowing || inJetpack()) {
        return;
    }
    // Interrupt jump — duck wins immediately
    jumpT = 0;
    slideT = SLIDE_DURATION * runnerMods().slideHang;
    playSound('popSound');
}

function tickSpawn(scroll: number, dt: number): void {
    spawnAcc += scroll * dt;
    const gap = spawnGap(elapsed, selectedDifficulty) * (forcePush ? 0.85 : 1);
    while (spawnAcc >= gap) {
        spawnAcc -= gap;
        const x = spawnX();
        if (forcePush) {
            const content = spawnRushContent(
                forcePush,
                x,
                elapsed,
                selectedDifficulty,
                rushCount
            );
            obstacles.push(...content.obstacles);
            loot.push(...content.loot);
        } else {
            const content = createObstacleChunk(x, elapsed, selectedDifficulty, false);
            obstacles.push(...content.obstacles);
            loot.push(...content.loot);
            if (content.extraGap > 0) {
                spawnAcc -= content.extraGap;
            }
        }
    }
}

function tickWorld(scroll: number, dt: number): void {
    for (const obs of obstacles) {
        tickObstacle(obs, dt, scroll);
    }
    for (const item of loot) {
        if (!item.taken) {
            item.x -= scroll * dt;
        }
    }
    obstacles = obstacles.filter(obs => !offscreen(obs.x, obs.w + 80));
    loot = loot.filter(item => !item.taken && !offscreen(item.x, 40));
}

function tickLootMagnet(dt: number, mods: ReturnType<typeof runnerMods>): void {
    if ((activeMods.magnet ?? 0) <= 0 && mods.magnetBonus <= 0) {
        return;
    }
    const radius = MAGNET_BASE_R + mods.magnetBonus + ((activeMods.magnet ?? 0) > 0 ? 30 : 0);
    const box = playerBox();
    const px = box.x + box.w / 2;
    const py = box.y + box.h / 2;
    for (const item of loot) {
        if (item.taken || (item.kind !== 'coin' && item.kind !== 'diamond')) {
            continue;
        }
        const pos = lootCenter(item);
        const dx = px - pos.x;
        const dy = py - pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius && dist > 1) {
            const pull = Math.min(1, (280 * dt) / dist);
            item.x += dx * pull;
            if (item.y !== undefined) {
                item.y += dy * pull;
            }
        }
    }
}

function playerBox(): Rect {
    const sliding = !inJetpack() && slideT > 0;
    const h = sliding ? PLAYER_H * 0.42 : PLAYER_H;
    const lift = jumpLift();
    const top = GROUND_Y - h - lift;
    return {
        x: PLAYER_X - PLAYER_HIT_W / 2,
        y: top,
        w: PLAYER_HIT_W,
        h
    };
}

function aabb(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clearsObstacle(obs: TrackObstacle): boolean {
    const jumping = jumpT > 0;
    const sliding = slideT > 0;
    switch (obs.kind) {
        case 'low':
        case 'train':
            return jumping;
        case 'high':
            return sliding;
        default:
            return false;
    }
}

function tickLootCollisionsOnly(): void {
    const box = playerBox();
    for (const item of loot) {
        if (item.taken) {
            continue;
        }
        const pos = lootCenter(item);
        const r = item.r;
        const lootBox: Rect = { x: pos.x - r, y: pos.y - r, w: r * 2, h: r * 2 };
        if (!aabb(box, lootBox)) {
            continue;
        }
        item.taken = true;
        collectLoot(item);
    }
}

function tickCollisions(): void {
    const box = playerBox();

    for (const obs of obstacles) {
        if (obs.hit) {
            continue;
        }
        const hit = obstacleHitbox(obs);
        if (!aabb(box, hit)) {
            continue;
        }
        if (clearsObstacle(obs)) {
            continue;
        }
        if (hasBoost) {
            hasBoost = false;
            obs.hit = true;
            score += 5;
            continue;
        }
        if (invuln > 0) {
            continue;
        }
        obs.hit = true;
        applyHit();
        if (!isRunning || isSwallowing) {
            return;
        }
    }

    tickLootCollisionsOnly();
}

function applyHit(): void {
    if (hasShield) {
        hasShield = false;
        invuln = HIT_INVULN;
        onHitSurvive(chase);
        playSound('explodeSound');
        return;
    }

    if (hp > 1) {
        hp -= 1;
        invuln = HIT_INVULN;
        onHitSurvive(chase);
        playSound('lockSound');
        playSound('warningSound');
        updateHud();
        return;
    }

    beginSwallow();
}

function collectLoot(item: TrackLoot): void {
    if (item.kind === 'coin') {
        const mult = (activeMods.x2 ?? 0) > 0 ? 2 : 1;
        addCurrency('coins', mult);
        score += 10 * mult;
        onCoinLead(chase, mult);
        playSound('slurpSound');
        updateHud();
        return;
    }
    if (item.kind === 'diamond') {
        addCurrency('diamonds', 1);
        score += 40;
        onCoinLead(chase, 3);
        playSound('comboSound');
        updateHud();
        return;
    }
    applyPower(item.kind);
}

function applyPower(kind: PowerKind): void {
    playSound('slurpSound');
    if (kind === 'health') {
        hp = Math.min(HP_CAP, hp + 1);
        updateHud();
        return;
    }
    if (kind === 'shield') {
        hasShield = true;
        return;
    }
    if (kind === 'boost') {
        hasBoost = true;
        return;
    }
    if (kind === 'jetpack') {
        startJetpack();
        return;
    }
    if (kind === 'magnet' || kind === 'x2') {
        const duration = POWER_DURATION[kind] ?? 5;
        activeMods[kind] = duration;
    }
}

function tickRush(dt: number): void {
    if (forcePush) {
        const prev = forcePush;
        forcePush = tickForcePush(forcePush, dt);
        if (!forcePush && prev.dualQueued) {
            beginForcePush(false);
        } else if (!forcePush) {
            nextRushAt = rushEveryFor(selectedDifficulty);
        }
        return;
    }

    nextRushAt -= dt;
    if (nextRushAt <= 0) {
        beginForcePush(true);
    }
}

function beginForcePush(rollDual: boolean): void {
    rushCount += 1;
    forcePush = createForcePush(rollDual && shouldDualRush());
    spawnAcc = spawnGap(elapsed, selectedDifficulty);
    playSound('warningSound');
}

function togglePause(): void {
    if (!isRunning || isSwallowing) {
        return;
    }

    isPaused = !isPaused;
    if (isPaused) {
        flyUp = false;
        flyDown = false;
    }
    pauseBtn.textContent = isPaused ? 'Resume' : PAUSE_LABEL;

    window.dispatchEvent(
        new CustomEvent('gameChrome:pauseStateChanged', {
            detail: { isPaused }
        })
    );
}

function finishEndGame(): void {
    if (!isRunning && !isSwallowing) {
        return;
    }

    isRunning = false;
    isSwallowing = false;
    isPaused = false;
    forcePush = null;
    chase.rushBoost = 0;
    stopLoop();
    clearEndGameTimers();

    const final = Math.floor(score);
    score = final;

    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }

    updateHud();
    sendGameOver(score);
    showGameOverAlert();
    notifyGameStateChanged();

    alertTitle.textContent = 'CAUGHT!';
    gameOverTitle.textContent = 'Caught!';

    // Show Restart after the catch flash so the alert does not cover the button
    endGamePanelTimer = window.setTimeout(() => {
        endGamePanelTimer = 0;
        finalScoreElement.textContent = score.toString();
        gameOverElement.classList.add('show');
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        notifyGameStateChanged();
        draw();
    }, 2200);
}

function showGameOverAlert(): void {
    alertScore.textContent = `Score: ${Math.floor(score)}`;
    gameOverAlert.classList.add('show');
    if (endGameAlertTimer) {
        clearTimeout(endGameAlertTimer);
    }
    endGameAlertTimer = window.setTimeout(() => {
        endGameAlertTimer = 0;
        gameOverAlert.classList.remove('show');
    }, 2000);
}

function handleKeyDown(event: KeyboardEvent): void {
    if (characterSelection.style.display === 'block') {
        if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
            event.preventDefault();
            cycleCharacter(-1);
        } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
            event.preventDefault();
            cycleCharacter(1);
        } else if (event.code === 'Enter' || event.code === 'Space') {
            event.preventDefault();
            onCharacterAction();
        }
        return;
    }

    if (event.code === 'KeyP') {
        event.preventDefault();
        togglePause();
        return;
    }

    if (!isRunning || isPaused || isSwallowing) {
        return;
    }

    if (event.code === 'ArrowUp' || event.code === 'KeyW' || event.code === 'Space') {
        event.preventDefault();
        if (inJetpack()) {
            flyUp = true;
            flyDown = false;
        } else {
            tryJump();
        }
    } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        event.preventDefault();
        if (inJetpack()) {
            flyDown = true;
            flyUp = false;
        } else {
            trySlide();
        }
    }
}

function handleKeyUp(event: KeyboardEvent): void {
    if (event.code === 'ArrowUp' || event.code === 'KeyW' || event.code === 'Space') {
        flyUp = false;
    } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        flyDown = false;
    }
}

function updateHud(): void {
    const wallet = getWallet();
    scoreElement.textContent = Math.floor(score).toString();
    highScoreElement.textContent = highScore.toString();
    if (coinsHud) {
        coinsHud.textContent = String(wallet.coins);
    }
    if (diamondHud) {
        diamondHud.textContent = String(wallet.diamonds);
    }
    hpElement.textContent = hp.toString();
    if (catchHud) {
        catchHud.textContent = `${Math.floor(chase.meter)}%`;
    }
}

function draw(): void {
    const skyMode = Boolean(jetpack && (jetpack.phase === 'sky' || jetpack.phase === 'descend'));
    const ascendP = jetpack?.phase === 'ascend' ? Math.min(1, jetpack.t / JETPACK_ASCEND) : 0;
    const blend =
        jetpack?.phase === 'ascend'
            ? ascendP
            : jetpack?.phase === 'descend'
              ? 1 - Math.min(1, jetpack.t / JETPACK_DESCEND)
              : skyMode
                ? 1
                : 0;

    if (blend < 0.99) {
        const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
        sky.addColorStop(0, '#243044');
        sky.addColorStop(0.55, '#1a2230');
        sky.addColorStop(1, '#151a24');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = 'rgba(36, 52, 72, 0.55)';
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y - 28);
        ctx.quadraticCurveTo(120, GROUND_Y - 55, 240, GROUND_Y - 30);
        ctx.quadraticCurveTo(360, GROUND_Y - 60, 520, GROUND_Y - 26);
        ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
        ctx.lineTo(0, GROUND_Y);
        ctx.closePath();
        ctx.fill();

        drawGround();
        drawRoadMarks();
    }

    if (blend > 0.01) {
        drawJetpackSky(blend);
    }

    if (!skyMode || jetpack?.phase === 'descend') {
        for (const obs of obstacles) {
            if (!obs.hit) {
                drawObstacle(ctx, obs);
            }
        }
    }

    for (const item of loot) {
        drawLoot(ctx, item);
    }

    const lift = jumpLift();
    const swallowP = isSwallowing ? Math.min(1, swallowT / SWALLOW_DURATION) : 0;
    let mouthOpen = 0;
    if (isSwallowing) {
        if (swallowP < 0.35) {
            mouthOpen = swallowP / 0.35;
        } else if (swallowP < 0.55) {
            mouthOpen = 1;
        } else {
            mouthOpen = Math.max(0, 1 - (swallowP - 0.55) / 0.25);
        }
    } else {
        mouthOpen = Math.max(0, (chase.meter - 85) / 40);
    }
    const bugScale = isSwallowing
        ? 1 + Math.sin(Math.min(1, swallowP / 0.7) * Math.PI) * 0.35
        : 1;

    if (!inJetpack()) {
        drawBugMan(ctx, bugX, GROUND_Y, {
            meter: chase.meter,
            form: bugForm,
            t: elapsed,
            mouthOpen,
            scaleBoost: bugScale,
            hop: isSwallowing ? Math.sin(swallowT * 18) * 2 : undefined
        });
    }

    if (isSwallowing && swallowP >= 0.48) {
        runnerEaten = true;
    }

    const invulnBlink = invuln <= 0 || Math.floor(invuln * 12) % 2 === 0;
    const showRunner = !runnerEaten && (!isSwallowing || swallowP < 0.5);
    if (invulnBlink && showRunner) {
        const swallowPull = isSwallowing ? Math.min(1, Math.max(0, (swallowP - 0.15) / 0.32)) : 0;
        const runnerX = PLAYER_X - PLAYER_W / 2 - swallowPull * Math.max(8, PLAYER_X - bugX);
        const runnerScale = 1 - swallowPull * 0.95;
        const runnerLift = lift + (isSwallowing ? swallowPull * 14 : 0);
        const flying = Boolean(jetpack);
        const flyLean = jetpackLean();

        ctx.save();
        if (swallowPull > 0) {
            const cx = runnerX + PLAYER_W / 2;
            const cy = GROUND_Y - runnerLift - PLAYER_H * 0.35;
            ctx.translate(cx, cy);
            ctx.scale(Math.max(0.05, runnerScale), Math.max(0.05, runnerScale));
            ctx.rotate(swallowPull * -0.85);
            ctx.translate(-cx, -cy);
            ctx.globalAlpha = Math.max(0, 1 - swallowPull);
        }
        drawRunner(ctx, getWallet().selected, runnerX, GROUND_Y - PLAYER_H, PLAYER_W, PLAYER_H, {
            jumping: jumpT > 0 || (isSwallowing && swallowPull > 0),
            sliding: slideT > 0 && !flying,
            shield: hasShield && !isSwallowing && !flying,
            jetpack: flying,
            flying,
            flyLean,
            t: elapsed,
            lift: runnerLift
        });
        ctx.restore();
    }

    if (isSwallowing && runnerEaten) {
        const gulp = Math.sin((swallowP - 0.5) * Math.PI * 4) * 0.12;
        ctx.fillStyle = `rgba(244, 135, 113, ${Math.max(0, gulp)})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    if (!skyMode) {
        drawVignette();
    }
    drawModHud();
    drawRushBanner();

    if (jetpack?.phase === 'sky') {
        ctx.fillStyle = 'rgba(212, 212, 212, 0.85)';
        ctx.font = 'bold 11px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`JETPACK  ${Math.ceil(jetpack.skyLeft)}s`, CANVAS_WIDTH / 2, 18);
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

function drawJetpackSky(blend: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    sky.addColorStop(0, '#0b1220');
    sky.addColorStop(0.45, '#152238');
    sky.addColorStop(1, '#1a2838');
    ctx.globalAlpha = blend;
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#e8eef8';
    for (let i = 0; i < 48; i++) {
        const sx = ((i * 97 + elapsed * 12) % CANVAS_WIDTH + CANVAS_WIDTH) % CANVAS_WIDTH;
        const sy = ((i * 53) % (CANVAS_HEIGHT - 20)) + 8;
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(elapsed * 2 + i));
        ctx.globalAlpha = blend * twinkle;
        ctx.beginPath();
        ctx.arc(sx, sy, i % 5 === 0 ? 1.6 : 1, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = blend * 0.55;
    for (let i = 0; i < 5; i++) {
        const cx = ((i * 140 - elapsed * 28) % (CANVAS_WIDTH + 120)) - 40;
        const cy = 40 + (i % 3) * 48;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(200, 210, 230, 0.35)' : 'rgba(180, 195, 220, 0.28)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 48, 14, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 22, cy + 4, 36, 12, 0, 0, Math.PI * 2);
        ctx.ellipse(cx - 20, cy + 2, 30, 10, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawGround(): void {
    // Near ground slab with slight perspective shade
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT);
    groundGrad.addColorStop(0, '#2a303a');
    groundGrad.addColorStop(0.35, '#222830');
    groundGrad.addColorStop(1, '#181c24');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    // Top edge highlight
    ctx.strokeStyle = 'rgba(140, 170, 200, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // Receding depth lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
        const y = GROUND_Y + i * 12;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }
}

function drawRoadMarks(): void {
    ctx.strokeStyle = 'rgba(86, 156, 214, 0.22)';
    ctx.setLineDash([12, 16]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-40 + (40 - roadOffset), GROUND_Y - 6);
    ctx.lineTo(CANVAS_WIDTH + 40, GROUND_Y - 6);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawVignette(): void {
    const alpha = vignetteAlpha(chase.meter);
    if (alpha <= 0) {
        return;
    }
    const gradient = ctx.createRadialGradient(
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2,
        CANVAS_HEIGHT * 0.2,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2,
        CANVAS_HEIGHT * 0.75
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(180, 40, 40, ${alpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawRushBanner(): void {
    const alpha = rushBannerAlpha(forcePush);
    if (alpha <= 0) {
        return;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f48771';
    ctx.font = 'bold 13px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FORCE PUSH', CANVAS_WIDTH / 2, 22);
    ctx.restore();
}

function drawModHud(): void {
    const radius = 14;
    const gap = 36;
    const startY = 56;
    const cx = CANVAS_WIDTH - 22;

    const entries: { key: string; remaining: number; max: number; active: boolean }[] = [
        ...TIMED_POWER_KINDS.map(kind => ({
            key: kind,
            remaining: activeMods[kind] ?? 0,
            max: POWER_DURATION[kind] ?? 5,
            active: (activeMods[kind] ?? 0) > 0
        })),
        {
            key: 'jetpack',
            remaining: jetpack?.phase === 'sky' ? jetpack.skyLeft : jetpack ? 1 : 0,
            max: POWER_DURATION.jetpack ?? JETPACK_SKY,
            active: Boolean(jetpack)
        },
        {
            key: 'shield',
            remaining: hasShield ? 1 : 0,
            max: 1,
            active: hasShield
        },
        {
            key: 'boost',
            remaining: hasBoost ? 1 : 0,
            max: 1,
            active: hasBoost
        }
    ];

    entries.forEach((entry, index) => {
        const cy = startY + index * gap;
        const color = POWERUP_COLORS[entry.key] ?? '#ffffff';

        ctx.save();
        ctx.globalAlpha = entry.active ? 1 : 0.28;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#1e1e1e';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        if (entry.active && entry.max > 0 && (TIMED_POWER_KINDS.includes(entry.key as TimedPowerKind) || entry.key === 'jetpack')) {
            const progress = Math.max(0, Math.min(1, entry.remaining / entry.max));
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.arc(cx, cy, radius + 3, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = color;
        ctx.font = 'bold 8px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(POWERUP_LABELS[entry.key] ?? '?', cx, cy);
        ctx.restore();
    });
}

function sendGameOver(finalScore: number): void {
    try {
        vscode.postMessage({
            command: 'gameOver',
            score: finalScore,
            difficulty: selectedDifficulty
        });
    } catch (error) {
        console.warn('Git Run could not send message:', error);
    }
}

function setupButtons(): void {
    init();
    startBtn?.addEventListener('click', () => startGame());
    pauseBtn?.addEventListener('click', () => togglePause());
    restartBtn?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        startGame();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButtons);
} else {
    setupButtons();
}
