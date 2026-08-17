import { IGame } from '../core/types';
import { StorageManager } from '../core/StorageManager';

const EXTENSION_KEY = /^\.([a-z0-9+]+\.)*[a-z0-9+]{1,16}$/i;

function sanitizeLinesByExtension(
    raw: Record<string, number>
): Record<string, number> {
    const linesByExtension: Record<string, number> = {};

    for (const [extension, lines] of Object.entries(raw)) {
        const key = extension === 'unknown' ? '.unknown' : extension.toLowerCase();
        if (!EXTENSION_KEY.test(key) || !Number.isInteger(lines) || lines < 0) {
            continue;
        }
        linesByExtension[key] = lines;
    }

    return linesByExtension;
}

export type StatsSnapshot = {
    totalLines: number;
    linesByExtension: Record<string, number>;
    playsRemaining: number;
    linesTowardUnlock: number;
    linesToUnlock: number;
    isUnlocked: boolean;
    games: Array<{
        id: string;
        name: string;
        isPremium: boolean;
        totalPlays: number;
        highScores: Record<string, number>;
        lastPlayed?: number;
    }>;
};

export function buildStatsSnapshot(
    storageManager: StorageManager,
    games: IGame[]
): StatsSnapshot {
    const globalState = storageManager.getGlobalPlayState();
    const config = storageManager.getConfig();

    return {
        totalLines: storageManager.getTotalLinesWritten(),
        linesByExtension: sanitizeLinesByExtension(
            storageManager.getLinesByExtension()
        ),
        playsRemaining: globalState.playsRemaining,
        linesTowardUnlock: globalState.linesWritten,
        linesToUnlock: config.unlock.linesToUnlock,
        isUnlocked: globalState.isUnlocked,
        games: games.map((game) => {
            const state = storageManager.getGameState(game.id);
            return {
                id: game.id,
                name: game.name,
                isPremium: game.isPremium,
                totalPlays: state.totalPlays,
                highScores: { ...state.highScores },
                ...(typeof state.lastPlayed === 'number'
                    ? { lastPlayed: state.lastPlayed }
                    : {})
            };
        })
    };
}
