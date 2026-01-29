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
                playsRemaining: this.config.unlock.initialPlays,
                linesWritten: 0,
                isUnlocked: true,
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
     * Checks if game is unlocked and has plays remaining
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

        // Get current state
        const state = this.storageManager.getGameState(gameId);

        // Check if game is unlocked
        if (!state.isUnlocked) {
            return {
                success: false,
                reason: `Game locked. Write ${this.getRemainingLinesToUnlock(gameId)} more lines to unlock.`,
                gameState: state
            };
        }

        // Check if plays remaining
        if (state.playsRemaining <= 0) {
            return {
                success: false,
                reason: `No plays remaining. Write ${this.config.unlock.linesToUnlock} lines to unlock.`,
                gameState: state
            };
        }

        // Decrement plays and update state
        const newState: GameState = {
            ...state,
            playsRemaining: state.playsRemaining - 1,
            totalPlays: state.totalPlays + 1,
            lastPlayed: Date.now()
        };

        // Lock game if no plays remaining
        if (newState.playsRemaining === 0) {
            newState.isUnlocked = false;
            newState.linesWritten = 0; // Reset counter for unlock

            // Emit lock event
            this.eventEmitter.fire({
                event: GameEvent.LOCKED,
                gameId,
                data: newState
            });
        }

        await this.storageManager.saveGameState(gameId, newState);

        // Emit play started event
        this.eventEmitter.fire({
            event: GameEvent.PLAY_STARTED,
            gameId,
            data: newState
        });

        return {
            success: true,
            gameState: newState
        };
    }

    /**
     * Records that a play session has ended
     * 
     * @param gameId - ID of game that was played
     * @param score - Final score achieved (optional)
     */
    async endPlay(gameId: string, score?: number): Promise<void> {
        const state = this.storageManager.getGameState(gameId);

        // Update high score if provided and higher than current
        if (score !== undefined && score > state.highScore) {
            await this.storageManager.updateGameState(gameId, {
                highScore: score
            });
        }

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

        // Update all locked games
        const lockedGames = this.getLockedGames();

        for (const game of lockedGames) {
            await this.updateGameProgress(game.id, change.netChange);
        }

        // Emit code written event
        this.eventEmitter.fire({
            event: GameEvent.CODE_WRITTEN,
            gameId: '__all__',
            data: change
        });
    }

    /**
     * Updates progress toward unlocking a specific game
     * 
     * @param gameId - ID of game to update
     * @param linesWritten - Number of lines written
     * @private
     */
    private async updateGameProgress(
        gameId: string,
        linesWritten: number
    ): Promise<void> {
        const state = this.storageManager.getGameState(gameId);

        // Only update if game is locked
        if (state.isUnlocked) {
            return;
        }

        const newLinesWritten = state.linesWritten + linesWritten;

        // Check if enough lines to unlock
        if (newLinesWritten >= this.config.unlock.linesToUnlock) {
            // Unlock the game!
            const newState: GameState = {
                ...state,
                isUnlocked: true,
                playsRemaining: this.config.unlock.playsPerUnlock,
                linesWritten: 0 // Reset counter
            };

            await this.storageManager.saveGameState(gameId, newState);

            // Emit unlock event
            this.eventEmitter.fire({
                event: GameEvent.UNLOCKED,
                gameId,
                data: newState
            });

            // Show notification if enabled
            if (this.config.showUnlockNotifications) {
                const game = this.games.get(gameId);
                vscode.window.showInformationMessage(
                    `🎮 ${game?.name || 'Game'} unlocked! You have ${newState.playsRemaining} plays.`
                );
            }
        } else {
            // Update progress
            await this.storageManager.updateGameState(gameId, {
                linesWritten: newLinesWritten
            });

            // Emit progress event
            this.eventEmitter.fire({
                event: GameEvent.PROGRESS_UPDATED,
                gameId,
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
     * Gets games that are currently unlocked
     * 
     * @returns Array of unlocked games
     */
    getUnlockedGames(): IGame[] {
        return this.getAllGames().filter(game => {
            const state = this.storageManager.getGameState(game.id);
            return state.isUnlocked;
        });
    }

    /**
     * Gets games that are currently locked
     * 
     * @returns Array of locked games
     */
    getLockedGames(): IGame[] {
        return this.getAllGames().filter(game => {
            const state = this.storageManager.getGameState(game.id);
            return !state.isUnlocked;
        });
    }

    /**
     * Checks if a specific game is unlocked
     * 
     * @param gameId - ID of game to check
     * @returns True if game is unlocked
     */
    isGameUnlocked(gameId: string): boolean {
        const state = this.storageManager.getGameState(gameId);
        return state.isUnlocked;
    }

    /**
     * Gets the number of plays remaining for a game
     * 
     * @param gameId - ID of game to check
     * @returns Number of plays remaining
     */
    getPlaysRemaining(gameId: string): number {
        const state = this.storageManager.getGameState(gameId);
        return state.playsRemaining;
    }

    /**
     * Gets remaining lines needed to unlock a game
     * 
     * @param gameId - ID of game to check
     * @returns Lines remaining (0 if already unlocked)
     */
    getRemainingLinesToUnlock(gameId: string): number {
        const state = this.storageManager.getGameState(gameId);

        if (state.isUnlocked) {
            return 0;
        }

        return Math.max(
            0,
            this.config.unlock.linesToUnlock - state.linesWritten
        );
    }

    /**
     * Gets unlock progress as percentage (0-100)
     * 
     * @param gameId - ID of game to check
     * @returns Progress percentage
     */
    getUnlockProgress(gameId: string): number {
        const state = this.storageManager.getGameState(gameId);

        if (state.isUnlocked) {
            return 100;
        }

        return Math.min(
            100,
            (state.linesWritten / this.config.unlock.linesToUnlock) * 100
        );
    }

    // ========================================
    // ADMIN/DEBUG METHODS
    // ========================================

    /**
     * Manually unlocks a game (for testing/admin purposes)
     * 
     * @param gameId - ID of game to unlock
     */
    async unlockGame(gameId: string): Promise<void> {
        await this.storageManager.updateGameState(gameId, {
            isUnlocked: true,
            playsRemaining: this.config.unlock.playsPerUnlock,
            linesWritten: 0
        });

        this.eventEmitter.fire({
            event: GameEvent.UNLOCKED,
            gameId,
            data: this.storageManager.getGameState(gameId)
        });
    }

    /**
     * Manually locks a game (for testing/admin purposes)
     * 
     * @param gameId - ID of game to lock
     */
    async lockGame(gameId: string): Promise<void> {
        await this.storageManager.updateGameState(gameId, {
            isUnlocked: false,
            playsRemaining: 0,
            linesWritten: 0
        });

        this.eventEmitter.fire({
            event: GameEvent.LOCKED,
            gameId,
            data: this.storageManager.getGameState(gameId)
        });
    }

    /**
     * Resets a game to initial state
     * 
     * @param gameId - ID of game to reset
     */
    async resetGame(gameId: string): Promise<void> {
        await this.storageManager.resetGameState(gameId);
    }

    /**
     * Resets all games to initial state
     */
    async resetAllGames(): Promise<void> {
        for (const game of this.games.values()) {
            await this.resetGame(game.id);
        }
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