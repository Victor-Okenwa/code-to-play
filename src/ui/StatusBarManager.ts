/**
 * StatusBarManager.ts
 * 
 * Manages the status bar item that shows game unlock progress and status.
 * Displays remaining lines to unlock or available plays for unlocked games.
 */

import * as vscode from 'vscode';
import { GameManager } from '../core/GameManager';
import { StorageManager } from '../core/StorageManager';
import { GameEvent } from '../core/types';

/**
 * Manages the status bar display for game unlock progress
 */
export class StatusBarManager {
    /**
     * The status bar item instance
     */
    private statusBarItem: vscode.StatusBarItem;

    /**
     * Currently tracked game (usually the last played or next to unlock)
     */
    private trackedGameId: string | null = null;

    /**
     * Timer for periodic updates
     */
    private updateTimer: NodeJS.Timeout | undefined;

    /**
     * Creates a new StatusBarManager instance
     * 
     * @param gameManager - Game manager for accessing game data
     * @param storageManager - Storage manager for accessing stats
     */
    constructor(
        private gameManager: GameManager,
        private storageManager: StorageManager
    ) {
        // Create status bar item (appears on right side)
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100 // Priority (higher = further left)
        );

        this.statusBarItem.command = 'codeToPlay.showStatus';

        this.setupEventListeners();
        this.determineTrackedGame();
        this.update();

        // Show the status bar item
        this.statusBarItem.show();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    /**
     * Sets up event listeners for auto-updates
     * 
     * @private
     */
    private setupEventListeners(): void {
        // Listen for game events
        this.gameManager.onGameEvent((event) => {
            switch (event.event) {
                case GameEvent.UNLOCKED:
                case GameEvent.LOCKED:
                case GameEvent.PLAY_STARTED:
                case GameEvent.PLAY_ENDED:
                    this.determineTrackedGame();
                    this.update();
                    break;

                case GameEvent.CODE_WRITTEN:
                case GameEvent.PROGRESS_UPDATED:
                    this.update();
                    break;
            }
        });

        // Periodic updates (every 30 seconds)
        this.updateTimer = setInterval(() => {
            this.update();
        }, 30000);
    }

    // ========================================
    // GAME TRACKING
    // ========================================

    /**
     * Determines which game to track in the status bar
     * Priority: locked games closest to unlock > unlocked games with plays
     * 
     * @private
     */
    private determineTrackedGame(): void {
        const games = this.gameManager.getAllGames();

        if (games.length === 0) {
            this.trackedGameId = null;
            return;
        }

        // Find locked games sorted by progress
        const lockedGames = this.gameManager.getLockedGames();
        if (lockedGames.length > 0) {
            // Track the locked game closest to unlock
            const sorted = lockedGames.sort((a, b) => {
                const progressA = this.gameManager.getUnlockProgress(a.id);
                const progressB = this.gameManager.getUnlockProgress(b.id);
                return progressB - progressA; // Highest progress first
            });

            this.trackedGameId = sorted[0].id;
            return;
        }

        // All games unlocked - track first unlocked game with plays
        const unlockedGames = this.gameManager.getUnlockedGames();
        const gamesWithPlays = unlockedGames.filter(g =>
            this.gameManager.getPlaysRemaining(g.id) > 0
        );

        if (gamesWithPlays.length > 0) {
            this.trackedGameId = gamesWithPlays[0].id;
        } else {
            // No games with plays - track first game
            this.trackedGameId = games[0].id;
        }
    }

    /**
     * Sets which game to track manually
     * 
     * @param gameId - ID of game to track
     */
    setTrackedGame(gameId: string): void {
        const game = this.gameManager.getGame(gameId);
        if (game) {
            this.trackedGameId = gameId;
            this.update();
        }
    }

    // ========================================
    // STATUS BAR UPDATE
    // ========================================

    /**
     * Updates the status bar item with current game status
     * 
     * @private
     */
    private update(): void {
        if (!this.trackedGameId) {
            this.showNoGamesStatus();
            return;
        }

        const game = this.gameManager.getGame(this.trackedGameId);
        if (!game) {
            this.showNoGamesStatus();
            return;
        }

        const state = this.storageManager.getGameState(this.trackedGameId);

        if (state.isUnlocked) {
            this.showUnlockedStatus(game.name, state.playsRemaining);
        } else {
            this.showLockedStatus(
                game.name,
                this.gameManager.getRemainingLinesToUnlock(this.trackedGameId),
                this.gameManager.getUnlockProgress(this.trackedGameId)
            );
        }
    }

    /**
     * Shows status when no games are available
     * 
     * @private
     */
    private showNoGamesStatus(): void {
        this.statusBarItem.text = '$(game) Code to Play';
        this.statusBarItem.tooltip = 'No games available';
        this.statusBarItem.backgroundColor = undefined;
    }

    /**
     * Shows status for an unlocked game
     * 
     * @param gameName - Name of the game
     * @param playsRemaining - Number of plays remaining
     * @private
     */
    private showUnlockedStatus(gameName: string, playsRemaining: number): void {
        if (playsRemaining > 0) {
            // Game ready to play
            this.statusBarItem.text = `$(play-circle) ${gameName} (${playsRemaining})`;
            this.statusBarItem.tooltip = this.createUnlockedTooltip(gameName, playsRemaining);
            this.statusBarItem.backgroundColor = undefined;
        } else {
            // No plays remaining
            this.statusBarItem.text = `$(circle-slash) ${gameName}`;
            this.statusBarItem.tooltip = this.createNoPlaysTooltip(gameName);
            this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.warningBackground'
            );
        }
    }

    /**
     * Shows status for a locked game
     * 
     * @param gameName - Name of the game
     * @param linesRemaining - Lines needed to unlock
     * @param progress - Progress percentage (0-100)
     * @private
     */
    private showLockedStatus(
        gameName: string,
        linesRemaining: number,
        progress: number
    ): void {
        // Show progress bar in status
        const progressBar = this.createProgressBar(progress);

        this.statusBarItem.text = `$(lock) ${gameName}: ${linesRemaining} lines ${progressBar}`;
        this.statusBarItem.tooltip = this.createLockedTooltip(
            gameName,
            linesRemaining,
            progress
        );
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
            'statusBarItem.errorBackground'
        );
    }

    // ========================================
    // TOOLTIP CREATION
    // ========================================

    /**
     * Creates tooltip for unlocked game
     * 
     * @param gameName - Name of the game
     * @param playsRemaining - Number of plays remaining
     * @returns Formatted tooltip
     * @private
     */
    private createUnlockedTooltip(gameName: string, playsRemaining: number): string {
        const config = this.storageManager.getConfig();

        return [
            `🎮 ${gameName}`,
            ``,
            `✅ Unlocked and ready to play!`,
            `🎯 Plays remaining: ${playsRemaining}`,
            ``,
            `📝 Write ${config.unlock.linesToUnlock} more lines after plays run out to unlock ${config.unlock.playsPerUnlock} new plays`,
            ``,
            `Click to view all games`
        ].join('\n');
    }

    /**
     * Creates tooltip for game with no plays
     * 
     * @param gameName - Name of the game
     * @returns Formatted tooltip
     * @private
     */
    private createNoPlaysTooltip(gameName: string): string {
        const config = this.storageManager.getConfig();

        return [
            `🎮 ${gameName}`,
            ``,
            `⚠️ No plays remaining`,
            `📝 Write ${config.unlock.linesToUnlock} lines of code to unlock ${config.unlock.playsPerUnlock} new plays`,
            ``,
            `Click to view all games`
        ].join('\n');
    }

    /**
     * Creates tooltip for locked game
     * 
     * @param gameName - Name of the game
     * @param linesRemaining - Lines needed to unlock
     * @param progress - Progress percentage
     * @returns Formatted tooltip
     * @private
     */
    private createLockedTooltip(
        gameName: string,
        linesRemaining: number,
        progress: number
    ): string {
        const config = this.storageManager.getConfig();
        const totalLines = this.storageManager.getTotalLinesWritten();

        return [
            `🎮 ${gameName}`,
            ``,
            `🔒 Locked`,
            `📊 Progress: ${Math.floor(progress)}%`,
            `📝 Write ${linesRemaining} more lines to unlock`,
            ``,
            `When unlocked, you'll get ${config.unlock.playsPerUnlock} plays`,
            ``,
            `📈 Total lines written: ${totalLines}`,
            ``,
            `Click to view all games`
        ].join('\n');
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Creates a visual progress bar string
     * 
     * @param progress - Progress percentage (0-100)
     * @returns Progress bar string
     * @private
     */
    private createProgressBar(progress: number): string {
        const totalBlocks = 10;
        const filledBlocks = Math.floor((progress / 100) * totalBlocks);
        const emptyBlocks = totalBlocks - filledBlocks;

        const filled = '█'.repeat(filledBlocks);
        const empty = '░'.repeat(emptyBlocks);

        return `[${filled}${empty}]`;
    }

    /**
     * Shows a quick status message
     * 
     * @param message - Message to display
     * @param duration - Duration in milliseconds
     */
    showMessage(message: string, duration: number = 3000): void {
        const originalText = this.statusBarItem.text;
        const originalTooltip = this.statusBarItem.tooltip;

        this.statusBarItem.text = `$(info) ${message}`;
        this.statusBarItem.tooltip = message;

        setTimeout(() => {
            this.statusBarItem.text = originalText;
            this.statusBarItem.tooltip = originalTooltip;
        }, duration);
    }

    /**
     * Animates the status bar (for celebrations)
     * 
     * @param message - Message to display
     * @param icon - Icon to use
     * @param duration - Duration in milliseconds
     */
    async celebrate(
        message: string,
        icon: string = 'star',
        duration: number = 2000
    ): Promise<void> {
        const originalText = this.statusBarItem.text;
        const originalTooltip = this.statusBarItem.tooltip;
        const originalBackground = this.statusBarItem.backgroundColor;

        // Animated celebration
        const icons = ['$(star)', '$(star-full)', '$(sparkle)'];
        let iconIndex = 0;

        const interval = setInterval(() => {
            this.statusBarItem.text = `${icons[iconIndex % icons.length]} ${message}`;
            iconIndex++;
        }, 200);

        this.statusBarItem.tooltip = message;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
            'statusBarItem.prominentBackground'
        );

        await new Promise(resolve => setTimeout(resolve, duration));

        clearInterval(interval);

        // Restore original
        this.statusBarItem.text = originalText;
        this.statusBarItem.tooltip = originalTooltip;
        this.statusBarItem.backgroundColor = originalBackground;
    }

    // ========================================
    // PUBLIC API
    // ========================================

    /**
     * Forces an immediate update of the status bar
     */
    forceUpdate(): void {
        this.determineTrackedGame();
        this.update();
    }

    /**
     * Hides the status bar item
     */
    hide(): void {
        this.statusBarItem.hide();
    }

    /**
     * Shows the status bar item
     */
    show(): void {
        this.statusBarItem.show();
    }

    // ========================================
    // CLEANUP
    // ========================================

    /**
     * Disposes of resources
     */
    dispose(): void {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        this.statusBarItem.dispose();
    }
}

/**
 * Creates and registers the status bar manager
 * Call this from extension.ts during activation
 * 
 * @param context - Extension context
 * @param gameManager - Game manager instance
 * @param storageManager - Storage manager instance
 * @returns The status bar manager instance
 */
export function createStatusBar(
    context: vscode.ExtensionContext,
    gameManager: GameManager,
    storageManager: StorageManager
): StatusBarManager {
    const statusBarManager = new StatusBarManager(gameManager, storageManager);

    // Register command for status bar click
    const command = vscode.commands.registerCommand('codeToPlay.showStatus', () => {
        // Focus on the games view
        vscode.commands.executeCommand('codeToPlayGames.focus');
    });

    context.subscriptions.push(statusBarManager, command);

    return statusBarManager;
}