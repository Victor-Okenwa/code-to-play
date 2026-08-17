/**
 * game.ts - Merge Conflict
 *
 * Puzzle-League cursor: swap adjacent hunks, match 3+, survive rising rows.
 * Enter swaps. Space pauses.
 */

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

interface MergeDifficulty {
    name: string;
    label: string;
    colors: number;
    riseMs: number;
}

const COLS = 6;
const ROWS = 12;
const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 480;
const CELL_W = CANVAS_WIDTH / COLS;
const CELL_H = CANVAS_HEIGHT / ROWS;
const HUNK_COLORS = ['#569cd6', '#ce9178', '#808080', '#c586c0', '#4ec9b0'];
const HUNK_LABELS = ['ours', 'theirs', 'base', 'index', 'stash'];

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const scoreElement = document.getElementById('score') as HTMLElement;
const highScoreElement = document.getElementById('highScore') as HTMLElement;
const comboElement = document.getElementById('combo') as HTMLElement;
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

const difficulties: Record<string, MergeDifficulty> = {
    easy: { name: 'Easy', label: 'Easy', colors: 3, riseMs: 6000 },
    medium: { name: 'Medium', label: 'Medium', colors: 4, riseMs: 4000 },
    hard: { name: 'Hard', label: 'Hard', colors: 5, riseMs: 2500 }
};

let selectedDifficulty = 'easy';
let currentDifficulty = difficulties.easy;
let board: (number | null)[][] = [];
let cursorCol = 2;
let cursorRow = 8;
let score = 0;
let highScore = 0;
let combo = 0;
let isRunning = false;
let isPaused = false;
let riseTimer: number | null = null;
let warningLatched = false;

function playSound(id: string): void {
    if (typeof soundManager !== 'undefined') {
        soundManager.playById(id);
    }
}

function init(): void {
    if (typeof initGameChrome === 'function') {
        initGameChrome();
    }
    if (typeof soundManager !== 'undefined' && soundManager.preloadAll) {
        soundManager.preloadAll();
    }

    setupDifficultySelection();
    loadHighScore();
    updateHud();
    setupEventListeners();
    resetBoard(false);
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

    enterGameBtn?.addEventListener('click', enterGame);
    backToMenuBtn?.addEventListener('click', backToMenu);
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

function enterGame(): void {
    currentDifficulty = difficulties[selectedDifficulty];
    loadHighScore();
    updateHud();

    difficultySelection.style.display = 'none';
    gamePlay.style.display = 'block';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(currentDifficulty.label);
        gameChrome.refreshToolbarPhase();
    }

    resetBoard(false);
    draw();
    notifyGameStateChanged();
}

function backToMenu(): void {
    stopRise();
    isRunning = false;
    isPaused = false;

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

    notifyGameStateChanged();
}

function loadHighScore(): void {
    const saved = localStorage.getItem(`mergeConflictHighScore_${selectedDifficulty}`);
    highScore = saved ? parseInt(saved, 10) : 0;
    refreshDifficultyBestScores();
}

function saveHighScore(): void {
    localStorage.setItem(`mergeConflictHighScore_${selectedDifficulty}`, highScore.toString());
    refreshDifficultyBestScores();
}

function getStoredHighScore(difficulty: string): number {
    const saved = localStorage.getItem(`mergeConflictHighScore_${difficulty}`);
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

function emptyBoard(): (number | null)[][] {
    return Array.from({ length: ROWS }, () => Array<number | null>(COLS).fill(null));
}

function randomColor(): number {
    return Math.floor(Math.random() * currentDifficulty.colors);
}

function randomRow(): number[] {
    return Array.from({ length: COLS }, () => randomColor());
}

function resetBoard(fill: boolean): void {
    board = emptyBoard();
    cursorCol = 2;
    cursorRow = 8;
    combo = 0;
    warningLatched = false;

    if (!fill) {
        return;
    }

    for (let row = ROWS - 5; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            board[row][col] = randomColor();
        }
    }

    // Break obvious starting triples so the board is playable
    for (let pass = 0; pass < 8; pass++) {
        const matches = findMatches();
        if (matches.length === 0) {
            break;
        }
        for (const cell of matches) {
            board[cell.row][cell.col] = randomColor();
        }
    }
}

function startGame(): void {
    playSound('popSound');
    stopRise();
    resetBoard(true);
    score = 0;
    combo = 0;
    isPaused = false;
    isRunning = true;

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    pauseBtn.textContent = 'Pause (SPC)';

    updateHud();
    draw();
    scheduleRise();
    notifyGameStateChanged();
}

function stopRise(): void {
    if (riseTimer !== null) {
        clearTimeout(riseTimer);
        riseTimer = null;
    }
}

function scheduleRise(): void {
    stopRise();
    if (!isRunning || isPaused) {
        return;
    }
    riseTimer = window.setTimeout(() => {
        riseRow();
        if (isRunning && !isPaused) {
            scheduleRise();
        }
    }, currentDifficulty.riseMs);
}

function riseRow(): void {
    if (board[0].some(cell => cell !== null)) {
        endGame();
        return;
    }

    const next = emptyBoard();
    for (let row = 0; row < ROWS - 1; row++) {
        next[row] = [...board[row + 1]];
    }
    next[ROWS - 1] = randomRow();
    board = next;

    if (cursorRow > 0) {
        cursorRow -= 1;
    }

    resolveMatches();
    updateHud();
    checkWarning();
    draw();
}

function findMatches(): Array<{ row: number; col: number }> {
    const marked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

    for (let row = 0; row < ROWS; row++) {
        let run = 1;
        for (let col = 1; col <= COLS; col++) {
            const same =
                col < COLS &&
                board[row][col] !== null &&
                board[row][col] === board[row][col - 1];
            if (same) {
                run += 1;
                continue;
            }
            if (run >= 3 && board[row][col - 1] !== null) {
                for (let k = 0; k < run; k++) {
                    marked[row][col - 1 - k] = true;
                }
            }
            run = 1;
        }
    }

    for (let col = 0; col < COLS; col++) {
        let run = 1;
        for (let row = 1; row <= ROWS; row++) {
            const same =
                row < ROWS &&
                board[row][col] !== null &&
                board[row][col] === board[row - 1][col];
            if (same) {
                run += 1;
                continue;
            }
            if (run >= 3 && board[row - 1][col] !== null) {
                for (let k = 0; k < run; k++) {
                    marked[row - 1 - k][col] = true;
                }
            }
            run = 1;
        }
    }

    const cells: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (marked[row][col]) {
                cells.push({ row, col });
            }
        }
    }
    return cells;
}

function applyGravity(): void {
    for (let col = 0; col < COLS; col++) {
        const stack: number[] = [];
        for (let row = 0; row < ROWS; row++) {
            const hunk = board[row][col];
            if (hunk !== null) {
                stack.push(hunk);
            }
        }
        for (let row = 0; row < ROWS; row++) {
            board[row][col] = null;
        }
        let write = ROWS - 1;
        for (let i = stack.length - 1; i >= 0; i--) {
            board[write][col] = stack[i];
            write -= 1;
        }
    }
}

function resolveMatches(): void {
    let waves = 0;
    let hunks = 0;

    while (true) {
        const matches = findMatches();
        if (matches.length === 0) {
            break;
        }
        waves += 1;
        hunks += matches.length;
        for (const cell of matches) {
            board[cell.row][cell.col] = null;
        }
        applyGravity();
    }

    combo = waves;
    if (hunks > 0) {
        score += Math.round(hunks * 10 * Math.max(1, waves));
        playSound(waves >= 2 ? 'comboSound' : 'slurpSound');
    }
}

function swapAtCursor(): void {
    if (!isRunning || isPaused) {
        return;
    }

    const right = cursorCol + 1;
    const a = board[cursorRow][cursorCol];
    const b = board[cursorRow][right];
    if (a === b) {
        return;
    }

    board[cursorRow][cursorCol] = b;
    board[cursorRow][right] = a;
    playSound('swapSound');

    applyGravity();
    resolveMatches();
    updateHud();
    checkWarning();
    draw();
}

function checkWarning(): void {
    const inDanger = board.slice(0, 2).some(row => row.some(cell => cell !== null));
    if (inDanger && !warningLatched) {
        playSound('warningSound');
        warningLatched = true;
    } else if (!inDanger) {
        warningLatched = false;
    }
}

function moveCursor(dx: number, dy: number): void {
    if (!isRunning || isPaused) {
        return;
    }
    cursorCol = Math.max(0, Math.min(COLS - 2, cursorCol + dx));
    cursorRow = Math.max(0, Math.min(ROWS - 1, cursorRow + dy));
    draw();
}

function togglePause(): void {
    if (!isRunning) {
        return;
    }

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause (SPC)';

    if (!isPaused) {
        scheduleRise();
    } else {
        stopRise();
    }

    window.dispatchEvent(new CustomEvent('gameChrome:pauseStateChanged', {
        detail: { isPaused }
    }));
}

function endGame(): void {
    playSound('crashSound');
    isRunning = false;
    isPaused = false;
    stopRise();

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
    }, 2500);
}

function showGameOverAlert(): void {
    alertScore.textContent = `Score: ${score}`;
    gameOverAlert.classList.add('show');
    setTimeout(() => {
        gameOverAlert.classList.remove('show');
    }, 2000);
}

function handleKeyPress(event: KeyboardEvent): void {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(event.key)) {
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
        case 'ArrowLeft':
            moveCursor(-1, 0);
            break;
        case 'ArrowRight':
            moveCursor(1, 0);
            break;
        case 'ArrowUp':
            moveCursor(0, -1);
            break;
        case 'ArrowDown':
            moveCursor(0, 1);
            break;
        case 'Enter':
            swapAtCursor();
            break;
    }
}

function updateHud(): void {
    scoreElement.textContent = score.toString();
    highScoreElement.textContent = highScore.toString();
    comboElement.textContent = combo.toString();
}

function drawRoundedRect(x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function draw(): void {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(244, 135, 113, 0.08)';
    ctx.fillRect(0, 0, canvas.width, CELL_H * 2);

    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_W, 0);
        ctx.lineTo(i * CELL_W, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_H);
        ctx.lineTo(canvas.width, i * CELL_H);
        ctx.stroke();
    }

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const hunk = board[row][col];
            if (hunk === null) {
                continue;
            }
            const pad = 3;
            const x = col * CELL_W + pad;
            const y = row * CELL_H + pad;
            const w = CELL_W - pad * 2;
            const h = CELL_H - pad * 2;
            const color = HUNK_COLORS[hunk] ?? HUNK_COLORS[0];

            drawRoundedRect(x, y, w, h, 5);
            ctx.fillStyle = color;
            ctx.fill();

            ctx.fillStyle = '#1e1e1e';
            ctx.font = 'bold 10px Orbitron, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(HUNK_LABELS[hunk] ?? '', x + w / 2, y + h / 2);
        }
    }

    const cx = cursorCol * CELL_W;
    const cy = cursorRow * CELL_H;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    drawRoundedRect(cx + 2, cy + 2, CELL_W * 2 - 4, CELL_H - 4, 6);
    ctx.stroke();
}

function sendGameOver(finalScore: number): void {
    try {
        vscode.postMessage({
            command: 'gameOver',
            score: finalScore,
            difficulty: selectedDifficulty
        });
    } catch (error) {
        console.warn('Merge Conflict could not send message:', error);
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
