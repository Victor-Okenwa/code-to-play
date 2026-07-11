/**
 * game.ts - Debug Snake Game Logic
 * 
 */

// ========================================
// TYPE DEFINITIONS
// ========================================

interface SnakeSegment {
    x: number;
    y: number;
}

interface Position {
    x: number;
    y: number;
}
// ========================================
// DECLARE GLOBAL VSCODE API
// This is injected by WebviewManager, not imported
// ========================================

declare const vscode: {
    postMessage(message: any): void;
};

// Declare SoundManager as global (injected by WebviewManager)
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

// ========================================
// TYPE DEFINITIONS
// ========================================

interface SnakeDifficulty {
    name: string;
    label: string;
    initialSpeed: number;
    minSpeed: number;
    speedMultiplier: number;
    bugsPerSpeedIncrease: number;
}

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const scoreElement = document.getElementById('score') as HTMLElement;
const highScoreElement = document.getElementById('highScore') as HTMLElement;
const speedElement = document.getElementById('speed') as HTMLElement;
const gameOverElement = document.getElementById('gameOver') as HTMLElement;
const finalScoreElement = document.getElementById('finalScore') as HTMLElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
const restartBtn = document.getElementById('restartBtn') as HTMLButtonElement;
const gameOverAlert = document.getElementById('gameOverAlert') as HTMLElement;
const alertScore = document.getElementById('alertScore') as HTMLElement;
const difficultySelection = document.getElementById('difficultySelection') as HTMLElement;
const gamePlay = document.getElementById('gamePlay') as HTMLElement;
const enterGameBtn = document.getElementById('enterGameBtn') as HTMLButtonElement;
const backToMenuBtn = document.getElementById('backToMenuBtn') as HTMLButtonElement;

// ========================================
// GAME CONFIGURATION CONSTANTS
// ========================================

const GRID_SIZE: number = 20;
const TILE_COUNT: number = canvas.width / GRID_SIZE;
const INITIAL_SNAKE_LENGTH: number = 3;
const INITIAL_SNAKE_X: number = 10;
const INITIAL_SNAKE_Y: number = 10;

const difficulties: Record<string, SnakeDifficulty> = {
    easy: {
        name: 'Easy',
        label: 'Easy',
        initialSpeed: 220,
        minSpeed: 80,
        speedMultiplier: 0.88,
        bugsPerSpeedIncrease: 6
    },
    hard: {
        name: 'Hard',
        label: 'Hard',
        initialSpeed: 160,
        minSpeed: 60,
        speedMultiplier: 0.85,
        bugsPerSpeedIncrease: 5
    },
    veryHard: {
        name: 'Very Hard',
        label: 'Very Hard',
        initialSpeed: 110,
        minSpeed: 45,
        speedMultiplier: 0.82,
        bugsPerSpeedIncrease: 4
    }
};

// ========================================
// GAME STATE VARIABLES
// ========================================

let selectedDifficulty: string = 'easy';
let currentDifficulty: SnakeDifficulty = difficulties.easy;
let bugsPerSpeedIncrease: number = currentDifficulty.bugsPerSpeedIncrease;
let minSpeed: number = currentDifficulty.minSpeed;
let speedMultiplier: number = currentDifficulty.speedMultiplier;

let snake: SnakeSegment[] = [];
let snakeLength: number = INITIAL_SNAKE_LENGTH;
let snakeX: number = INITIAL_SNAKE_X;
let snakeY: number = INITIAL_SNAKE_Y;
let velocityX: number = 0;
let velocityY: number = 0;
let bugX: number = 15;
let bugY: number = 15;
let score: number = 0;
let highScore: number = 0;
let gameLoop: number | null = null;
let gameSpeed: number = currentDifficulty.initialSpeed;
let isRunning: boolean = false;
let isPaused: boolean = false;

// ========================================
// INITIALIZATION
// ========================================

function init(): void {
    if (typeof initGameChrome === 'function') {
        initGameChrome();
    }

    if (typeof soundManager !== 'undefined' && soundManager.preloadAll) {
        soundManager.preloadAll();
    }

    setupDifficultySelection();
    loadHighScore();
    updateScoreDisplay();
    updateSpeedDisplay();
    placeBug();
    setupEventListeners();
    drawInitialState();
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

    if (enterGameBtn) {
        enterGameBtn.addEventListener('click', enterGame);
    }

    if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', backToMenu);
    }
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

    const selectedCard = document.getElementById(`${difficulty}Card`);
    if (selectedCard) {
        selectedCard.classList.add('active');
    }

    loadHighScore();
    updateScoreDisplay();
}

function enterGame(): void {
    currentDifficulty = difficulties[selectedDifficulty];
    bugsPerSpeedIncrease = currentDifficulty.bugsPerSpeedIncrease;
    minSpeed = currentDifficulty.minSpeed;
    speedMultiplier = currentDifficulty.speedMultiplier;
    gameSpeed = currentDifficulty.initialSpeed;

    loadHighScore();
    updateScoreDisplay();

    difficultySelection.style.display = 'none';
    gamePlay.style.display = 'block';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(currentDifficulty.label);
        gameChrome.refreshToolbarPhase();
    }

    notifyGameStateChanged();
}

function backToMenu(): void {
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
    difficultySelection.style.display = 'block';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge('');
        gameChrome.refreshToolbarPhase();
    }

    drawInitialState();
    notifyGameStateChanged();
}

function loadHighScore(): void {
    const saved = localStorage.getItem(`snakeHighScore_${selectedDifficulty}`);
    if (saved) {
        highScore = parseInt(saved, 10);
    }
}

function saveHighScore(): void {
    localStorage.setItem(`snakeHighScore_${selectedDifficulty}`, highScore.toString());
}

function notifyGameStateChanged(): void {
    window.dispatchEvent(new CustomEvent('gameChrome:gameStateChanged'));
}

function setupEventListeners(): void {
    document.addEventListener('keydown', handleKeyPress);

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

// ========================================
// INITIAL STATE DRAWING
// ========================================

function drawInitialState(): void {
    // Clear canvas
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
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

    // Draw initial snake (just the head)
    const centerX = INITIAL_SNAKE_X * GRID_SIZE + GRID_SIZE / 2;
    const centerY = INITIAL_SNAKE_Y * GRID_SIZE + GRID_SIZE / 2;
    const radius = GRID_SIZE * 0.95 / 2;

    const gradient = ctx.createRadialGradient(
        centerX - radius / 3,
        centerY - radius / 3,
        0,
        centerX,
        centerY,
        radius
    );
    gradient.addColorStop(0, '#5dd9b8');
    gradient.addColorStop(1, '#4ec9b0');

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX - radius / 3, centerY - radius / 3, radius / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();

    drawBug();
}

// ========================================
// GAME LIFECYCLE CONTROL
// ========================================

function startGame(): void {
    // ✅ Play start sound using global soundManager
    if (typeof soundManager !== 'undefined') {
        soundManager.playById('popSound');
    } else {
        console.warn('[Debug Snake] SoundManager not available');
    }

    // Reset game state
    snake = [];
    snakeLength = INITIAL_SNAKE_LENGTH;
    snakeX = INITIAL_SNAKE_X;
    snakeY = INITIAL_SNAKE_Y;
    velocityX = 1;
    velocityY = 0;
    score = 0;
    gameSpeed = currentDifficulty.initialSpeed;
    isPaused = false;

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');

    updateScoreDisplay();
    updateSpeedDisplay();
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';

    placeBug();

    isRunning = true;
    runGameLoop();
    notifyGameStateChanged();
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

    gameLoop = window.setTimeout(() => runGameLoop(), gameSpeed);
}

function togglePause(): void {
    if (!isRunning) {
        return;
    }

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';

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
        updateScoreDisplay();
    }

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
    alertScore.textContent = `Bugs Fixed: ${score}`;
    gameOverAlert.classList.add('show');

    setTimeout(() => {
        gameOverAlert.classList.remove('show');
    }, 2000);
}

// ========================================
// GAME LOGIC
// ========================================

function update(): void {
    snakeX += velocityX;
    snakeY += velocityY;

    if (snakeX < 0 || snakeX >= TILE_COUNT || snakeY < 0 || snakeY >= TILE_COUNT) {
        endGame();
        return;
    }

    snake.push({ x: snakeX, y: snakeY });

    while (snake.length > snakeLength) {
        snake.shift();
    }

    for (let i = 0; i < snake.length - 1; i++) {
        if (snake[i].x === snakeX && snake[i].y === snakeY) {
            endGame();
            return;
        }
    }

    if (snakeX === bugX && snakeY === bugY) {
        score++;
        snakeLength++;
        updateScoreDisplay();
        // Play slurp sound as snakes eats
        soundManager.playById('slurpSound');
        placeBug();

        if (score % bugsPerSpeedIncrease === 0) {
            gameSpeed = Math.max(minSpeed, gameSpeed * speedMultiplier);
            updateSpeedDisplay();
        }
    }
}

// ========================================
// RENDERING
// ========================================

function draw(): void {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    drawSnake();
    drawBug();
}

function drawSnake(): void {
    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        const isHead = i === snake.length - 1;

        const size = isHead ? GRID_SIZE * 0.95 : GRID_SIZE * 0.9;
        const centerX = segment.x * GRID_SIZE + GRID_SIZE / 2;
        const centerY = segment.y * GRID_SIZE + GRID_SIZE / 2;
        const radius = size / 2;

        const gradient = ctx.createRadialGradient(
            centerX - radius / 3,
            centerY - radius / 3,
            0,
            centerX,
            centerY,
            radius
        );
        gradient.addColorStop(0, '#5dd9b8');
        gradient.addColorStop(1, '#4ec9b0');

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        if (!isHead) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(46, 125, 108, 0.5)';
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(centerX - radius / 3, centerY - radius / 3, radius / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
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

    ctx.beginPath();
    ctx.arc(centerX - radius * 0.4, centerY - radius * 0.3, spotRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX - radius * 0.4, centerY + radius * 0.3, spotRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX + radius * 0.4, centerY - radius * 0.3, spotRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX + radius * 0.4, centerY + radius * 0.3, spotRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(centerX - radius * 0.3, centerY - radius);
    ctx.lineTo(centerX - radius * 0.5, centerY - radius * 1.5);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + radius * 0.3, centerY - radius);
    ctx.lineTo(centerX + radius * 0.5, centerY - radius * 1.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX - radius * 0.5, centerY - radius * 1.5, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX + radius * 0.5, centerY - radius * 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
}

function placeBug(): void {
    let validPosition = false;

    while (!validPosition) {
        bugX = Math.floor(Math.random() * TILE_COUNT);
        bugY = Math.floor(Math.random() * TILE_COUNT);

        validPosition = true;

        for (const segment of snake) {
            if (segment.x === bugX && segment.y === bugY) {
                validPosition = false;
                break;
            }
        }

        if (bugX === snakeX && bugY === snakeY) {
            validPosition = false;
        }
    }
}

// ========================================
// INPUT HANDLING
// ========================================

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

function handleKeyPress(event: KeyboardEvent): void {
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

// ========================================
// UI UPDATES
// ========================================

function updateScoreDisplay(): void {
    scoreElement.textContent = score.toString();
    highScoreElement.textContent = highScore.toString();
}

function updateSpeedDisplay(): void {
    const level = Math.floor(score / bugsPerSpeedIncrease) + 1;
    speedElement.textContent = level.toString();
}

// ========================================
// VS CODE COMMUNICATION
// ========================================

function sendGameOver(finalScore: number): void {
    try {
        vscode.postMessage({
            command: 'gameOver',
            score: finalScore
        });
    } catch (error) {
        console.warn('Debug Snake Could not send message:', error);
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupButtons(): void {
    init();

    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', togglePause);
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', restartGame);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButtons);
} else {
    setupButtons();
}