import { CANVAS_WIDTH } from './constants';

export type BotPhase = 'follow' | 'lock' | 'shoot' | 'exit';

export interface BotBullet {
    x: number;
    y: number;
    vx: number;
    r: number;
    hit: boolean;
}

export interface BugBot {
    x: number;
    y: number;
    lockY: number;
    phase: BotPhase;
    phaseT: number;
    vx: number;
    shotsFired: number;
    shotCooldown: number;
    bullets: BotBullet[];
}

const FOLLOW = 1.15;
const LOCK = 0.28;
const SHOTS = 3;
const SHOT_GAP = 0.34;
const EXIT_AFTER_LAST = 0.2;
const BULLET_VX = -360;
const BULLET_R = 5.5;
const SHOOT_END = (SHOTS - 1) * SHOT_GAP + EXIT_AFTER_LAST;

/** Time from spawn through the third shot. */
export const BOT_SHOT_WINDOW = FOLLOW + LOCK + SHOOT_END;

export function createBugBot(birdY: number): BugBot {
    return {
        x: CANVAS_WIDTH + 28,
        y: birdY,
        lockY: birdY,
        phase: 'follow',
        phaseT: 0,
        vx: -160,
        shotsFired: 0,
        shotCooldown: 0,
        bullets: []
    };
}

function fireBullet(bot: BugBot): void {
    bot.bullets.push({
        x: bot.x - 20,
        y: bot.lockY,
        vx: BULLET_VX,
        r: BULLET_R,
        hit: false
    });
    bot.shotsFired += 1;
    bot.shotCooldown = SHOT_GAP;
}

function updateBullets(bot: BugBot, dt: number): void {
    for (const bullet of bot.bullets) {
        bullet.x += bullet.vx * dt;
    }
    bot.bullets = bot.bullets.filter(bullet => !bullet.hit && bullet.x > -28);
}

export function updateBugBot(bot: BugBot, dt: number, birdY: number): void {
    bot.phaseT += dt;
    updateBullets(bot, dt);

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
            fireBullet(bot);
        }
        return;
    }

    if (bot.phase === 'shoot') {
        bot.y = bot.lockY;
        bot.shotCooldown -= dt;
        if (bot.shotsFired < SHOTS && bot.shotCooldown <= 0) {
            fireBullet(bot);
        }
        if (bot.phaseT >= SHOOT_END) {
            bot.phase = 'exit';
            bot.phaseT = 0;
            bot.vx = 260;
        }
        return;
    }

    bot.x += bot.vx * dt;
    bot.y = bot.lockY;
}

export function bulletHitsBird(
    bullet: BotBullet,
    hit: { x: number; y: number; w: number; h: number }
): boolean {
    if (bullet.hit) {
        return false;
    }
    const nx = Math.max(hit.x, Math.min(bullet.x, hit.x + hit.w));
    const ny = Math.max(hit.y, Math.min(bullet.y, hit.y + hit.h));
    const dx = bullet.x - nx;
    const dy = bullet.y - ny;
    return dx * dx + dy * dy <= bullet.r * bullet.r;
}

export function botOffscreen(bot: BugBot): boolean {
    return bot.phase === 'exit'
        && bot.x > CANVAS_WIDTH + 40
        && bot.bullets.length === 0;
}

export function botIsAttacking(bot: BugBot): boolean {
    return bot.phase === 'follow'
        || bot.phase === 'lock'
        || bot.phase === 'shoot'
        || bot.bullets.length > 0;
}

export function drawBugBot(ctx: CanvasRenderingContext2D, bot: BugBot): void {
    for (const bullet of bot.bullets) {
        drawBullet(ctx, bullet);
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

function drawBullet(ctx: CanvasRenderingContext2D, bullet: BotBullet): void {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.fillStyle = 'rgba(255, 180, 150, 0.45)';
    ctx.beginPath();
    ctx.ellipse(4, 0, bullet.r + 5, bullet.r + 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.ellipse(0, 0, bullet.r + 3, bullet.r - 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f3f3f3';
    ctx.beginPath();
    ctx.ellipse(-2, 0, 2.2, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
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
