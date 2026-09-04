/**
 * config.ts
 *
 * Configuration and metadata for Git Run
 */

import { IGame } from '../../core/types';

export const GitRunGame: IGame = {
    id: 'git-run',
    name: 'Git Run',
    description:
        'Landscape runner: jump trees, duck iron bars. Grab coins and diamonds, survive Force Push — unlock runners with coins and diamonds.',
    iconPath: 'assets/icon.svg',
    isPremium: true,
    isOnline: false,
    htmlPath: 'index.html',
    jsPath: 'game.ts',
    cssPath: 'styles.css'
};
