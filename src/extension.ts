import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('✅ Code to Play is activating...');
	vscode.window.showInformationMessage('🎮 Code to Play activated!');
}

export function deactivate() { }