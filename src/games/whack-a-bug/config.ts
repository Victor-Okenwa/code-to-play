/**
 * config.ts
 * 
 * Configuration and metadata for Whack-a-Bug game
 */

import { IGame } from '../../core/types';

/**
 * Whack-a-Bug game configuration
 */
export const WhackABugGame: IGame = {
    id: 'whack-a-bug',
    name: 'Whack-a-Bug',
    description: 'Test your reflexes! Squash the bugs as they pop up before time runs out!',
    iconPath: 'assets/icon.svg',
    isPremium: false,
    isOnline: false,
    htmlPath: 'index.html',
    jsPath: 'game.ts',  // TypeScript file
    cssPath: 'styles.css'
};