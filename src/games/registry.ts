/**
 * registry.ts
 * 
 * Central registry for all games in the extension.
 * Import this to get a list of all available games.
 */

import { IGame } from '../core/types';
import { DebugSnakeGame } from './debug-snake/config';
import { WhackABugGame } from './whack-a-bug/config';

/**
 * All registered games in the extension
 * Add new games to this array to make them available
 */
export const AllGames: IGame[] = [
    DebugSnakeGame,
    WhackABugGame
];

/**
 * Get a game by its ID
 * 
 * @param gameId - ID of the game to retrieve
 * @returns Game object or undefined if not found
 */
export function getGameById(gameId: string): IGame | undefined {
    return AllGames.find(game => game.id === gameId);
}

/**
 * Get all free (non-premium) games
 * 
 * @returns Array of free games
 */
export function getFreeGames(): IGame[] {
    return AllGames.filter(game => !game.isPremium);
}

/**
 * Get all premium games
 * 
 * @returns Array of premium games
 */
export function getPremiumGames(): IGame[] {
    return AllGames.filter(game => game.isPremium);
}