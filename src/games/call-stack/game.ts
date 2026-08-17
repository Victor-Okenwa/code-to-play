/**
 * game.ts - Call Stack
 *
 * Drop 1x2 call/return frames. A return sitting on a matching-color
 * call pops both. Touch the top row and the stack overflows.
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

type FrameKind = 'call' | 'ret';

interface Frame {
    kind: FrameKind;
    color: number;
}

interface Piece {
    col: number;
    row: number;
    top: Frame;
    bottom: Frame;
}

interface StackDifficulty {
    name: string;
    label: string;
    colors: number;
    dropMs: number;
    rows: number;
}

const COLS = 8;
const CANVAS_WIDTH = 320;
const FRAME_COLORS = ['#4fc1ff', '#dcdcaa', '#c586c0', '#4ec9b0', '#ce9178'];

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const scoreElement = document.getElementById('score') as HTMLElement;
const highScoreElement = document.getElementById('highScore') as HTMLElement;
const comboElement = document.getElementById('combo') as HTMLElement;
const stackHeightElement = document.getElementById('stackHeight') as HTMLElement;
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

const difficulties: Record<string, StackDifficulty> = {
    easy: { name: 'Easy', label: 'Easy', colors: 3, dropMs: 700, rows: 14 },
    medium: { name: 'Medium', label: 'Medium', colors: 4, dropMs: 450, rows: 14 },
    hard: { name: 'Hard', label: 'Hard', colors: 5, dropMs: 280, rows: 12 }
};

let selectedDifficulty = 'easy';
let currentDifficulty = difficulties.easy;
let board: (Frame | null)[][] = [];
let piece: Piece | null = null;
let score = 0;
let highScore = 0;
let combo = 0;
let isRunning = false;
let isPaused = false;
let dropTimer: number | null = null;
let warningLatched = false;
let rows = currentDifficulty.rows;
let cellSize = CANVAS_WIDTH / COLS;

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
    resizeCanvas();
    resetBoard();
    loadHighScore();
    updateHud();
    setupEventListeners();
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

    rows = currentDifficulty.rows;
    resizeCanvas();
    resetBoard();
    loadHighScore();
    updateHud();
}

function enterGame(): void {
    currentDifficulty = difficulties[selectedDifficulty];
    rows = currentDifficulty.rows;
    resizeCanvas();
    resetBoard();
    loadHighScore();
    updateHud();

    difficultySelection.style.display = 'none';
    gamePlay.style.display = 'block';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(currentDifficulty.label);
        gameChrome.refreshToolbarPhase();
    }

    draw();
    notifyGameStateChanged();
}

function backToMenu(): void {
    stopLoop();
    isRunning = false;
    isPaused = false;
    piece = null;

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
    const saved = localStorage.getItem(`callStackHighScore_${selectedDifficulty}`);
    highScore = saved ? parseInt(saved, 10) : 0;
    refreshDifficultyBestScores();
}

function saveHighScore(): void {
    localStorage.setItem(`callStackHighScore_${selectedDifficulty}`, highScore.toString());
    refreshDifficultyBestScores();
}

function getStoredHighScore(difficulty: string): number {
    const saved = localStorage.getItem(`callStackHighScore_${difficulty}`);
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

function resizeCanvas(): void {
    rows = currentDifficulty.rows;
    cellSize = CANVAS_WIDTH / COLS;
    canvas.width = CANVAS_WIDTH;
    canvas.height = cellSize * rows;
}

function emptyBoard(): (Frame | null)[][] {
    return Array.from({ length: rows }, () => Array<Frame | null>(COLS).fill(null));
}

function resetBoard(): void {
    board = emptyBoard();
    piece = null;
    combo = 0;
    warningLatched = false;
}

function randomFrame(): Frame {
    return {
        kind: Math.random() < 0.5 ? 'call' : 'ret',
        color: Math.floor(Math.random() * currentDifficulty.colors)
    };
}

function spawnPiece(): boolean {
    const col = Math.floor(COLS / 2);
    const next: Piece = {
        col,
        row: 0,
        top: randomFrame(),
        bottom: randomFrame()
    };

    if (cellBlocked(col, 0) || cellBlocked(col, 1)) {
        return false;
    }

    piece = next;
    return true;
}

function cellBlocked(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= rows) {
        return true;
    }
    return board[row][col] !== null;
}

function pieceBlockedAt(col: number, row: number): boolean {
    return cellBlocked(col, row) || cellBlocked(col, row + 1);
}

function startGame(): void {
    playSound('popSound');
    stopLoop();
    resizeCanvas();
    resetBoard();
    score = 0;
    combo = 0;
    isPaused = false;
    isRunning = true;

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    pauseBtn.textContent = 'Pause (SPC)';

    if (!spawnPiece()) {
        endGame();
        return;
    }

    updateHud();
    draw();
    runLoop();
    notifyGameStateChanged();
}

function stopLoop(): void {
    if (dropTimer !== null) {
        clearTimeout(dropTimer);
        dropTimer = null;
    }
}

function runLoop(): void {
    stopLoop();
    if (!isRunning || isPaused) {
        return;
    }

    dropTimer = window.setTimeout(() => {
        tick();
        if (isRunning && !isPaused) {
            runLoop();
        }
    }, currentDifficulty.dropMs);
}

function tick(): void {
    if (!piece) {
        return;
    }

    if (!pieceBlockedAt(piece.col, piece.row + 1)) {
        piece.row += 1;
        draw();
        return;
    }

    lockPiece();
}

function lockPiece(): void {
    if (!piece) {
        return;
    }

    placeFrame(piece.col, piece.row, piece.top);
    placeFrame(piece.col, piece.row + 1, piece.bottom);
    piece = null;
    playSound('lockSound');

    resolveMatches();
    updateHud();
    checkWarning();

    if (isOverflow()) {
        endGame();
        return;
    }

    if (!spawnPiece()) {
        endGame();
        return;
    }

    draw();
}

function placeFrame(col: number, row: number, frame: Frame): void {
    if (row >= 0 && row < rows && col >= 0 && col < COLS) {
        board[row][col] = frame;
    }
}

function resolveMatches(): void {
    let waves = 0;
    let pairs = 0;

    while (true) {
        const toClear: Array<{ col: number; row: number }> = [];

        for (let col = 0; col < COLS; col++) {
            for (let row = 0; row < rows - 1; row++) {
                const upper = board[row][col];
                const lower = board[row + 1][col];
                if (
                    upper &&
                    lower &&
                    upper.kind === 'ret' &&
                    lower.kind === 'call' &&
                    upper.color === lower.color
                ) {
                    toClear.push({ col, row });
                    toClear.push({ col, row: row + 1 });
                }
            }
        }

        if (toClear.length === 0) {
            break;
        }

        waves += 1;
        pairs += toClear.length / 2;

        const seen = new Set<string>();
        for (const cell of toClear) {
            const key = `${cell.col}:${cell.row}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            board[cell.row][cell.col] = null;
        }

        applyGravity();
    }

    combo = waves;
    if (pairs > 0) {
        score += Math.round(pairs * 10 * Math.max(1, waves));
        playSound(waves >= 2 ? 'comboSound' : 'slurpSound');
    }
}

function applyGravity(): void {
    for (let col = 0; col < COLS; col++) {
        const stack: Frame[] = [];
        for (let row = 0; row < rows; row++) {
            const frame = board[row][col];
            if (frame) {
                stack.push(frame);
            }
        }
        for (let row = 0; row < rows; row++) {
            board[row][col] = null;
        }
        let write = rows - 1;
        for (let i = stack.length - 1; i >= 0; i--) {
            board[write][col] = stack[i];
            write -= 1;
        }
    }
}

function isOverflow(): boolean {
    return board[0]?.some(cell => cell !== null) ?? false;
}

function stackHeight(): number {
    let minRow = rows;
    for (let row = 0; row < rows; row++) {
        if (board[row]?.some(cell => cell !== null)) {
            minRow = row;
            break;
        }
    }
    return board.length === 0 ? 0 : rows - minRow;
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

function tryMove(dx: number): void {
    if (!piece || !isRunning || isPaused) {
        return;
    }
    const nextCol = piece.col + dx;
    if (!pieceBlockedAt(nextCol, piece.row)) {
        piece.col = nextCol;
        draw();
    }
}

function rotatePiece(): void {
    if (!piece || !isRunning || isPaused) {
        return;
    }
    const swapped = piece.top;
    piece.top = piece.bottom;
    piece.bottom = swapped;
    playSound('popSound');
    draw();
}

function softDrop(): void {
    if (!piece || !isRunning || isPaused) {
        return;
    }
    if (!pieceBlockedAt(piece.col, piece.row + 1)) {
        piece.row += 1;
        draw();
        return;
    }
    lockPiece();
}

function hardDrop(): void {
    if (!piece || !isRunning || isPaused) {
        return;
    }
    let dropped = 0;
    while (!pieceBlockedAt(piece.col, piece.row + 1)) {
        piece.row += 1;
        dropped += 1;
    }
    score += dropped * 2;
    lockPiece();
}

function togglePause(): void {
    if (!isRunning) {
        return;
    }

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause (SPC)';

    if (!isPaused) {
        runLoop();
    } else {
        stopLoop();
    }

    window.dispatchEvent(new CustomEvent('gameChrome:pauseStateChanged', {
        detail: { isPaused }
    }));
}

function endGame(): void {
    playSound('crashSound');
    isRunning = false;
    isPaused = false;
    piece = null;
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
        case 'ArrowLeft':
            tryMove(-1);
            break;
        case 'ArrowRight':
            tryMove(1);
            break;
        case 'ArrowUp':
            rotatePiece();
            break;
        case 'ArrowDown':
            softDrop();
            break;
        case 'x':
        case 'X':
            hardDrop();
            break;
    }
}

function updateHud(): void {
    scoreElement.textContent = score.toString();
    highScoreElement.textContent = highScore.toString();
    comboElement.textContent = combo.toString();
    stackHeightElement.textContent = stackHeight().toString();
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

function drawFrame(frame: Frame, col: number, row: number, ghost = false): void {
    const pad = 3;
    const x = col * cellSize + pad;
    const y = row * cellSize + pad;
    const w = cellSize - pad * 2;
    const h = cellSize - pad * 2;
    const color = FRAME_COLORS[frame.color] ?? FRAME_COLORS[0];

    ctx.globalAlpha = ghost ? 0.35 : 1;
    drawRoundedRect(x, y, w, h, 6);

    if (frame.kind === 'call') {
        ctx.fillStyle = color;
        ctx.fill();
    } else {
        ctx.fillStyle = '#1e1e1e';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    ctx.fillStyle = frame.kind === 'call' ? '#1e1e1e' : color;
    ctx.font = 'bold 11px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(frame.kind === 'call' ? 'fn' : 'ret', x + w / 2, y + h / 2);
    ctx.globalAlpha = 1;
}

function draw(): void {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i <= rows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(244, 135, 113, 0.08)';
    ctx.fillRect(0, 0, canvas.width, cellSize * 2);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < COLS; col++) {
            const frame = board[row][col];
            if (frame) {
                drawFrame(frame, col, row);
            }
        }
    }

    if (piece) {
        let ghostRow = piece.row;
        while (!pieceBlockedAt(piece.col, ghostRow + 1)) {
            ghostRow += 1;
        }
        if (ghostRow !== piece.row) {
            drawFrame(piece.top, piece.col, ghostRow, true);
            drawFrame(piece.bottom, piece.col, ghostRow + 1, true);
        }
        drawFrame(piece.top, piece.col, piece.row);
        drawFrame(piece.bottom, piece.col, piece.row + 1);
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
        console.warn('Call Stack could not send message:', error);
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
