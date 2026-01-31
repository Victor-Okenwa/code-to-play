/**
 * game.ts - Debug Snake Game Logic
 * 
 * Classic Snake game with debugging theme
 * - Control green snake to catch red ladybugs
 * - Snake grows longer with each bug caught
 * - Speed increases every 5 bugs
 * - Avoid walls and self-collision
 * 
 * Controls:
 * - Arrow Keys: Move snake
 * - Space: Pause/Resume
 * 
 * @author Code to Play Extension
 * @version 1.0.0
 */

// ========================================
// TYPE DEFINITIONS
// ========================================

/**
 * Represents a single segment of the snake's body
 */
interface SnakeSegment {
    /** X coordinate on the grid (0 to tileCount-1) */
    x: number;
    /** Y coordinate on the grid (0 to tileCount-1) */
    y: number;
}

/**
 * Represents a position on the grid
 */
interface Position {
    /** X coordinate */
    x: number;
    /** Y coordinate */
    y: number;
}

// ========================================
// DOM ELEMENT REFERENCES
// Cached for performance - retrieved once at load
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
// GAME CONFIGURATION CONSTANTS
// ========================================

/** Size of each grid tile in pixels */
const GRID_SIZE: number = 20;

/** Number of tiles across the canvas (20x20 grid) */
const TILE_COUNT: number = canvas.width / GRID_SIZE;

/** Initial game speed in milliseconds per frame */
const INITIAL_SPEED: number = 200;

/** Minimum speed (game won't go faster than this) */
const MIN_SPEED: number = 50;

/** Speed multiplier when difficulty increases (0.85 = 15% faster) */
const SPEED_MULTIPLIER: number = 0.85;

/** Number of bugs to catch before speed increases */
const BUGS_PER_SPEED_INCREASE: number = 5;

/** Initial snake length */
const INITIAL_SNAKE_LENGTH: number = 3;

/** Initial snake position */
const INITIAL_SNAKE_X: number = 10;
const INITIAL_SNAKE_Y: number = 10;

// ========================================
// GAME STATE VARIABLES
// Mutable state that changes during gameplay
// ========================================

/** Array of snake body segments (tail to head) */
let snake: SnakeSegment[] = [];

/** Current length of the snake */
let snakeLength: number = INITIAL_SNAKE_LENGTH;

/** Current X position of snake head */
let snakeX: number = INITIAL_SNAKE_X;

/** Current Y position of snake head */
let snakeY: number = INITIAL_SNAKE_Y;

/** Horizontal velocity (-1=left, 0=stopped, 1=right) */
let velocityX: number = 0;

/** Vertical velocity (-1=up, 0=stopped, 1=down) */
let velocityY: number = 0;

/** Current X position of the bug to catch */
let bugX: number = 15;

/** Current Y position of the bug to catch */
let bugY: number = 15;

/** Current score (number of bugs caught) */
let score: number = 0;

/** Highest score achieved (persisted in localStorage) */
let highScore: number = 0;

/** Game loop timer ID (for clearTimeout) */
let gameLoop: number | null = null;

/** Current game speed in milliseconds */
let gameSpeed: number = INITIAL_SPEED;

/** Whether the game is currently running */
let isRunning: boolean = false;

/** Whether the game is currently paused */
let isPaused: boolean = false;

// ========================================
// INITIALIZATION
// Called once when the page loads
// ========================================

/**
 * Initialize the game
 * Sets up event listeners and loads saved data
 */
function init(): void {
    loadHighScore();
    updateScoreDisplay();
    placeBug();
    setupEventListeners();
}

/**
 * Load high score from localStorage
 */
function loadHighScore(): void {
    const saved = localStorage.getItem('snakeHighScore');
    if (saved) {
        highScore = parseInt(saved, 10);
    }
}

/**
 * Save high score to localStorage
 */
function saveHighScore(): void {
    localStorage.setItem('snakeHighScore', highScore.toString());
}

/**
 * Set up keyboard event listeners
 */
function setupEventListeners(): void {
    document.addEventListener('keydown', handleKeyPress);
}

// ========================================
// GAME LIFECYCLE CONTROL
// Functions that control game start, pause, restart, end
// ========================================

/**
 * Start a new game
 * Resets all game state to initial values
 */
console.log("Debug Game starting")
function startGame(): void {
    // Prevent starting if already running
    if (isRunning) {
        return;
    };

    // Reset all game state
    snake = [];
    snakeLength = INITIAL_SNAKE_LENGTH;
    snakeX = INITIAL_SNAKE_X;
    snakeY = INITIAL_SNAKE_Y;
    velocityX = 0;
    velocityY = 0;
    score = 0;
    gameSpeed = INITIAL_SPEED;
    isPaused = false;

    // Hide game over screens
    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');

    // Update UI
    updateScoreDisplay();
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';

    // Place first bug
    placeBug();

    // Start the game loop
    isRunning = true;
    runGameLoop();
}

/**
 * Main game loop
 * Updates game state and renders at specified speed
 */
function runGameLoop(): void {
    // Clear any existing timeout
    if (gameLoop) {
        clearTimeout(gameLoop);
    }

    // Don't run if game is stopped or paused
    if (!isRunning || isPaused) {
        return;
    }

    // Update game state
    update();

    // Render current state
    draw();

    // Schedule next frame
    gameLoop = window.setTimeout(() => runGameLoop(), gameSpeed);
}

/**
 * Toggle pause state
 * Pauses or resumes the game
 */
function togglePause(): void {
    if (!isRunning) {
        return;
    }

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';

    // Resume game loop if unpausing
    if (!isPaused) {
        runGameLoop();
    }
}

/**
 * Restart the game
 * Alias for startGame - used by restart button
 */
function restartGame(): void {
    startGame();
}

/**
 * End the game
 * Shows game over screen and updates high score
 */
function endGame(): void {
    isRunning = false;
    isPaused = false;

    // Stop game loop
    if (gameLoop) {
        clearTimeout(gameLoop);
        gameLoop = null;
    }

    // Update high score if beaten
    if (score > highScore) {
        highScore = score;
        saveHighScore();
        updateScoreDisplay();
    }

    // Show game over alert (2 second overlay)
    showGameOverAlert();

    // Show full game over screen after alert fades
    setTimeout(() => {
        finalScoreElement.textContent = score.toString();
        gameOverElement.classList.add('show');
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
    }, 2500);
}

/**
 * Show the game over alert overlay
 * Full-screen red overlay with score
 */
function showGameOverAlert(): void {
    alertScore.textContent = `Bugs Fixed: ${score}`;
    gameOverAlert.classList.add('show');

    // Fade out after 2 seconds
    setTimeout(() => {
        gameOverAlert.classList.remove('show');
    }, 2000);
}

// ========================================
// GAME LOGIC
// Core game mechanics - collision, scoring, movement
// ========================================

/**
 * Update game state for current frame
 * Handles movement, collision detection, and scoring
 */
function update(): void {
    // Move snake head
    snakeX += velocityX;
    snakeY += velocityY;

    // Check wall collision
    if (snakeX < 0 || snakeX >= TILE_COUNT || snakeY < 0 || snakeY >= TILE_COUNT) {
        endGame();
        return;
    }

    // Add new head position to snake
    snake.push({ x: snakeX, y: snakeY });

    // Remove tail segments to maintain correct length
    while (snake.length > snakeLength) {
        snake.shift();
    }

    // Check self collision (snake hitting its own body)
    for (let i = 0; i < snake.length - 1; i++) {
        if (snake[i].x === snakeX && snake[i].y === snakeY) {
            endGame();
            return;
        }
    }

    // Check bug collision
    if (snakeX === bugX && snakeY === bugY) {
        // Bug caught!
        score++;
        snakeLength++;
        updateScoreDisplay();
        placeBug();

        // Increase speed every 5 bugs
        if (score % BUGS_PER_SPEED_INCREASE === 0) {
            gameSpeed = Math.max(MIN_SPEED, gameSpeed * SPEED_MULTIPLIER);
            updateSpeedDisplay();
        }
    }
}

// ========================================
// RENDERING
// Functions that draw the game to the canvas
// ========================================

/**
 * Draw the complete game state
 * Clears canvas and draws all game elements
 */
function draw(): void {
    // Clear canvas with dark background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw game elements
    drawSnake();
    drawBug();
}

/**
 * Draw the snake on the canvas
 * Uses circular segments with gradient and shine effect
 */
function drawSnake(): void {
    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        const isHead = i === snake.length - 1;

        // Calculate segment properties
        const size = isHead ? GRID_SIZE * 0.95 : GRID_SIZE * 0.9;
        const centerX = segment.x * GRID_SIZE + GRID_SIZE / 2;
        const centerY = segment.y * GRID_SIZE + GRID_SIZE / 2;
        const radius = size / 2;

        // Create gradient for 3D effect
        const gradient = ctx.createRadialGradient(
            centerX - radius / 3,  // Light source from top-left
            centerY - radius / 3,
            0,
            centerX,
            centerY,
            radius
        );
        gradient.addColorStop(0, '#5dd9b8');  // Lighter green
        gradient.addColorStop(1, '#4ec9b0');  // VS Code teal

        // Draw main segment circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Add darker marking on body segments (not head)
        if (!isHead) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(46, 125, 108, 0.5)';
            ctx.fill();
        }

        // Add shine effect
        ctx.beginPath();
        ctx.arc(centerX - radius / 3, centerY - radius / 3, radius / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
    }
}

/**
 * Draw the bug (ladybug) on the canvas
 * Draws a red circle with black spots and antennae
 */
function drawBug(): void {
    const centerX = bugX * GRID_SIZE + GRID_SIZE / 2;
    const centerY = bugY * GRID_SIZE + GRID_SIZE / 2;
    const radius = GRID_SIZE * 0.4;

    // Draw red body
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#cc0000';
    ctx.fill();

    // Draw center line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw spots
    const spotRadius = radius * 0.25;

    // Left spots
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.4, centerY - radius * 0.3, spotRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX - radius * 0.4, centerY + radius * 0.3, spotRadius, 0, Math.PI * 2);
    ctx.fill();

    // Right spots
    ctx.beginPath();
    ctx.arc(centerX + radius * 0.4, centerY - radius * 0.3, spotRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX + radius * 0.4, centerY + radius * 0.3, spotRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw antennae
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

    // Draw antenna tips
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.5, centerY - radius * 1.5, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX + radius * 0.5, centerY - radius * 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Place bug at a random position
 * Ensures bug doesn't spawn on the snake
 */
function placeBug(): void {
    let validPosition = false;

    while (!validPosition) {
        // Generate random position
        bugX = Math.floor(Math.random() * TILE_COUNT);
        bugY = Math.floor(Math.random() * TILE_COUNT);

        // Check if position overlaps with snake
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
// Keyboard controls for the game
// ========================================

/**
 * Handle keyboard input
 * Controls: Arrow keys for direction, Space for pause
 * 
 * @param event - Keyboard event
 */
function handleKeyPress(event: KeyboardEvent): void {
    // Prevent arrow keys from scrolling the page
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
    }

    // Space key toggles pause
    if (event.key === ' ') {
        togglePause();
        return;
    }

    // Don't change direction if game not running or paused
    if (!isRunning || isPaused) {
        return;
    }

    // Change direction based on arrow key
    // Prevent 180-degree turns (can't turn directly backwards)
    switch (event.key) {
        case 'ArrowUp':
            if (velocityY !== 1) {  // Not moving down
                velocityX = 0;
                velocityY = -1;
            }
            break;

        case 'ArrowDown':
            if (velocityY !== -1) {  // Not moving up
                velocityX = 0;
                velocityY = 1;
            }
            break;

        case 'ArrowLeft':
            if (velocityX !== 1) {  // Not moving right
                velocityX = -1;
                velocityY = 0;
            }
            break;

        case 'ArrowRight':
            if (velocityX !== -1) {  // Not moving left
                velocityX = 1;
                velocityY = 0;
            }
            break;
    }
}

// ========================================
// UI UPDATES
// Functions that update the score/speed display
// ========================================

/**
 * Update the score and high score display
 */
function updateScoreDisplay(): void {
    scoreElement.textContent = score.toString();
    highScoreElement.textContent = highScore.toString();
}

/**
 * Update the speed level display
 * Speed level = (score / 5) + 1
 */
function updateSpeedDisplay(): void {
    const level = Math.floor(score / BUGS_PER_SPEED_INCREASE) + 1;
    speedElement.textContent = level.toString();
}

// ========================================
// INITIALIZATION
// Auto-start when page loads
// ========================================

// Initialize game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Expose functions to global scope for onclick handlers in HTML
(window as any).startGame = startGame;
(window as any).togglePause = togglePause;
(window as any).restartGame = restartGame;