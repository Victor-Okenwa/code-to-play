/**
 * game.ts - Whack-a-Bug Game Logic
 * 
 * TypeScript implementation of the Whack-a-Bug game.
 * Runs in VS Code webview with full type safety.
 */

// ========================================
// TYPE DEFINITIONS
// ========================================

interface Difficulty {
    name: string;
    spawnMin: number;
    spawnMax: number;
    bugDuration: number;
    pointsPerBug: number;
}

interface BugState {
    active: boolean;
    holeIndex: number;
    timer: number | null;
}

// ========================================
// DOM ELEMENT REFERENCES
// ========================================

const difficultySelection = document.getElementById('difficultySelection') as HTMLElement;
const gameArea = document.getElementById('gameArea') as HTMLElement;
const scoreElement = document.getElementById('score') as HTMLElement;
const highScoreElement = document.getElementById('highScore') as HTMLElement;
const timerElement = document.getElementById('timer') as HTMLElement;
const gameGrid = document.getElementById('gameGrid') as HTMLElement;
const gameOverElement = document.getElementById('gameOver') as HTMLElement;
const finalScoreElement = document.getElementById('finalScore') as HTMLElement;
const gameOverAlert = document.getElementById('gameOverAlert') as HTMLElement;
const alertScore = document.getElementById('alertScore') as HTMLElement;

// ========================================
// GAME CONSTANTS
// ========================================

const GAME_DURATION: number = 60; // seconds
const HOLE_COUNT: number = 9;

// ========================================
// DIFFICULTY SETTINGS
// ========================================

const difficulties: Record<string, Difficulty> = {
    easy: {
        name: 'Easy',
        spawnMin: 800,
        spawnMax: 1500,
        bugDuration: 1500,
        pointsPerBug: 10
    },
    medium: {
        name: 'Medium',
        spawnMin: 600,
        spawnMax: 1200,
        bugDuration: 1200,
        pointsPerBug: 15
    },
    hard: {
        name: 'Hard',
        spawnMin: 400,
        spawnMax: 1000,
        bugDuration: 900,
        pointsPerBug: 20
    }
};

// ========================================
// GAME STATE VARIABLES
// ========================================

let selectedDifficulty: string = 'easy';
let currentDifficulty: Difficulty = difficulties.easy;
let score: number = 0;
let highScore: number = 0;
let timeRemaining: number = GAME_DURATION;
let isPlaying: boolean = false;
let bugs: BugState[] = [];
let spawnTimer: number | null = null;
let countdownTimer: number | null = null;

// ========================================
// INITIALIZATION
// ========================================

function init(): void {
    loadHighScore();
    updateScoreDisplay();
    createHoles();
}

function loadHighScore(): void {
    const saved = localStorage.getItem(`whackBugHighScore_${selectedDifficulty}`);
    if (saved) {
        highScore = parseInt(saved, 10);
    }
}

function saveHighScore(): void {
    localStorage.setItem(`whackBugHighScore_${selectedDifficulty}`, highScore.toString());
}

function createHoles(): void {
    gameGrid.innerHTML = '';

    for (let i = 0; i < HOLE_COUNT; i++) {
        const hole = document.createElement('div');
        hole.className = 'hole';
        hole.dataset.index = i.toString();

        const bug = document.createElement('div');
        bug.className = 'bug';
        bug.innerHTML = createBugSVG();
        bug.addEventListener('click', () => whackBug(i));

        hole.appendChild(bug);
        gameGrid.appendChild(hole);

        bugs.push({ active: false, holeIndex: i, timer: null });
    }
}

function createBugSVG(): string {
    return `
        <svg viewBox="0 0 60 80" width="60" height="80">
            <ellipse cx="30" cy="40" rx="25" ry="32" fill="#cc0000"/>
            <line x1="30" y1="10" x2="30" y2="70" stroke="#000" stroke-width="3"/>
            <circle cx="20" cy="25" r="5" fill="#000"/>
            <circle cx="40" cy="25" r="5" fill="#000"/>
            <circle cx="20" cy="45" r="4" fill="#000"/>
            <circle cx="40" cy="45" r="4" fill="#000"/>
            <line x1="20" y1="8" x2="15" y2="0" stroke="#000" stroke-width="2"/>
            <line x1="40" y1="8" x2="45" y2="0" stroke="#000" stroke-width="2"/>
            <circle cx="15" cy="0" r="2" fill="#000"/>
            <circle cx="45" cy="0" r="2" fill="#000"/>
        </svg>
    `;
}

// ========================================
// DIFFICULTY SELECTION
// ========================================

function selectDifficulty(difficulty: string): void {
    // Only allow easy for now
    if (difficulty !== 'easy') return;

    selectedDifficulty = difficulty;

    // Update UI
    document.querySelectorAll('.difficulty-card').forEach(card => {
        card.classList.remove('active');
    });

    const selectedCard = document.getElementById(`${difficulty}Card`);
    if (selectedCard) {
        selectedCard.classList.add('active');
    }
}

function startGameMode(): void {
    if (selectedDifficulty !== 'easy') {
        alert('Only Easy mode is available in this version!');
        return;
    }

    currentDifficulty = difficulties[selectedDifficulty];
    loadHighScore();
    updateScoreDisplay();

    difficultySelection.style.display = 'none';
    gameArea.style.display = 'block';

    startGame();
}

function backToMenu(): void {
    stopGame();

    gameArea.style.display = 'none';
    difficultySelection.style.display = 'block';

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
}

// ========================================
// GAME CONTROL
// ========================================

function startGame(): void {
    score = 0;
    timeRemaining = GAME_DURATION;
    isPlaying = true;

    updateScoreDisplay();
    updateTimerDisplay();

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');

    bugs.forEach(bug => {
        bug.active = false;
        const holeElement = gameGrid.children[bug.holeIndex] as HTMLElement;
        const bugElement = holeElement.querySelector('.bug') as HTMLElement;
        bugElement.classList.remove('active');
    });

    startCountdown();
    scheduleNextBug();
}

function stopGame(): void {
    isPlaying = false;

    if (spawnTimer) {
        clearTimeout(spawnTimer);
        spawnTimer = null;
    }

    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }

    bugs.forEach(bug => {
        if (bug.timer) {
            clearTimeout(bug.timer);
            bug.timer = null;
        }
        bug.active = false;
    });
}

function endGame(): void {
    stopGame();

    if (score > highScore) {
        highScore = score;
        saveHighScore();
        updateScoreDisplay();
    }

    showGameOverAlert();

    setTimeout(() => {
        finalScoreElement.textContent = score.toString();
        gameOverElement.classList.add('show');
    }, 2500);
}

function showGameOverAlert(): void {
    alertScore.textContent = `Score: ${score}`;
    gameOverAlert.classList.add('show');

    setTimeout(() => {
        gameOverAlert.classList.remove('show');
    }, 2000);
}

function restartGame(): void {
    startGame();
}

// ========================================
// GAME LOGIC
// ========================================

function startCountdown(): void {
    countdownTimer = window.setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            endGame();
        }
    }, 1000);
}

function scheduleNextBug(): void {
    if (!isPlaying) return;

    const spawnDelay = getSpawnDelay();

    spawnTimer = window.setTimeout(() => {
        spawnBug();
        scheduleNextBug();
    }, spawnDelay);
}

function getSpawnDelay(): number {
    const progressFactor = 1 - (timeRemaining / GAME_DURATION);
    const range = currentDifficulty.spawnMax - currentDifficulty.spawnMin;
    const reduction = range * progressFactor * 0.5;

    const min = currentDifficulty.spawnMin - reduction;
    const max = currentDifficulty.spawnMax - reduction;

    return Math.random() * (max - min) + min;
}

function spawnBug(): void {
    if (!isPlaying) return;

    const availableHoles = bugs
        .map((bug, index) => ({ bug, index }))
        .filter(({ bug }) => !bug.active);

    if (availableHoles.length === 0) return;

    const randomHole = availableHoles[Math.floor(Math.random() * availableHoles.length)];
    const holeIndex = randomHole.index;
    const bug = bugs[holeIndex];

    bug.active = true;

    const holeElement = gameGrid.children[holeIndex] as HTMLElement;
    const bugElement = holeElement.querySelector('.bug') as HTMLElement;
    bugElement.classList.add('active');

    bug.timer = window.setTimeout(() => {
        hideBug(holeIndex);
    }, currentDifficulty.bugDuration);
}

function hideBug(holeIndex: number): void {
    const bug = bugs[holeIndex];

    if (bug.timer) {
        clearTimeout(bug.timer);
        bug.timer = null;
    }

    bug.active = false;

    const holeElement = gameGrid.children[holeIndex] as HTMLElement;
    const bugElement = holeElement.querySelector('.bug') as HTMLElement;
    bugElement.classList.remove('active');
}

function whackBug(holeIndex: number): void {
    const bug = bugs[holeIndex];

    if (!isPlaying || !bug.active) return;

    score += currentDifficulty.pointsPerBug;
    updateScoreDisplay();

    const holeElement = gameGrid.children[holeIndex] as HTMLElement;
    const bugElement = holeElement.querySelector('.bug') as HTMLElement;

    bugElement.classList.add('squashed');

    showScorePopup(holeElement, currentDifficulty.pointsPerBug);

    setTimeout(() => {
        bugElement.classList.remove('squashed');
    }, 300);

    hideBug(holeIndex);
}

function showScorePopup(holeElement: HTMLElement, points: number): void {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `+${points}`;

    holeElement.appendChild(popup);

    setTimeout(() => {
        popup.remove();
    }, 1000);
}

// ========================================
// UI UPDATES
// ========================================

function updateScoreDisplay(): void {
    scoreElement.textContent = score.toString();
    highScoreElement.textContent = highScore.toString();
}

function updateTimerDisplay(): void {
    timerElement.textContent = timeRemaining.toString();

    if (timeRemaining <= 10) {
        timerElement.classList.add('warning');
    } else {
        timerElement.classList.remove('warning');
    }
}

// ========================================
// INITIALIZE ON LOAD
// ========================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

(window as any).selectDifficulty = selectDifficulty;
(window as any).startGameMode = startGameMode;
(window as any).backToMenu = backToMenu;
(window as any).restartGame = restartGame;