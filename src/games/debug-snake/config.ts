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
    description: 'Classic Snake game with a coding twist! Navigate the snake to destroy bugs before their disappear.',
    iconPath: 'assets/icon.svg',
    isPremium: false,
    // isOnline: false,
    htmlPath: 'index.html',
    jsPath: 'game.ts',  // TypeScript file
    cssPath: 'styles.css'
};