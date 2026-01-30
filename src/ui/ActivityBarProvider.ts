/**
 * ActivityBarProvider.ts
 * 
 * Provides the tree view for displaying games in the VS Code activity bar.
 * Shows game list with unlock status, plays remaining, and progress indicators.
 */

import * as vscode from 'vscode';
import { IGame, GameState } from '../core/types';
import { GameManager } from '../core/GameManager';
import { StorageManager } from '../core/StorageManager';

/**
 * Represents a single item in the game tree view
 */
class GameTreeItem extends vscode.TreeItem {
    constructor(
        public readonly game: IGame,
        public readonly state: GameState,
        public readonly globalState: any,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(game.name, collapsibleState);

        this.tooltip = this.createTooltip();
        this.description = this.createDescription();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();

        // Make playable games clickable
        if (globalState.isUnlocked && globalState.playsRemaining > 0) {
            this.command = {
                command: 'codeToPlay.playGame',
                title: 'Play Game',
                arguments: [game.id]
            };
        }
    }

    /**
     * Creates tooltip text with detailed game information
     * 
     * @returns Formatted tooltip string
     * @private
     */
    private createTooltip(): string {
        const lines: string[] = [
            `🎮 ${this.game.name}`,
            ``,
            this.game.description,
            ``,
        ];

        if (this.globalState.isUnlocked) {
            lines.push(`✅ Unlocked`);
            lines.push(`🎯 Plays remaining: ${this.globalState.playsRemaining}`);
        } else {
            const manager = (this as any).manager;
            const remaining = manager?.getRemainingLinesToUnlock() || 0;
            lines.push(`🔒 Locked`);
            lines.push(`📝 Write ${remaining} more lines to unlock`);
        }

        if (this.state.highScore > 0) {
            lines.push(`🏆 High score: ${this.state.highScore}`);
        }

        if (this.state.totalPlays > 0) {
            lines.push(`📊 Total plays: ${this.state.totalPlays}`);
        }

        return lines.join('\n');
    }

    /**
     * Creates description text shown next to the game name
     * 
     * @returns Short status description
     * @private
     */
    private createDescription(): string {
        if (this.globalState.isUnlocked) {
            if (this.globalState.playsRemaining > 0) {
                return `${this.globalState.playsRemaining} plays`;
            } else {
                return 'No plays';
            }
        } else {
            return '🔒 Locked';
        }
    }

    /**
     * Gets the appropriate icon for the game's current state
     * 
     * @returns Icon path or ThemeIcon
     * @private
     */
    private getIcon(): vscode.ThemeIcon | { light: string; dark: string } | undefined {
        if (this.globalState.isUnlocked) {
            if (this.globalState.playsRemaining > 0) {
                return new vscode.ThemeIcon('play-circle',
                    new vscode.ThemeColor('terminal.ansiGreen'));
            } else {
                return new vscode.ThemeIcon('circle-slash',
                    new vscode.ThemeColor('terminal.ansiYellow'));
            }
        } else {
            return new vscode.ThemeIcon('lock',
                new vscode.ThemeColor('terminal.ansiRed'));
        }
    }

    /**
     * Gets context value for controlling context menu items
     * 
     * @returns Context value string
     * @private
     */
    private getContextValue(): string {
        if (this.globalState.isUnlocked && this.globalState.playsRemaining > 0) {
            return 'gameUnlocked';
        } else if (this.globalState.isUnlocked && this.globalState.playsRemaining === 0) {
            return 'gameNoPlays';
        } else {
            return 'gameLocked';
        }
    }
}

/**
 * Provides tree data for the games activity bar view
 */
export class ActivityBarProvider implements vscode.TreeDataProvider<GameTreeItem> {
    /**
     * Event emitter for tree data changes
     */
    private _onDidChangeTreeData = new vscode.EventEmitter<GameTreeItem | undefined | null | void>();

    /**
     * Public event that fires when tree data changes
     */
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /**
     * Creates a new ActivityBarProvider instance
     * 
     * @param gameManager - Game manager for accessing game data
     * @param storageManager - Storage manager for accessing game states
     */
    constructor(
        private gameManager: GameManager,
        private storageManager: StorageManager
    ) {
        // Listen for game events to refresh view
        this.setupEventListeners();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    /**
     * Sets up event listeners for auto-refresh
     * 
     * @private
     */
    private setupEventListeners(): void {
        // Refresh when games are unlocked/locked
        this.gameManager.onGameEvent((event) => {
            this.refresh();
        });
    }

    // ========================================
    // TREE DATA PROVIDER IMPLEMENTATION
    // ========================================

    /**
     * Gets tree item representation for a game
     * Required by TreeDataProvider interface
     * 
     * @param element - Game tree item
     * @returns The tree item itself
     */
    getTreeItem(element: GameTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets children for a tree element
     * Required by TreeDataProvider interface
     * 
     * @param element - Parent element (undefined for root)
     * @returns Array of child tree items
     */
    getChildren(element?: GameTreeItem): Thenable<GameTreeItem[]> {
        // If no element provided, return root level
        if (!element) {
            const items: GameTreeItem[] = [];
            const globalState = this.storageManager.getGlobalPlayState();

            // Add header showing plays remaining
            const headerItem = this.createPlaysHeader(globalState);
            items.push(headerItem);

            // Add spacer for visual separation
            items.push(this.createSpacer());

            // Add "Free Games" category header
            const categoryHeader = this.createCategoryHeader('Free Games');
            items.push(categoryHeader);

            // Add all games
            const gameItems = this.getGameTreeItems();
            items.push(...gameItems);

            return Promise.resolve(items);
        }

        // Items have no children
        return Promise.resolve([]);
    }

    /**
     * Creates a header item showing plays remaining
     * 
     * @param globalState - Global play state
     * @returns Tree item for plays header
     * @private
     */
    private createPlaysHeader(globalState: any): GameTreeItem {
        const playsText = `Plays remaining: ${globalState.playsRemaining}`;
        const headerItem = new vscode.TreeItem(playsText, vscode.TreeItemCollapsibleState.None);

        // Use larger icon for emphasis
        headerItem.iconPath = globalState.isUnlocked
            ? new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('terminal.ansiGreen'))
            : new vscode.ThemeIcon('lock', new vscode.ThemeColor('terminal.ansiRed'));


        headerItem.contextValue = 'playsHeader';

        // Tooltip
        headerItem.tooltip = globalState.isUnlocked
            ? `✅ You have ${globalState.playsRemaining} plays available`
            : `🔒 Write ${this.gameManager.getRemainingLinesToUnlock()} more lines to unlock`;

        // Not clickable
        headerItem.command = undefined;

        return headerItem as any;
    }

    /**
     * Creates a category header item
     * 
     * @param label - Category label
     * @returns Tree item for category
     * @private
     */
    private createCategoryHeader(label: string): GameTreeItem {
        const categoryItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        categoryItem.contextValue = 'categoryHeader';
        categoryItem.iconPath = new vscode.ThemeIcon('folder-opened');

        return categoryItem as any;
    }

    /**
     * Creates a spacer item for visual separation
     * 
     * @returns Tree item for spacer
     * @private
     */
    private createSpacer(): GameTreeItem {
        const spacerItem = new vscode.TreeItem('', vscode.TreeItemCollapsibleState.None);
        spacerItem.contextValue = 'spacer';
        spacerItem.iconPath = undefined;
        spacerItem.command = undefined;

        return spacerItem as any;
    }

    /**
     * Gets parent of a tree element
     * Optional TreeDataProvider method
     * 
     * @param element - Child element
     * @returns Parent element (always undefined for flat list)
     */
    getParent(element: GameTreeItem): vscode.ProviderResult<GameTreeItem> {
        // Flat list, no parent
        return undefined;
    }

    // ========================================
    // GAME TREE ITEM CREATION
    // ========================================

    /**
     * Creates tree items for all registered games
     * 
     * @returns Array of game tree items
     * @private
     */
    private getGameTreeItems(): GameTreeItem[] {
        const games = this.gameManager.getAllGames();
        const globalState = this.storageManager.getGlobalPlayState();
        const items: GameTreeItem[] = [];

        for (const game of games) {
            const state = this.storageManager.getGameState(game.id);
            const item = new GameTreeItem(
                game,
                state,
                globalState,
                vscode.TreeItemCollapsibleState.None
            );

            // Store manager reference for tooltip (bit of a hack)
            (item as any).manager = this.gameManager;

            items.push(item);
        }

        // Sort by name (all games have same unlock status now)
        items.sort((a, b) => a.game.name.localeCompare(b.game.name));

        return items;
    }

    // ========================================
    // PUBLIC API
    // ========================================

    /**
     * Refreshes the tree view
     * Call this when game states change
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Focuses on a specific game in the tree
     * 
     * @param gameId - ID of game to focus
     */
    async focusGame(gameId: string): Promise<void> {
        // Refresh to ensure latest state
        this.refresh();

        // Note: Actual focusing would require tree view instance
        // This is typically done in extension.ts when registering the view
    }

    /**
     * Shows a message when no games are registered
     * 
     * @returns Tree item with message
     */
    private getEmptyStateItem(): GameTreeItem[] {
        const emptyItem = new vscode.TreeItem(
            'No games available',
            vscode.TreeItemCollapsibleState.None
        );
        emptyItem.description = 'Add games to start playing';
        emptyItem.iconPath = new vscode.ThemeIcon('info');

        return [emptyItem as any];
    }

    /**
     * Gets a summary item showing overall stats
     * Can be shown at the top of the tree
     * 
     * @returns Summary tree item
     */
    private getSummaryItem(): GameTreeItem | null {
        const games = this.gameManager.getAllGames();

        if (games.length === 0) {
            return null;
        }

        const unlockedCount = games.filter(g =>
            this.gameManager.isGameUnlocked(g.id)
        ).length;

        const summaryItem = new vscode.TreeItem(
            '📊 Overview',
            vscode.TreeItemCollapsibleState.None
        );

        summaryItem.description = `${unlockedCount}/${games.length} unlocked`;
        summaryItem.tooltip = this.createSummaryTooltip();
        summaryItem.contextValue = 'summary';

        return summaryItem as any;
    }

    /**
     * Creates tooltip for summary item
     * 
     * @returns Summary tooltip text
     * @private
     */
    private createSummaryTooltip(): string {
        const games = this.gameManager.getAllGames();
        const unlocked = games.filter(g => this.gameManager.isGameUnlocked(g.id));
        const locked = games.filter(g => !this.gameManager.isGameUnlocked(g.id));

        const totalPlays = games.reduce((sum, g) => {
            const state = this.storageManager.getGameState(g.id);
            return sum + state.totalPlays;
        }, 0);

        const totalLines = this.storageManager.getTotalLinesWritten();

        return [
            '📊 Code to Play Statistics',
            '',
            `🎮 Games: ${games.length} total`,
            `✅ Unlocked: ${unlocked.length}`,
            `🔒 Locked: ${locked.length}`,
            ``,
            `📝 Total lines written: ${totalLines}`,
            `🎯 Total plays: ${totalPlays}`
        ].join('\n');
    }

    // ========================================
    // CLEANUP
    // ========================================

    /**
     * Disposes of resources
     */
    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}

/**
 * Creates and registers the activity bar view
 * Call this from extension.ts during activation
 * 
 * @param context - Extension context
 * @param gameManager - Game manager instance
 * @param storageManager - Storage manager instance
 * @returns The tree view instance
 */
export function createActivityBarView(
    context: vscode.ExtensionContext,
    gameManager: GameManager,
    storageManager: StorageManager
): vscode.TreeView<GameTreeItem> {
    // Create provider
    const provider = new ActivityBarProvider(gameManager, storageManager);

    // Register tree view
    const treeView = vscode.window.createTreeView('codeToPlayGames', {
        treeDataProvider: provider,
        showCollapseAll: false
    });

    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand(
        'codeToPlay.refreshGames',
        () => provider.refresh()
    );

    // Add to subscriptions for cleanup
    context.subscriptions.push(treeView, refreshCommand, provider);

    return treeView;
}