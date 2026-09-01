import { BIRD_H, BIRD_W } from './constants';
import { getCharacter, type CharacterId } from './roster';

export function drawBird(
    ctx: CanvasRenderingContext2D,
    id: CharacterId | string,
    x: number,
    y: number,
    vy: number,
    scale = 1
): void {
    const character = getCharacter(id);
    const tilt = Math.max(-0.55, Math.min(0.7, vy / 480));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(scale, scale);

    switch (character.body) {
        case 'pelican':
            drawPelican(ctx, character.color, character.wing);
            break;
        case 'swan':
            drawSwan(ctx, character.color, character.wing);
            break;
        case 'eagle':
            drawEagle(ctx, character.color, character.wing);
            break;
        case 'robo':
            drawRobo(ctx, character.color, character.wing);
            break;
        case 'wood':
            drawWood(ctx, character.color, character.wing);
            break;
        default:
            drawOval(ctx, character.color, character.wing);
            break;
    }

    ctx.restore();
}

function drawOval(ctx: CanvasRenderingContext2D, color: string, wing: string): void {
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.ellipse(-10, 2, 7, 4, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_W / 2, BIRD_H / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e1e1e';
    ctx.font = 'bold 8px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('{ }', 0, 1);

    ctx.beginPath();
    ctx.arc(7, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ce9178';
    ctx.beginPath();
    ctx.moveTo(11, -1);
    ctx.lineTo(18, 1);
    ctx.lineTo(11, 3);
    ctx.closePath();
    ctx.fill();
}

function drawPelican(ctx: CanvasRenderingContext2D, color: string, wing: string): void {
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.ellipse(-8, 4, 10, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dcdcaa';
    ctx.beginPath();
    ctx.ellipse(14, 4, 8, 4, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(6, -3, 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawSwan(ctx: CanvasRenderingContext2D, color: string, wing: string): void {
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.ellipse(-6, 3, 11, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 2, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, -2);
    ctx.quadraticCurveTo(14, -12, 16, -4);
    ctx.stroke();
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(15, -5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ce9178';
    ctx.beginPath();
    ctx.moveTo(16, -4);
    ctx.lineTo(22, -3);
    ctx.lineTo(16, -1);
    ctx.fill();
}

function drawEagle(ctx: CanvasRenderingContext2D, color: string, wing: string): void {
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.moveTo(-16, 2);
    ctx.lineTo(-2, -6);
    ctx.lineTo(4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.lineTo(16, -8);
    ctx.lineTo(8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(6, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f48771';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(18, 2);
    ctx.lineTo(10, 4);
    ctx.fill();
}

function drawRobo(ctx: CanvasRenderingContext2D, color: string, wing: string): void {
    ctx.fillStyle = wing;
    ctx.fillRect(-14, -3, 8, 8);
    ctx.fillRect(6, -3, 8, 8);
    ctx.fillStyle = color;
    ctx.fillRect(-8, -7, 16, 14);
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(2, -4, 5, 4);
    ctx.fillStyle = '#4ec9b0';
    ctx.fillRect(3, -3, 3, 2);
    ctx.fillStyle = '#dcdcaa';
    ctx.fillRect(8, 0, 7, 3);
}

function drawWood(ctx: CanvasRenderingContext2D, color: string, wing: string): void {
    ctx.fillStyle = wing;
    ctx.fillRect(-13, -2, 9, 7);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.lineTo(10, -6);
    ctx.lineTo(12, 8);
    ctx.lineTo(-9, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3e3e42';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(8, -2);
    ctx.moveTo(-5, 2);
    ctx.lineTo(7, 4);
    ctx.stroke();
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(4, -3, 3, 3);
    ctx.fillStyle = '#ce9178';
    ctx.fillRect(10, 0, 6, 3);
}
