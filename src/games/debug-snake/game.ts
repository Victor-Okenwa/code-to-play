/**
 * game.ts - Debug Snake Game Logic
 * 
 * Fixed version with proper VS Code API usage
 * - No vscode imports (this runs in browser, not Node.js)
 * - Uses global vscode variable injected by WebviewManager
 */

import { GameManager } from "../../core/GameManager";

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
const restartBtn = document.getElementById('restartBtn') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const gameOverAlert = document.getElementById('gameOverAlert') as HTMLElement;
const alertScore = document.getElementById('alertScore') as HTMLElement;

// ========================================
// GAME CONFIGURATION CONSTANTS
// ========================================

const GRID_SIZE: number = 20;
const TILE_COUNT: number = canvas.width / GRID_SIZE;
const INITIAL_SPEED: number = 200;
const MIN_SPEED: number = 50;
const SPEED_MULTIPLIER: number = 0.85;
const BUGS_PER_SPEED_INCREASE: number = 5;
const INITIAL_SNAKE_LENGTH: number = 3;
const INITIAL_SNAKE_X: number = 10;
const INITIAL_SNAKE_Y: number = 10;

// ========================================
// GAME STATE VARIABLES
// ========================================

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
let gameSpeed: number = INITIAL_SPEED;
let isRunning: boolean = false;
let isPaused: boolean = false;

// ========================================
// INITIALIZATION
// ========================================

function init(): void {
    loadHighScore();
    updateScoreDisplay();
    updateSpeedDisplay();
    placeBug();
    setupEventListeners();

    // Draw initial state so grid lines are visible
    drawInitialState();

    // if (highScore > 0 && resetBtn) {
    //     resetBtn.style.display = 'inline-block';
    // }
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


    if (isRunning) {
        return;
    }

    // Reset game state
    snake = [];
    snakeLength = INITIAL_SNAKE_LENGTH;
    snakeX = INITIAL_SNAKE_X;
    snakeY = INITIAL_SNAKE_Y;
    velocityX = 1;
    velocityY = 0;
    score = 0;
    gameSpeed = INITIAL_SPEED;
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
        placeBug();

        if (score % BUGS_PER_SPEED_INCREASE === 0) {
            gameSpeed = Math.max(MIN_SPEED, gameSpeed * SPEED_MULTIPLIER);
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
    const level = Math.floor(score / BUGS_PER_SPEED_INCREASE) + 1;
    speedElement.textContent = level.toString();
}

// ========================================
// VS CODE COMMUNICATION
// ========================================

/**
 * Sends game over message to VS Code extension
 * Uses the global vscode variable (no import needed!)
 */
function sendGameOver(finalScore: number): void {
    try {
        // vscode is available globally (injected by WebviewManager)
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

// ========================================
// INITIALIZE ON LOAD
// ========================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButtons);
} else {
    setupButtons();
}