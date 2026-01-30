/**
 * GameManager.ts
 * 
 * Central controller for game mechanics including play limits, unlocking,
 * and state management. Coordinates between CodeTracker and StorageManager.
 */

import * as vscode from 'vscode';
import {
    IGame,
    GameState,
    GlobalPlayState,
    PlayAttemptResult,
    GameEvent,
    CodeChange,
    ExtensionConfig
} from './types';
import { StorageManager } from './StorageManager';
import { CodeTracker } from './CodeTracker';

/**
 * Manages all game-related logic and state
 */
export class GameManager {
    /**
     * Registered games in the extension
     */
    private games: Map<string, IGame> = new Map();

    /**
     * Event emitter for game events
     */
    private eventEmitter = new vscode.EventEmitter<{
        event: GameEvent;
        gameId: string;
        data?: any
    }>();

    /**
     * Public event that fires for various game events
     */
    public readonly onGameEvent = this.eventEmitter.event;

    /**
     * Current extension configuration
     */
    private config: ExtensionConfig;

    /**
     * Creates a new GameManager instance
     * 
     * @param storageManager - Storage manager for persistence
     * @param codeTracker - Code tracker for monitoring code changes
     */
    constructor(
        private storageManager: StorageManager,
        private codeTracker: CodeTracker
    ) {
        this.config = storageManager.getConfig();
        this.setupCodeTracking();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    /**
     * Sets up code tracking event handlers
     * 
     * @private
     */
    private setupCodeTracking(): void {
        // Listen for code changes
        this.codeTracker.onCodeWritten(async (change: CodeChange) => {
            await this.handleCodeWritten(change);
        });
    }

    /**
     * Registers a game with the manager
     * 
     * @param game - Game to register
     */
    registerGame(game: IGame): void {
        this.games.set(game.id, game);

        // Ensure game has initial state
        const state = this.storageManager.getGameState(game.id);
        if (!state) {
            this.storageManager.saveGameState(game.id, {
                highScore: 0,
                totalPlays: 0
            });
        }
    }

    /**
     * Registers multiple games at once
     * 
     * @param games - Array of games to register
     */
    registerGames(games: IGame[]): void {
        games.forEach(game => this.registerGame(game));
    }

    // ========================================
    // GAME ACCESS CONTROL
    // ========================================

    /**
     * Attempts to start a play session for a game
     * Checks if games are unlocked and has plays remaining
     * NOTE: Does NOT decrement plays - that happens in endPlay()
     * 
     * @param gameId - ID of game to play
     * @returns Result indicating success or failure
     */
    async attemptPlay(gameId: string): Promise<PlayAttemptResult> {
        const game = this.games.get(gameId);

        // Validate game exists
        if (!game) {
            return {
                success: false,
                reason: `Game '${gameId}' not found`
            };
        }

        // Get global play state
        const globalState = this.storageManager.getGlobalPlayState();

        // Check if games are unlocked
        if (!globalState.isUnlocked) {
            return {
                success: false,
                reason: `Games locked. Write ${this.getRemainingLinesToUnlock()} more lines to unlock.`
            };
        }

        // Check if plays remaining
        if (globalState.playsRemaining <= 0) {
            return {
                success: false,
                reason: `No plays remaining. Write ${this.config.unlock.linesToUnlock} lines to unlock.`
            };
        }

        // Allow play (don't decrement here - happens in endPlay)
        return {
            success: true
        };
    }

    /**
     * Records that a play session has ended
     * THIS is where we decrement the play counter
     * 
     * @param gameId - ID of game that was played
     * @param score - Final score achieved (optional)
     */
    async endPlay(gameId: string, score?: number): Promise<void> {
        const gameState = this.storageManager.getGameState(gameId);
        const globalState = this.storageManager.getGlobalPlayState();

        // Update game-specific stats
        const updates: Partial<GameState> = {
            totalPlays: gameState.totalPlays + 1,
            lastPlayed: Date.now()
        };

        // Update high score if provided and higher than current
        if (score !== undefined && score > gameState.highScore) {
            updates.highScore = score;
        }

        await this.storageManager.updateGameState(gameId, updates);

        // Decrement global plays
        const newPlaysRemaining = globalState.playsRemaining - 1;
        const newGlobalState: GlobalPlayState = {
            ...globalState,
            playsRemaining: newPlaysRemaining
        };

        // Lock if no plays remaining
        if (newPlaysRemaining === 0) {
            newGlobalState.isUnlocked = false;
            newGlobalState.linesWritten = 0; // Reset counter for unlock

            // Emit lock event
            this.eventEmitter.fire({
                event: GameEvent.LOCKED,
                gameId: '__global__',
                data: newGlobalState
            });
        }

        await this.storageManager.saveGlobalPlayState(newGlobalState);

        // Emit play ended event
        this.eventEmitter.fire({
            event: GameEvent.PLAY_ENDED,
            gameId,
            data: { score }
        });
    }

    // ========================================
    // CODE TRACKING & UNLOCK LOGIC
    // ========================================

    /**
     * Handles code written events from CodeTracker
     * Updates line counts and checks for unlocks
     * 
     * @param change - Code change details
     * @private
     */
    private async handleCodeWritten(change: CodeChange): Promise<void> {
        // Add to total lines written
        await this.storageManager.addLinesWritten(change.netChange);

        // Update global unlock progress
        await this.updateGlobalProgress(change.netChange);

        // Emit code written event
        this.eventEmitter.fire({
            event: GameEvent.CODE_WRITTEN,
            gameId: '__global__',
            data: change
        });
    }

    /**
     * Updates progress toward unlocking games globally
     * 
     * @param linesWritten - Number of lines written
     * @private
     */
    private async updateGlobalProgress(linesWritten: number): Promise<void> {
        const globalState = this.storageManager.getGlobalPlayState();

        // Only update if games are locked
        if (globalState.isUnlocked) {
            return;
        }

        const newLinesWritten = globalState.linesWritten + linesWritten;

        // Check if enough lines to unlock
        if (newLinesWritten >= this.config.unlock.linesToUnlock) {
            // Unlock all games!
            const newState: GlobalPlayState = {
                isUnlocked: true,
                playsRemaining: this.config.unlock.playsPerUnlock,
                linesWritten: 0 // Reset counter
            };

            await this.storageManager.saveGlobalPlayState(newState);

            // Emit unlock event
            this.eventEmitter.fire({
                event: GameEvent.UNLOCKED,
                gameId: '__global__',
                data: newState
            });

            // Show notification if enabled
            if (this.config.showUnlockNotifications) {
                vscode.window.showInformationMessage(
                    `🎮 Games unlocked! You have ${newState.playsRemaining} plays.`
                );
            }
        } else {
            // Update progress
            await this.storageManager.updateGlobalPlayState({
                linesWritten: newLinesWritten
            });

            // Emit progress event
            this.eventEmitter.fire({
                event: GameEvent.PROGRESS_UPDATED,
                gameId: '__global__',
                data: {
                    linesWritten: newLinesWritten,
                    linesRequired: this.config.unlock.linesToUnlock,
                    progress: newLinesWritten / this.config.unlock.linesToUnlock
                }
            });
        }
    }

    // ========================================
    // QUERY METHODS
    // ========================================

    /**
     * Gets a specific game by ID
     * 
     * @param gameId - ID of game to retrieve
     * @returns Game object or undefined
     */
    getGame(gameId: string): IGame | undefined {
        return this.games.get(gameId);
    }

    /**
     * Gets all registered games
     * 
     * @returns Array of all games
     */
    getAllGames(): IGame[] {
        return Array.from(this.games.values());
    }

    /**
     * Gets games that are currently unlocked (checks global state)
     * 
     * @returns Array of all games if unlocked, empty if locked
     */
    getUnlockedGames(): IGame[] {
        const globalState = this.storageManager.getGlobalPlayState();
        return globalState.isUnlocked ? this.getAllGames() : [];
    }

    /**
     * Gets games that are currently locked (checks global state)
     * 
     * @returns Empty array if unlocked, all games if locked
     */
    getLockedGames(): IGame[] {
        const globalState = this.storageManager.getGlobalPlayState();
        return globalState.isUnlocked ? [] : this.getAllGames();
    }

    /**
     * Checks if games are unlocked (global state)
     * 
     * @param gameId - ID of game to check (ignored, kept for compatibility)
     * @returns True if games are unlocked
     */
    isGameUnlocked(gameId: string): boolean {
        const globalState = this.storageManager.getGlobalPlayState();
        return globalState.isUnlocked;
    }

    /**
     * Gets the number of plays remaining (global)
     * 
     * @param gameId - ID of game to check (ignored, kept for compatibility)
     * @returns Number of plays remaining
     */
    getPlaysRemaining(gameId: string): number {
        const globalState = this.storageManager.getGlobalPlayState();
        return globalState.playsRemaining;
    }

    /**
     * Gets remaining lines needed to unlock games (global)
     * 
     * @param gameId - ID of game to check (ignored, kept for compatibility)
     * @returns Lines remaining (0 if already unlocked)
     */
    getRemainingLinesToUnlock(gameId?: string): number {
        const globalState = this.storageManager.getGlobalPlayState();

        if (globalState.isUnlocked) {
            return 0;
        }

        return Math.max(
            0,
            this.config.unlock.linesToUnlock - globalState.linesWritten
        );
    }

    /**
     * Gets unlock progress as percentage (0-100)
     * 
     * @param gameId - ID of game to check (ignored, kept for compatibility)
     * @returns Progress percentage
     */
    getUnlockProgress(gameId?: string): number {
        const globalState = this.storageManager.getGlobalPlayState();

        if (globalState.isUnlocked) {
            return 100;
        }

        return Math.min(
            100,
            (globalState.linesWritten / this.config.unlock.linesToUnlock) * 100
        );
    }

    // ========================================
    // ADMIN/DEBUG METHODS
    // ========================================

    /**
     * Manually unlocks games (for testing/admin purposes)
     * 
     * @param gameId - ID of game to unlock (ignored, kept for compatibility)
     */
    async unlockGame(gameId?: string): Promise<void> {
        const globalState: GlobalPlayState = {
            isUnlocked: true,
            playsRemaining: this.config.unlock.playsPerUnlock,
            linesWritten: 0
        };

        await this.storageManager.saveGlobalPlayState(globalState);

        this.eventEmitter.fire({
            event: GameEvent.UNLOCKED,
            gameId: '__global__',
            data: globalState
        });
    }

    /**
     * Manually locks games (for testing/admin purposes)
     * 
     * @param gameId - ID of game to lock (ignored, kept for compatibility)
     */
    async lockGame(gameId?: string): Promise<void> {
        const globalState: GlobalPlayState = {
            isUnlocked: false,
            playsRemaining: 0,
            linesWritten: 0
        };

        await this.storageManager.saveGlobalPlayState(globalState);

        this.eventEmitter.fire({
            event: GameEvent.LOCKED,
            gameId: '__global__',
            data: globalState
        });
    }

    /**
     * Resets a game to initial state (high score only)
     * 
     * @param gameId - ID of game to reset
     */
    async resetGame(gameId: string): Promise<void> {
        await this.storageManager.resetGameState(gameId);
    }

    /**
     * Resets all games to initial state and resets global play state
     */
    async resetAllGames(): Promise<void> {
        // Reset individual game stats
        for (const game of this.games.values()) {
            await this.resetGame(game.id);
        }

        // Reset global play state
        await this.storageManager.resetGlobalPlayState();
    }

    /**
     * Updates the configuration
     * 
     * @param config - New configuration
     */
    async updateConfig(config: ExtensionConfig): Promise<void> {
        this.config = config;
        await this.storageManager.saveConfig(config);
        this.codeTracker.updateConfig(config);
    }

    // ========================================
    // CLEANUP
    // ========================================

    /**
     * Disposes of all resources
     */
    dispose(): void {
        this.eventEmitter.dispose();
        this.games.clear();
    }
}