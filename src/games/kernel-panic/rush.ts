import { CANVAS_WIDTH, RUSH_ALIEN_HITS, RUSH_LASER_COUNT } from './constants';

export type AlienPhase = 'enter' | 'lock' | 'shoot' | 'exit';

export interface AlienLaser {
    x: number;
    y: number;
    w: number;
    h: number;
    vy: number;
    hit: boolean;
}

export interface RushAlien {
    x: number;
    y: number;
    w: number;
    h: number;
    phase: AlienPhase;
    phaseT: number;
    lockX: number;
    shotsFired: number;
    shotCooldown: number;
    hitsTaken: number;
    lasers: AlienLaser[];
    destroyed: boolean;
}

const ENTER = 0.9;
const LOCK = 0.35;
const SHOT_GAP = 0.4;
const EXIT_AFTER = 0.35;
const LASER_VY = 280;
const SHOOT_END = (RUSH_LASER_COUNT - 1) * SHOT_GAP + EXIT_AFTER;

export function rushEveryFor(difficulty: string): number {
    if (difficulty === 'easy') {
        return 20;
    }
    return 15;
}

export function createRushAlien(playerX: number): RushAlien {
    return {
        x: Math.max(20, Math.min(CANVAS_WIDTH - 56, playerX - 18)),
        y: -40,
        w: 44,
        h: 28,
        phase: 'enter',
        phaseT: 0,
        lockX: playerX,
        shotsFired: 0,
        shotCooldown: 0,
        hitsTaken: 0,
        lasers: [],
        destroyed: false
    };
}

function fireLaser(alien: RushAlien): void {
    alien.lasers.push({
        x: alien.x + alien.w / 2 - 2,
        y: alien.y + alien.h,
        w: 4,
        h: 14,
        vy: LASER_VY,
        hit: false
    });
    alien.shotsFired += 1;
    alien.shotCooldown = SHOT_GAP;
}

export function updateRushAlien(alien: RushAlien, dt: number, playerX: number): void {
    if (alien.destroyed) {
        for (const laser of alien.lasers) {
            laser.y += laser.vy * dt;
        }
        alien.lasers = alien.lasers.filter(laser => !laser.hit && laser.y < 520);
        return;
    }

    alien.phaseT += dt;
    for (const laser of alien.lasers) {
        laser.y += laser.vy * dt;
    }
    alien.lasers = alien.lasers.filter(laser => !laser.hit && laser.y < 520);

    if (alien.phase === 'enter') {
        alien.y += 90 * dt;
        alien.x += (playerX - alien.w / 2 - alien.x) * Math.min(1, dt * 4);
        if (alien.phaseT >= ENTER || alien.y >= 28) {
            alien.y = 28;
            alien.phase = 'lock';
            alien.phaseT = 0;
            alien.lockX = playerX;
        }
        return;
    }

    if (alien.phase === 'lock') {
        alien.y = 28;
        alien.x += (alien.lockX - alien.w / 2 - alien.x) * Math.min(1, dt * 5);
        if (alien.phaseT >= LOCK) {
            alien.phase = 'shoot';
            alien.phaseT = 0;
            fireLaser(alien);
        }
        return;
    }

    if (alien.phase === 'shoot') {
        alien.y = 28;
        alien.shotCooldown -= dt;
        if (alien.shotsFired < RUSH_LASER_COUNT && alien.shotCooldown <= 0) {
            fireLaser(alien);
        }
        if (alien.phaseT >= SHOOT_END) {
            alien.phase = 'exit';
            alien.phaseT = 0;
        }
        return;
    }

    alien.y -= 160 * dt;
}

export function hitRushAlien(alien: RushAlien): boolean {
    if (alien.destroyed) {
        return false;
    }
    alien.hitsTaken += 1;
    if (alien.hitsTaken >= RUSH_ALIEN_HITS) {
        alien.destroyed = true;
        return true;
    }
    return false;
}

export function rushAlienDone(alien: RushAlien): boolean {
    if (alien.destroyed) {
        return alien.lasers.length === 0;
    }
    return alien.phase === 'exit' && alien.y + alien.h < -20 && alien.lasers.length === 0;
}

export function drawRushAlien(ctx: CanvasRenderingContext2D, alien: RushAlien): void {
    if (alien.destroyed) {
        return;
    }
    const cx = alien.x + alien.w / 2;
    const cy = alien.y + alien.h / 2;

    ctx.fillStyle = '#4ec9b0';
    ctx.beginPath();
    ctx.ellipse(cx, cy, alien.w / 2, alien.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7ee7ff';
    for (const ox of [-10, 0, 10]) {
        ctx.beginPath();
        ctx.arc(cx + ox, cy - 1, 2.8, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = '#7ee7ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, alien.w / 2, alien.h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
}

export function drawAlienLaser(ctx: CanvasRenderingContext2D, laser: AlienLaser): void {
    ctx.fillStyle = '#f48771';
    ctx.fillRect(laser.x, laser.y, laser.w, laser.h);
    ctx.fillStyle = '#ffd7d0';
    ctx.fillRect(laser.x + 1, laser.y + 2, laser.w - 2, laser.h - 4);
}
