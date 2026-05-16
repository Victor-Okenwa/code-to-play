/**
 * WebviewManager.ts
 * 
 * Manages webview panels for game UIs in the Code to Play VS Code extension.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IGame } from '../core/types';
import { GameManager } from '../core/GameManager';

export class WebviewManager {
    private activePanels = new Map<string, vscode.WebviewPanel>();
    private context: vscode.ExtensionContext;

    constructor(
        context: vscode.ExtensionContext,
        private gameManager: GameManager
    ) {
        this.context = context;
    }

    // ========================================
    // WEBVIEW CREATION
    // ========================================

    async openGame(gameId: string): Promise<vscode.WebviewPanel | null> {
        const game = this.gameManager.getGame(gameId);

        if (!game) {
            vscode.window.showErrorMessage(`Game '${gameId}' not found`);
            return null;
        }

        const playResult = await this.gameManager.attemptPlay(gameId);

        if (!playResult.success) {
            vscode.window.showWarningMessage(playResult.reason || 'Cannot play game');
            return null;
        }

        const existingPanel = this.activePanels.get(gameId);
        if (existingPanel) {
            existingPanel.reveal();
            return existingPanel;
        }

        const panel = this.createWebviewPanel(game);
        this.activePanels.set(gameId, panel);
        this.setupPanelHandlers(gameId, panel);
        await this.loadGameContent(panel, game);

        return panel;
    }

    private createWebviewPanel(game: IGame): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            `codeToPlay.${game.id}`,
            game.name,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'dist')),
                    vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
                ]
            }
        );

        panel.iconPath = new vscode.ThemeIcon('game'); // use game icon as the tab icon

        return panel;
    }

    private setupPanelHandlers(gameId: string, panel: vscode.WebviewPanel): void {
        panel.onDidDispose(() => {
            this.activePanels.delete(gameId);
            // DON'T call endPlay here - only when game actually ends
        });

        panel.webview.onDidReceiveMessage(
            message => this.handleWebviewMessage(gameId, message),
            undefined,
            this.context.subscriptions
        );

        panel.onDidChangeViewState(e => {
            if (!e.webviewPanel.visible) {
                // Could pause game or save state here
            }
        });
    }

    // ========================================
    // CONTENT LOADING
    // ========================================

    private async loadGameContent(
        panel: vscode.WebviewPanel,
        game: IGame
    ): Promise<void> {
        try {
            const distGameDir = path.join(
                this.context.extensionPath,
                'dist',
                'games',
                game.id
            );

            const htmlPath = path.join(distGameDir, game.htmlPath);
            const jsPath = path.join(distGameDir, 'game.js');
            const cssPath = path.join(distGameDir, game.cssPath);



            let html = fs.readFileSync(htmlPath, 'utf8');
            const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';
            const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
            const codiconUris = this.getCodiconUris(panel.webview);

            if (!js) {
                console.warn(`[WebviewManager] No JS file for ${game.id}!`);
            }

            const nonce = this.getNonce();
            const fontUris = this.getFontUris(panel.webview);
            const soundUris = this.getSoundUris(panel.webview);

            // Create content
            const commonStyles = this.getCommonStyles(fontUris, codiconUris, nonce);
            const styleTag = this.createStyleTag(css, nonce);

            // CRITICAL: Inject VS Code API first, then game code
            const vscodeApiScript = this.createVSCodeApiScript(nonce);
            const scriptTag = this.createScriptTag(js, nonce);

            // Inject into HTML
            html = this.injectContent(html, commonStyles + styleTag, vscodeApiScript + scriptTag, soundUris);
            html = this.applyContentSecurityPolicy(html, panel.webview, nonce);

            panel.webview.html = html;
        } catch (error) {
            console.error(`[WebviewManager] Error:`, error);
            vscode.window.showErrorMessage(
                `Failed to load game: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Creates the VS Code API script that games will use
     */
    private createVSCodeApiScript(nonce: string): string {
        return `<script nonce="${nonce}">
            // Make VS Code API globally available
            const vscode = acquireVsCodeApi();
        </script>`;
    }

    private getFontUris(webview: vscode.Webview): Map<string, vscode.Uri> {
        const fontDir = path.join(this.context.extensionPath, 'dist', 'media', 'fonts');
        const uris = new Map<string, vscode.Uri>();

        const fonts = {
            pressStartWoff2: 'PressStart2P.woff2',
            pressStartTtf: 'PressStart2P-Regular.ttf',
            orbitronWoff2: 'Orbitron.woff2',
            orbitronRegular: 'Orbitron-Regular.ttf',
            orbitronBold: 'Orbitron-Bold.ttf'
        };

        for (const [key, filename] of Object.entries(fonts)) {
            const fontUri = vscode.Uri.file(path.join(fontDir, filename));
            uris.set(key, webview.asWebviewUri(fontUri));
        }

        return uris;
    }

    private getCodiconUris(webview: vscode.Webview): { cssUri: vscode.Uri; fontUri: vscode.Uri } {
        const codiconsPath = vscode.Uri.joinPath(
            this.context.extensionUri,
            'node_modules',
            '@vscode',
            'codicons',
            'dist'
        );

        return {
            cssUri: webview.asWebviewUri(vscode.Uri.joinPath(codiconsPath, 'codicon.css')),
            fontUri: webview.asWebviewUri(vscode.Uri.joinPath(codiconsPath, 'codicon.ttf'))
        };
    }

    private getSoundUris(webview: vscode.Webview): Map<string, vscode.Uri> {
        const soundDir = path.join(this.context.extensionPath, 'media', 'sfx');
        const uris = new Map<string, vscode.Uri>();

        const sounds = ['slurp.mp3', 'pop.mp3'];

        for (const soundFile of sounds) {
            const soundUri = vscode.Uri.file(path.join(soundDir, soundFile));
            uris.set(soundFile, webview.asWebviewUri(soundUri));
        }

        return uris;
    }

    private getCommonStyles(
        fontUris: Map<string, vscode.Uri>,
        codiconUris: { cssUri: vscode.Uri; fontUri: vscode.Uri },
        nonce: string
    ): string {
        return `
            <link nonce="${nonce}" rel="stylesheet" href="${codiconUris.cssUri}">

            <style nonce="${nonce}">
                @font-face {
                    font-family: 'Press Start 2P';
                    src: url('${fontUris.get('pressStartWoff2')}') format('woff2'),
                         url('${fontUris.get('pressStartTtf')}') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                }
                
                @font-face {
                    font-family: 'Orbitron';
                    src: url('${fontUris.get('orbitronWoff2')}') format('woff2'),
                         url('${fontUris.get('orbitronRegular')}') format('truetype');
                    font-weight: 400;
                    font-style: normal;
                }
                
                @font-face {
                    font-family: 'Orbitron';
                    src: url('${fontUris.get('orbitronBold')}') format('truetype');
                    font-weight: 700;
                    font-style: normal;
                }
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Orbitron', sans-serif;
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                
                h1, h2, h3, h4, h5, h6 {
                    font-family: 'Press Start 2P', cursive;
                }
            </style>
        `;
    }

    private createStyleTag(css: string, nonce: string): string {
        if (!css) {
            return '';
        }
        return `<style nonce="${nonce}">${css}</style>`;
    }

    private createScriptTag(js: string, nonce: string): string {
        if (!js) {
            return '';
        }
        return `<script nonce="${nonce}">${js}</script>`;
    }

    private injectContent(html: string, styles: string, scripts: string, soundUris?: Map<string, vscode.Uri>): string {
        if (styles && html.includes('</head>')) {
            html = html.replace('</head>', `${styles}</head>`);
        }

        if (scripts && html.includes('</body>')) {
            html = html.replace('</body>', `${scripts}</body>`);
        }

        // Replace sound source placeholders with actual URIs
        if (soundUris) {
            for (const [filename, uri] of soundUris) {
                const placeholder = `SOUND_SRC_${filename.toUpperCase().replace('.', '_')}`;
                html = html.replace(new RegExp(placeholder, 'g'), uri.toString());
            }
        }

        return html;
    }

    private applyContentSecurityPolicy(
        html: string,
        webview: vscode.Webview,
        nonce: string
    ): string {
        const csp = `
            <meta http-equiv="Content-Security-Policy"
                  content="default-src 'none';
                           style-src ${webview.cspSource} 'unsafe-inline';
                           script-src 'nonce-${nonce}';
                           font-src ${webview.cspSource};
                           img-src ${webview.cspSource} data:;
                           media-src ${webview.cspSource};
                           connect-src ${webview.cspSource};">
        `;

        if (html.includes('<head>')) {
            html = html.replace('<head>', `<head>${csp}`);
        } else {
            html = `${csp}\n${html}`;
        }

        return html;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    // ========================================
    // MESSAGE HANDLING
    // ========================================

    /**
     * Handles messages from games
     */
    private async handleWebviewMessage(gameId: string, message: any): Promise<void> {
        switch (message.command) {
            case 'gameOver':
                // THIS IS WHERE PLAYS ARE DECREMENTED!
                await this.handleGameOver(gameId, message.score);
                break;

            case 'log':
                console.log(`[${gameId}]`, message.message);
                break;

            case 'error':
                console.error(`[${gameId}]`, message.error);
                break;

            case 'ready':
                console.log(`[${gameId}] Ready`);
                break;

            default:
                console.warn(`[${gameId}] Unknown message:`, message.command);
        }
    }

    /**
     * Handles game over - decrements plays and updates high score
     */
    private async handleGameOver(gameId: string, score?: number): Promise<void> {
        // This decrements the play counter!
        await this.gameManager.endPlay(gameId, score);

        // Get plays after decrementing
        const playsAfter = this.gameManager.getPlaysRemaining();

        // Show custom message when plays exhausted
        if (playsAfter === 0) {
            const config = (this.gameManager as any).config;
            const linesToUnlock = config.unlock.linesToUnlock;

            this.closeAllGames();

            vscode.window.showInformationMessage(
                `Your play allowance has been exhausted! Write ${linesToUnlock} lines of code to unlock more plays. Happy coding!`
            );
        }

        const state = this.gameManager.getGame(gameId);
        if (score && state) {
            const storageManager = (this.gameManager as any).storageManager;
            const gameState = storageManager.getGameState(gameId);

            if (score >= gameState.highScore) {
                vscode.window.showInformationMessage(
                    `New high score in ${state.name}: ${score}!`
                );
            }
        }
    }

    postMessage(gameId: string, message: any): void {
        const panel = this.activePanels.get(gameId);
        if (panel) {
            panel.webview.postMessage(message);
        }
    }

    // ========================================
    // PUBLIC API
    // ========================================

    closeGame(gameId: string): void {
        const panel = this.activePanels.get(gameId);
        if (panel) {
            panel.dispose();
        }
    }

    closeAllGames(): void {
        for (const panel of this.activePanels.values()) {
            panel.dispose();
        }
        this.activePanels.clear();
    }

    isGameOpen(gameId: string): boolean {
        return this.activePanels.has(gameId);
    }

    getOpenGames(): string[] {
        return Array.from(this.activePanels.keys());
    }

    dispose(): void {
        this.closeAllGames();
    }
}

export function createWebviewManager(
    context: vscode.ExtensionContext,
    gameManager: GameManager
): WebviewManager {
    const webviewManager = new WebviewManager(context, gameManager);

    const playCommand = vscode.commands.registerCommand(
        'codeToPlay.playGame',
        async (gameId: string) => {
            await webviewManager.openGame(gameId);
        }
    );

    context.subscriptions.push(webviewManager, playCommand);

    return webviewManager;
}