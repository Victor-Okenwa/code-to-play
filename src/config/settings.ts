import * as vscode from 'vscode';

export const LINES_TO_UNLOCK_MIN = 1000;
export const LINES_TO_UNLOCK_DEFAULT = 1000;

/**
 * Reads the user-configured lines required to unlock more plays.
 * Clamped to {@link LINES_TO_UNLOCK_MIN} so values below 1000 are ignored.
 */
export function getLinesToUnlock(): number {
    const configured = vscode.workspace
        .getConfiguration('codeToPlay')
        .get<number>('unlock.linesToUnlock', LINES_TO_UNLOCK_DEFAULT);

    const value = Number.isFinite(configured) ? configured : LINES_TO_UNLOCK_DEFAULT;
    return Math.max(LINES_TO_UNLOCK_MIN, Math.floor(value));
}
