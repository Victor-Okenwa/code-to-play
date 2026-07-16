/**
 * game.ts - Whack-a-Bug Game Logic
 *
 */

// ========================================
// DECLARE GLOBAL VSCODE API
// This is injected by WebviewManager, not imported
// ========================================

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

// ========================================
// TYPE DEFINITIONS
// ========================================

type BugKind = 'whack' | 'avoid';

interface BugTypeDef {
    id: string;
    kind: BugKind;
    points: number;
    cssClass: string;
    weight: number;
}

interface Difficulty {
    name: string;
    spawnMin: number;
    spawnMax: number;
    bugDuration: number;
    bugTypes: BugTypeDef[];
    legend: string;
}

interface BugState {
    active: boolean;
    holeIndex: number;
    timer: number | null;
    typeId: string | null;
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
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
const bugLegend = document.getElementById('bugLegend') as HTMLElement;

// ========================================
// GAME CONSTANTS
// ========================================

const GAME_DURATION: number = 60;
const HOLE_COUNT: number = 9;

const BUG_TYPE_COMMON: BugTypeDef = {
    id: 'common',
    kind: 'whack',
    points: 10,
    cssClass: 'bug--common',
    weight: 1
};

const BUG_TYPE_SYNTAX: BugTypeDef = {
    id: 'syntax',
    kind: 'whack',
    points: 10,
    cssClass: 'bug--syntax',
    weight: 3
};

const BUG_TYPE_NULL_REF: BugTypeDef = {
    id: 'nullRef',
    kind: 'whack',
    points: 15,
    cssClass: 'bug--null-ref',
    weight: 3
};

const BUG_TYPE_OVERFLOW: BugTypeDef = {
    id: 'overflow',
    kind: 'whack',
    points: 20,
    cssClass: 'bug--overflow',
    weight: 2
};

const BUG_TYPE_FEATURE: BugTypeDef = {
    id: 'feature',
    kind: 'avoid',
    points: -25,
    cssClass: 'bug--feature',
    weight: 2
};

const BUG_TYPE_CRITICAL: BugTypeDef = {
    id: 'critical',
    kind: 'whack',
    points: 30,
    cssClass: 'bug--critical',
    weight: 1
};

// ========================================
// DIFFICULTY SETTINGS
// ========================================

const difficulties: Record<string, Difficulty> = {
    easy: {
        name: 'Easy',
        spawnMin: 800,
        spawnMax: 1500,
        bugDuration: 1500,
        bugTypes: [BUG_TYPE_COMMON],
        legend: ''
    },
    medium: {
        name: 'Medium',
        spawnMin: 600,
        spawnMax: 1200,
        bugDuration: 1200,
        bugTypes: [BUG_TYPE_SYNTAX, BUG_TYPE_NULL_REF, BUG_TYPE_OVERFLOW],
        legend: 'Syntax +10 · Null +15 · Overflow +20 — squash them all'
    },
    hard: {
        name: 'Hard',
        spawnMin: 500,
        spawnMax: 1100,
        bugDuration: 1150,
        bugTypes: [
            BUG_TYPE_SYNTAX,
            BUG_TYPE_NULL_REF,
            BUG_TYPE_OVERFLOW,
            BUG_TYPE_FEATURE,
            BUG_TYPE_CRITICAL
        ],
        legend: 'Green features = avoid (−25) · Critical = +30'
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
let isPaused: boolean = false;
let bugs: BugState[] = [];
let spawnTimer: number | null = null;
let countdownTimer: number | null = null;

// ========================================
// INITIALIZATION
// ========================================

function init(): void {
    if (typeof initGameChrome === 'function') {
        initGameChrome();
    }

    if (typeof soundManager !== 'undefined') {
        soundManager.setMuted(false);
    }

    loadHighScore();
    updateScoreDisplay();
    createHoles();
}

function loadHighScore(): void {
    const saved = localStorage.getItem(`whackBugHighScore_${selectedDifficulty}`);
    if (saved) {
        highScore = parseInt(saved, 10);
    } else {
        highScore = 0;
    }
    refreshDifficultyBestScores();
}

function saveHighScore(): void {
    localStorage.setItem(`whackBugHighScore_${selectedDifficulty}`, highScore.toString());
    refreshDifficultyBestScores();
}

function getStoredHighScore(difficulty: string): number {
    const saved = localStorage.getItem(`whackBugHighScore_${difficulty}`);
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

function createHoles(): void {
    gameGrid.innerHTML = '';
    bugs = [];

    for (let i = 0; i < HOLE_COUNT; i++) {
        const hole = document.createElement('div');
        hole.className = 'hole';
        hole.dataset.index = i.toString();

        const bug = document.createElement('div');
        bug.className = 'bug';
        bug.innerHTML = createBugSVG('common');
        bug.addEventListener('click', () => whackBug(i));

        hole.appendChild(bug);
        gameGrid.appendChild(hole);

        bugs.push({ active: false, holeIndex: i, timer: null, typeId: null });
    }
}

// ========================================
// BUG VISUALS
// ========================================

function createBugSVG(typeId: string): string {
    switch (typeId) {
        case 'syntax':
            return createThemedBugSVG('#e5c07b', '{;}');
        case 'nullRef':
            return createThemedBugSVG('#61afef', 'null');
        case 'overflow':
            return createThemedBugSVG('#c678dd', '∞');
        case 'feature':
            return createThemedBugSVG('#98c379', '★');
        case 'critical':
            return createThemedBugSVG('#ff6b6b', '!!');
        case 'common':
        default:
            return `
                <svg viewBox="0 0 60 80" width="60" height="80" aria-hidden="true">
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
}

function createThemedBugSVG(fill: string, label: string): string {
    return `
        <svg viewBox="0 0 60 80" width="60" height="80" aria-hidden="true">
            <ellipse cx="30" cy="40" rx="25" ry="32" fill="${fill}"/>
            <line x1="30" y1="10" x2="30" y2="70" stroke="#1e1e1e" stroke-width="3"/>
            <circle cx="20" cy="25" r="5" fill="#1e1e1e"/>
            <circle cx="40" cy="25" r="5" fill="#1e1e1e"/>
            <circle cx="20" cy="45" r="4" fill="#1e1e1e"/>
            <circle cx="40" cy="45" r="4" fill="#1e1e1e"/>
            <line x1="20" y1="8" x2="15" y2="0" stroke="#1e1e1e" stroke-width="2"/>
            <line x1="40" y1="8" x2="45" y2="0" stroke="#1e1e1e" stroke-width="2"/>
            <circle cx="15" cy="0" r="2" fill="#1e1e1e"/>
            <circle cx="45" cy="0" r="2" fill="#1e1e1e"/>
            <text x="30" y="58" text-anchor="middle" fill="#1e1e1e"
                font-family="Orbitron, sans-serif" font-size="11" font-weight="700">${label}</text>
        </svg>
    `;
}

function getBugTypeById(typeId: string | null): BugTypeDef | null {
    if (!typeId) {
        return null;
    }
    return currentDifficulty.bugTypes.find(t => t.id === typeId) ?? null;
}

function pickWeightedBugType(): BugTypeDef {
    const types = currentDifficulty.bugTypes;
    const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const type of types) {
        roll -= type.weight;
        if (roll <= 0) {
            return type;
        }
    }

    return types[types.length - 1];
}

function applyBugAppearance(bugElement: HTMLElement, type: BugTypeDef): void {
    bugElement.className = `bug ${type.cssClass}`;
    bugElement.innerHTML = createBugSVG(type.id);
}

function clearBugAppearance(bugElement: HTMLElement): void {
    bugElement.className = 'bug';
    bugElement.innerHTML = createBugSVG('common');
}

// ========================================
// DIFFICULTY SELECTION
// ========================================

function selectDifficulty(difficulty: string, options: { openAccordion?: boolean } = {}): void {
    if (!difficulties[difficulty]) {
        return;
    }

    const openAccordion = options.openAccordion !== false;

    selectedDifficulty = difficulty;
    currentDifficulty = difficulties[difficulty];

    document.querySelectorAll('.difficulty-card').forEach(card => {
        const details = card as HTMLDetailsElement;
        const isSelected = details.dataset.difficulty === difficulty;
        details.classList.toggle('active', isSelected);
        if (openAccordion) {
            details.open = isSelected;
        }
    });

    loadHighScore();
    updateScoreDisplay();
}

function notifyGameStateChanged(): void {
    window.dispatchEvent(new CustomEvent('gameChrome:gameStateChanged'));
}

function updateBugLegend(): void {
    if (!bugLegend) {
        return;
    }

    if (currentDifficulty.legend) {
        bugLegend.textContent = currentDifficulty.legend;
        bugLegend.hidden = false;
    } else {
        bugLegend.textContent = '';
        bugLegend.hidden = true;
    }
}

function enterGame(): void {
    if (!difficulties[selectedDifficulty]) {
        return;
    }

    currentDifficulty = difficulties[selectedDifficulty];
    loadHighScore();
    updateScoreDisplay();
    updateBugLegend();

    difficultySelection.style.display = 'none';
    gameArea.style.display = 'block';
    gameArea.classList.add('active');

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(currentDifficulty.name);
        gameChrome.refreshToolbarPhase();
    }

    notifyGameStateChanged();
}

function backToMenu(): void {
    stopGame();

    gameArea.style.display = 'none';
    gameArea.classList.remove('active');
    difficultySelection.style.display = 'block';

    startBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';

    if (bugLegend) {
        bugLegend.hidden = true;
    }

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge('');
        gameChrome.refreshToolbarPhase();
    }

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    notifyGameStateChanged();
}

// ========================================
// GAME CONTROL
// ========================================

function startGame(): void {
    if (typeof soundManager !== 'undefined') {
        soundManager.playById('popSound');
    }
    score = 0;
    timeRemaining = GAME_DURATION;
    isPlaying = true;
    isPaused = false;

    updateScoreDisplay();
    updateTimerDisplay();

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');

    bugs.forEach(bug => {
        hideBug(bug.holeIndex);
    });

    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    pauseBtn.textContent = 'Pause';

    startCountdown();
    scheduleNextBug();
    notifyGameStateChanged();
}

function togglePause(): void {
    if (!isPlaying || timeRemaining <= 0) {
        return;
    }

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';

    if (isPaused) {
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
        });
    } else {
        startCountdown();
        scheduleNextBug();
    }

    window.dispatchEvent(new CustomEvent('gameChrome:pauseStateChanged', {
        detail: { isPaused }
    }));
}

function stopGame(): void {
    isPlaying = false;
    isPaused = false;

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
        bug.typeId = null;

        const holeElement = gameGrid.children[bug.holeIndex] as HTMLElement | undefined;
        if (holeElement) {
            const bugElement = holeElement.querySelector('.bug') as HTMLElement | null;
            if (bugElement) {
                bugElement.classList.remove('active', 'squashed');
                clearBugAppearance(bugElement);
            }
        }
    });
}

function endGame(): void {
    if (typeof soundManager !== 'undefined') {
        soundManager.playById('popSound');
    }
    stopGame();

    pauseBtn.style.display = 'none';

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
        notifyGameStateChanged();
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
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }

    countdownTimer = window.setInterval(() => {
        if (isPaused) {
            return;
        }

        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            endGame();
        }
    }, 1000);
}

function scheduleNextBug(): void {
    if (!isPlaying || isPaused) {
        return;
    }

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
    if (!isPlaying || isPaused) {
        return;
    }

    const availableHoles = bugs
        .map((bug, index) => ({ bug, index }))
        .filter(({ bug }) => !bug.active);

    if (availableHoles.length === 0) {
        return;
    }

    const randomHole = availableHoles[Math.floor(Math.random() * availableHoles.length)];
    const holeIndex = randomHole.index;
    const bug = bugs[holeIndex];
    const bugType = pickWeightedBugType();

    bug.active = true;
    bug.typeId = bugType.id;

    const holeElement = gameGrid.children[holeIndex] as HTMLElement;
    const bugElement = holeElement.querySelector('.bug') as HTMLElement;
    applyBugAppearance(bugElement, bugType);
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
    bug.typeId = null;

    const holeElement = gameGrid.children[holeIndex] as HTMLElement;
    const bugElement = holeElement.querySelector('.bug') as HTMLElement;
    bugElement.classList.remove('active', 'squashed');
    clearBugAppearance(bugElement);
}

function whackBug(holeIndex: number): void {
    const bug = bugs[holeIndex];

    if (!isPlaying || !bug.active) {
        return;
    }

    const bugType = getBugTypeById(bug.typeId);
    if (!bugType) {
        hideBug(holeIndex);
        return;
    }

    if (typeof soundManager !== 'undefined') {
        soundManager.playById(bugType.kind === 'avoid' ? 'popSound' : 'slurpSound');
    }

    score = Math.max(0, score + bugType.points);
    updateScoreDisplay();

    const holeElement = gameGrid.children[holeIndex] as HTMLElement;
    const bugElement = holeElement.querySelector('.bug') as HTMLElement;

    bugElement.classList.add('squashed');
    showScorePopup(holeElement, bugType.points);

    setTimeout(() => {
        bugElement.classList.remove('squashed');
    }, 300);

    hideBug(holeIndex);
}

function showScorePopup(holeElement: HTMLElement, points: number): void {
    const popup = document.createElement('div');
    popup.className = points < 0 ? 'score-popup score-popup--penalty' : 'score-popup';
    popup.textContent = points > 0 ? `+${points}` : `${points}`;

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
// VS CODE COMMUNICATION
// ========================================

function sendGameOver(finalScore: number): void {
    try {
        vscode.postMessage({
            command: 'gameOver',
            score: finalScore,
            difficulty: selectedDifficulty
        });
    } catch (error) {
        console.warn('[Whack-a-Bug] Could not send message:', error);
    }
}

function resetHighScore(): void {
    if (isPlaying) {
        return;
    }

    if (confirm('Are you sure you want to reset your high score? This cannot be undone.')) {
        highScore = 0;
        saveHighScore();
        updateScoreDisplay();
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupButtons(): void {
    init();

    document.querySelectorAll('.difficulty-card[data-difficulty]').forEach(card => {
        const details = card as HTMLDetailsElement;
        const difficulty = details.dataset.difficulty;
        if (!difficulty) {
            return;
        }

        details.addEventListener('toggle', () => {
            if (!details.open) {
                return;
            }

            // Close sibling accordions, then select this difficulty.
            document.querySelectorAll('.difficulty-card').forEach(other => {
                const otherDetails = other as HTMLDetailsElement;
                if (otherDetails !== details) {
                    otherDetails.open = false;
                }
            });
            selectDifficulty(difficulty, { openAccordion: false });
            details.classList.add('active');
        });
    });

    const startGameBtn = document.querySelector('.start-game-btn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', enterGame);
    }

    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', togglePause);
    }

    window.addEventListener('gameChrome:togglePause', () => {
        if (isPlaying) {
            togglePause();
        }
    });

    window.addEventListener('gameChrome:start', () => {
        if (!isPlaying && startBtn.style.display !== 'none') {
            startGame();
        }
    });

    window.addEventListener('gameChrome:restart', () => {
        gameOverElement.classList.remove('show');
        gameOverAlert.classList.remove('show');
        restartGame();
    });

    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space' && isPlaying && timeRemaining > 0
            && !gameOverElement.classList.contains('show')) {
            event.preventDefault();
            togglePause();
        }
    });

    const restartButtons = document.querySelectorAll('[data-action="restart"]');
    restartButtons.forEach(btn => {
        btn.addEventListener('click', restartGame);
    });

    const backButtons = document.querySelectorAll('[data-action="back"]');
    backButtons.forEach(btn => {
        btn.addEventListener('click', backToMenu);
    });

    const resetHighScoreBtn = document.getElementById('resetHighScoreBtn') as HTMLButtonElement;
    if (resetHighScoreBtn) {
        resetHighScoreBtn.addEventListener('click', resetHighScore);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButtons);
} else {
    setupButtons();
}
