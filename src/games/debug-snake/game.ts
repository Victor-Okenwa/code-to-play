/**
 * game.ts - Debug Snake Game Logic
 * 
 * TypeScript implementation of the Debug Snake game.
 * Runs in VS Code webview with full type safety.
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
// DOM ELEMENT REFERENCES
// ========================================

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const scoreElement = document.getElementById('score') as HTMLElement;
const highScoreElement = document.getElementById('highScore') as HTMLElement;
const speedElement = document.getElementById('speed') as HTMLElement;
const gameOverElement = document.getElementById('gameOver') as HTMLElement;
const finalScoreElement = document.getElementById('finalScore') as HTMLElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
const gameOverAlert = document.getElementById('gameOverAlert') as HTMLElement;
const alertScore = document.getElementById('alertScore') as HTMLElement;

// ========================================
// GAME CONSTANTS
// ========================================

const gridSize: number = 20;
const tileCount: number = canvas.width / gridSize;

// ========================================
// GAME STATE VARIABLES
// ========================================

let snake: SnakeSegment[] = [];
let snakeLength: number = 3;
let snakeX: number = 10;
let snakeY: number = 10;
let velocityX: number = 0;
let velocityY: number = 0;
let bugX: number = 15;
let bugY: number = 15;
let score: number = 0;
let highScore: number = 0;
let gameLoop: number | null = null;
let gameSpeed: number = 200;
let isRunning: boolean = false;
let isPaused: boolean = false;

// ========================================
// INITIALIZATION
// ========================================

function init(): void {
    loadHighScore();
    updateScoreDisplay();
    placeBug();
    setupEventListeners();
}

function loadHighScore(): void {
    const saved = localStorage.getItem('snakeHighScore');
    if (saved) {
        highScore = parseInt(saved, 10);
    }
}

function saveHighScore(): void {
    localStorage.setItem('snakeHighScore', highScore.toString());
}

function setupEventListeners(): void {
    document.addEventListener('keydown', handleKeyPress);
}

// ========================================
// GAME CONTROL
// ========================================

function startGame(): void {
    if (isRunning) return;

    snake = [];
    snakeLength = 3;
    snakeX = 10;
    snakeY = 10;
    velocityX = 0;
    velocityY = 0;
    score = 0;
    gameSpeed = 200;
    isPaused = false;

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');

    updateScoreDisplay();
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';

    placeBug();

    isRunning = true;
    runGameLoop();
}

function runGameLoop(): void {
    if (gameLoop) {
        clearTimeout(gameLoop);
    }

    if (!isRunning || isPaused) return;

    update();
    draw();

    gameLoop = window.setTimeout(() => runGameLoop(), gameSpeed);
}

function togglePause(): void {
    if (!isRunning) return;

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';

    if (!isPaused) {
        runGameLoop();
    }
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

    showGameOverAlert();

    setTimeout(() => {
        finalScoreElement.textContent = score.toString();
        gameOverElement.classList.add('show');
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
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

    if (snakeX < 0 || snakeX >= tileCount || snakeY < 0 || snakeY >= tileCount) {
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
        placeBug();

        if (score % 5 === 0) {
            gameSpeed = Math.max(50, gameSpeed * 0.85);
            updateSpeedDisplay();
        }
    }
}

function draw(): void {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawSnake();
    drawBug();
}

function drawSnake(): void {
    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        const isHead = i === snake.length - 1;

        const size = isHead ? gridSize * 0.95 : gridSize * 0.9;
        const centerX = segment.x * gridSize + gridSize / 2;
        const centerY = segment.y * gridSize + gridSize / 2;
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
    const centerX = bugX * gridSize + gridSize / 2;
    const centerY = bugY * gridSize + gridSize / 2;
    const radius = gridSize * 0.4;

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
        bugX = Math.floor(Math.random() * tileCount);
        bugY = Math.floor(Math.random() * tileCount);

        validPosition = true;
        for (const segment of snake) {
            if (segment.x === bugX && segment.y === bugY) {
                validPosition = false;
                break;
            }
        }
    }
}

// ========================================
// INPUT HANDLING
// ========================================

function handleKeyPress(event: KeyboardEvent): void {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
    }

    if (event.key === ' ') {
        togglePause();
        return;
    }

    if (!isRunning || isPaused) return;

    switch (event.key) {
        case 'ArrowUp':
            if (velocityY !== 1) {
                velocityX = 0;
                velocityY = -1;
            }
            break;
        case 'ArrowDown':
            if (velocityY !== -1) {
                velocityX = 0;
                velocityY = 1;
            }
            break;
        case 'ArrowLeft':
            if (velocityX !== 1) {
                velocityX = -1;
                velocityY = 0;
            }
            break;
        case 'ArrowRight':
            if (velocityX !== -1) {
                velocityX = 1;
                velocityY = 0;
            }
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
    const level = Math.floor(score / 5) + 1;
    speedElement.textContent = level.toString();
}

// ========================================
// INITIALIZE ON LOAD
// ========================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

(window as any).startGame = startGame;
(window as any).togglePause = togglePause;
(window as any).restartGame = restartGame;