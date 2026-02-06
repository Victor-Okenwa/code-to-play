/**
 * ActivityBarProvider.ts - WITH STICKY FOOTER BUTTONS
 * 
 * Provides the tree view for displaying games in the VS Code activity bar.
 * Includes sticky footer with "View Stats" and "Export Stats" buttons.
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

    private createDescription(): string {
        if (this.globalState.isUnlocked) {
            if (this.globalState.playsRemaining > 0) {
                return `${this.globalState.playsRemaining} plays`;
            } else {
                return 'No plays';
            }
        } else {
            return 'Locked';
        }
    }

    private getIcon(): vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined {
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
 * Special tree item for footer buttons
 */
class FooterButtonItem extends vscode.TreeItem {
    constructor(
        label: string,
        commandId: string,
        icon: string,
        description?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);

        this.description = description;
        this.iconPath = new vscode.ThemeIcon(icon);
        this.contextValue = 'footerButton';

        this.command = {
            command: commandId,
            title: label
        };
    }
}

/**
 * Provides tree data for the games activity bar view
 */
export class ActivityBarProvider implements vscode.TreeDataProvider<GameTreeItem | FooterButtonItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<GameTreeItem | FooterButtonItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private gameManager: GameManager,
        private storageManager: StorageManager
    ) {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.gameManager.onGameEvent((event) => {
            this.refresh();
        });
    }

    getTreeItem(element: GameTreeItem | FooterButtonItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: GameTreeItem | FooterButtonItem): Thenable<(GameTreeItem | FooterButtonItem)[]> {
        if (!element) {
            const items: (GameTreeItem | FooterButtonItem)[] = [];
            const globalState = this.storageManager.getGlobalPlayState();

            // Header: Plays remaining
            const headerItem = this.createPlaysHeader(globalState);
            items.push(headerItem as any);

            // Spacer
            items.push(this.createSpacer() as any);

            // Category header
            const categoryHeader = this.createCategoryHeader('Free Games');
            items.push(categoryHeader as any);

            // Game items
            const gameItems = this.getGameTreeItems();
            items.push(...gameItems);

            // STICKY FOOTER BUTTONS
            items.push(this.createSpacer() as any);
            items.push(this.createFooterSeparator() as any);
            items.push(this.createFooterButtons()[0]);
            items.push(this.createFooterButtons()[1]);

            return Promise.resolve(items);
        }

        return Promise.resolve([]);
    }

    /**
     * Creates sticky footer buttons
     */
    private createFooterButtons(): FooterButtonItem[] {
        return [
            new FooterButtonItem(
                'View Statistics',
                'codeToPlay.viewStats',
                'graph',
                'View your coding stats'
            ),
            new FooterButtonItem(
                'Export Statistics',
                'codeToPlay.exportData',
                'export',
                'Export your data'
            )
        ];
    }

    /**
     * Creates a visual separator before footer
     */
    private createFooterSeparator(): GameTreeItem {
        const separator = new vscode.TreeItem('----', vscode.TreeItemCollapsibleState.None);
        separator.contextValue = 'separator';
        separator.iconPath = undefined;
        separator.command = undefined;
        separator.description = '';
        return separator as any;
    }

    private createPlaysHeader(globalState: any): GameTreeItem {
        const playsText = `Plays remaining: ${globalState.playsRemaining}`;
        const headerItem = new vscode.TreeItem(playsText, vscode.TreeItemCollapsibleState.None);

        headerItem.iconPath = globalState.isUnlocked
            ? new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('terminal.ansiGreen'))
            : new vscode.ThemeIcon('lock', new vscode.ThemeColor('terminal.ansiRed'));

        headerItem.contextValue = 'playsHeader';

        headerItem.tooltip = globalState.isUnlocked
            ? `You have ${globalState.playsRemaining} plays available`
            : `Write ${this.gameManager.getRemainingLinesToUnlock()} more lines to unlock`;

        headerItem.command = undefined;

        return headerItem as any;
    }

    private createCategoryHeader(label: string): GameTreeItem {
        const categoryItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        categoryItem.contextValue = 'categoryHeader';
        categoryItem.iconPath = new vscode.ThemeIcon('folder-opened');

        return categoryItem as any;
    }

    private createSpacer(): GameTreeItem {
        const spacerItem = new vscode.TreeItem('', vscode.TreeItemCollapsibleState.None);
        spacerItem.contextValue = 'spacer';
        spacerItem.iconPath = undefined;
        spacerItem.command = undefined;

        return spacerItem as any;
    }

    getParent(element: GameTreeItem | FooterButtonItem): vscode.ProviderResult<GameTreeItem | FooterButtonItem> {
        return undefined;
    }

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

            (item as any).manager = this.gameManager;
            items.push(item);
        }

        items.sort((a, b) => a.game.name.localeCompare(b.game.name));

        return items;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async focusGame(gameId: string): Promise<void> {
        this.refresh();
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}

/**
 * Creates and registers the activity bar view with sticky footer
 */
export function createActivityBarView(
    context: vscode.ExtensionContext,
    gameManager: GameManager,
    storageManager: StorageManager
): vscode.TreeView<GameTreeItem | FooterButtonItem> {
    const provider = new ActivityBarProvider(gameManager, storageManager);

    const treeView = vscode.window.createTreeView('codeToPlayGames', {
        treeDataProvider: provider,
        showCollapseAll: false
    });

    const refreshCommand = vscode.commands.registerCommand(
        'codeToPlay.refreshGames',
        () => provider.refresh()
    );

    context.subscriptions.push(treeView, refreshCommand, provider);

    return treeView;
}