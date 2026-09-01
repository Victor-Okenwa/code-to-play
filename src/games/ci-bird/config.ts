/**
 * config.ts
 *
 * Configuration and metadata for CI Bird
 */

import { IGame } from '../../core/types';

export const CiBirdGame: IGame = {
    id: 'ci-bird',
    name: 'CI Bird',
    description: 'Flap the deploy bird through CI gates. Keep the pipeline green.',
    iconPath: 'assets/icon.svg',
    isPremium: false,
    isOnline: false,
    htmlPath: 'index.html',
    jsPath: 'game.ts',
    cssPath: 'styles.css'
};
