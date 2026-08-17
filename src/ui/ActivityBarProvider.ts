/**
 * ActivityBarProvider.ts - WITH STICKY FOOTER BUTTONS
 * 
 * Provides the tree view for displaying games in the VS Code activity bar.
 * Includes sticky footer with "View Stats" and "Export Stats" buttons.
 */

import * as vscode from 'vscode';
import { IGame, GameState, getBestHighScore, formatHighScores, DEFAULT_CONFIG } from '../core/types';
import { GameManager } from '../core/GameManager';
import { StorageManager } from '../core/StorageManager';
import { AuthManager } from '../auth/AuthManager';
import { AuthState } from '../auth/types';

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

    private createTooltip(): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = true;

        tooltip.appendMarkdown(`### 🎮 ${this.game.name}\n\n`);
        tooltip.appendMarkdown(`${this.game.description}\n\n`);

        if (this.game.isPremium) {
            tooltip.appendMarkdown(`⭐ **Pro** — playable while checkout is coming soon.\n\n`);
        }

        if (this.globalState.isUnlocked) {
            tooltip.appendMarkdown(`✅ **Unlocked**\n`);
            tooltip.appendMarkdown(`🎯 **Plays remaining:** ${this.globalState.playsRemaining}\n`);

            if (this.globalState.playsRemaining > 0) {
                tooltip.appendMarkdown(`\n💡 _Click to play!_`);
            } else {
                const manager = (this as any).manager;
                const remaining = manager?.getRemainingLinesToUnlock() || 0;
                tooltip.appendMarkdown(`\n⚠️ **Out of plays!** Write ${remaining} more lines to unlock more.`);
            }
        } else {
            const manager = (this as any).manager;
            const remaining = manager?.getRemainingLinesToUnlock() || 0;
            tooltip.appendMarkdown(`🔒 **Locked**\n`);
            tooltip.appendMarkdown(`📝 **Write ${remaining} more lines to unlock**\n`);
        }

        const bestHighScore = getBestHighScore(this.state);
        if (bestHighScore > 0) {
            tooltip.appendMarkdown(`\n🏆 **High Scores:** ${formatHighScores(this.state)}`);
        }

        if (this.state.totalPlays > 0) {
            tooltip.appendMarkdown(`\n📊 **Total Plays:** ${this.state.totalPlays}`);
        }

        return tooltip;
    }

    private createDescription(): string {
        const prefix = this.game.isPremium ? 'Pro · ' : '';

        if (this.globalState.isUnlocked) {
            if (this.globalState.playsRemaining > 0) {
                return `${prefix}▶️ ${this.globalState.playsRemaining} plays`;
            } else {
                return `${prefix}⏸️ No plays`;
            }
        } else {
            const progress = this.calculateUnlockProgress();
            const progressBar = this.createProgressBar(progress);
            return `${prefix}${progressBar} Locked`;
        }
    }

    private calculateUnlockProgress(): number {
        const manager = (this as any).manager;
        const totalLines = manager?.storageManager?.getTotalLinesWritten() || 0;
        const config = manager?.storageManager?.getConfig();
        const linesNeeded = config?.unlock?.linesToUnlock ?? DEFAULT_CONFIG.unlock.linesToUnlock;
        return Math.min(totalLines / linesNeeded, 1);
    }

    private createProgressBar(progress: number): string {
        const filled = Math.floor(progress * 5);
        const empty = 5 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }

    private getIcon(): vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined {
        if (this.globalState.isUnlocked) {
            if (this.globalState.playsRemaining > 0) {
                return new vscode.ThemeIcon('play-circle', this.getDynamicIconColor());
            } else {
                return new vscode.ThemeIcon('circle-slash',
                    new vscode.ThemeColor('statusBarItem.warningForeground'));
            }
        } else {
            return new vscode.ThemeIcon('lock',
                new vscode.ThemeColor('statusBarItem.errorForeground'));
        }
    }

    private getDynamicIconColor(): vscode.ThemeColor {
        const plays = this.globalState.playsRemaining;

        if (plays <= 2) {
            return new vscode.ThemeColor('statusBarItem.errorForeground');
        } else if (plays <= 5) {
            return new vscode.ThemeColor('statusBarItem.warningForeground');
        } else {
            return new vscode.ThemeColor('statusBarItem.activeForeground');
        }
    }

    private getContextValue(): string {
        const baseContexts = [];

        if (this.globalState.isUnlocked) {
            baseContexts.push('gameUnlocked');
            if (this.globalState.playsRemaining > 0) {
                baseContexts.push('gamePlayable');
                if (this.globalState.playsRemaining <= 2) {
                    baseContexts.push('gameLowPlays');
                }
            } else {
                baseContexts.push('gameNoPlays');
            }
        } else {
            baseContexts.push('gameLocked');
        }

        // Add game-specific context
        baseContexts.push(`game-${this.game.id}`);

        // Add performance context
        const bestHighScore = getBestHighScore(this.state);
        if (bestHighScore > 1000) {
            baseContexts.push('highPerformer');
        } else if (bestHighScore > 100) {
            baseContexts.push('goodPerformer');
        }

        // Add activity context
        if (this.state.totalPlays > 50) {
            baseContexts.push('frequentPlayer');
        }

        return baseContexts.join(' ');
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

class AccountTreeItem extends vscode.TreeItem {
    constructor(state: AuthState) {
        super(accountLabel(state), vscode.TreeItemCollapsibleState.None);

        this.description = accountDescription(state);
        this.tooltip = accountTooltip(state);
        this.iconPath = new vscode.ThemeIcon(accountIcon(state));
        this.contextValue = `account-${state.status}`;
        this.command = {
            command: 'codeToPlay.accountAction',
            title: 'Account'
        };
    }
}

function accountLabel(state: AuthState): string {
    if (state.status === 'signedIn') {
        return state.profile.name;
    }

    if (state.status === 'pending') {
        return state.userCode;
    }

    return 'Sign in with GitHub';
}

function accountDescription(state: AuthState): string {
    if (state.status === 'signedIn') {
        return `Free · ${state.profile.email}`;
    }

    if (state.status === 'pending') {
        return 'Waiting for approval…';
    }

    return 'Optional — required later for Pro';
}

function accountTooltip(state: AuthState): string {
    if (state.status === 'signedIn') {
        return `${state.profile.name} (${state.profile.email})`;
    }

    if (state.status === 'pending') {
        return `Approve ${state.userCode} in the browser, or click to copy the code.`;
    }

    return 'Sign in with GitHub to link this editor. Free games still work without an account.';
}

function accountIcon(state: AuthState): string {
    if (state.status === 'signedIn') {
        return 'account';
    }

    if (state.status === 'pending') {
        return 'loading~spin';
    }

    return 'github';
}

type GamesTreeItem = GameTreeItem | FooterButtonItem | AccountTreeItem;

/**
 * Provides tree data for the games activity bar view
 */
export class ActivityBarProvider implements vscode.TreeDataProvider<GamesTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<GamesTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private gameManager: GameManager,
        private storageManager: StorageManager,
        private authManager: AuthManager
    ) {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.gameManager.onGameEvent(() => {
            this.refresh();
        });
        this.authManager.onDidChange(() => {
            this.refresh();
        });
    }

    getTreeItem(element: GamesTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: GamesTreeItem): Thenable<GamesTreeItem[]> {
        if (!element) {
            const items: GamesTreeItem[] = [];
            const globalState = this.storageManager.getGlobalPlayState();

            items.push(new AccountTreeItem(this.authManager.getState()));
            items.push(this.createSpacer() as GameTreeItem);

            const headerItem = this.createPlaysHeader(globalState);
            items.push(headerItem as GameTreeItem);

            items.push(this.createSpacer() as GameTreeItem);

            const freeItems = this.getGameTreeItems(false);
            const proItems = this.getGameTreeItems(true);

            items.push(this.createCategoryHeader('Free Games') as GameTreeItem);
            items.push(...freeItems);

            if (proItems.length > 0) {
                items.push(this.createSpacer() as GameTreeItem);
                items.push(this.createCategoryHeader('Pro Games', 'star') as GameTreeItem);
                items.push(...proItems);
            }

            items.push(this.createSpacer() as GameTreeItem);
            items.push(this.createFooterSeparator() as GameTreeItem);
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
            ? new vscode.ThemeIcon('play-circle', this.getHeaderIconColor(globalState.playsRemaining))
            : new vscode.ThemeIcon('lock', new vscode.ThemeColor('statusBarItem.errorForeground'));

        headerItem.contextValue = 'playsHeader';

        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = true;

        if (globalState.isUnlocked) {
            tooltip.appendMarkdown(`### 🎯 Game Status\n\n`);
            tooltip.appendMarkdown(`You have **${globalState.playsRemaining} plays** available!\n\n`);

            if (globalState.playsRemaining <= 2) {
                tooltip.appendMarkdown(`⚠️ **Running low!** Consider writing more code soon.`);
            } else if (globalState.playsRemaining === 0) {
                const remaining = this.gameManager.getRemainingLinesToUnlock();
                tooltip.appendMarkdown(`⏸️ **Out of plays!** Write **${remaining} more lines** to unlock more.`);
            } else {
                tooltip.appendMarkdown(`✅ **Ready to play!** Click on any game below to start.`);
            }
        } else {
            const remaining = this.gameManager.getRemainingLinesToUnlock();
            tooltip.appendMarkdown(`### 🔒 Games Locked\n\n`);
            tooltip.appendMarkdown(`Write **${remaining} more lines** of code to unlock games!\n\n`);
            tooltip.appendMarkdown(`Keep coding to earn your break time! 💻`);
        }

        headerItem.tooltip = tooltip;
        headerItem.command = undefined;

        return headerItem as any;
    }

    private getHeaderIconColor(playsRemaining: number): vscode.ThemeColor {
        if (playsRemaining <= 2) {
            return new vscode.ThemeColor('statusBarItem.errorForeground');
        } else if (playsRemaining <= 5) {
            return new vscode.ThemeColor('statusBarItem.warningForeground');
        } else {
            return new vscode.ThemeColor('statusBarItem.activeForeground');
        }
    }

    private createCategoryHeader(label: string, icon = 'folder-opened'): GameTreeItem {
        const categoryItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        categoryItem.contextValue = 'categoryHeader';
        categoryItem.iconPath = new vscode.ThemeIcon(icon);

        return categoryItem as any;
    }

    private createSpacer(): GameTreeItem {
        const spacerItem = new vscode.TreeItem('', vscode.TreeItemCollapsibleState.None);
        spacerItem.contextValue = 'spacer';
        spacerItem.iconPath = undefined;
        spacerItem.command = undefined;

        return spacerItem as any;
    }

    getParent(element: GamesTreeItem): vscode.ProviderResult<GamesTreeItem> {
        return undefined;
    }

    private getGameTreeItems(premium: boolean): GameTreeItem[] {
        const games = this.gameManager.getAllGames().filter(game => game.isPremium === premium);
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
    storageManager: StorageManager,
    authManager: AuthManager
): vscode.TreeView<GamesTreeItem> {
    const provider = new ActivityBarProvider(gameManager, storageManager, authManager);

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