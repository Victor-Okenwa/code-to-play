/**
 * game-chrome.ts - Shared UI chrome for all games
 * Mute toggle, focus-play overlay, Ctrl+M shortcut, zoom application
 */

declare const soundManager: {
    toggleMute(): boolean;
    setMuted(muted: boolean): void;
    isSoundMuted(): boolean;
};

declare global {
    interface Window {
        gameChrome: {
            refreshMuteUI(): void;
            refreshFullscreenUI(): void;
            applyZoom(zoom: number): void;
            setDifficultyBadge(label: string): void;
            toggleFullscreen(): void;
            isFocusPlayActive(): boolean;
            refreshToolbarPhase(): void;
        };
        initGameChrome(): void;
    }
}

interface FocusRestore {
    element: HTMLElement;
    parent: HTMLElement;
    nextSibling: Node | null;
}

let allowFullscreen = true;
let autoFullscreen = false;
let autoFullscreenApplied = false;
let focusPlayActive = false;
const focusRestoreStack: FocusRestore[] = [];
let focusScoreObserver: MutationObserver | null = null;
let gameOverObserver: MutationObserver | null = null;

interface GameOverRestore {
    element: HTMLElement;
    parent: HTMLElement;
    nextSibling: Node | null;
}

let gameOverAlertRestore: GameOverRestore | null = null;
let gameOverPanelRestore: GameOverRestore | null = null;

function getPrimaryScoreElement(): HTMLElement | null {
    return document.querySelector('.focus-play-scores #score') as HTMLElement | null;
}

function getPrimaryScoreLabel(): string {
    const label = document.querySelector('.focus-play-scores .score-label, .focus-play-scores .info-label');
    return label?.textContent?.trim() || 'Score';
}

function setupFocusScoreDisplay(): void {
    const scoreSlot = document.getElementById('focusPlayScore');
    const primaryValue = getPrimaryScoreElement();

    if (!scoreSlot || !primaryValue) {
        if (scoreSlot) {
            scoreSlot.innerHTML = '';
        }
        return;
    }

    const labelText = getPrimaryScoreLabel();

    scoreSlot.innerHTML = `
        <div class="focus-play-score-compact">
            <span class="focus-play-score-label">${labelText}</span>
            <span class="focus-play-score-value" id="focusPlayScoreValue">${primaryValue.textContent}</span>
        </div>
    `;

    focusScoreObserver?.disconnect();
    focusScoreObserver = new MutationObserver(() => {
        const display = document.getElementById('focusPlayScoreValue');
        if (display) {
            display.textContent = primaryValue.textContent;
        }
        refreshFocusGameStateUI();
    });
    focusScoreObserver.observe(primaryValue, { childList: true, characterData: true, subtree: true });
}

function teardownFocusScoreDisplay(): void {
    focusScoreObserver?.disconnect();
    focusScoreObserver = null;
    const scoreSlot = document.getElementById('focusPlayScore');
    if (scoreSlot) {
        scoreSlot.innerHTML = '';
    }
}

function getFocusPauseKey(): string | null {
    const el = document.querySelector('[data-focus-pause-key]');
    return el?.getAttribute('data-focus-pause-key') || null;
}

function isGameOverVisible(): boolean {
    const alert = document.getElementById('gameOverAlert');
    const panel = document.getElementById('gameOver');
    return !!(alert?.classList.contains('show') || panel?.classList.contains('show'));
}

function isGameActivelyPlaying(): boolean {
    const gamePauseBtn = document.getElementById('pauseBtn');
    if (!gamePauseBtn) {
        return false;
    }
    return gamePauseBtn.style.display !== 'none';
}

function isGameIdleBeforeStart(): boolean {
    if (isGameOverVisible()) {
        return false;
    }
    const gameStartBtn = document.getElementById('startBtn');
    if (!gameStartBtn) {
        return false;
    }
    return gameStartBtn.style.display !== 'none';
}

function refreshFocusActionUI(): void {
    const actionBtn = document.getElementById('focusPlayPause');
    const actionIcon = document.getElementById('focusPlayPauseIcon');
    const actionLabel = document.getElementById('focusPlayPauseLabel');
    const hint = document.getElementById('focusPlayPauseHint');
    const pauseKey = getFocusPauseKey();
    const gamePauseBtn = document.getElementById('pauseBtn');

    if (!actionBtn || !actionIcon || !actionLabel) {
        return;
    }

    if (isGameIdleBeforeStart()) {
        actionIcon.className = 'codicon codicon-debug-start';
        actionLabel.textContent = 'Play';
        actionBtn.setAttribute('aria-pressed', 'false');
        actionBtn.title = 'Start game';
        if (hint) {
            hint.textContent = 'Press Play to start';
        }
        return;
    }

    const isPaused = gamePauseBtn?.textContent?.toLowerCase().includes('resume') ?? false;
    actionIcon.className = isPaused ? 'codicon codicon-debug-start' : 'codicon codicon-debug-pause';
    actionLabel.textContent = isPaused ? 'Resume' : 'Pause';
    actionBtn.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
    actionBtn.title = isPaused ? 'Resume game' : 'Pause game';
    if (hint && pauseKey) {
        hint.textContent = `${pauseKey} to pause`;
    }
}

function refreshFocusGameStateUI(): void {
    const actionBtn = document.getElementById('focusPlayPause');
    const hint = document.getElementById('focusPlayPauseHint');
    const restartBtn = document.getElementById('focusPlayRestart');
    const hasStartBtn = !!document.getElementById('startBtn');
    const hasPauseBtn = !!document.getElementById('pauseBtn');
    const supportsFocusControls = hasStartBtn || hasPauseBtn;
    const gameOver = isGameOverVisible();
    const idle = isGameIdleBeforeStart();
    const playing = isGameActivelyPlaying();

    if (gameOver) {
        if (actionBtn) {
            actionBtn.style.display = 'none';
        }
        if (hint) {
            hint.style.display = 'none';
        }
        if (restartBtn) {
            restartBtn.style.display = 'inline-flex';
        }
        return;
    }

    if (restartBtn) {
        restartBtn.style.display = 'none';
    }

    if (!supportsFocusControls) {
        if (actionBtn) {
            actionBtn.style.display = 'none';
        }
        if (hint) {
            hint.style.display = 'none';
        }
        return;
    }

    if (actionBtn) {
        actionBtn.style.display = (idle || playing) ? 'inline-flex' : 'none';
    }
    if (hint) {
        hint.style.display = (idle || playing) ? 'inline' : 'none';
    }

    refreshFocusActionUI();
}

function restoreSingleGameOverElement(element: HTMLElement): void {
    let restore: GameOverRestore | null = null;

    if (element.id === 'gameOverAlert') {
        restore = gameOverAlertRestore;
        gameOverAlertRestore = null;
    } else if (element.id === 'gameOver') {
        restore = gameOverPanelRestore;
        gameOverPanelRestore = null;
    }

    if (!restore || restore.element !== element) {
        return;
    }

    if (restore.nextSibling) {
        restore.parent.insertBefore(element, restore.nextSibling);
    } else {
        restore.parent.appendChild(element);
    }
}

function moveGameOverToFocusSlot(element: HTMLElement): void {
    const slot = document.getElementById('focusPlayGameOverSlot');
    if (!slot || !focusPlayActive || slot.contains(element)) {
        return;
    }

    const restore: GameOverRestore = {
        element,
        parent: element.parentElement as HTMLElement,
        nextSibling: element.nextSibling
    };

    if (element.id === 'gameOverAlert') {
        gameOverAlertRestore = restore;
    } else if (element.id === 'gameOver') {
        gameOverPanelRestore = restore;
    } else {
        return;
    }

    slot.appendChild(element);
}

function restoreGameOverElements(): void {
    const alert = document.getElementById('gameOverAlert');
    const panel = document.getElementById('gameOver');

    if (alert) {
        restoreSingleGameOverElement(alert);
    }
    if (panel) {
        restoreSingleGameOverElement(panel);
    }
}

function syncGameOverIntoFocus(): void {
    const alert = document.getElementById('gameOverAlert');
    const panel = document.getElementById('gameOver');

    if (alert?.classList.contains('show')) {
        moveGameOverToFocusSlot(alert);
    }
    if (panel?.classList.contains('show')) {
        moveGameOverToFocusSlot(panel);
    }
}

function setupGameOverObserver(): void {
    const alert = document.getElementById('gameOverAlert');
    const panel = document.getElementById('gameOver');

    gameOverObserver?.disconnect();

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.attributeName !== 'class') {
                continue;
            }

            const element = mutation.target as HTMLElement;

            if (element.classList.contains('show')) {
                if (focusPlayActive) {
                    moveGameOverToFocusSlot(element);
                }
            } else {
                restoreSingleGameOverElement(element);
            }

            refreshFocusGameStateUI();
        }
    });

    if (alert) {
        observer.observe(alert, { attributes: true, attributeFilter: ['class'] });
    }
    if (panel) {
        observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
    }

    gameOverObserver = observer;
}

function dispatchTogglePause(): void {
    window.dispatchEvent(new CustomEvent('gameChrome:togglePause'));
    setTimeout(refreshFocusGameStateUI, 0);
}

function applyZoom(zoom: number): void {
    const clamped = Math.max(0.5, Math.min(1.5, zoom));
    document.documentElement.style.setProperty('--game-zoom', String(clamped));

    const viewport = document.getElementById('gameViewport');
    if (viewport && !focusPlayActive) {
        (viewport as HTMLElement).style.zoom = String(clamped);
    }
}

function applyDisplayConfig(config: {
    zoom?: number;
    allowFullscreen?: boolean;
    autoFullscreen?: boolean;
}): void {
    if (config.allowFullscreen !== undefined) {
        allowFullscreen = config.allowFullscreen;
        updateFullscreenButtonVisibility();
    }

    if (config.autoFullscreen !== undefined) {
        autoFullscreen = config.autoFullscreen;
    }

    if (config.zoom !== undefined) {
        applyZoom(config.zoom);
    }

    if (allowFullscreen && autoFullscreen && !autoFullscreenApplied) {
        autoFullscreenApplied = true;
        setTimeout(() => {
            enterFocusPlay();
        }, 300);
    }
}

function ensureFocusOverlay(): void {
    let overlay = document.getElementById('focusPlayOverlay') as HTMLElement | null;

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'focusPlayOverlay';
        overlay.className = 'focus-play-overlay';
        overlay.hidden = true;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                exitFocusPlay();
            }
        });
    }

    if (document.getElementById('focusPlayControls')) {
        return;
    }

    overlay.innerHTML = `
        <div class="focus-play-dialog" role="dialog" aria-modal="true" aria-label="Focused gameplay">
            <div class="focus-play-header">
                <div class="focus-play-score" id="focusPlayScore"></div>
                <button type="button" class="focus-play-control-btn focus-play-exit-btn" id="focusPlayClose" title="Exit focus mode (Ctrl+F)">
                    <i class="codicon codicon-close"></i>
                    <span>Exit</span>
                </button>
            </div>
            <div class="focus-play-stage-wrap">
                <div class="focus-play-stage" id="focusPlayStage"></div>
                <div class="focus-play-game-over-slot" id="focusPlayGameOverSlot"></div>
            </div>
            <div class="focus-play-controls" id="focusPlayControls">
                <button type="button" class="focus-play-control-btn" id="focusPlayPause" title="Play or pause">
                    <i class="codicon codicon-debug-pause" id="focusPlayPauseIcon"></i>
                    <span id="focusPlayPauseLabel">Pause</span>
                </button>
                <span class="focus-play-control-hint" id="focusPlayPauseHint">Space to pause</span>
                <button type="button" class="focus-play-control-btn focus-play-restart-btn" id="focusPlayRestart" title="Restart game" hidden>
                    <i class="codicon codicon-debug-restart"></i>
                    <span>Restart</span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('focusPlayClose')?.addEventListener('click', () => {
        exitFocusPlay();
    });

    document.getElementById('focusPlayPause')?.addEventListener('click', () => {
        if (isGameIdleBeforeStart()) {
            window.dispatchEvent(new CustomEvent('gameChrome:start'));
        } else if (isGameActivelyPlaying()) {
            dispatchTogglePause();
        }
        setTimeout(refreshFocusGameStateUI, 0);
    });

    document.getElementById('focusPlayRestart')?.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('gameChrome:restart'));
    });

    window.addEventListener('gameChrome:pauseStateChanged', () => {
        refreshFocusGameStateUI();
    });

    window.addEventListener('gameChrome:gameStateChanged', () => {
        refreshFocusGameStateUI();
    });
}

function moveToFocusSlot(element: HTMLElement, slot: HTMLElement): void {
    focusRestoreStack.push({
        element,
        parent: element.parentElement as HTMLElement,
        nextSibling: element.nextSibling
    });
    slot.appendChild(element);
}

function restoreFocusElements(): void {
    while (focusRestoreStack.length > 0) {
        const { element, parent, nextSibling } = focusRestoreStack.pop() as FocusRestore;
        if (nextSibling) {
            parent.insertBefore(element, nextSibling);
        } else {
            parent.appendChild(element);
        }
    }
}

function enterFocusPlay(): void {
    if (!canUseFocus() || focusPlayActive) {
        return;
    }

    const target = document.querySelector('.focus-play-target') as HTMLElement | null;
    if (!target) {
        console.warn('[GameChrome] No .focus-play-target found for focus mode');
        return;
    }

    ensureFocusOverlay();

    const overlayEl = document.getElementById('focusPlayOverlay') as HTMLElement;
    const stageEl = document.getElementById('focusPlayStage') as HTMLElement;

    moveToFocusSlot(target, stageEl);
    setupFocusScoreDisplay();
    syncGameOverIntoFocus();

    overlayEl.hidden = false;
    document.body.classList.add('focus-play-active');
    focusPlayActive = true;
    refreshFullscreenUI();
    refreshFocusGameStateUI();
}

function exitFocusPlay(): void {
    if (!focusPlayActive) {
        return;
    }

    restoreGameOverElements();
    restoreFocusElements();
    teardownFocusScoreDisplay();

    const overlay = document.getElementById('focusPlayOverlay') as HTMLElement;
    if (overlay) {
        overlay.hidden = true;
    }

    document.body.classList.remove('focus-play-active');
    focusPlayActive = false;
    refreshFullscreenUI();

    const zoom = getComputedStyle(document.documentElement)
        .getPropertyValue('--game-zoom')
        .trim() || '0.85';
    const viewport = document.getElementById('gameViewport') as HTMLElement | null;
    if (viewport) {
        viewport.style.zoom = zoom;
    }
}

function isOnMenuScreen(): boolean {
    const difficulty = document.getElementById('difficultySelection');
    const characters = document.getElementById('characterSelection');
    const difficultyOpen = difficulty
        ? window.getComputedStyle(difficulty).display !== 'none'
        : false;
    const charactersOpen = characters
        ? window.getComputedStyle(characters).display !== 'none'
        : false;
    return difficultyOpen || charactersOpen;
}

function isOnDifficultyScreen(): boolean {
    return isOnMenuScreen();
}

function canUseFocus(): boolean {
    return allowFullscreen && !isOnDifficultyScreen();
}

function updateFullscreenButtonVisibility(): void {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const toolbarHint = document.querySelector('.toolbar-hint') as HTMLElement | null;

    if (fullscreenBtn) {
        fullscreenBtn.style.display = canUseFocus() ? 'inline-flex' : 'none';
    }

    if (toolbarHint) {
        toolbarHint.textContent = isOnMenuScreen()
            ? (document.getElementById('characterSelection')
                && window.getComputedStyle(document.getElementById('characterSelection') as HTMLElement).display !== 'none'
                    ? 'Choose character'
                    : 'Choose difficulty')
            : 'Ctrl+M mute · Ctrl+F focus';
    }
}

function refreshToolbarPhase(): void {
    if (isOnDifficultyScreen() && focusPlayActive) {
        exitFocusPlay();
    }
    updateFullscreenButtonVisibility();
    refreshFullscreenUI();
}

function refreshMuteUI(): void {
    const muteBtn = document.getElementById('muteBtn');
    const muteIcon = document.getElementById('muteIcon');
    const muteLabel = document.getElementById('muteLabel');

    if (!muteBtn || !muteIcon || !muteLabel) {
        return;
    }

    const isMuted = typeof soundManager !== 'undefined' && soundManager.isSoundMuted();

    muteBtn.classList.toggle('muted', isMuted);
    muteIcon.className = isMuted ? 'codicon codicon-mute' : 'codicon codicon-unmute';
    muteLabel.textContent = isMuted ? 'Muted' : 'Sound On';
    muteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
}

function refreshFullscreenUI(): void {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    const fullscreenLabel = document.getElementById('fullscreenLabel');

    if (!fullscreenBtn || !fullscreenIcon || !fullscreenLabel) {
        return;
    }

    fullscreenBtn.classList.toggle('active', focusPlayActive);
    fullscreenIcon.className = focusPlayActive
        ? 'codicon codicon-screen-normal'
        : 'codicon codicon-screen-full';
    fullscreenLabel.textContent = focusPlayActive ? 'Exit Focus' : 'Focus Play';
    fullscreenBtn.setAttribute('aria-pressed', focusPlayActive ? 'true' : 'false');
}

function toggleFullscreen(): void {
    if (!canUseFocus()) {
        return;
    }

    if (focusPlayActive) {
        exitFocusPlay();
    } else {
        enterFocusPlay();
    }
}

function isFocusPlayActive(): boolean {
    return focusPlayActive;
}

function toggleMute(): void {
    if (typeof soundManager === 'undefined') {
        return;
    }
    soundManager.toggleMute();
    refreshMuteUI();
}

function setDifficultyBadge(label: string): void {
    const badge = document.getElementById('difficultyBadge');
    if (badge) {
        badge.textContent = label;
        badge.style.display = label ? 'inline-block' : 'none';
    }
}

function setupMessageListeners(): void {
    window.addEventListener('message', (event) => {
        const message = event.data;

        if (message.command === 'updateDisplayConfig' && message.config) {
            applyDisplayConfig(message.config);
        }

        if (message.command === 'updateSoundConfig') {
            setTimeout(refreshMuteUI, 0);
        }
    });
}

function setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
        const isCtrlM = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm';
        if (isCtrlM) {
            event.preventDefault();
            toggleMute();
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && canUseFocus()) {
            event.preventDefault();
            toggleFullscreen();
            return;
        }

        if (event.key === 'Escape' && focusPlayActive) {
            event.preventDefault();
            exitFocusPlay();
        }
    });
}

function setupToolbarButtons(): void {
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
        muteBtn.addEventListener('click', toggleMute);
    }

    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            toggleFullscreen();
        });
    }
}

function initGameChrome(): void {
    ensureFocusOverlay();
    setupGameOverObserver();
    setupMessageListeners();
    setupKeyboardShortcuts();
    setupToolbarButtons();
    refreshMuteUI();
    refreshToolbarPhase();
    updateFullscreenButtonVisibility();
}

window.gameChrome = {
    refreshMuteUI,
    refreshFullscreenUI,
    applyZoom,
    setDifficultyBadge,
    toggleFullscreen,
    isFocusPlayActive,
    refreshToolbarPhase
};

window.initGameChrome = initGameChrome;

export { initGameChrome };
