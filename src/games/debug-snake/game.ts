/**
 * game.ts - Debug Snake
 *
 * Snake with character shop, bug/pink wallet, and timed pink pickups.
 */

import { drawSnakePreview, drawSnakeSegment } from './characters';
import {
    CANVAS_SIZE,
    GRID_SIZE,
    INITIAL_SNAKE_LENGTH,
    INITIAL_SNAKE_X,
    INITIAL_SNAKE_Y,
    INVULN_TICKS,
    PINK_TIMEOUT,
    TILE_COUNT
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
import { formatCost, formatMods, getSnake, SNAKES, type SnakeId } from './roster';

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

interface SnakeSegment {
    x: number;
    y: number;
}

interface SnakeDifficulty {
    name: string;
    label: string;
    initialSpeed: number;
    minSpeed: number;
    speedMultiplier: number;
    bugsPerSpeedIncrease: number;
    pinkEvery: number;
}

interface PinkBall {
    x: number;
    y: number;
    remainingMs: number;
}

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const previewCanvas = document.getElementById('characterPreview') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const previewCtx = previewCanvas?.getContext('2d') as CanvasRenderingContext2D | null;
const scoreElement = document.getElementById('score') as HTMLElement;
const highScoreElement = document.getElementById('highScore') as HTMLElement;
const speedElement = document.getElementById('speed') as HTMLElement;
const bugsHud = document.getElementById('bugsHud') as HTMLElement;
const pinkHud = document.getElementById('pinkHud') as HTMLElement;
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
const walletBugsEl = document.getElementById('walletBugs') as HTMLElement;
const walletPinkEl = document.getElementById('walletPink') as HTMLElement;
const charLockedEl = document.getElementById('charLocked') as HTMLElement;

const difficulties: Record<string, SnakeDifficulty> = {
    easy: {
        name: 'Easy',
        label: 'Easy',
        initialSpeed: 220,
        minSpeed: 80,
        speedMultiplier: 0.88,
        bugsPerSpeedIncrease: 6,
        pinkEvery: 10
    },
    medium: {
        name: 'Medium',
        label: 'Medium',
        initialSpeed: 160,
        minSpeed: 60,
        speedMultiplier: 0.85,
        bugsPerSpeedIncrease: 5,
        pinkEvery: 8
    },
    hard: {
        name: 'Hard',
        label: 'Hard',
        initialSpeed: 110,
        minSpeed: 45,
        speedMultiplier: 0.82,
        bugsPerSpeedIncrease: 4,
        pinkEvery: 6
    }
};

let selectedDifficulty = 'easy';
let currentDifficulty = difficulties.easy;
let bugsPerSpeedIncrease = currentDifficulty.bugsPerSpeedIncrease;
let minSpeed = currentDifficulty.minSpeed;
let speedMultiplier = currentDifficulty.speedMultiplier;
let pinkEvery = currentDifficulty.pinkEvery;

let snake: SnakeSegment[] = [];
let snakeLength = INITIAL_SNAKE_LENGTH;
let snakeX = INITIAL_SNAKE_X;
let snakeY = INITIAL_SNAKE_Y;
let velocityX = 0;
let velocityY = 0;
let bugX = 15;
let bugY = 15;
let pinkBall: PinkBall | null = null;
let score = 0;
let runBugs = 0;
let runPink = 0;
let highScore = 0;
let gameLoop: number | null = null;
let baseGameSpeed = currentDifficulty.initialSpeed;
let gameSpeed = baseGameSpeed;
let isRunning = false;
let isPaused = false;
let lives = 1;
let invulnTicks = 0;
let browsingIndex = 0;

function playSound(id: string): void {
    if (typeof soundManager !== 'undefined') {
        soundManager.playById(id);
    }
}

function selectedSnake() {
    return getSnake(getWallet().selected);
}

function speedMod(): number {
    return selectedSnake().mods.speed;
}

function init(): void {
    if (typeof initGameChrome === 'function') {
        initGameChrome();
    }
    if (typeof soundManager !== 'undefined' && soundManager.preloadAll) {
        soundManager.preloadAll();
    }

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
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
    placeBug();
    requestReady();
    refreshCharacterUi();
    drawInitialState();
}

function migrateHighScores(): void {
    if (localStorage.getItem('snakeScoreMigratedV2')) {
        return;
    }
    const oldHard = localStorage.getItem('snakeHighScore_hard');
    const oldVeryHard = localStorage.getItem('snakeHighScore_veryHard');
    if (oldHard && !localStorage.getItem('snakeHighScore_medium')) {
        localStorage.setItem('snakeHighScore_medium', oldHard);
    }
    if (oldVeryHard) {
        localStorage.setItem('snakeHighScore_hard', oldVeryHard);
    }
    localStorage.setItem('snakeScoreMigratedV2', '1');
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
    const index = SNAKES.findIndex(snake => snake.id === selectedId);
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
    currentDifficulty = difficulties[selectedDifficulty];
    bugsPerSpeedIncrease = currentDifficulty.bugsPerSpeedIncrease;
    minSpeed = currentDifficulty.minSpeed;
    speedMultiplier = currentDifficulty.speedMultiplier;
    pinkEvery = currentDifficulty.pinkEvery;
    baseGameSpeed = currentDifficulty.initialSpeed;
    gameSpeed = baseGameSpeed;

    loadHighScore();
    updateHud();

    characterSelection.style.display = 'none';
    gamePlay.style.display = 'block';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(`${currentDifficulty.label} · ${selectedSnake().name}`);
        gameChrome.refreshToolbarPhase();
    }

    drawInitialState();
    notifyGameStateChanged();
}

function backToCharacters(): void {
    if (isRunning) {
        isRunning = false;
        isPaused = false;
        if (gameLoop) {
            clearTimeout(gameLoop);
            gameLoop = null;
        }
    }

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

function browsingCharacter() {
    return SNAKES[browsingIndex] ?? SNAKES[0];
}

function cycleCharacter(delta: number): void {
    browsingIndex = (browsingIndex + delta + SNAKES.length) % SNAKES.length;
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
    playSound('popSound');
    refreshCharacterUi();
}

function refreshCharacterUi(): void {
    const character = browsingCharacter();
    const wallet = getWallet();
    const owned = isUnlocked(character.id);
    charNameEl.textContent = character.name;
    charCostEl.textContent = owned ? 'Owned' : formatCost(character);
    charModsEl.textContent = formatMods(character);
    walletBugsEl.textContent = String(wallet.bugs);
    walletPinkEl.textContent = String(wallet.pink);
    charActionBtn.textContent = owned ? 'Select' : `Buy · ${formatCost(character)}`;
    charActionBtn.disabled = !owned && (
        character.currency === 'bugs'
            ? wallet.bugs < character.cost
            : wallet.pink < character.cost
    );
    charLockedEl.textContent = owned
        ? (wallet.selected === character.id ? 'Selected' : '')
        : character.currency === 'pink' ? 'Premium' : 'Locked';

    drawPreview();
    updateHud();
}

function drawPreview(): void {
    if (!previewCtx || !previewCanvas) {
        return;
    }
    drawSnakePreview(previewCtx, browsingCharacter().id, previewCanvas.width, previewCanvas.height);
}

function loadHighScore(): void {
    const saved = localStorage.getItem(`snakeHighScore_${selectedDifficulty}`);
    highScore = saved ? parseInt(saved, 10) : 0;
    refreshDifficultyBestScores();
}

function saveHighScore(): void {
    localStorage.setItem(`snakeHighScore_${selectedDifficulty}`, highScore.toString());
    refreshDifficultyBestScores();
}

function getStoredHighScore(difficulty: string): number {
    const saved = localStorage.getItem(`snakeHighScore_${difficulty}`);
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
    document.addEventListener('keydown', handleKeyPress);

    window.addEventListener('message', event => {
        const message = event.data;
        if (message?.command === 'debugSnakeEconomy') {
            applyEconomy(message);
            const selectedId = getWallet().selected;
            const index = SNAKES.findIndex(snake => snake.id === selectedId);
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
        restartGame();
    });
}

function drawInitialState(): void {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawSnakeSegment(ctx, getWallet().selected, INITIAL_SNAKE_X, INITIAL_SNAKE_Y, true);
    drawBug();
}

function drawGrid(): void {
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 1;
    for (let i = 0; i <= TILE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
    }
}

function startGame(): void {
    playSound('popSound');
    if (gameLoop) {
        clearTimeout(gameLoop);
        gameLoop = null;
    }

    snake = [];
    snakeLength = INITIAL_SNAKE_LENGTH;
    snakeX = INITIAL_SNAKE_X;
    snakeY = INITIAL_SNAKE_Y;
    velocityX = 1;
    velocityY = 0;
    score = 0;
    runBugs = 0;
    runPink = 0;
    pinkBall = null;
    baseGameSpeed = currentDifficulty.initialSpeed;
    gameSpeed = baseGameSpeed;
    lives = 1 + selectedSnake().mods.resurrection;
    invulnTicks = 0;
    isPaused = false;

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    updateHud();
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    pauseBtn.textContent = 'Pause (SPC)';

    placeBug();
    isRunning = true;
    runGameLoop();
    notifyGameStateChanged();
}

function tickDelay(): number {
    return Math.max(20, gameSpeed / speedMod());
}

function runGameLoop(): void {
    if (gameLoop) {
        clearTimeout(gameLoop);
    }

    if (!isRunning || isPaused) {
        return;
    }

    update();
    draw();

    gameLoop = window.setTimeout(() => runGameLoop(), tickDelay());
}

function togglePause(): void {
    if (!isRunning) {
        return;
    }

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause (SPC)';

    if (!isPaused) {
        runGameLoop();
    }

    window.dispatchEvent(new CustomEvent('gameChrome:pauseStateChanged', {
        detail: { isPaused }
    }));
}

function restartGame(): void {
    startGame();
}

function endGame(): void {
    isRunning = false;
    isPaused = false;

    if (gameLoop) {
        clearTimeout(gameLoop);
        gameLoop = null;
    }

    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }

    persistNow();
    sendGameOver(score);
    showGameOverAlert();
    notifyGameStateChanged();

    setTimeout(() => {
        finalScoreElement.textContent = score.toString();
        gameOverElement.classList.add('show');
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        notifyGameStateChanged();
    }, 2500);
}

function showGameOverAlert(): void {
    alertScore.textContent = `Bugs Fixed: ${score} · +${runBugs} bugs · ♦ +${runPink} pink`;
    gameOverAlert.classList.add('show');
    setTimeout(() => {
        gameOverAlert.classList.remove('show');
    }, 2000);
}

function resurrect(prevX: number, prevY: number, poppedSegment: boolean): void {
    snakeX = prevX;
    snakeY = prevY;
    if (poppedSegment && snake.length > 0) {
        snake.pop();
    }
    lives -= 1;
    invulnTicks = INVULN_TICKS;
    playSound('popSound');
    updateHud();
}

function update(): void {
    if (invulnTicks > 0) {
        invulnTicks -= 1;
    }

    if (pinkBall) {
        pinkBall.remainingMs -= tickDelay();
        if (pinkBall.remainingMs <= 0) {
            pinkBall = null;
        }
    }

    const prevX = snakeX;
    const prevY = snakeY;

    snakeX += velocityX;
    snakeY += velocityY;

    const outOfBounds = snakeX < 0 || snakeX >= TILE_COUNT || snakeY < 0 || snakeY >= TILE_COUNT;
    if (outOfBounds) {
        if (invulnTicks > 0) {
            snakeX = prevX;
            snakeY = prevY;
            return;
        }
        if (lives > 1) {
            resurrect(prevX, prevY, false);
            return;
        }
        endGame();
        return;
    }

    snake.push({ x: snakeX, y: snakeY });
    while (snake.length > snakeLength) {
        snake.shift();
    }

    if (invulnTicks <= 0) {
        for (let i = 0; i < snake.length - 1; i++) {
            const segment = snake[i];
            if (segment.x === snakeX && segment.y === snakeY) {
                if (lives > 1) {
                    resurrect(prevX, prevY, true);
                    return;
                }
                endGame();
                return;
            }
        }
    }

    if (snakeX === bugX && snakeY === bugY) {
        score += 1;
        runBugs += 1;
        snakeLength += 1;
        addCurrency('bugs', 1);
        playSound('slurpSound');
        updateHud();
        placeBug();

        if (score % bugsPerSpeedIncrease === 0) {
            gameSpeed = Math.max(minSpeed, gameSpeed * speedMultiplier);
            updateSpeedDisplay();
        }

        if (score > 0 && score % pinkEvery === 0) {
            spawnPinkBall();
        }
    }

    if (pinkBall && snakeX === pinkBall.x && snakeY === pinkBall.y) {
        runPink += 1;
        addCurrency('pink', 1);
        playSound('popSound');
        pinkBall = null;
        updateHud();
    }
}

function spawnPinkBall(): void {
    if (pinkBall) {
        return;
    }

    let attempts = 0;
    while (attempts < 80) {
        attempts += 1;
        const x = Math.floor(Math.random() * TILE_COUNT);
        const y = Math.floor(Math.random() * TILE_COUNT);
        if (isOccupied(x, y)) {
            continue;
        }
        pinkBall = { x, y, remainingMs: PINK_TIMEOUT * 1000 };
        return;
    }
}

function isOccupied(x: number, y: number): boolean {
    if (x === snakeX && y === snakeY) {
        return true;
    }
    if (x === bugX && y === bugY) {
        return true;
    }
    for (const segment of snake) {
        if (segment.x === x && segment.y === y) {
            return true;
        }
    }
    return false;
}

function draw(): void {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    const snakeId = getWallet().selected;
    const blink = invulnTicks > 0 && invulnTicks % 2 === 0;
    if (!blink) {
        for (let i = 0; i < snake.length; i++) {
            const segment = snake[i];
            drawSnakeSegment(ctx, snakeId, segment.x, segment.y, i === snake.length - 1);
        }
    }

    drawBug();
    if (pinkBall) {
        drawPinkBall(pinkBall);
    }
}

function drawBug(): void {
    const centerX = bugX * GRID_SIZE + GRID_SIZE / 2;
    const centerY = bugY * GRID_SIZE + GRID_SIZE / 2;
    const radius = GRID_SIZE * 0.4;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#cc0000';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    const spotRadius = radius * 0.25;
    ctx.fillStyle = '#000000';
    for (const [ox, oy] of [[-0.4, -0.3], [-0.4, 0.3], [0.4, -0.3], [0.4, 0.3]] as const) {
        ctx.beginPath();
        ctx.arc(centerX + radius * ox, centerY + radius * oy, spotRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPinkBall(ball: PinkBall): void {
    const centerX = ball.x * GRID_SIZE + GRID_SIZE / 2;
    const centerY = ball.y * GRID_SIZE + GRID_SIZE / 2;
    const radius = GRID_SIZE * 0.32;
    const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 180);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * pulse, 0, Math.PI * 2);
    ctx.fillStyle = '#ff79c6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function placeBug(): void {
    let attempts = 0;
    while (attempts < 80) {
        attempts += 1;
        const x = Math.floor(Math.random() * TILE_COUNT);
        const y = Math.floor(Math.random() * TILE_COUNT);
        if (!isOccupied(x, y) && !(pinkBall && pinkBall.x === x && pinkBall.y === y)) {
            bugX = x;
            bugY = y;
            return;
        }
    }
}

function handleDirection(dir: string): void {
    if (!isRunning || isPaused) {
        return;
    }

    switch (dir) {
        case 'up':
            if (velocityY !== 1) { velocityX = 0; velocityY = -1; }
            break;
        case 'down':
            if (velocityY !== -1) { velocityX = 0; velocityY = 1; }
            break;
        case 'left':
            if (velocityX !== 1) { velocityX = -1; velocityY = 0; }
            break;
        case 'right':
            if (velocityX !== -1) { velocityX = 1; velocityY = 0; }
            break;
    }
}

function onCharacterScreen(): boolean {
    return characterSelection.style.display === 'block';
}

function handleKeyPress(event: KeyboardEvent): void {
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

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
    }

    if (event.key === ' ') {
        togglePause();
        return;
    }

    if (!isRunning || isPaused) {
        return;
    }

    switch (event.key) {
        case 'ArrowUp':
            handleDirection('up');
            break;
        case 'ArrowDown':
            handleDirection('down');
            break;
        case 'ArrowLeft':
            handleDirection('left');
            break;
        case 'ArrowRight':
            handleDirection('right');
            break;
    }
}

function updateHud(): void {
    const wallet = getWallet();
    scoreElement.textContent = score.toString();
    highScoreElement.textContent = highScore.toString();
    bugsHud.textContent = `${runBugs} / ${wallet.bugs}`;
    pinkHud.textContent = `${runPink} / ${wallet.pink}`;
    livesHud.textContent = String(Math.max(0, lives));
    updateSpeedDisplay();
}

function updateSpeedDisplay(): void {
    const level = Math.floor(score / bugsPerSpeedIncrease) + 1;
    speedElement.textContent = level.toString();
}

function sendGameOver(finalScore: number): void {
    try {
        vscode.postMessage({
            command: 'gameOver',
            score: finalScore,
            difficulty: selectedDifficulty
        });
    } catch (error) {
        console.warn('Debug Snake could not send message:', error);
    }
}

function setupButtons(): void {
    init();
    startBtn?.addEventListener('click', startGame);
    pauseBtn?.addEventListener('click', togglePause);
    restartBtn?.addEventListener('click', restartGame);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButtons);
} else {
    setupButtons();
}
