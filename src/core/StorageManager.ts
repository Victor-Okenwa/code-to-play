/**
 * StorageManager.ts
 * 
 * Handles all persistence operations for the extension.
 * Manages game states, user preferences, and statistics using VS Code's storage APIs.
 */

import * as vscode from 'vscode';
import {
    GameState,
    StorageKey,
    ExtensionConfig,
    DEFAULT_GAME_STATE,
    DEFAULT_CONFIG
} from './types';

/**
 * Manages persistent storage for the extension
 * Uses VS Code's Memento API for global and workspace-specific storage
 */
export class StorageManager {
    /**
     * Global storage (persists across all workspaces)
     */
    private globalState: vscode.Memento;

    /**
     * Workspace storage (specific to current workspace)
     */
    private workspaceState: vscode.Memento;

    /**
     * Creates a new StorageManager instance
     * 
     * @param context - VS Code extension context
     */
    constructor(private context: vscode.ExtensionContext) {
        this.globalState = context.globalState;
        this.workspaceState = context.workspaceState;
    }

    // ========================================
    // GAME STATE MANAGEMENT
    // ========================================

    /**
     * Retrieves the state for a specific game
     * Returns default state if no saved state exists
     * 
     * @param gameId - Unique identifier for the game
     * @returns The game's current state
     */
    getGameState(gameId: string): GameState {
        const key = this.getGameStateKey(gameId);
        const savedState = this.globalState.get<GameState>(key);

        // Return saved state or default
        return savedState || { ...DEFAULT_GAME_STATE };
    }

    /**
     * Saves the state for a specific game
     * 
     * @param gameId - Unique identifier for the game
     * @param state - Game state to save
     * @returns Promise that resolves when save is complete
     */
    async saveGameState(gameId: string, state: GameState): Promise<void> {
        const key = this.getGameStateKey(gameId);
        await this.globalState.update(key, state);
    }

    /**
     * Updates specific properties of a game's state
     * Merges with existing state rather than replacing
     * 
     * @param gameId - Unique identifier for the game
     * @param updates - Partial state object with properties to update
     * @returns Promise that resolves when update is complete
     */
    async updateGameState(
        gameId: string,
        updates: Partial<GameState>
    ): Promise<void> {
        const currentState = this.getGameState(gameId);
        const newState = { ...currentState, ...updates };
        await this.saveGameState(gameId, newState);
    }

    /**
     * Resets a game's state to default values
     * 
     * @param gameId - Unique identifier for the game
     * @returns Promise that resolves when reset is complete
     */
    async resetGameState(gameId: string): Promise<void> {
        await this.saveGameState(gameId, { ...DEFAULT_GAME_STATE });
    }

    /**
     * Gets all game states
     * Useful for statistics and bulk operations
     * 
     * @returns Map of game IDs to their states
     */
    getAllGameStates(): Map<string, GameState> {
        const states = new Map<string, GameState>();
        const keys = this.globalState.keys();

        // Filter for game state keys and load them
        for (const key of keys) {
            if (key.startsWith(StorageKey.GAME_STATE_PREFIX)) {
                const gameId = key.replace(StorageKey.GAME_STATE_PREFIX, '');
                const state = this.globalState.get<GameState>(key);
                if (state) {
                    states.set(gameId, state);
                }
            }
        }

        return states;
    }

    // ========================================
    // CONFIGURATION MANAGEMENT
    // ========================================

    /**
     * Gets the extension configuration
     * Returns default config if none exists
     * 
     * @returns Current extension configuration
     */
    getConfig(): ExtensionConfig {
        const savedConfig = this.globalState.get<ExtensionConfig>(
            StorageKey.CONFIG
        );
        return savedConfig || { ...DEFAULT_CONFIG };
    }

    /**
     * Saves the extension configuration
     * 
     * @param config - Configuration to save
     * @returns Promise that resolves when save is complete
     */
    async saveConfig(config: ExtensionConfig): Promise<void> {
        await this.globalState.update(StorageKey.CONFIG, config);
    }

    /**
     * Updates specific configuration properties
     * 
     * @param updates - Partial config object with properties to update
     * @returns Promise that resolves when update is complete
     */
    async updateConfig(updates: Partial<ExtensionConfig>): Promise<void> {
        const currentConfig = this.getConfig();
        const newConfig = { ...currentConfig, ...updates };
        await this.saveConfig(newConfig);
    }

    /**
     * Resets configuration to default values
     * 
     * @returns Promise that resolves when reset is complete
     */
    async resetConfig(): Promise<void> {
        await this.saveConfig({ ...DEFAULT_CONFIG });
    }

    // ========================================
    // STATISTICS TRACKING
    // ========================================

    /**
     * Gets the total lines of code written across all time
     * 
     * @returns Total line count
     */
    getTotalLinesWritten(): number {
        return this.globalState.get<number>(
            StorageKey.TOTAL_LINES_WRITTEN,
            0
        );
    }

    /**
     * Increments the total lines written counter
     * 
     * @param lines - Number of lines to add
     * @returns Promise that resolves when update is complete
     */
    async addLinesWritten(lines: number): Promise<void> {
        const current = this.getTotalLinesWritten();
        await this.globalState.update(
            StorageKey.TOTAL_LINES_WRITTEN,
            current + lines
        );
    }

    /**
     * Sets the total lines written counter to a specific value
     * 
     * @param lines - New total value
     * @returns Promise that resolves when update is complete
     */
    async setTotalLinesWritten(lines: number): Promise<void> {
        await this.globalState.update(StorageKey.TOTAL_LINES_WRITTEN, lines);
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Generates the storage key for a game's state
     * 
     * @param gameId - Unique identifier for the game
     * @returns Full storage key
     */
    private getGameStateKey(gameId: string): string {
        return `${StorageKey.GAME_STATE_PREFIX}${gameId}`;
    }

    /**
     * Clears all extension data from storage
     * WARNING: This is destructive and cannot be undone
     * 
     * @returns Promise that resolves when clear is complete
     */
    async clearAllData(): Promise<void> {
        const keys = this.globalState.keys();

        // Clear all keys that belong to this extension
        for (const key of keys) {
            if (key.startsWith('codeToPlay.')) {
                await this.globalState.update(key, undefined);
            }
        }
    }

    /**
     * Exports all extension data as JSON
     * Useful for backups or debugging
     * 
     * @returns JSON string of all data
     */
    exportData(): string {
        const data: Record<string, any> = {};
        const keys = this.globalState.keys();

        for (const key of keys) {
            if (key.startsWith('codeToPlay.')) {
                data[key] = this.globalState.get(key);
            }
        }

        return JSON.stringify(data, null, 2);
    }

    /**
     * Imports data from JSON export
     * 
     * @param jsonData - JSON string of exported data
     * @returns Promise that resolves when import is complete
     */
    async importData(jsonData: string): Promise<void> {
        try {
            const data = JSON.parse(jsonData);

            for (const [key, value] of Object.entries(data)) {
                if (key.startsWith('codeToPlay.')) {
                    await this.globalState.update(key, value);
                }
            }
        } catch (error) {
            throw new Error(`Failed to import data: ${error}`);
        }
    }

    /**
     * Gets diagnostic information about storage usage
     * Useful for debugging
     * 
     * @returns Storage diagnostics
     */
    getDiagnostics(): {
        totalKeys: number;
        gameStates: number;
        totalLinesWritten: number;
        hasConfig: boolean;
    } {
        const keys = this.globalState.keys();
        const extensionKeys = keys.filter(k => k.startsWith('codeToPlay.'));
        const gameStateKeys = extensionKeys.filter(k =>
            k.startsWith(StorageKey.GAME_STATE_PREFIX)
        );

        return {
            totalKeys: extensionKeys.length,
            gameStates: gameStateKeys.length,
            totalLinesWritten: this.getTotalLinesWritten(),
            hasConfig: this.globalState.get(StorageKey.CONFIG) !== undefined
        };
    }
}