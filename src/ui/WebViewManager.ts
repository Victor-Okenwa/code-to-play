/**
 * WebviewManager.ts
 * 
 * Manages webview panels for displaying games.
 * Handles webview creation, communication, resource loading, and lifecycle.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IGame } from '../core/types';
import { GameManager } from '../core/GameManager';

/**
 * Manages game webview panels
 */
export class WebviewManager {
    /**
     * Active webview panels mapped by game ID
     */
    private activePanels = new Map<string, vscode.WebviewPanel>();

    /**
     * Extension context for accessing resources
     */
    private context: vscode.ExtensionContext;

    /**
     * Creates a new WebviewManager instance
     * 
     * @param context - Extension context
     * @param gameManager - Game manager for game data
     */
    constructor(
        context: vscode.ExtensionContext,
        private gameManager: GameManager
    ) {
        this.context = context;
    }

    // ========================================
    // WEBVIEW CREATION
    // ========================================

    /**
     * Opens a game in a webview panel
     * Reuses existing panel if game is already open
     * 
     * @param gameId - ID of game to open
     * @returns The webview panel or null if game not found
     */
    async openGame(gameId: string): Promise<vscode.WebviewPanel | null> {
        const game = this.gameManager.getGame(gameId);

        if (!game) {
            vscode.window.showErrorMessage(`Game '${gameId}' not found`);
            return null;
        }

        // Check for attempt to play
        const playResult = await this.gameManager.attemptPlay(gameId);

        if (!playResult.success) {
            vscode.window.showWarningMessage(playResult.reason || 'Cannot play game');
            return null;
        }

        // Reuse existing panel if available
        const existingPanel = this.activePanels.get(gameId);
        if (existingPanel) {
            existingPanel.reveal();
            return existingPanel;
        }

        // Create new panel
        const panel = this.createWebviewPanel(game);

        // Store panel
        this.activePanels.set(gameId, panel);

        // Setup panel event handlers
        this.setupPanelHandlers(gameId, panel);

        // Load game content
        await this.loadGameContent(panel, game);

        return panel;
    }

    /**
     * Creates a new webview panel
     * 
     * @param game - Game to create panel for
     * @returns The webview panel
     * @private
     */
    private createWebviewPanel(game: IGame): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            `codeToPlay.${game.id}`,
            `🎮 ${game.name}`,
            vscode.ViewColumn.Eight,
            {
                enableScripts: true,
                // retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
                    vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'games'))
                ]
            }
        );

        return panel;
    }

    /**
     * Sets up event handlers for a webview panel
     * 
     * @param gameId - ID of the game
     * @param panel - Webview panel
     * @private
     */
    private setupPanelHandlers(gameId: string, panel: vscode.WebviewPanel): void {
        // Handle panel disposal (when closed)
        panel.onDidDispose(() => {
            this.activePanels.delete(gameId);
            this.gameManager.endPlay(gameId);
        });

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            message => this.handleWebviewMessage(gameId, message),
            undefined,
            this.context.subscriptions
        );

        // Handle visibility changes
        panel.onDidChangeViewState(e => {
            if (!e.webviewPanel.visible) {
                // Could pause game or save state here
            }
        });
    }

    // ========================================
    // CONTENT LOADING
    // ========================================

    /**
     * Loads game content into webview
     * 
     * @param panel - Webview panel
     * @param game - Game to load
     * @private
     */
    private async loadGameContent(
        panel: vscode.WebviewPanel,
        game: IGame
    ): Promise<void> {
        try {
            // Get paths to game files
            const gameDir = path.join(
                this.context.extensionPath,
                'src',
                'games',
                game.id
            );

            const htmlPath = path.join(gameDir, game.htmlPath);
            const jsPath = path.join(gameDir, game.jsPath);
            const cssPath = path.join(gameDir, game.cssPath);

            // Read game files
            let html = fs.readFileSync(htmlPath, 'utf8');
            const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';
            const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

            // Get font URIs
            const fontUris = this.getFontUris(panel.webview);

            // Inject CSS with fonts
            const styleTag = this.createStyleTag(css, fontUris);

            // Inject JavaScript
            const scriptTag = this.createScriptTag(js);

            // Inject common styles
            const commonCss = this.getCommonStyles(fontUris);

            // Insert into HTML
            html = this.injectContent(html, commonCss + styleTag, scriptTag);

            // Apply CSP (Content Security Policy)
            html = this.applyContentSecurityPolicy(html, panel.webview);

            // Set HTML
            panel.webview.html = html;

        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to load game: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Gets URIs for font files
     * 
     * @param webview - Webview instance
     * @returns Map of font names to URIs
     * @private
     */
    private getFontUris(webview: vscode.Webview): Map<string, vscode.Uri> {
        const fontDir = path.join(this.context.extensionPath, 'media', 'fonts');
        const uris = new Map<string, vscode.Uri>();

        // Press Start 2P
        const pressStartWoff2 = vscode.Uri.file(
            path.join(fontDir, 'PressStart2P.woff2')
        );
        const pressStartTtf = vscode.Uri.file(
            path.join(fontDir, 'PressStart2P-Regular.ttf')
        );

        // Orbitron
        const orbitronWoff2 = vscode.Uri.file(
            path.join(fontDir, 'Orbitron.woff2')
        );
        const orbitronRegular = vscode.Uri.file(
            path.join(fontDir, 'Orbitron-Regular.ttf')
        );
        const orbitronBold = vscode.Uri.file(
            path.join(fontDir, 'Orbitron-Bold.ttf')
        );

        uris.set('pressStartWoff2', webview.asWebviewUri(pressStartWoff2));
        uris.set('pressStartTtf', webview.asWebviewUri(pressStartTtf));
        uris.set('orbitronWoff2', webview.asWebviewUri(orbitronWoff2));
        uris.set('orbitronRegular', webview.asWebviewUri(orbitronRegular));
        uris.set('orbitronBold', webview.asWebviewUri(orbitronBold));

        return uris;
    }

    /**
     * Gets common styles including font faces
     * 
     * @param fontUris - Map of font URIs
     * @returns CSS string
     * @private
     */
    private getCommonStyles(fontUris: Map<string, vscode.Uri>): string {
        return `
            <style>
                /* Font Faces */
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
                
                /* Reset */
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                /* Base styles */
                body {
                    font-family: 'Orbitron', sans-serif;
                    overflow: hidden;
                }
                
                /* Headings use gaming font */
                h1, h2, h3, h4, h5, h6 {
                    font-family: 'Press Start 2P', cursive;
                }
            </style>
        `;
    }

    /**
     * Creates a style tag with CSS content
     * 
     * @param css - CSS content
     * @param fontUris - Font URIs for any dynamic replacements
     * @returns HTML style tag
     * @private
     */
    private createStyleTag(css: string, fontUris: Map<string, vscode.Uri>): string {
        if (!css) {
            return '';
        }

        return `<style>${css}</style>`;
    }

    /**
     * Creates a script tag with JavaScript content
     * 
     * @param js - JavaScript content
     * @returns HTML script tag
     * @private
     */
    private createScriptTag(js: string): string {
        if (!js) {
            return '';
        }

        return `<script>${js}</script>`;
    }

    /**
     * Injects style and script tags into HTML
     * 
     * @param html - Original HTML
     * @param styles - Style tags to inject
     * @param scripts - Script tags to inject
     * @returns Modified HTML
     * @private
     */
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
     * Applies Content Security Policy to HTML
     * 
     * @param html - HTML content
     * @param webview - Webview instance
     * @returns HTML with CSP meta tag
     * @private
     */
    private applyContentSecurityPolicy(
        html: string,
        webview: vscode.Webview
    ): string {
        const nonce = this.getNonce();

        // Create CSP meta tag
        const csp = `
            <meta http-equiv="Content-Security-Policy" 
                  content="default-src 'none'; 
                           style-src ${webview.cspSource} 'unsafe-inline'; 
                           script-src 'nonce-${nonce}' 'unsafe-eval'; 
                           font-src ${webview.cspSource}; 
                           img-src ${webview.cspSource} data:;">
        `;

        // Add nonce to inline scripts
        html = html.replace(/<script>/g, `<script nonce="${nonce}">`);

        // Inject CSP
        if (html.includes('<head>')) {
            html = html.replace('<head>', `<head>${csp}`);
        }

        return html;
    }

    /**
     * Generates a nonce for CSP
     * 
     * @returns Random nonce string
     * @private
     */
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
     * Handles messages received from webview
     * 
     * @param gameId - ID of the game
     * @param message - Message from webview
     * @private
     */
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
                // Game loaded and ready
                console.log(`Game ${gameId} ready`);
                break;

            default:
                console.warn(`Unknown message command: ${message.command}`);
        }
    }

    /**
     * Handles game over event from webview
     * 
     * @param gameId - ID of the game
     * @param score - Final score
     * @private
     */
    private async handleGameOver(gameId: string, score?: number): Promise<void> {
        await this.gameManager.endPlay(gameId, score);

        // Show congratulatory message if high score
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

    /**
     * Sends a message to a game's webview
     * 
     * @param gameId - ID of the game
     * @param message - Message to send
     */
    postMessage(gameId: string, message: any): void {
        const panel = this.activePanels.get(gameId);
        if (panel) {
            panel.webview.postMessage(message);
        }
    }

    // ========================================
    // PUBLIC API
    // ========================================

    /**
     * Closes a game's webview
     * 
     * @param gameId - ID of game to close
     */
    closeGame(gameId: string): void {
        const panel = this.activePanels.get(gameId);
        if (panel) {
            panel.dispose();
        }
    }

    /**
     * Closes all open game webviews
     */
    closeAllGames(): void {
        for (const panel of this.activePanels.values()) {
            panel.dispose();
        }
        this.activePanels.clear();
    }

    /**
     * Checks if a game is currently open
     * 
     * @param gameId - ID of game to check
     * @returns True if game is open
     */
    isGameOpen(gameId: string): boolean {
        return this.activePanels.has(gameId);
    }

    /**
     * Gets list of currently open games
     * 
     * @returns Array of game IDs
     */
    getOpenGames(): string[] {
        return Array.from(this.activePanels.keys());
    }

    // ========================================
    // CLEANUP
    // ========================================

    /**
     * Disposes of all resources
     */
    dispose(): void {
        this.closeAllGames();
    }
}

/**
 * Creates and registers the webview manager
 * Call this from extension.ts during activation
 * 
 * @param context - Extension context
 * @param gameManager - Game manager instance
 * @returns The webview manager instance
 */
export function createWebviewManager(
    context: vscode.ExtensionContext,
    gameManager: GameManager
): WebviewManager {
    const webviewManager = new WebviewManager(context, gameManager);

    // Register play game command
    const playCommand = vscode.commands.registerCommand(
        'codeToPlay.playGame',
        async (gameId: string) => {
            await webviewManager.openGame(gameId);
        }
    );

    context.subscriptions.push(webviewManager, playCommand);

    return webviewManager;
}