import { CANVAS_HEIGHT, CANVAS_WIDTH, RUSH_ALIEN_HITS, RUSH_LASER_COUNT } from './constants';

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
    /** Lateral dodge velocity while locking in */
    dodgeVx: number;
    dodgeCooldown: number;
    weaveT: number;
}

/** Longer enter so the craft is visible before it engages. */
const ENTER = 2.1;
/** Longer lock-on before the first shot. */
const LOCK = 1.55;
const SHOT_GAP = 0.55;
const EXIT_AFTER = 0.5;
const LASER_VY = 260;
const ENTER_SPEED = 48;
const SHOOT_END = (RUSH_LASER_COUNT - 1) * SHOT_GAP + EXIT_AFTER;

/** Chance a rush spawns a second craft after the first finishes. */
export const DUAL_RUSH_CHANCE = 0.38;

export function rushEveryFor(difficulty: string): number {
    if (difficulty === 'easy') {
        return 20;
    }
    return 15;
}

export function createRushAlien(playerX: number, sideBias = 0): RushAlien {
    const baseX = playerX - 18 + sideBias;
    return {
        x: Math.max(16, Math.min(CANVAS_WIDTH - 60, baseX)),
        y: -48,
        w: 44,
        h: 28,
        phase: 'enter',
        phaseT: 0,
        lockX: playerX,
        shotsFired: 0,
        shotCooldown: 0,
        hitsTaken: 0,
        lasers: [],
        destroyed: false,
        dodgeVx: 0,
        dodgeCooldown: 0,
        weaveT: Math.random() * Math.PI * 2
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

function clampAlienX(alien: RushAlien): void {
    alien.x = Math.max(8, Math.min(CANVAS_WIDTH - alien.w - 8, alien.x));
}

/**
 * During enter/lock, weave and try to dodge nearby player bullets.
 */
function applyDodge(
    alien: RushAlien,
    dt: number,
    playerX: number,
    bullets: Array<{ x: number; y: number; w: number; h: number; vy: number }>
): void {
    alien.weaveT += dt;
    alien.dodgeCooldown = Math.max(0, alien.dodgeCooldown - dt);

    // Gentle weave so the craft keeps moving while locking
    const weave = Math.sin(alien.weaveT * 2.4) * 55;
    const targetX = playerX - alien.w / 2 + weave * 0.35;
    alien.x += (targetX - alien.x) * Math.min(1, dt * 1.6);

    if (alien.dodgeCooldown <= 0) {
        for (const bullet of bullets) {
            if (bullet.vy >= 0) {
                continue;
            }
            const dx = bullet.x + bullet.w / 2 - (alien.x + alien.w / 2);
            const dy = alien.y + alien.h - bullet.y;
            // Bullet rising toward the craft
            if (dy > 0 && dy < 160 && Math.abs(dx) < 28) {
                // ~70% chance to dodge this approach
                if (Math.random() < 0.7) {
                    const dir = dx >= 0 ? -1 : 1;
                    alien.dodgeVx = dir * (140 + Math.random() * 80);
                    alien.dodgeCooldown = 0.35 + Math.random() * 0.2;
                } else {
                    alien.dodgeCooldown = 0.15;
                }
                break;
            }
        }
    }

    if (alien.dodgeVx !== 0) {
        alien.x += alien.dodgeVx * dt;
        alien.dodgeVx *= Math.max(0, 1 - dt * 3.2);
        if (Math.abs(alien.dodgeVx) < 8) {
            alien.dodgeVx = 0;
        }
    }

    clampAlienX(alien);
}

export function updateRushAlien(
    alien: RushAlien,
    dt: number,
    playerX: number,
    bullets: Array<{ x: number; y: number; w: number; h: number; vy: number }> = []
): void {
    if (alien.destroyed) {
        for (const laser of alien.lasers) {
            laser.y += laser.vy * dt;
        }
        alien.lasers = alien.lasers.filter(laser => !laser.hit && laser.y < CANVAS_HEIGHT + 40);
        return;
    }

    alien.phaseT += dt;
    for (const laser of alien.lasers) {
        laser.y += laser.vy * dt;
    }
    alien.lasers = alien.lasers.filter(laser => !laser.hit && laser.y < CANVAS_HEIGHT + 40);

    if (alien.phase === 'enter') {
        alien.y += ENTER_SPEED * dt;
        applyDodge(alien, dt, playerX, bullets);
        if (alien.phaseT >= ENTER || alien.y >= 36) {
            alien.y = 36;
            alien.phase = 'lock';
            alien.phaseT = 0;
            alien.lockX = playerX;
            alien.dodgeVx = 0;
        }
        return;
    }

    if (alien.phase === 'lock') {
        alien.y = 36;
        applyDodge(alien, dt, playerX, bullets);
        // Slowly settle toward a lock aim while still able to dodge
        alien.lockX += (playerX - alien.lockX) * Math.min(1, dt * 1.2);
        if (alien.phaseT >= LOCK) {
            alien.phase = 'shoot';
            alien.phaseT = 0;
            alien.dodgeVx = 0;
            fireLaser(alien);
        }
        return;
    }

    if (alien.phase === 'shoot') {
        alien.y = 36;
        // Hold near lock aim; light tracking only
        alien.x += (alien.lockX - alien.w / 2 - alien.x) * Math.min(1, dt * 2.2);
        clampAlienX(alien);
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

    alien.y -= 120 * dt;
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
