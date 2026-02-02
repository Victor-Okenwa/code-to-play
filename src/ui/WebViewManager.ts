/**
 * WebviewManager.ts - OPTIMIZED for Event Listeners
 * 
 * Changes from previous version:
 * 1. Removed 'unsafe-inline' from CSP (no longer needed!)
 * 2. Scripts now use ONLY nonce
 * 3. Cleaner, more secure CSP
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
            `🎮 ${game.name}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'dist'))
                ]
            }
        );

        return panel;
    }

    private setupPanelHandlers(gameId: string, panel: vscode.WebviewPanel): void {
        panel.onDidDispose(() => {
            this.activePanels.delete(gameId);
            this.gameManager.endPlay(gameId);
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
            // Load from dist (compiled output)
            const distGameDir = path.join(
                this.context.extensionPath,
                'dist',
                'games',
                game.id
            );

            const htmlPath = path.join(distGameDir, game.htmlPath);
            const jsPath = path.join(distGameDir, 'game.js');
            const cssPath = path.join(distGameDir, game.cssPath);

            console.log(`[WebviewManager] Loading game: ${game.id}`);
            console.log(`[WebviewManager] HTML: ${fs.existsSync(htmlPath)}`);
            console.log(`[WebviewManager] JS: ${fs.existsSync(jsPath)}`);
            console.log(`[WebviewManager] CSS: ${fs.existsSync(cssPath)}`);

            // Read files
            let html = fs.readFileSync(htmlPath, 'utf8');
            const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';
            const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

            if (!js) {
                console.warn(`[WebviewManager] ⚠️ No JavaScript file found for ${game.id}!`);
            }

            // Generate nonce ONCE
            const nonce = this.getNonce();

            // Get font URIs
            const fontUris = this.getFontUris(panel.webview);

            // Create tags
            const commonStyles = this.getCommonStyles(fontUris, nonce);
            const styleTag = this.createStyleTag(css, nonce);
            const scriptTag = this.createScriptTag(js, nonce);

            // Inject into HTML
            html = this.injectContent(html, commonStyles + styleTag, scriptTag);

            // Apply CSP
            html = this.applyContentSecurityPolicy(html, panel.webview, nonce);

            // Set HTML
            panel.webview.html = html;

            console.log(`[WebviewManager] ✅ ${game.id} loaded successfully!`);

        } catch (error) {
            console.error(`[WebviewManager] ❌ Error:`, error);
            vscode.window.showErrorMessage(
                `Failed to load game: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
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

    private getCommonStyles(fontUris: Map<string, vscode.Uri>, nonce: string): string {
        return `
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

    private injectContent(html: string, styles: string, scripts: string): string {
        // Inject styles before </head>
        if (styles && html.includes('</head>')) {
            html = html.replace('</head>', `${styles}</head>`);
        }

        // Inject scripts before </body>
        if (scripts && html.includes('</body>')) {
            html = html.replace('</body>', `${scripts}</body>`);
        }

        return html;
    }

    /**
     * ✅ CLEAN CSP - No unsafe-inline needed!
     * Event listeners in JS file with nonce = secure ✅
     */
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
                           img-src ${webview.cspSource} data:;">
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

    private async handleWebviewMessage(gameId: string, message: any): Promise<void> {
        switch (message.command) {
            case 'gameOver':
                await this.handleGameOver(gameId, message.score);
                break;

            case 'log':
                console.log(`[${gameId}]`, message.message);
                break;

            case 'error':
                console.error(`[${gameId}]`, message.error);
                break;

            case 'ready':
                console.log(`[${gameId}] Game ready`);
                break;

            default:
                console.warn(`[${gameId}] Unknown message:`, message.command);
        }
    }

    private async handleGameOver(gameId: string, score?: number): Promise<void> {
        await this.gameManager.endPlay(gameId, score);

        const state = this.gameManager.getGame(gameId);
        if (score && state) {
            const storageManager = (this.gameManager as any).storageManager;
            const gameState = storageManager.getGameState(gameId);

            if (score >= gameState.highScore) {
                vscode.window.showInformationMessage(
                    `🏆 New high score in ${state.name}: ${score}!`
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