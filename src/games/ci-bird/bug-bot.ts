import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants';

export type BotPhase = 'follow' | 'lock' | 'shoot' | 'exit';

export interface BugBot {
    x: number;
    y: number;
    lockY: number;
    phase: BotPhase;
    phaseT: number;
    vx: number;
    laserActive: boolean;
    laserT: number;
    hit: boolean;
}

export interface LaserHit {
    y: number;
    x0: number;
    x1: number;
}

const FOLLOW = 2;
const LOCK = 0.35;
const SHOOT = 0.28;

export function createBugBot(birdY: number): BugBot {
    return {
        x: CANVAS_WIDTH + 28,
        y: birdY,
        lockY: birdY,
        phase: 'follow',
        phaseT: 0,
        vx: -90,
        laserActive: false,
        laserT: 0,
        hit: false
    };
}

export function updateBugBot(bot: BugBot, dt: number, birdY: number): void {
    bot.phaseT += dt;

    if (bot.phase === 'follow') {
        bot.y += (birdY - bot.y) * Math.min(1, dt * 6);
        bot.x += bot.vx * dt;
        if (bot.x < CANVAS_WIDTH - 46) {
            bot.x = CANVAS_WIDTH - 46;
        }
        if (bot.phaseT >= FOLLOW) {
            bot.phase = 'lock';
            bot.phaseT = 0;
            bot.lockY = bot.y;
        }
        return;
    }

    if (bot.phase === 'lock') {
        bot.y = bot.lockY;
        if (bot.phaseT >= LOCK) {
            bot.phase = 'shoot';
            bot.phaseT = 0;
            bot.laserActive = true;
            bot.laserT = SHOOT;
        }
        return;
    }

    if (bot.phase === 'shoot') {
        bot.y = bot.lockY;
        bot.laserT -= dt;
        if (bot.laserT <= 0) {
            bot.laserActive = false;
            bot.phase = 'exit';
            bot.phaseT = 0;
            bot.vx = 260;
        }
        return;
    }

    bot.x += bot.vx * dt;
    bot.y = bot.lockY;
}

export function botLaser(bot: BugBot): LaserHit | null {
    if (!bot.laserActive) {
        return null;
    }
    return {
        y: bot.lockY,
        x0: 0,
        x1: bot.x
    };
}

export function botOffscreen(bot: BugBot): boolean {
    return bot.phase === 'exit' && bot.x > CANVAS_WIDTH + 40;
}

export function drawBugBot(ctx: CanvasRenderingContext2D, bot: BugBot): void {
    const laser = botLaser(bot);
    if (laser) {
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(laser.x0, laser.y);
        ctx.lineTo(laser.x1, laser.y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 200, 180, 0.7)';
        ctx.lineWidth = 8;
        ctx.stroke();
    }

    ctx.save();
    ctx.translate(bot.x, bot.y);
    if (bot.phase === 'exit') {
        ctx.scale(-1, 1);
    }

    ctx.fillStyle = '#f48771';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(-6, -2, 3, 0, Math.PI * 2);
    ctx.arc(2, -3, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d16969';
    ctx.beginPath();
    ctx.moveTo(12, -4);
    ctx.lineTo(22, 0);
    ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.lineTo(-16, 12);
    ctx.moveTo(4, 6);
    ctx.lineTo(8, 13);
    ctx.stroke();

    ctx.restore();
}

export function drawRushBanner(ctx: CanvasRenderingContext2D, remaining: number): void {
    ctx.fillStyle = 'rgba(78, 201, 176, 0.18)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 28);
    ctx.fillStyle = '#4ec9b0';
    ctx.font = '10px "Press Start 2P", cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`RUSH HOUR ${remaining.toFixed(1)}s`, CANVAS_WIDTH / 2, 14);
}

