/**
 * StorageManager.test.ts
 * 
 * Unit tests for StorageManager class
 * Tests all storage operations including game states, config, and statistics
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { StorageManager } from '../core/StorageManager';
import { GameState, DEFAULT_GAME_STATE, DEFAULT_CONFIG } from '../core/types';

/**
 * Mock ExtensionContext for testing
 */
class MockMemento implements vscode.Memento {
    private storage = new Map<string, any>();

    keys(): readonly string[] {
        return Array.from(this.storage.keys());
    }

    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    get<T>(key: string, defaultValue?: T): T | undefined {
        const value = this.storage.get(key);
        return value !== undefined ? value : defaultValue;
    }

    async update(key: string, value: any): Promise<void> {
        if (value === undefined) {
            this.storage.delete(key);
        } else {
            this.storage.set(key, value);
        }
    }

    clear(): void {
        this.storage.clear();
    }
}

class MockExtensionContext implements vscode.ExtensionContext {
    subscriptions: vscode.Disposable[] = [];
    workspaceState: vscode.Memento;
    globalState: vscode.Memento & { setKeysForSync(keys: readonly string[]): void };
    secrets: vscode.SecretStorage = {} as any;
    extensionUri: vscode.Uri = vscode.Uri.file('/test');
    extensionPath: string = '/test';
    environmentVariableCollection: vscode.GlobalEnvironmentVariableCollection = {} as any;
    asAbsolutePath(relativePath: string): string {
        return `/test/${relativePath}`;
    }
    storageUri: vscode.Uri | undefined = vscode.Uri.file('/test/storage');
    storagePath: string | undefined = '/test/storage';
    globalStorageUri: vscode.Uri = vscode.Uri.file('/test/global');
    globalStoragePath: string = '/test/global';
    logUri: vscode.Uri = vscode.Uri.file('/test/log');
    logPath: string = '/test/log';
    extensionMode: vscode.ExtensionMode = vscode.ExtensionMode.Test;
    extension: vscode.Extension<any> = {} as any;
    languageModelAccessInformation: vscode.LanguageModelAccessInformation = {} as any;

    constructor() {
        const memento = new MockMemento();
        this.workspaceState = memento;
        this.globalState = Object.assign(memento, {
            setKeysForSync: (keys: readonly string[]) => { }
        });
    }
}

suite('StorageManager Test Suite', () => {
    let storageManager: StorageManager;
    let context: MockExtensionContext;

    // Setup before each test
    setup(() => {
        context = new MockExtensionContext();
        storageManager = new StorageManager(context);
    });

    // Cleanup after each test
    teardown(async () => {
        await storageManager.clearAllData();
    });

    // ========================================
    // GAME STATE TESTS
    // ========================================

    test('Get game state returns default for new game', () => {
        const state = storageManager.getGameState('test-game');

        assert.strictEqual(state.playsRemaining, DEFAULT_GAME_STATE.playsRemaining);
        assert.strictEqual(state.isUnlocked, DEFAULT_GAME_STATE.isUnlocked);
        assert.strictEqual(state.linesWritten, DEFAULT_GAME_STATE.linesWritten);
    });

    test('Save and retrieve game state', async () => {
        const testState: GameState = {
            playsRemaining: 3,
            linesWritten: 25,
            isUnlocked: false,
            highScore: 150,
            totalPlays: 10,
            lastPlayed: Date.now()
        };

        await storageManager.saveGameState('test-game', testState);
        const retrieved = storageManager.getGameState('test-game');

        assert.strictEqual(retrieved.playsRemaining, testState.playsRemaining);
        assert.strictEqual(retrieved.linesWritten, testState.linesWritten);
        assert.strictEqual(retrieved.isUnlocked, testState.isUnlocked);
        assert.strictEqual(retrieved.highScore, testState.highScore);
        assert.strictEqual(retrieved.totalPlays, testState.totalPlays);
    });

    test('Update game state merges with existing', async () => {
        const initialState: GameState = {
            playsRemaining: 5,
            linesWritten: 0,
            isUnlocked: true,
            highScore: 0,
            totalPlays: 0
        };

        await storageManager.saveGameState('test-game', initialState);
        await storageManager.updateGameState('test-game', {
            playsRemaining: 4,
            highScore: 100
        });

        const updated = storageManager.getGameState('test-game');

        assert.strictEqual(updated.playsRemaining, 4);
        assert.strictEqual(updated.highScore, 100);
        assert.strictEqual(updated.isUnlocked, true); // Unchanged
        assert.strictEqual(updated.linesWritten, 0); // Unchanged
    });

    test('Reset game state returns to default', async () => {
        const modifiedState: GameState = {
            playsRemaining: 0,
            linesWritten: 50,
            isUnlocked: false,
            highScore: 200,
            totalPlays: 20
        };

        await storageManager.saveGameState('test-game', modifiedState);
        await storageManager.resetGameState('test-game');

        const reset = storageManager.getGameState('test-game');

        assert.strictEqual(reset.playsRemaining, DEFAULT_GAME_STATE.playsRemaining);
        assert.strictEqual(reset.isUnlocked, DEFAULT_GAME_STATE.isUnlocked);
        assert.strictEqual(reset.linesWritten, DEFAULT_GAME_STATE.linesWritten);
    });

    test('Get all game states returns multiple games', async () => {
        await storageManager.saveGameState('game-1', { ...DEFAULT_GAME_STATE, highScore: 100 });
        await storageManager.saveGameState('game-2', { ...DEFAULT_GAME_STATE, highScore: 200 });
        await storageManager.saveGameState('game-3', { ...DEFAULT_GAME_STATE, highScore: 300 });

        const allStates = storageManager.getAllGameStates();

        assert.strictEqual(allStates.size, 3);
        assert.strictEqual(allStates.get('game-1')?.highScore, 100);
        assert.strictEqual(allStates.get('game-2')?.highScore, 200);
        assert.strictEqual(allStates.get('game-3')?.highScore, 300);
    });

    // ========================================
    // CONFIGURATION TESTS
    // ========================================

    test('Get config returns default for new extension', () => {
        const config = storageManager.getConfig();

        assert.strictEqual(config.unlock.initialPlays, DEFAULT_CONFIG.unlock.initialPlays);
        assert.strictEqual(config.unlock.linesToUnlock, DEFAULT_CONFIG.unlock.linesToUnlock);
        assert.strictEqual(config.showUnlockNotifications, DEFAULT_CONFIG.showUnlockNotifications);
    });

    test('Save and retrieve config', async () => {
        const testConfig = {
            ...DEFAULT_CONFIG,
            unlock: {
                ...DEFAULT_CONFIG.unlock,
                initialPlays: 10,
                linesToUnlock: 100
            }
        };

        await storageManager.saveConfig(testConfig);
        const retrieved = storageManager.getConfig();

        assert.strictEqual(retrieved.unlock.initialPlays, 10);
        assert.strictEqual(retrieved.unlock.linesToUnlock, 100);
    });

    test('Update config merges with existing', async () => {
        await storageManager.updateConfig({
            showUnlockNotifications: false
        });

        const updated = storageManager.getConfig();

        assert.strictEqual(updated.showUnlockNotifications, false);
        assert.strictEqual(updated.unlock.initialPlays, DEFAULT_CONFIG.unlock.initialPlays);
    });

    test('Reset config returns to default', async () => {
        await storageManager.updateConfig({
            showUnlockNotifications: false,
            trackAllFiles: true
        });

        await storageManager.resetConfig();
        const reset = storageManager.getConfig();

        assert.strictEqual(reset.showUnlockNotifications, DEFAULT_CONFIG.showUnlockNotifications);
        assert.strictEqual(reset.trackAllFiles, DEFAULT_CONFIG.trackAllFiles);
    });

    // ========================================
    // STATISTICS TESTS
    // ========================================

    test('Total lines written starts at zero', () => {
        const total = storageManager.getTotalLinesWritten();
        assert.strictEqual(total, 0);
    });

    test('Add lines written increments total', async () => {
        await storageManager.addLinesWritten(10);
        await storageManager.addLinesWritten(15);
        await storageManager.addLinesWritten(5);

        const total = storageManager.getTotalLinesWritten();
        assert.strictEqual(total, 30);
    });

    test('Set total lines written overwrites value', async () => {
        await storageManager.addLinesWritten(50);
        await storageManager.setTotalLinesWritten(100);

        const total = storageManager.getTotalLinesWritten();
        assert.strictEqual(total, 100);
    });

    // ========================================
    // UTILITY TESTS
    // ========================================

    test('Clear all data removes everything', async () => {
        await storageManager.saveGameState('game-1', DEFAULT_GAME_STATE);
        await storageManager.saveGameState('game-2', DEFAULT_GAME_STATE);
        await storageManager.addLinesWritten(50);

        await storageManager.clearAllData();

        const total = storageManager.getTotalLinesWritten();
        const allStates = storageManager.getAllGameStates();

        assert.strictEqual(total, 0);
        assert.strictEqual(allStates.size, 0);
    });

    test('Export data creates valid JSON', async () => {
        await storageManager.saveGameState('game-1', { ...DEFAULT_GAME_STATE, highScore: 100 });
        await storageManager.addLinesWritten(50);

        const exported = storageManager.exportData();
        const parsed = JSON.parse(exported);

        assert.ok(parsed['codeToPlay.gameState.game-1']);
        assert.strictEqual(parsed['codeToPlay.totalLinesWritten'], 50);
    });

    test('Import data restores from JSON', async () => {
        const testData = {
            'codeToPlay.gameState.test-game': { ...DEFAULT_GAME_STATE, highScore: 200 },
            'codeToPlay.totalLinesWritten': 75
        };

        await storageManager.importData(JSON.stringify(testData));

        const gameState = storageManager.getGameState('test-game');
        const totalLines = storageManager.getTotalLinesWritten();

        assert.strictEqual(gameState.highScore, 200);
        assert.strictEqual(totalLines, 75);
    });

    test('Diagnostics return accurate information', async () => {
        await storageManager.saveGameState('game-1', DEFAULT_GAME_STATE);
        await storageManager.saveGameState('game-2', DEFAULT_GAME_STATE);
        await storageManager.addLinesWritten(50);
        await storageManager.saveConfig(DEFAULT_CONFIG);

        const diagnostics = storageManager.getDiagnostics();

        assert.strictEqual(diagnostics.gameStates, 2);
        assert.strictEqual(diagnostics.totalLinesWritten, 50);
        assert.strictEqual(diagnostics.hasConfig, true);
    });
});