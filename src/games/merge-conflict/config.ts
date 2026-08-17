/**
 * config.ts
 *
 * Configuration and metadata for Merge Conflict
 */

import { IGame } from '../../core/types';

export const MergeConflictGame: IGame = {
    id: 'merge-conflict',
    name: 'Merge Conflict',
    description: 'Swap ours, theirs, and base hunks to merge matching lines. Let HEAD reach the top and the merge fails.',
    iconPath: 'assets/icon.svg',
    isPremium: true,
    isOnline: false,
    htmlPath: 'index.html',
    jsPath: 'game.ts',
    cssPath: 'styles.css'
};
