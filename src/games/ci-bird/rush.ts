import { CANVAS_HEIGHT, CANVAS_WIDTH, COIN_RADIUS } from './constants';

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

export interface Collectible {
    x: number;
    y: number;
    kind: 'gold' | 'diamond';
    r: number;
    taken: boolean;
}

export function pickFormation(): FormationKind {
    return FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)] ?? 'circle';
}

export function rushInterval(base: number, elapsed: number): number {
    const t = Math.min(1, elapsed / 120);
    return Math.max(base * 0.7, base * (1 - 0.3 * t));
}

export function rushDuration(elapsed: number): number {
    const t = Math.min(1, elapsed / 140);
    const min = 5 + 3 * t;
    const max = Math.min(10, 6.5 + 3.5 * t);
    return min + Math.random() * Math.max(0.2, max - min);
}

export function bugBotCount(elapsed: number): number {
    return Math.min(5, 1 + Math.floor(elapsed / 28));
}

export function buildFormation(
    kind: FormationKind,
    includeDiamond: boolean
): Collectible[] {
    const cx = CANVAS_WIDTH * 0.62;
    const cy = CANVAS_HEIGHT * 0.48;
    const points = shapePoints(kind, cx, cy);
    const coins: Collectible[] = points.map(([x, y]) => ({
        x,
        y,
        kind: 'gold' as const,
        r: COIN_RADIUS,
        taken: false
    }));

    if (includeDiamond && points.length > 0) {
        coins.push({
            x: cx,
            y: cy,
            kind: 'diamond',
            r: 8,
            taken: false
        });
    }

    return coins;
}

function shapePoints(kind: FormationKind, cx: number, cy: number): Array<[number, number]> {
    const radius = 78;
    switch (kind) {
        case 'square':
            return rectPoints(cx, cy, 110, 110, 5);
        case 'rectangle':
            return rectPoints(cx, cy, 150, 80, 6);
        case 'triangle':
            return polygonPoints(cx, cy, 3, radius, -Math.PI / 2, 5);
        case 'chevron':
            return chevronPoints(cx, cy);
        case 'circle':
            return polygonPoints(cx, cy, 16, radius, 0, 1);
        case 'heptagon':
            return polygonPoints(cx, cy, 7, radius, -Math.PI / 2, 4);
        case 'octagon':
            return polygonPoints(cx, cy, 8, radius, Math.PI / 8, 4);
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
    for (let i = 0; i < 8; i++) {
        const t = i / 7;
        points.push([cx - 50 + t * 70, cy - 40 + t * 40]);
        points.push([cx - 50 + t * 70, cy + 40 - t * 40]);
    }
    points.push([cx + 40, cy]);
    return points;
}
