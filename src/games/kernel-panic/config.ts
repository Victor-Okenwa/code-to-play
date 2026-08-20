/**
 * config.ts
 *
 * Configuration and metadata for Kernel Panic
 */

import { IGame } from '../../core/types';

export const KernelPanicGame: IGame = {
    id: 'kernel-panic',
    name: 'Kernel Panic',
    description: 'Fly the kernel, shoot falling threats, and keep uptime until the clock runs out — or HP hits zero.',
    iconPath: 'assets/icon.svg',
    isPremium: true,
    isOnline: false,
    htmlPath: 'index.html',
    jsPath: 'game.ts',
    cssPath: 'styles.css'
};
