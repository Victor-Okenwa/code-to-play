/**
 * config.ts
 * 
 * Configuration and metadata for Debug Snake game
 */

import { IGame } from '../../core/types';

/**
 * Debug snake configuration
 */
export const DebugSnakeGame: IGame = {
    id: 'debug-snake',
    name: 'Debug Snake',
    description: 'Classic snake with a debugging twist. Catch ladybugs, collect pink balls, and unlock snakes!',
    iconPath: 'assets/icon.svg',
    isPremium: false,
    isOnline: false,
    htmlPath: 'index.html',
    jsPath: 'game.ts',
    cssPath: 'styles.css'
};