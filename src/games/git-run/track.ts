import {
    CANVAS_WIDTH,
    COIN_R,
    DIAMOND_CHANCE,
    DIAMOND_R,
    DUCK_GAP,
    GROUND_Y,
    HEALTH_PICKUP_SIZE,
    PAIR_GAP,
    PICKUP_SIZE,
    POWER_DROP_WEIGHTS,
    SPAWN_GAP_BASE,
    SPAWN_GAP_MIN
} from './constants';

/** Ground obstacles need jump; high obstacles need duck. */
export type ObstacleKind = 'low' | 'high' | 'train';

export type ObstacleLook = 'tree' | 'bars' | 'grove';

export type PowerKind = 'magnet' | 'shield' | 'jetpack' | 'boost' | 'x2' | 'health';

export interface TrackObstacle {
    id: number;
    kind: ObstacleKind;
    look: ObstacleLook;
    x: number;
    w: number;
    h: number;
    hit: boolean;
    segs?: number;
}

export interface TrackLoot {
    id: number;
    kind: 'coin' | 'diamond' | PowerKind;
    x: number;
    /** Absolute center Y when set (sky / jetpack coins). */
    y?: number;
    r: number;
    taken: boolean;
}

let nextId = 1;

export function resetTrackIds(): void {
    nextId = 1;
}

export function spawnGap(elapsed: number, difficulty: string): number {
    const base = SPAWN_GAP_BASE[difficulty] ?? 185;
    const t = Math.min(1, elapsed / 100);
    return Math.max(SPAWN_GAP_MIN, base - t * 35);
}

function pickWeightedPower(): PowerKind {
    const entries = Object.entries(POWER_DROP_WEIGHTS) as [PowerKind, number][];
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * total;
    for (const [kind, w] of entries) {
        roll -= w;
        if (roll <= 0) {
            return kind;
        }
    }
    return 'magnet';
}

export function createObstacleChunk(
    x: number,
    elapsed: number,
    difficulty: string,
    rush: boolean
): { obstacles: TrackObstacle[]; loot: TrackLoot[]; extraGap: number } {
    const obstacles: TrackObstacle[] = [];
    const loot: TrackLoot[] = [];
    let extraGap = 0;
    const t = Math.min(1, elapsed / 80);
    const roll = Math.random();

    const pushObs = (partial: Omit<TrackObstacle, 'id' | 'hit' | 'x'> & { x?: number }): void => {
        obstacles.push({
            id: nextId++,
            hit: false,
            x,
            ...partial
        } as TrackObstacle);
    };

    if (rush && Math.random() < 0.4) {
        for (let i = 0; i < 5; i++) {
            loot.push({
                id: nextId++,
                kind: 'coin',
                x: x + i * 28,
                r: COIN_R,
                taken: false
            });
        }
        return { obstacles, loot, extraGap };
    }

    if (rush) {
        // During rush keep hazards single — pairs are too tight at high speed.
        if (Math.random() < 0.5) {
            pushObs({ kind: 'low', look: 'tree', w: 32, h: 40 });
        } else {
            pushObs({ kind: 'high', look: 'bars', w: 36, h: GROUND_Y - DUCK_GAP });
        }
        return { obstacles, loot, extraGap };
    }

    if (roll < 0.24) {
        for (let i = 0; i < 5; i++) {
            loot.push({
                id: nextId++,
                kind: 'coin',
                x: x + i * 26,
                r: COIN_R,
                taken: false
            });
        }
        if (Math.random() < (DIAMOND_CHANCE[difficulty] ?? 0.1)) {
            loot.push({
                id: nextId++,
                kind: 'diamond',
                x: x + 5 * 26,
                r: DIAMOND_R,
                taken: false
            });
        }
    } else if (roll < 0.58) {
        pushObs({
            kind: 'low',
            look: 'tree',
            w: 26 + Math.floor(Math.random() * 10),
            h: 34 + Math.floor(Math.random() * 10)
        });
    } else if (roll < 0.88) {
        pushObs({
            kind: 'high',
            look: 'bars',
            w: 28 + Math.floor(Math.random() * 14),
            h: GROUND_Y - DUCK_GAP
        });
    } else if (roll < 0.96 && t > 0.15) {
        pushObs({
            kind: 'train',
            look: 'grove',
            w: 24,
            h: 36,
            segs: 2 + Math.floor(Math.random() * 2)
        });
    } else {
        // Rare jump→duck pair with wide spacing (PAIR_GAP).
        pushObs({ kind: 'low', look: 'tree', w: 30, h: 38 });
        pushObs({ kind: 'high', look: 'bars', x: x + PAIR_GAP, w: 34, h: GROUND_Y - DUCK_GAP });
        extraGap = PAIR_GAP;
    }

    if (Math.random() < 0.12 + t * 0.08) {
        const power = pickWeightedPower();
        const size = power === 'health' ? HEALTH_PICKUP_SIZE : PICKUP_SIZE;
        loot.push({
            id: nextId++,
            kind: power,
            x: x + 60,
            r: size / 2,
            taken: false
        });
    } else if (Math.random() < (DIAMOND_CHANCE[difficulty] ?? 0.1) * 0.5) {
        loot.push({
            id: nextId++,
            kind: 'diamond',
            x: x + 50,
            r: DIAMOND_R,
            taken: false
        });
    }

    return { obstacles, loot, extraGap };
}

export function createDetachedHead(x: number): TrackObstacle {
    return {
        id: nextId++,
        kind: 'low',
        look: 'tree',
        x,
        w: 36,
        h: 48,
        hit: false
    };
}

export function obstacleHitbox(obs: TrackObstacle): { x: number; y: number; w: number; h: number } {
    if (obs.kind === 'train' || obs.kind === 'low') {
        // Collision is the trunk — canopy is visual only so jumps feel fair.
        const segs = obs.kind === 'train' ? (obs.segs ?? 2) : 1;
        const span = obs.kind === 'train' ? obs.w * segs + (segs - 1) * 10 : obs.w;
        const trunkW = Math.max(10, (obs.kind === 'train' ? obs.w : span) * 0.38);
        const trunkH = obs.h * 0.72;
        const boxX = obs.x + (span - trunkW) / 2;
        return {
            x: boxX,
            y: GROUND_Y - trunkH,
            w: trunkW,
            h: trunkH
        };
    }
    if (obs.kind === 'high') {
        // Vertical bars hanging from the top down to the duck gap.
        return {
            x: obs.x,
            y: 0,
            w: obs.w,
            h: GROUND_Y - DUCK_GAP
        };
    }
    return { x: obs.x, y: GROUND_Y - obs.h, w: obs.w, h: obs.h };
}

export function tickObstacle(obs: TrackObstacle, dt: number, scroll: number): void {
    obs.x -= scroll * dt;
}

function drawTree(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }): void {
    const trunkW = Math.max(7, box.w * 0.32);
    const trunkH = box.h * 0.4;
    const trunkX = box.x + (box.w - trunkW) / 2;
    const trunkY = box.y + box.h - trunkH;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(box.x + box.w / 2, GROUND_Y + 2, box.w * 0.45, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4a3418';
    ctx.fillRect(trunkX + 2, trunkY, trunkW, trunkH);
    ctx.fillStyle = '#7a5a32';
    ctx.fillRect(trunkX, trunkY, trunkW * 0.65, trunkH);
    ctx.fillStyle = '#9a7548';
    ctx.fillRect(trunkX, trunkY, 2.5, trunkH);

    const canopyR = box.w * 0.62;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h * 0.36;

    ctx.fillStyle = '#245a38';
    ctx.beginPath();
    ctx.arc(cx + 4, cy + 3, canopyR * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d8b57';
    ctx.beginPath();
    ctx.arc(cx, cy, canopyR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5ec97a';
    ctx.beginPath();
    ctx.arc(cx - canopyR * 0.28, cy - canopyR * 0.22, canopyR * 0.55, 0, Math.PI * 2);
    ctx.fill();
}

function drawIronBars(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }): void {
    const barCount = Math.max(3, Math.floor(box.w / 8));
    const gap = box.w / (barCount + 1);

    ctx.fillStyle = '#5a6068';
    ctx.fillRect(box.x - 4, 0, box.w + 8, 8);
    ctx.fillStyle = '#9aa0a8';
    ctx.fillRect(box.x - 4, 0, box.w + 8, 3);

    for (let i = 1; i <= barCount; i++) {
        const bx = box.x + gap * i - 2.5;
        ctx.fillStyle = '#3e444c';
        ctx.fillRect(bx + 2, 6, 4, box.h - 6);
        ctx.fillStyle = i % 2 === 0 ? '#8b929c' : '#6a717a';
        ctx.fillRect(bx, 6, 5, box.h - 6);
        ctx.fillStyle = 'rgba(230, 235, 240, 0.4)';
        ctx.fillRect(bx, 6, 1.5, box.h - 6);
        ctx.fillStyle = '#4a5058';
        ctx.beginPath();
        ctx.moveTo(bx, box.h);
        ctx.lineTo(bx + 5, box.h);
        ctx.lineTo(bx + 2.5, box.h + 5);
        ctx.closePath();
        ctx.fill();
    }

    ctx.fillStyle = '#7a8088';
    ctx.fillRect(box.x - 2, box.h - 5, box.w + 4, 5);
}

function drawGrove(ctx: CanvasRenderingContext2D, obs: TrackObstacle): void {
    const segs = obs.segs ?? 2;
    for (let i = 0; i < segs; i++) {
        const ox = obs.x + i * (obs.w + 10);
        drawTree(ctx, { x: ox, y: GROUND_Y - obs.h, w: obs.w, h: obs.h });
    }
}

export function drawObstacle(ctx: CanvasRenderingContext2D, obs: TrackObstacle): void {
    const box = obstacleHitbox(obs);
    ctx.save();
    if (obs.look === 'bars' || obs.kind === 'high') {
        drawIronBars(ctx, box);
    } else if (obs.look === 'grove' || obs.kind === 'train') {
        drawGrove(ctx, obs);
    } else {
        drawTree(ctx, box);
    }
    ctx.restore();
}

export function lootCenter(loot: TrackLoot): { x: number; y: number } {
    if (loot.y !== undefined) {
        return { x: loot.x, y: loot.y };
    }
    return { x: loot.x, y: GROUND_Y - 28 };
}

export function drawLoot(ctx: CanvasRenderingContext2D, loot: TrackLoot): void {
    if (loot.taken) {
        return;
    }
    const { x, y } = lootCenter(loot);
    ctx.save();
    if (loot.kind === 'coin') {
        ctx.fillStyle = '#dcdcaa';
        ctx.beginPath();
        ctx.arc(x, y, loot.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b0ad6a';
        ctx.beginPath();
        ctx.arc(x, y, loot.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
    } else if (loot.kind === 'diamond') {
        ctx.fillStyle = '#4fc1ff';
        ctx.beginPath();
        ctx.moveTo(x, y - loot.r);
        ctx.lineTo(x + loot.r, y);
        ctx.lineTo(x, y + loot.r);
        ctx.lineTo(x - loot.r, y);
        ctx.closePath();
        ctx.fill();
    } else if (loot.kind === 'jetpack') {
        // White pack + bluish-red flame pickup
        ctx.fillStyle = '#e8ecf0';
        ctx.beginPath();
        ctx.roundRect(x - 10, y - 9, 14, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x - 8, y - 7, 8, 12);
        ctx.fillStyle = '#6a7380';
        ctx.fillRect(x - 7, y + 7, 8, 3);
        const flame = ctx.createLinearGradient(x - 3, y + 10, x - 3, y + 22);
        flame.addColorStop(0, '#ff6b4a');
        flame.addColorStop(0.45, '#ff3d6e');
        flame.addColorStop(1, '#6eb6ff');
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.moveTo(x - 7, y + 10);
        ctx.lineTo(x + 1, y + 10);
        ctx.lineTo(x - 3, y + 22);
        ctx.closePath();
        ctx.fill();
    } else {
        const colors: Record<string, string> = {
            magnet: '#ce9178',
            shield: '#858585',
            boost: '#c586c0',
            x2: '#dcdcaa',
            health: '#4ec9b0'
        };
        ctx.fillStyle = colors[loot.kind] ?? '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, loot.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#1e1e1e';
        ctx.font = 'bold 11px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label =
            loot.kind === 'health' ? '+' : loot.kind === 'x2' ? '2x' : loot.kind.slice(0, 1).toUpperCase();
        ctx.fillText(label, x, y);
    }
    ctx.restore();
}

export function offscreen(x: number, w = 60): boolean {
    return x + w < -40;
}

export function spawnX(): number {
    return CANVAS_WIDTH + 40;
}
