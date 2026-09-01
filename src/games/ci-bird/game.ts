/**
 * game.ts - CI Bird
 *
 * One-button flyer. Flap through scrolling CI gates and keep the pipeline green.
 */

declare const vscode: {
    postMessage(message: { command: string; score?: number; difficulty?: string }): void;
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

interface BirdDifficulty {
    name: string;
    label: string;
    gravity: number;
    flapImpulse: number;
    maxFall: number;
    scroll: number;
    gap: number;
    spacing: number;
}

interface Pipe {
    x: number;
    gapY: number;
    gapH: number;
    label: string;
    scored: boolean;
}

interface LineMark {
    x: number;
    n: number;
}

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 480;
const BIRD_X = 78;
const BIRD_W = 22;
const BIRD_H = 16;
const PIPE_WIDTH = 52;
const PIPE_MARGIN = 36;
const PAUSE_LABEL = 'Pause (P)';
const GATE_LABELS = ['lint', 'test', 'typecheck', 'deploy'] as const;

const difficulties: Record<string, BirdDifficulty> = {
    easy: {
        name: 'Easy',
        label: 'Easy',
        gravity: 980,
        flapImpulse: -310,
        maxFall: 420,
        scroll: 118,
        gap: 168,
        spacing: 230
    },
    hard: {
        name: 'Hard',
        label: 'Hard',
        gravity: 1180,
        flapImpulse: -340,
        maxFall: 480,
        scroll: 158,
        gap: 138,
        spacing: 205
    },
    veryHard: {
        name: 'Very Hard',
        label: 'Very Hard',
        gravity: 1420,
        flapImpulse: -370,
        maxFall: 540,
        scroll: 198,
        gap: 112,
        spacing: 188
    }
};

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const scoreElement = document.getElementById('score') as HTMLElement;
const highScoreElement = document.getElementById('highScore') as HTMLElement;
const nextGateElement = document.getElementById('nextGate') as HTMLElement;
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

let selectedDifficulty = 'easy';
let currentDifficulty = difficulties.easy;
let score = 0;
let highScore = 0;
let isRunning = false;
let isPaused = false;
let lastTs = 0;
let rafId = 0;
let birdY = CANVAS_HEIGHT / 2;
let birdVy = 0;
let pipes: Pipe[] = [];
let nextLabelIndex = 0;
let lineMarks: LineMark[] = [];

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

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    setupDifficultySelection();
    loadHighScore();
    updateHud();
    setupEventListeners();
    seedLineMarks();
    draw(0);
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
    resetRun(false);

    difficultySelection.style.display = 'none';
    gamePlay.style.display = 'block';

    if (typeof gameChrome !== 'undefined') {
        gameChrome.setDifficultyBadge(currentDifficulty.label);
        gameChrome.refreshToolbarPhase();
    }

    draw(0);
    notifyGameStateChanged();
}

function backToMenu(): void {
    stopLoop();
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
    const saved = localStorage.getItem(`ciBirdHighScore_${selectedDifficulty}`);
    highScore = saved ? parseInt(saved, 10) : 0;
    refreshDifficultyBestScores();
}

function saveHighScore(): void {
    localStorage.setItem(`ciBirdHighScore_${selectedDifficulty}`, highScore.toString());
    refreshDifficultyBestScores();
}

function getStoredHighScore(difficulty: string): number {
    const saved = localStorage.getItem(`ciBirdHighScore_${difficulty}`);
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

    canvas.addEventListener('mousedown', event => {
        event.preventDefault();
        flapFromInput();
    });

    canvas.addEventListener('touchstart', event => {
        event.preventDefault();
        flapFromInput();
    }, { passive: false });

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

function seedLineMarks(): void {
    lineMarks = [];
    for (let i = 0; i < 12; i++) {
        lineMarks.push({
            x: (i * 42) % CANVAS_WIDTH,
            n: 10 + i * 7
        });
    }
}

function resetRun(playing: boolean): void {
    currentDifficulty = difficulties[selectedDifficulty];
    score = 0;
    birdY = CANVAS_HEIGHT / 2;
    birdVy = 0;
    pipes = [];
    nextLabelIndex = 0;
    isPaused = false;
    isRunning = playing;
    updateHud();
}

function startGame(): void {
    playSound('popSound');
    stopLoop();
    resetRun(true);
    spawnPipe(CANVAS_WIDTH + 40);

    gameOverElement.classList.remove('show');
    gameOverAlert.classList.remove('show');
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    pauseBtn.textContent = PAUSE_LABEL;

    lastTs = 0;
    rafId = requestAnimationFrame(loop);
    notifyGameStateChanged();
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

    if (lastTs === 0) {
        lastTs = ts;
    }
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    if (!isPaused) {
        update(dt);
    }
    draw(ts);
    rafId = requestAnimationFrame(loop);
}

function nextLabel(): string {
    const label = GATE_LABELS[nextLabelIndex % GATE_LABELS.length];
    nextLabelIndex += 1;
    return label;
}

function spawnPipe(x: number): void {
    const gapH = currentDifficulty.gap;
    const minY = PIPE_MARGIN;
    const maxY = CANVAS_HEIGHT - PIPE_MARGIN - gapH;
    const gapY = minY + Math.random() * Math.max(1, maxY - minY);

    pipes.push({
        x,
        gapY,
        gapH,
        label: nextLabel(),
        scored: false
    });
}

function birdHitbox(): { x: number; y: number; w: number; h: number } {
    return {
        x: BIRD_X - BIRD_W / 2 + 2,
        y: birdY - BIRD_H / 2 + 2,
        w: BIRD_W - 4,
        h: BIRD_H - 4
    };
}

function update(dt: number): void {
    birdVy = Math.min(currentDifficulty.maxFall, birdVy + currentDifficulty.gravity * dt);
    birdY += birdVy * dt;

    const hit = birdHitbox();
    if (hit.y < 0 || hit.y + hit.h > CANVAS_HEIGHT) {
        endGame();
        return;
    }

    for (const pipe of pipes) {
        pipe.x -= currentDifficulty.scroll * dt;
    }

    while (pipes.length > 0 && pipes[0].x + PIPE_WIDTH < -20) {
        pipes.shift();
    }

    const last = pipes[pipes.length - 1];
    if (!last || last.x < CANVAS_WIDTH - currentDifficulty.spacing) {
        spawnPipe(CANVAS_WIDTH + PIPE_WIDTH);
    }

    for (const pipe of pipes) {
        if (!pipe.scored && pipe.x + PIPE_WIDTH < BIRD_X) {
            pipe.scored = true;
            score += 1;
            playSound('slurpSound');
            updateHud();
        }

        const inX = hit.x + hit.w > pipe.x && hit.x < pipe.x + PIPE_WIDTH;
        if (!inX) {
            continue;
        }

        const inGap = hit.y >= pipe.gapY && hit.y + hit.h <= pipe.gapY + pipe.gapH;
        if (!inGap) {
            endGame();
            return;
        }
    }

    for (const mark of lineMarks) {
        mark.x -= currentDifficulty.scroll * 0.35 * dt;
        if (mark.x < -24) {
            mark.x += CANVAS_WIDTH + 48;
            mark.n += 12;
        }
    }

    updateHud();
}

function flapFromInput(): void {
    if (!isRunning || isPaused) {
        return;
    }
    flap();
}

function flap(): void {
    birdVy = currentDifficulty.flapImpulse;
    playSound('popSound');
}

function togglePause(): void {
    if (!isRunning) {
        return;
    }

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : PAUSE_LABEL;

    window.dispatchEvent(new CustomEvent('gameChrome:pauseStateChanged', {
        detail: { isPaused }
    }));
}

function endGame(): void {
    if (!isRunning) {
        return;
    }

    playSound('crashSound');
    isRunning = false;
    isPaused = false;
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
        draw(0);
    }, 2500);
}

function showGameOverAlert(): void {
    alertScore.textContent = `Checks: ${score}`;
    gameOverAlert.classList.add('show');
    setTimeout(() => {
        gameOverAlert.classList.remove('show');
    }, 2000);
}

function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === ' ') {
        event.preventDefault();
        flapFromInput();
        return;
    }

    if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        togglePause();
    }
}

function upcomingPipe(): Pipe | undefined {
    return pipes.find(pipe => !pipe.scored);
}

function updateHud(): void {
    scoreElement.textContent = score.toString();
    highScoreElement.textContent = highScore.toString();
    nextGateElement.textContent = upcomingPipe()?.label ?? '—';
}

function draw(ts: number): void {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawBackdrop();
    for (const pipe of pipes) {
        drawPipe(pipe);
    }

    const drawY = isRunning
        ? birdY
        : CANVAS_HEIGHT / 2 + Math.sin((ts || 0) / 420) * 8;
    drawBird(drawY, isRunning ? birdVy : Math.cos((ts || 0) / 420) * 40);

    if (isPaused && isRunning) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#4ec9b0';
        ctx.font = '16px "Press Start 2P", cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
}

function drawBackdrop(): void {
    ctx.fillStyle = '#252526';
    ctx.fillRect(0, 0, 28, CANVAS_HEIGHT);

    ctx.fillStyle = '#3e3e42';
    ctx.fillRect(28, 0, 1, CANVAS_HEIGHT);

    ctx.fillStyle = '#6a6a6a';
    ctx.font = '9px Orbitron, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let row = 0; row < 16; row++) {
        const y = 18 + row * 30;
        ctx.fillText(String(row + 1).padStart(2, '0'), 24, y);
    }

    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (const mark of lineMarks) {
        ctx.beginPath();
        ctx.moveTo(mark.x, 0);
        ctx.lineTo(mark.x, CANVAS_HEIGHT);
        ctx.stroke();
    }
}

function drawPipe(pipe: Pipe): void {
    const topH = pipe.gapY;
    const bottomY = pipe.gapY + pipe.gapH;
    const bottomH = CANVAS_HEIGHT - bottomY;

    ctx.fillStyle = '#f48771';
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topH);
    ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, bottomH);

    ctx.fillStyle = '#d16969';
    ctx.fillRect(pipe.x, topH - 10, PIPE_WIDTH, 10);
    ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, 10);

    ctx.fillStyle = '#4ec9b0';
    ctx.fillRect(pipe.x, pipe.gapY, PIPE_WIDTH, 3);
    ctx.fillRect(pipe.x, bottomY - 3, PIPE_WIDTH, 3);

    ctx.fillStyle = '#1e1e1e';
    ctx.font = 'bold 9px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (topH > 28) {
        ctx.save();
        ctx.translate(pipe.x + PIPE_WIDTH / 2, topH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(pipe.label, 0, 0);
        ctx.restore();
    }

    if (bottomH > 28) {
        ctx.save();
        ctx.translate(pipe.x + PIPE_WIDTH / 2, bottomY + bottomH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(pipe.label, 0, 0);
        ctx.restore();
    }
}

function drawBird(y: number, vy: number): void {
    const tilt = Math.max(-0.55, Math.min(0.7, vy / 480));
    ctx.save();
    ctx.translate(BIRD_X, y);
    ctx.rotate(tilt);

    ctx.fillStyle = '#3aa894';
    ctx.beginPath();
    ctx.ellipse(-10, 2, 7, 4, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4ec9b0';
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_W / 2, BIRD_H / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e1e1e';
    ctx.font = 'bold 8px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('{ }', 0, 1);

    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(7, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ce9178';
    ctx.beginPath();
    ctx.moveTo(11, -1);
    ctx.lineTo(18, 1);
    ctx.lineTo(11, 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function sendGameOver(finalScore: number): void {
    try {
        vscode.postMessage({
            command: 'gameOver',
            score: finalScore,
            difficulty: selectedDifficulty
        });
    } catch (error) {
        console.warn('CI Bird could not send message:', error);
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
