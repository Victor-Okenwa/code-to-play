/**
 * config.ts
 *
 * Configuration and metadata for Kernel Panic
 */

import { IGame } from '../../core/types';

export const KernelPanicGame: IGame = {
    id: 'kernel-panic',
    name: 'Kernel Panic',
    description: 'Fly unlocked crafts, shoot falling threats, collect gold and diamonds, survive rush-hour aliens and bosses — the longer you last, the tougher it gets.',
    iconPath: 'assets/icon.svg',
    isPremium: true,
    isOnline: false,
    htmlPath: 'index.html',
    jsPath: 'game.ts',
    cssPath: 'styles.css'
};
