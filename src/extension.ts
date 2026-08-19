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
import { GameEvent, formatHighScores, DEFAULT_DIFFICULTY_KEY } from './core/types';
import { AuthManager } from './auth/AuthManager';
import { StatsSync } from './stats/StatsSync';
import { EntitlementsSync } from './billing/EntitlementsSync';

/** * Activates the extension
 * 
 * @param context - VS Code extension context
 */

export function activate(context: vscode.ExtensionContext) {
	const isLocalDev = context.extensionMode === vscode.ExtensionMode.Development;

	if (isLocalDev) {
		console.log('LOCAL [1] - Code to Play extension is now active!');
	}

	// ========================================
	// INITIALIZE CORE COMPONENTS
	// ========================================

	// Storage manager for persistence
	const storageManager = new StorageManager(context);

	// Code tracker to monitor coding activity
	const codeTracker = new CodeTracker(storageManager);

	// Game manager to handle game logic
	const gameManager = new GameManager(storageManager, codeTracker);
	gameManager.registerGames(AllGames);

	const authManager = new AuthManager(context);
	const statsSync = new StatsSync(authManager, storageManager, gameManager);
	const entitlementsSync = new EntitlementsSync(authManager, gameManager);
	void authManager.refreshSession().then(() => {
		statsSync.start();
		entitlementsSync.start();
	});

	// Set the context key (controls the "when" clause)
	vscode.commands.executeCommand('setContext', 'codeToPlay:isDev', isLocalDev);

	// ========================================
	// CREATE UI COMPONENTS
	// ========================================

	// Activity bar tree view
	const treeView = createActivityBarView(context, gameManager, storageManager, authManager);

	// Status bar item
	const statusBar = createStatusBar(context, gameManager, storageManager);

	// Webview manager for game UIs
	const webviewManager = createWebviewManager(context, gameManager);

	// showDbState(context);

	// ========================================
	// REGISTER COMMANDS
	// ========================================

	// Command to open extension settings
	const openSettingsCommand = vscode.commands.registerCommand('codeToPlay.openSettings', () => {
		vscode.commands.executeCommand("workbench.action.openSettings", "codeToPlay");
	});

	const signInCommand = vscode.commands.registerCommand('codeToPlay.signIn', () => {
		return authManager.signIn();
	});

	const signOutCommand = vscode.commands.registerCommand('codeToPlay.signOut', () => {
		return authManager.signOut();
	});

	const openDashboardCommand = vscode.commands.registerCommand('codeToPlay.openDashboard', () => {
		return authManager.openDashboard();
	});

	const openPricingCommand = vscode.commands.registerCommand('codeToPlay.openPricing', () => {
		return authManager.openPricing();
	});

	const accountActionCommand = vscode.commands.registerCommand('codeToPlay.accountAction', () => {
		return authManager.handleAccountClick();
	});

	const playsActionCommand = vscode.commands.registerCommand('codeToPlay.playsAction', () => {
		return authManager.handlePlaysClick();
	});

	// Command to reset all games
	const resetAllGamesCommand = vscode.commands.registerCommand('codeToPlay.resetAllGames', async () => {
		// Confirm reset
		const confirm = await vscode.window.showWarningMessage(
			`Reset all games? This will clear all high scores.`,
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
		const linesByExtension = storageManager.getLinesByExtensionSorted();
		const mostActive = linesByExtension[0];
		const games = gameManager.getAllGames();
		const unlocked = games.filter(() => gameManager.isGameUnlocked()).length;

		let stats = `Code to Play Statistics\n\n`;
		stats += `Total Lines of Code Written: ${totalLines}\n`;
		if (mostActive) {
			stats += `Most written: ${mostActive.extension} (${mostActive.lines})\n`;
		}
		stats += `Games Unlocked: ${unlocked} / ${games.length}\n\n`;

		if (linesByExtension.length > 0) {
			stats += `Lines by file type:\n`;
			for (const { extension, lines } of linesByExtension) {
				const marker = mostActive && extension === mostActive.extension
					? ' (most)'
					: '';
				stats += `  ${extension}: ${lines}${marker}\n`;
			}
			stats += `\n`;
		} else if (totalLines > 0) {
			stats += `Lines by file type: none yet — counts start as you write in tracked files.\n\n`;
		}

		stats += `Games:\n`;
		games.forEach(game => {
			const state = storageManager.getGameState(game.id);
			const playsRemaining = gameManager.getPlaysRemaining();
			stats += `${game.name}\n`;
			stats += `   Plays Remaining: ${playsRemaining}\n`;
			const highScoreText = formatHighScores(state);
			const scoreLabel = Object.keys(state.highScores ?? {}).length === 1
				&& Object.keys(state.highScores)[0] === DEFAULT_DIFFICULTY_KEY
				? 'High Score'
				: 'High Scores';
			stats += `   ${scoreLabel}: ${highScoreText}\n`;
			stats += `   Total Plays: ${state.totalPlays}\n\n`;
		});

		vscode.window.showInformationMessage(stats, { modal: true });
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


	// ========================================
	// TESTING / DEBUGGING COMMANDS
	// ========================================

	// Command to unlock games (for testing and debugging)
	const unlockAllGames = vscode.commands.registerCommand('codeToPlay.unlockAllGames', async () => {
		if (!isLocalDev) {
			return;
		}

		await gameManager.unlockAllGames();
		vscode.window.showInformationMessage(`All games has been unlocked and number of plays reset! Enjoy playing!`);
	});

	// Command to lock games (for testing and debugging)
	const lockAllGames = vscode.commands.registerCommand('codeToPlay.lockAllGames', async () => {
		if (!isLocalDev) {
			return;
		}

		await gameManager.lockAllGames();
		vscode.window.showInformationMessage(`All games has been locked`);
	});

	const unlockPro = vscode.commands.registerCommand('codeToPlay.unlockPro', async () => {
		if (!isLocalDev) {
			return;
		}

		await gameManager.unlockPro();
		vscode.window.showInformationMessage(
			'Pro unlocked. Call Stack and Merge Conflict are playable, and plays were adjusted.'
		);
	});

	const lockPro = vscode.commands.registerCommand('codeToPlay.lockPro', async () => {
		if (!isLocalDev) {
			return;
		}

		await gameManager.lockPro();
		vscode.window.showInformationMessage(
			'Pro locked. You are on the Free plan. Call Stack and Merge Conflict need a Pro subscription.'
		);
	});

	// Command to import data
	const importDataCommand = vscode.commands.registerCommand('codeToPlay.importData', async () => {
		if (!isLocalDev) {
			return;
		}

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


	// Command to reset game state
	const resetGameStateCommand = vscode.commands.registerCommand('codeToPlay.resetGame', async () => {
		if (!isLocalDev) {
			return;
		}

		async (gameId: string) => {
			if (!gameId) {
				// Show quick pick to select game
				const games = gameManager.getAllGames();
				const items = games.map(game => ({
					label: game.name,
					description: game.description,
					gameId: game.id
				}));


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
					statusBar.celebrate(`Unlocked ${game.name}!`);

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
					vscode.window.showWarningMessage(
						`${lockedGame.name} locked. Write ${config.unlock.linesToUnlock} lines to unlock ${config.unlock.playsPerUnlock} new plays.`,
						'Buy play spaces'
					).then(selection => {
						if (selection === 'Buy play spaces') {
							void authManager.openSubscription();
						}
					});
				}
				break;

			case GameEvent.PROGRESS_UPDATED:
				// Progress toward unlock - optionally show notifications
				if (data.progress >= 0.75 && data.progress < 0.76) {
					// 75% progress milestone
					const progressGame = gameManager.getGame(gameId);
					if (progressGame) {
						vscode.window.showInformationMessage(
							`Almost there! ${data.linesRequired - data.linesWritten} more lines to unlock ${progressGame.name}`
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
		signInCommand,
		signOutCommand,
		openDashboardCommand,
		openPricingCommand,
		accountActionCommand,
		playsActionCommand,
		viewStatsCommand,
		exportDataCommand,
		resetAllGamesCommand,

		authManager,
		statsSync,
		entitlementsSync,

		// Admin Commands (in dev mode only)
		unlockAllGames,
		lockAllGames,
		unlockPro,
		lockPro,
		importDataCommand,
		resetGameStateCommand
	);

}
