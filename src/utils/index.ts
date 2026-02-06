import * as vscode from "vscode";

export function showDbState(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('myExtension.showStorage', async () => {
        // Option A: Show globalState keys & values
        const globalKeys = context.globalState.keys();
        const globalData: Record<string, any> = {};
        for (const key of globalKeys) {
            globalData[key] = context.globalState.get(key);
        }

        // Option B: Same for workspaceState (only makes sense if a workspace is open)
        const wsKeys = context.workspaceState.keys();
        const wsData: Record<string, any> = {};
        for (const key of wsKeys) {
            wsData[key] = context.workspaceState.get(key);
        }

        // Show in output channel (persistent & searchable)
        const channel = vscode.window.createOutputChannel('Extension Storage Debug');
        channel.appendLine('=== Global State ===');
        channel.appendLine(JSON.stringify(globalData, null, 2));
        channel.appendLine('\n=== Workspace State ===');
        channel.appendLine(JSON.stringify(wsData, null, 2));
        channel.show();

        // Or show quick popup (good for small data)
        // await vscode.window.showInformationMessage('Global keys: ' + globalKeys.join(', '));
    });

    context.subscriptions.push(disposable);
}