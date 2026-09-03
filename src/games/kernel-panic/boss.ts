import {
    BOSS_HP,
    BOSS_MAX_DELAY,
    BOSS_MIN_DELAY,
    BOSS_SIZE,
    BOSS_SPEED_MULT,
    BOSS_WARN_FLASHES,
    CANVAS_WIDTH
} from './constants';

export interface BossEnemy {
    x: number;
    y: number;
    w: number;
    h: number;
    vy: number;
    vx: number;
    hp: number;
    maxHp: number;
    waveId: number;
    warned: boolean;
    kind: 'boss';
}

export function nextBossDelay(): number {
    return BOSS_MIN_DELAY + Math.random() * (BOSS_MAX_DELAY - BOSS_MIN_DELAY);
}

export function createBoss(threatSpeed: number): BossEnemy {
    const size = BOSS_SIZE;
    return {
        kind: 'boss',
        x: (CANVAS_WIDTH - size) / 2,
        y: -size - 8,
        w: size,
        h: size,
        vy: threatSpeed * BOSS_SPEED_MULT,
        vx: (Math.random() - 0.5) * 20,
        hp: BOSS_HP,
        maxHp: BOSS_HP,
        waveId: 0,
        warned: false
    };
}

export function drawBoss(ctx: CanvasRenderingContext2D, boss: BossEnemy): void {
    const { x, y, w, h, hp, maxHp } = boss;

    ctx.fillStyle = '#be5046';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#f48771';
    ctx.fillRect(x + 6, y + 6, w - 12, h - 12);

    ctx.fillStyle = '#1e1e1e';
    ctx.font = 'bold 14px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOSS', x + w / 2, y + h / 2);

    const barW = w;
    const barH = 8;
    const barX = x;
    const barY = y - 14;
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#f48771';
    ctx.fillRect(barX, barY, barW * (hp / maxHp), barH);
    ctx.strokeStyle = '#d4d4d4';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
}

export function bossWarningFlashAlpha(warnT: number, flashCount = BOSS_WARN_FLASHES): number {
    if (warnT <= 0) {
        return 0;
    }
    const period = 0.35;
    const total = flashCount * period;
    if (warnT > total) {
        return 0;
    }
    const phase = (warnT % period) / period;
    return phase < 0.5 ? 0.35 * (1 - phase * 2) : 0;
}

export { BOSS_WARN_FLASHES };
