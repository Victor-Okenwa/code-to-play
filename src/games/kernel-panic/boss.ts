import {
    BOSS_MAX_DELAY,
    BOSS_MIN_DELAY,
    BOSS_RED_SIZE,
    BOSS_SIZE,
    BOSS_SPEED_MULT,
    BOSS_WARN_FLASHES,
    CANVAS_WIDTH
} from './constants';

export type BossVariant = 'blue' | 'yellow' | 'red';

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
    variant: BossVariant;
}

interface BossDef {
    hp: number;
    size: number;
    outer: string;
    inner: string;
    bar: string;
    label: string;
    weight: number;
}

const BOSS_DEFS: Record<BossVariant, BossDef> = {
    blue: {
        hp: 30,
        size: BOSS_SIZE,
        outer: '#165a82',
        inner: '#4fc1ff',
        bar: '#4fc1ff',
        label: 'BLUE',
        weight: 45
    },
    yellow: {
        hp: 90,
        size: BOSS_SIZE,
        outer: '#b0ad6a',
        inner: '#dcdcaa',
        bar: '#dcdcaa',
        label: 'YELLOW',
        weight: 30
    },
    red: {
        hp: 180,
        size: BOSS_RED_SIZE,
        outer: '#be5046',
        inner: '#f48771',
        bar: '#f48771',
        label: 'RED',
        weight: 15
    }
};

export function nextBossDelay(): number {
    return BOSS_MIN_DELAY + Math.random() * (BOSS_MAX_DELAY - BOSS_MIN_DELAY);
}

export function pickBossVariant(): BossVariant {
    const entries = Object.entries(BOSS_DEFS) as Array<[BossVariant, BossDef]>;
    const total = entries.reduce((sum, [, def]) => sum + def.weight, 0);
    let roll = Math.random() * total;
    for (const [variant, def] of entries) {
        roll -= def.weight;
        if (roll <= 0) {
            return variant;
        }
    }
    return 'blue';
}

export function createBoss(threatSpeed: number): BossEnemy {
    const variant = pickBossVariant();
    const def = BOSS_DEFS[variant];
    const size = def.size;
    return {
        kind: 'boss',
        variant,
        x: (CANVAS_WIDTH - size) / 2,
        y: -size - 8,
        w: size,
        h: size,
        vy: threatSpeed * BOSS_SPEED_MULT,
        vx: (Math.random() - 0.5) * 20,
        hp: def.hp,
        maxHp: def.hp,
        waveId: 0,
        warned: false
    };
}

export function drawBoss(ctx: CanvasRenderingContext2D, boss: BossEnemy): void {
    const { x, y, w, h, hp, maxHp, variant } = boss;
    const def = BOSS_DEFS[variant];

    ctx.fillStyle = def.outer;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = def.inner;
    ctx.fillRect(x + 6, y + 6, w - 12, h - 12);

    ctx.fillStyle = '#1e1e1e';
    ctx.font = 'bold 12px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, x + w / 2, y + h / 2);

    const barW = w;
    const barH = 8;
    const barX = x;
    const barY = y - 14;
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = def.bar;
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
