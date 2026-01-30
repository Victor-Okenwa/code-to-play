/**
 * extension.ts
 * 
 * Main entry point for the Code to Play VS Code extension.
 * Activates and deactivates the extension, setting up core components.
 */

import * as vscode from 'vscode';
import { StorageManager } from './core/StorageManager';
import { CodeTracker } from './core/CodeTracker';
import { GameManager } from './core/GameManager';
import { createActivityBarView } from './ui/ActivityBarProvider';
import { createStatusBar } from './ui/StatusBarManager';
import { createWebviewManager } from './ui/WebViewManager';
import { AllGames } from './games/registry';
import { GameEvent } from './core/types';


/** * Activates the extension
 * 
 * @param context - VS Code extension context
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('Code to Play extension is now active!');

	// ========================================
	// INITIALIZE CORE COMPONENTS
	// ========================================

	// Storage manager for persistence
	const storageManager = new StorageManager(context);

	// Code tracker to monitor coding activity
	const codeTracker = new CodeTracker(storageManager);

	// Game manager to handle game logic
	const gameManager = new GameManager(storageManager, codeTracker);

	// ========================================
	// REGISTER GAMES
	// ========================================

	console.log(`Registering ${AllGames.length} games...`);
	gameManager.registerGames(AllGames);

	AllGames.map(game => {
		console.log(`${game.name}, ${game.id}`);
	});


	// ========================================
	// CREATE UI COMPONENTS
	// ========================================

	// Activity bar tree view
	const treeView = createActivityBarView(context, gameManager, storageManager);

	// Status bar item
	const statusBar = createStatusBar(context, gameManager, storageManager);

	// Webview manager for game UIs
	const webviewManager = createWebviewManager(context, gameManager);

	// ========================================
	// REGISTER COMMANDS
	// ========================================

	// Command to open extension settings
	const openSettingsCommand = vscode.commands.registerCommand('codeToPlay.openSettings', () => {
		vscode.commands.executeCommand("workbench.action.openSettings", "codeToPlay");
	});


	// Command to reset game state
	const resetGameStateCommand = vscode.commands.registerCommand('codeToPlay.resetGame', async () => {
		async (gameId: string) => {
			if (!gameId) {
				// Show quick pick to select game
				const games = gameManager.getAllGames();
				const items = games.map(game => ({
					label: game.name,
					description: game.description,
					gameId: game.id
				}))


				const selected = await vscode.window.showQuickPick(items, {
					placeHolder: 'Select a game to reset'
				});

				if (!selected) {
					return;
				}

				gameId = selected.gameId;
			}

			// Confirm reset
			const game = gameManager.getGame(gameId);
			const confirm = await vscode.window.showWarningMessage(
				`Reset ${game?.name}? This will clear your high score and plays`,
				'Reset',
				'Cancel'
			);

			if (confirm === 'Reset') {
				await gameManager.resetGame(gameId);
				vscode.window.showInformationMessage(`${game?.name} has been reset.`);
			}
		};
	});

	// Command to reset all games
	const resetAllGamesCommand = vscode.commands.registerCommand('codeToPlay.resetAllGames', async () => {
		// Confirm reset
		const confirm = await vscode.window.showWarningMessage(
			`Reset all games? This will clear all high scores and plays.`,
			'Reset All',
			'Cancel'
		);

		if (confirm === 'Reset All') {
			await gameManager.resetAllGames();
			vscode.window.showInformationMessage(`All games have been reset.`);
		};
	});


	// Command to view stats
	const viewStatsCommand = vscode.commands.registerCommand('codeToPlay.viewStats', () => {
		const totalLines = storageManager.getTotalLinesWritten();
		const games = gameManager.getAllGames();
		const unlocked = games.filter(game => gameManager.isGameUnlocked(game.id)).length;

		let stats = `Code to Play Statistics\n\n`;
		stats += `Total Lines of Code Written: ${totalLines}\n`;
		stats += `Games Unlocked: ${unlocked} / ${games.length}\n\n`;

		stats += `Games:\n`;
		games.map(game => {
			const state = storageManager.getGameState(game.id);
			const status = state.isUnlocked ? '✅' : '🔒';
			stats += `${status} ${game.name}\n`;
			stats += `   Plays: ${state.playsRemaining}\n`;
			stats += `   High Score: ${state.highScore}\n`;
			stats += `   Total Plays: ${state.totalPlays}\n\n`;
		});

		vscode.window.showInformationMessage(stats, { modal: true });
	});

	// Command to unlock game (for testind and debugging)
	const unlockGameCommand = vscode.commands.registerCommand('codeToPlay.unlockGame', async () => {
		async (gameId?: string) => {
			if (!gameId) {
				// Show quick pick to select game
				const games = gameManager.getLockedGames();
				const items = games.map(game => ({
					label: game.name,
					description: game.description,
					gameId: game.id
				}))

				const selected = await vscode.window.showQuickPick(items, {
					placeHolder: 'Select a game to unlock'
				});

				if (!selected) {
					return;
				}

				gameId = selected.gameId;
			}

			await gameManager.unlockGame(gameId);
			const game = gameManager.getGame(gameId);
			vscode.window.showInformationMessage(`${game?.name} has been unlocked! Enjoy playing!`);
		};
	});

	// Command to export data
	const exportDataCommand = vscode.commands.registerCommand('codeToPlay.exportData', async () => {
		const data = storageManager.exportData();

		const uri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file('code-to-play-data.json'),
			filters: { 'JSON Files': ['json'] }
		});

		if (uri) {
			await vscode.workspace.fs.writeFile(uri, Buffer.from(data, 'utf8'));
			vscode.window.showInformationMessage('Code to Play data exported successfully.');
		}
	});

	// Command to import data
	const importDataCommand = vscode.commands.registerCommand('codeToPlay.importData', async () => {
		const uris = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: { 'JSON': ['json'] }
		});

		if (uris && uris.length > 0) {
			try {
				const data = await vscode.workspace.fs.readFile(uris[0]);
				const jsonData = Buffer.from(data).toString('utf8');

				await storageManager.importData(jsonData);
				vscode.window.showInformationMessage('Code to Play data imported successfully.');
			} catch (error) {
				vscode.window.showErrorMessage('Failed to import Code to Play data. Please ensure the file is valid.');
			}
		}
	});

	// ========================================
	// EVENT HANDLERS
	// ========================================

	// Listen for game to unlock events
	gameManager.onGameEvent(({ event, gameId, data }) => {
		switch (event) {
			case GameEvent.UNLOCKED:
				const game = gameManager.getGame(gameId);
				if (game) {
					// Show celebrations in status bar
					statusBar.celebrate(`🎉 Unlocked ${game.name}! 🎉`);

					// Show notification
					vscode.window.showInformationMessage(`Congratulations! You've unlocked ${game.name}! Enjoy playing!`, 'Play Now').then(selection => {
						if (selection === 'Play Now') {
							vscode.commands.executeCommand('codeToPlay.playGame', gameId);
						}
					});
				}
				break;

			case GameEvent.LOCKED:
				// Game locked - user ran out of plays
				const lockedGame = gameManager.getGame(gameId);
				if (lockedGame) {
					const config = storageManager.getConfig();
					vscode.window.showWarningMessage(`🔒 ${lockedGame.name} locked. Write ${config.unlock.linesToUnlock} lines to unlock ${config.unlock.playsPerUnlock} new plays.`);
				}
				break;

			case GameEvent.PROGRESS_UPDATED:
				// Progress toward unlock - optionally show notifications
				if (data.progress >= 0.75 && data.progress < 0.76) {
					// 75% progress milestone
					const progressGame = gameManager.getGame(gameId);
					if (progressGame) {
						vscode.window.showInformationMessage(
							`📝 Almost there! ${data.linesRequired - data.linesWritten} more lines to unlock ${progressGame.name}`
						);
					}
				}

				break;

			default:
				// No action for other events
				break;

		}
	});

	// ========================================
	// ADD TO SUBSCRIPTIONS
	// ========================================

	context.subscriptions.push(
		storageManager,
		codeTracker,
		gameManager,
		treeView,
		statusBar,
		webviewManager,
		openSettingsCommand,
		resetGameStateCommand,
		resetAllGamesCommand,
		viewStatsCommand,
		unlockGameCommand,
		exportDataCommand,
		importDataCommand
	);

}
