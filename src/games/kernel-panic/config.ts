/**
 * config.ts
 *
 * Configuration and metadata for Kernel Panic
 */

import { IGame } from '../../core/types';

export const KernelPanicGame: IGame = {
    id: 'kernel-panic',
    name: 'Kernel Panic',
    description: 'Fly the kernel craft, shoot falling threats, grab colored power-ups, and last as long as you can — the longer you survive, the tougher it gets.',
    iconPath: 'assets/icon.svg',
    isPremium: true,
    isOnline: false,
    htmlPath: 'index.html',
    jsPath: 'game.ts',
    cssPath: 'styles.css'
};
