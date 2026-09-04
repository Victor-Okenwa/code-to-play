import { CANVAS_HEIGHT, CANVAS_WIDTH, COIN_R, DIAMOND_R } from './constants';
import type { TrackLoot } from './track';

export type FormationKind =
    | 'square'
    | 'rectangle'
    | 'triangle'
    | 'chevron'
    | 'circle'
    | 'heptagon'
    | 'octagon';

const FORMATIONS: FormationKind[] = [
    'square',
    'rectangle',
    'triangle',
    'chevron',
    'circle',
    'heptagon',
    'octagon'
];

export const JETPACK_ASCEND = 1.35;
export const JETPACK_SKY = 13.5;
export const JETPACK_DESCEND = 1.45;
export const JETPACK_FLY_MID = CANVAS_HEIGHT * 0.42;
export const JETPACK_FLY_MIN = 36;
export const JETPACK_FLY_MAX = CANVAS_HEIGHT - 36;
export const FORMATION_SPACING = 175;

let lootId = 900000;

export function pickFormation(): FormationKind {
    return FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)] ?? 'circle';
}

export function buildSkyFormation(
    kind: FormationKind,
    includeDiamond: boolean,
    cx = CANVAS_WIDTH + 80,
    cy = JETPACK_FLY_MID
): TrackLoot[] {
    const points = shapePoints(kind, cx, cy);
    const coins: TrackLoot[] = points.map(([x, y]) => ({
        id: lootId++,
        kind: 'coin' as const,
        x,
        y,
        r: COIN_R,
        taken: false
    }));

    if (includeDiamond && points.length > 0) {
        coins.push({
            id: lootId++,
            kind: 'diamond',
            x: cx,
            y: cy,
            r: DIAMOND_R,
            taken: false
        });
    }

    return coins;
}

function shapePoints(kind: FormationKind, cx: number, cy: number): Array<[number, number]> {
    const radius = 52;
    switch (kind) {
        case 'square':
            return rectPoints(cx, cy, 78, 78, 4);
        case 'rectangle':
            return rectPoints(cx, cy, 110, 56, 5);
        case 'triangle':
            return polygonPoints(cx, cy, 3, radius, -Math.PI / 2, 4);
        case 'chevron':
            return chevronPoints(cx, cy);
        case 'circle':
            return polygonPoints(cx, cy, 14, radius, 0, 1);
        case 'heptagon':
            return polygonPoints(cx, cy, 7, radius, -Math.PI / 2, 3);
        case 'octagon':
            return polygonPoints(cx, cy, 8, radius, Math.PI / 8, 3);
        default:
            return polygonPoints(cx, cy, 12, radius, 0, 1);
    }
}

function rectPoints(
    cx: number,
    cy: number,
    w: number,
    h: number,
    perSide: number
): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    const left = cx - w / 2;
    const top = cy - h / 2;
    for (let i = 0; i < perSide; i++) {
        const t = i / Math.max(1, perSide - 1);
        points.push([left + t * w, top]);
        points.push([left + t * w, top + h]);
        if (i > 0 && i < perSide - 1) {
            points.push([left, top + t * h]);
            points.push([left + w, top + t * h]);
        }
    }
    return points;
}

function polygonPoints(
    cx: number,
    cy: number,
    sides: number,
    radius: number,
    rotation: number,
    perEdge: number
): Array<[number, number]> {
    const vertices: Array<[number, number]> = [];
    for (let i = 0; i < sides; i++) {
        const a = rotation + (Math.PI * 2 * i) / sides;
        vertices.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    }

    const points: Array<[number, number]> = [];
    for (let i = 0; i < sides; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % sides];
        if (!a || !b) {
            continue;
        }
        for (let p = 0; p < perEdge; p++) {
            const t = p / perEdge;
            points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
    }
    return points;
}

function chevronPoints(cx: number, cy: number): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    for (let i = 0; i < 7; i++) {
        const t = i / 6;
        points.push([cx - 40 + t * 55, cy - 28 + t * 28]);
        points.push([cx - 40 + t * 55, cy + 28 - t * 28]);
    }
    points.push([cx + 28, cy]);
    return points;
}

/** White jetpack with bluish-red propeller fire (drawn at hip, facing left/back). */
export function drawJetpackUnit(
    ctx: CanvasRenderingContext2D,
    cx: number,
    midY: number,
    t: number,
    thrust = 1
): void {
    ctx.save();
    // Pack body (white)
    ctx.fillStyle = '#d8dce3';
    ctx.beginPath();
    ctx.roundRect(cx - 16, midY - 10, 12, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#f4f6f8';
    ctx.beginPath();
    ctx.roundRect(cx - 15, midY - 9, 8, 16, 2);
    ctx.fill();
    // Straps
    ctx.strokeStyle = '#9aa3b0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 4, midY - 6);
    ctx.lineTo(cx + 4, midY - 4);
    ctx.moveTo(cx - 4, midY + 6);
    ctx.lineTo(cx + 4, midY + 4);
    ctx.stroke();

    // Propeller nozzle
    ctx.fillStyle = '#6a7380';
    ctx.fillRect(cx - 14, midY + 8, 8, 4);

    // Bluish-red fire
    const flicker = 0.7 + Math.sin(t * 28) * 0.3;
    const len = (10 + thrust * 10) * flicker;
    const grad = ctx.createLinearGradient(cx - 10, midY + 12, cx - 10, midY + 12 + len);
    grad.addColorStop(0, '#ff6b4a');
    grad.addColorStop(0.35, '#ff3d6e');
    grad.addColorStop(0.65, '#6eb6ff');
    grad.addColorStop(1, 'rgba(80, 160, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - 14, midY + 12);
    ctx.lineTo(cx - 6, midY + 12);
    ctx.lineTo(cx - 10 + Math.sin(t * 40) * 2, midY + 12 + len);
    ctx.closePath();
    ctx.fill();

    // Hot core
    ctx.fillStyle = 'rgba(255, 220, 180, 0.85)';
    ctx.beginPath();
    ctx.moveTo(cx - 12, midY + 12);
    ctx.lineTo(cx - 8, midY + 12);
    ctx.lineTo(cx - 10, midY + 12 + len * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}
