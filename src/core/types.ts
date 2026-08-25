/**
 * types.ts
 * 
 * Central type definitions for the Code to Play extension.
 * Contains all interfaces, types, and enums used across the extension.
 */

import { TRACKEDEXTENSION } from "../constants/TrackedExtensions";

/**
 * Represents a playable game in the extension
 */
export interface IGame {
    /** Unique identifier for the game (e.g., 'debug-snake') */
    id: string;

    /** Display name shown to users (e.g., 'Debug Snake') */
    name: string;

    /** Short description of the game */
    description: string;

    /** Path to the game's icon file */
    iconPath: string;

    /** Whether this game requires premium/paid access */
    isPremium: boolean;

    /** Whether the game requires an online connection */
    isOnline?: boolean;

    /** Relative path to the game's HTML file */
    htmlPath: string;

    /** Relative path to the game's JavaScript file */
    jsPath: string;

    /** Relative path to the game's CSS file */
    cssPath: string;
}

/**
 * Tracks the current state of a game for a user
 */
export interface GameState  {
    /**
     * High scores keyed by difficulty id.
     * Games without difficulty levels use DEFAULT_DIFFICULTY_KEY ('default').
     */
    highScores: Record<string, number>;

    /** Total number of times this game has been played */
    totalPlays: number;

    /** Timestamp of last play session */
    lastPlayed?: number;
}

/** Key used when a game has no difficulty levels or omits difficulty on gameOver */
export const DEFAULT_DIFFICULTY_KEY = 'default';

export function resolveDifficultyKey(difficulty?: string): string {
    const trimmed = difficulty?.trim();
    return trimmed ? trimmed : DEFAULT_DIFFICULTY_KEY;
}

export function getHighScoreFor(state: GameState, difficulty?: string): number {
    const key = resolveDifficultyKey(difficulty);
    return state.highScores?.[key] ?? 0;
}

export function getBestHighScore(state: GameState): number {
    const scores = Object.values(state.highScores ?? {});
    if (scores.length === 0) {
        return 0;
    }
    return Math.max(...scores);
}

export function formatHighScores(state: GameState): string {
    const entries = Object.entries(state.highScores ?? {})
        .filter(([, score]) => score > 0)
        .sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) {
        return '0';
    }

    if (entries.length === 1 && entries[0][0] === DEFAULT_DIFFICULTY_KEY) {
        return String(entries[0][1]);
    }

    return entries.map(([key, score]) => `${key} ${score}`).join(', ');
}

/**
 * Returns a new highScores map with score applied for the given difficulty
 * when it beats the previous best for that key. Unchanged if not higher.
 */
export function withUpdatedHighScore(
    state: GameState,
    score: number,
    difficulty?: string
): { highScores: Record<string, number>; improved: boolean; key: string } {
    const key = resolveDifficultyKey(difficulty);
    const previous = state.highScores?.[key] ?? 0;
    const improved = score > previous;

    if (!improved) {
        return {
            highScores: { ...(state.highScores ?? {}) },
            improved: false,
            key
        };
    }

    return {
        highScores: {
            ...(state.highScores ?? {}),
            [key]: score
        },
        improved: true,
        key
    };
}

/**
 * Normalizes legacy GameState ({ highScore: number }) to the highScores map shape.
 */
export function normalizeGameState(raw: unknown): GameState {
    if (!raw || typeof raw !== 'object') {
        return {
            highScores: {},
            totalPlays: 0,
            lastPlayed: undefined
        };
    }

    const data = raw as Partial<GameState> & { highScore?: number };

    if (data.highScores && typeof data.highScores === 'object') {
        return {
            highScores: { ...data.highScores },
            totalPlays: data.totalPlays ?? 0,
            lastPlayed: data.lastPlayed
        };
    }

    const legacy = typeof data.highScore === 'number' ? data.highScore : 0;
    return {
        highScores: legacy > 0 ? { [DEFAULT_DIFFICULTY_KEY]: legacy } : {},
        totalPlays: data.totalPlays ?? 0,
        lastPlayed: data.lastPlayed
    };
}

/**
 * Global play state shared across all games
 */
export const PRO_EXTRA_PLAY_SPACES = 2;
export const PRO_TRIAL_DAYS = 5;

export type ProAdminOverride = 'unlocked' | 'locked';

export interface GlobalPlayState {
    /** Number of play sessions remaining before lock */
    playsRemaining: number;

    /** Total lines of meaningful code written since last unlock */
    linesWritten: number;

    /** Whether games are currently unlocked and playable */
    isUnlocked: boolean;

    /** Whether Pro games (Call Stack, Merge Conflict, Kernel Panic) are allowed */
    isProUnlocked: boolean;

    /** Whether the +2 Pro play spaces have already been applied */
    proSpacesApplied: boolean;

    /** Lifetime purchased play spaces already added to the local pool */
    appliedPurchasedPlaySpaces: number;

    /** Dev-only override so Polar sync does not immediately undo admin lock/unlock */
    proAdminOverride?: ProAdminOverride;
}

/**
 * Configuration for game unlock mechanics
 */
export interface UnlockConfig {
    /** Number of free plays before game locks */
    initialPlays: number;

    /** Lines of code required to unlock game after lock */
    linesToUnlock: number;

    /** Number of plays granted when unlocked */
    playsPerUnlock: number;

    /** Whether to count only non-comment, non-whitespace lines */
    countMeaningfulLinesOnly: boolean;
}

/**
 * Represents a code change event in the editor
 */
export interface CodeChange {
    /** Number of lines added */
    linesAdded: number;

    /** Number of lines deleted */
    linesDeleted: number;

    /** Net change in lines (added - deleted) */
    netChange: number;

    /** Whether the change contains meaningful code */
    isMeaningful: boolean;

    /** File language/type (e.g., 'typescript', 'javascript') */
    languageId: string;

    /** Tracked file extension (e.g., '.ts', '.py') */
    fileExtension: string;

    /** Timestamp of the change */
    timestamp: number;
}

/**
 * Storage keys for persistent data
 */
export enum StorageKey {
    /** Prefix for game state storage */
    GAME_STATE_PREFIX = 'codeToPlay.gameState.',

    /** Global play state (shared across all games) */
    GLOBAL_PLAY_STATE = 'codeToPlay.globalPlayState',

    /** Total lines of code written across all time */
    TOTAL_LINES_WRITTEN = 'codeToPlay.totalLinesWritten',

    /** Lines written per tracked file extension */
    LINES_BY_EXTENSION = 'codeToPlay.linesByExtension',

    /** Configuration settings */
    CONFIG = 'codeToPlay.config',

    /** User preferences */
    PREFERENCES = 'codeToPlay.preferences'
}

/**
 * Events that can be emitted by the extension
 */
export enum GameEvent {
    /** Game was unlocked */
    UNLOCKED = 'game:unlocked',

    /** Game was locked */
    LOCKED = 'game:locked',

    /** Play session started */
    PLAY_STARTED = 'game:playStarted',

    /** Play session ended */
    PLAY_ENDED = 'game:playEnded',

    /** Code was written */
    CODE_WRITTEN = 'code:written',

    /** Progress toward unlock */
    PROGRESS_UPDATED = 'progress:updated'
}

/**
 * Result of attempting to play a game
 */
export interface PlayAttemptResult {
    /** Whether the play attempt was successful */
    success: boolean;

    /** Reason for failure (if any) */
    reason?: string;

    /** Updated game state after attempt */
    gameState?: GameState;
}

/**
 * Statistics about user's coding activity
 */
export interface CodingStats {
    /** Total lines of meaningful code written */
    totalLines: number;

    /** Lines written today */
    linesToday: number;

    /** Lines written this week */
    linesThisWeek: number;

    /** Most written tracked file extension (e.g., '.ts') */
    mostActiveExtension: string;

    /** Lines written per tracked file extension */
    linesByExtension: Record<string, number>;

    /** Average lines per day */
    averageLinesPerDay: number;
}

/**
 * Configuration for the entire extension
 */
export interface ExtensionConfig {
    /** Game unlock configuration */
    unlock: UnlockConfig;

    /** Whether to show notifications for unlocks */
    showUnlockNotifications: boolean;

    /** Whether to track code in all files or only specific types */
    trackAllFiles: boolean;

    /** File extensions to track (if trackAllFiles is false) */
    trackedExtensions: string[];

    /** Minimum time between code changes to count (milliseconds) */
    debounceTime: number;
}

/**
 * Default extension configuration
 */
export const DEFAULT_CONFIG: ExtensionConfig = {
    unlock: {
        initialPlays: 5,
        linesToUnlock: 1000,
        playsPerUnlock: 5,
        countMeaningfulLinesOnly: true
    },
    showUnlockNotifications: true,
    trackAllFiles: false,
    trackedExtensions: TRACKEDEXTENSION,
    debounceTime: 1000
};

/**
 * Default game state for new games
 */
export const DEFAULT_GAME_STATE: GameState = {
    highScores: {},
    totalPlays: 0,
    lastPlayed: undefined
};

/**
 * Default global play state
 */
export const DEFAULT_GLOBAL_PLAY_STATE: GlobalPlayState = {
    playsRemaining: DEFAULT_CONFIG.unlock.initialPlays,
    linesWritten: 0,
    isUnlocked: true,
    isProUnlocked: false,
    proSpacesApplied: false,
    appliedPurchasedPlaySpaces: 0
};