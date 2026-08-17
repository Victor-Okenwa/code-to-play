/**
 * config.ts
 *
 * Configuration and metadata for Call Stack
 */

import { IGame } from '../../core/types';

export const CallStackGame: IGame = {
    id: 'call-stack',
    name: 'Call Stack',
    description: 'Drop call and return frames. Match a return onto its call to pop the stack — overflow and you crash.',
    iconPath: 'assets/icon.svg',
    isPremium: true,
    isOnline: false,
    htmlPath: 'index.html',
    jsPath: 'game.ts',
    cssPath: 'styles.css'
};
