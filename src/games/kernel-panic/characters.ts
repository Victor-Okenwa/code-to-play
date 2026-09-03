import { getCharacter, type CharacterId } from './roster';

export function drawCraft(
    ctx: CanvasRenderingContext2D,
    id: CharacterId | string,
    x: number,
    y: number,
    w: number,
    h: number,
    thrusting: boolean,
    shield: boolean
): void {
    const character = getCharacter(id);
    const cx = x + w / 2;
    const by = y + h;

    ctx.save();

    if (shield) {
        ctx.strokeStyle = '#858585';
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, y + h / 2, 19, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    if (thrusting) {
        drawThrust(ctx, cx, by, character.body === 'rocket' ? 1 : 2);
    }

    switch (character.body) {
        case 'rocket':
            drawRocket(ctx, cx, y, w, h, character.color, character.accent);
            break;
        case 'alien':
            drawAlien(ctx, cx, y, w, h, character.color, character.accent);
            break;
        default:
            drawShip(ctx, cx, y, w, h, character.color, character.accent);
            break;
    }

    ctx.restore();
}

function drawThrust(ctx: CanvasRenderingContext2D, cx: number, by: number, jets: number): void {
    const flick = 6 + Math.random() * 5;
    const offsets = jets === 1 ? [0] : [-6, 6];
    for (const ox of offsets) {
        ctx.fillStyle = `rgba(126, 231, 255, ${0.55 + Math.random() * 0.45})`;
        ctx.beginPath();
        ctx.moveTo(cx + ox - 3.2, by);
        ctx.lineTo(cx + ox + 3.2, by);
        ctx.lineTo(cx + ox, by + flick);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.moveTo(cx + ox - 1.4, by);
        ctx.lineTo(cx + ox + 1.4, by);
        ctx.lineTo(cx + ox, by + flick * 0.55);
        ctx.closePath();
        ctx.fill();
    }
}

function drawShip(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    _w: number,
    h: number,
    color: string,
    accent: string
): void {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(cx - 4, y + 7);
    ctx.lineTo(cx - 21, y + 15);
    ctx.lineTo(cx - 19, y + 21);
    ctx.lineTo(cx - 3, y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 4, y + 7);
    ctx.lineTo(cx + 21, y + 15);
    ctx.lineTo(cx + 19, y + 21);
    ctx.lineTo(cx + 3, y + 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 4, y + 7);
    ctx.lineTo(cx - 21, y + 15);
    ctx.lineTo(cx - 18, y + 15.5);
    ctx.lineTo(cx - 4, y + 9);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 4, y + 7);
    ctx.lineTo(cx + 21, y + 15);
    ctx.lineTo(cx + 18, y + 15.5);
    ctx.lineTo(cx + 4, y + 9);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(cx - 22, y + 14, 6, 3);
    ctx.fillRect(cx + 16, y + 14, 6, 3);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx + 7, y + 8);
    ctx.lineTo(cx + 5, y + h - 2);
    ctx.lineTo(cx - 5, y + h - 2);
    ctx.lineTo(cx - 7, y + 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.moveTo(cx - 2.2, y + 5);
    ctx.lineTo(cx + 2.2, y + 5);
    ctx.lineTo(cx + 1.5, y + 9.5);
    ctx.lineTo(cx - 1.5, y + 9.5);
    ctx.closePath();
    ctx.fill();
}

function drawRocket(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    _w: number,
    h: number,
    color: string,
    accent: string
): void {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx + 7, y + 10);
    ctx.lineTo(cx - 7, y + 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = color;
    ctx.fillRect(cx - 6, y + 10, 12, h - 14);

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(cx - 6, y + h - 4);
    ctx.lineTo(cx - 11, y + h + 2);
    ctx.lineTo(cx - 6, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 6, y + h - 4);
    ctx.lineTo(cx + 11, y + h + 2);
    ctx.lineTo(cx + 6, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - 6, y + h - 4, 12, 4);

    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.ellipse(cx, y + 16, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawAlien(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    w: number,
    h: number,
    color: string,
    accent: string
): void {
    const cy = y + h / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.55, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = accent;
    for (const ox of [-8, 0, 8]) {
        ctx.beginPath();
        ctx.arc(cx + ox, cy - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.55, h * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
}
