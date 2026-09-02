import { GRID_SIZE } from './constants';
import { getSnake, type SnakeId } from './roster';

export function drawSnakeSegment(
    ctx: CanvasRenderingContext2D,
    id: SnakeId | string,
    x: number,
    y: number,
    isHead: boolean,
    scale = 1
): void {
    const snake = getSnake(id);
    const size = (isHead ? GRID_SIZE * 0.95 : GRID_SIZE * 0.9) * scale;
    const centerX = x * GRID_SIZE + GRID_SIZE / 2;
    const centerY = y * GRID_SIZE + GRID_SIZE / 2;
    const radius = size / 2;

    if (snake.kind === 'robot') {
        drawRobotSegment(ctx, centerX, centerY, radius, isHead, snake.color, snake.accent);
        return;
    }

    const gradient = ctx.createRadialGradient(
        centerX - radius / 3,
        centerY - radius / 3,
        0,
        centerX,
        centerY,
        radius
    );
    gradient.addColorStop(0, lighten(snake.color));
    gradient.addColorStop(1, snake.color);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    if (!isHead) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = snake.accent;
        ctx.globalAlpha = 0.45;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(centerX - radius / 3, centerY - radius / 3, radius / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();

    if (isHead) {
        ctx.fillStyle = '#1e1e1e';
        ctx.beginPath();
        ctx.arc(centerX + radius * 0.15, centerY - radius * 0.15, radius * 0.12, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function drawSnakePreview(
    ctx: CanvasRenderingContext2D,
    id: SnakeId | string,
    canvasW: number,
    canvasH: number
): void {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const cols = 5;
    const startX = 4;
    const startY = Math.floor(canvasH / GRID_SIZE / 2);
    for (let i = 0; i < cols; i++) {
        drawSnakeSegment(ctx, id, startX + i, startY, i === cols - 1, 1.15);
    }
}

function drawRobotSegment(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    isHead: boolean,
    color: string,
    accent: string
): void {
    ctx.fillStyle = accent;
    ctx.fillRect(cx - radius - 2, cy - radius * 0.5, radius * 0.45, radius);
    ctx.fillRect(cx + radius * 0.55, cy - radius * 0.5, radius * 0.45, radius);
    ctx.fillStyle = color;
    ctx.fillRect(cx - radius, cy - radius * 0.75, radius * 2, radius * 1.5);
    if (isHead) {
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(cx - radius * 0.2, cy - radius * 0.35, radius * 0.55, radius * 0.35);
        ctx.fillStyle = '#4ec9b0';
        ctx.fillRect(cx - radius * 0.05, cy - radius * 0.25, radius * 0.25, radius * 0.15);
    }
}

function lighten(hex: string): string {
    return hex;
}
