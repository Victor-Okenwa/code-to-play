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
export interface GameState {
    /** High score achieved in this game */
    highScore: number;

    /** Total number of times this game has been played */
    totalPlays: number;

    /** Timestamp of last play session */
    lastPlayed?: number;
}

/**
 * Global play state shared across all games
 */
export interface GlobalPlayState {
    /** Number of play sessions remaining before lock */
    playsRemaining: number;

    /** Total lines of meaningful code written since last unlock */
    linesWritten: number;

    /** Whether games are currently unlocked and playable */
    isUnlocked: boolean;
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

    /** Most active language */
    mostActiveLanguage: string;

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
        linesToUnlock: 50,
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
    highScore: 0,
    totalPlays: 0,
    lastPlayed: undefined
};

/**
 * Default global play state
 */
export const DEFAULT_GLOBAL_PLAY_STATE: GlobalPlayState = {
    playsRemaining: DEFAULT_CONFIG.unlock.initialPlays,
    linesWritten: 0,
    isUnlocked: true
};