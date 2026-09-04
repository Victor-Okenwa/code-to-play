import { getCharacter, type CharacterId, type RunnerKind } from './roster';
import { drawJetpackUnit } from './jetpack';

/**
 * Side-view runner facing right, with simple volume (shade + shadow) so it reads less flat.
 */
export function drawRunner(
    ctx: CanvasRenderingContext2D,
    id: CharacterId | string,
    x: number,
    y: number,
    w: number,
    h: number,
    opts: {
        jumping?: boolean;
        sliding?: boolean;
        shield?: boolean;
        jetpack?: boolean;
        t?: number;
        lift?: number;
        flying?: boolean;
        /** 0 upright → 1 fully horizontal (Superman lean). */
        flyLean?: number;
    } = {}
): void {
    const character = getCharacter(id);
    const sliding = Boolean(opts.sliding);
    const jumping = Boolean(opts.jumping);
    const flying = Boolean(opts.flying);
    const flyLean = Math.min(1, Math.max(0, opts.flyLean ?? (flying ? 1 : 0)));
    const lift = opts.lift ?? (jumping ? 28 : 0);
    const bodyH = sliding ? h * 0.42 : h;
    const feetY = y + h - lift;
    const bodyTop = feetY - bodyH;
    const t = opts.t ?? 0;
    const cx = x + w / 2;
    const midY = bodyTop + bodyH / 2;
    // Freeze run cycle while leaning into flight
    const runPhase = flyLean > 0.15 ? 0 : t * 14;

    ctx.save();

    // Ground contact shadow (depth cue) — fade when airborne / jetpacking
    if (!flying || lift < 50) {
        const shadowScale = jumping || flying ? 0.4 + (1 - Math.min(1, lift / 120)) * 0.5 : sliding ? 0.85 : 1;
        ctx.fillStyle = `rgba(0, 0, 0, ${flying ? 0.15 : 0.35})`;
        ctx.beginPath();
        ctx.ellipse(cx, y + h + 2, w * 0.42 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Smooth upright → horizontal lean (head leads to the right)
    if (flyLean > 0.001) {
        ctx.translate(cx, midY);
        ctx.rotate(flyLean * (Math.PI / 2));
        ctx.translate(-cx, -midY);
    }

    if (opts.shield) {
        ctx.strokeStyle = '#a0a0a0';
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(cx, bodyTop + bodyH / 2, w * 0.55, bodyH * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    if (opts.jetpack) {
        drawJetpackUnit(ctx, cx - 2, bodyTop + bodyH * 0.45, t, 0.85 + flyLean * 0.55);
    }

    drawSideProfile(
        ctx,
        cx,
        bodyTop,
        w,
        bodyH,
        character.color,
        character.accent,
        character.kind,
        character.gender === 'female',
        runPhase,
        sliding,
        jumping || flyLean > 0.2,
        flyLean
    );

    ctx.restore();
}

function shade(hex: string, amount: number): string {
    const n = hex.replace('#', '');
    const num = parseInt(n.length === 3 ? n.split('').map(c => c + c).join('') : n, 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + amount));
    const b = Math.min(255, Math.max(0, (num & 255) + amount));
    return `rgb(${r},${g},${b})`;
}

function drawSideProfile(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    w: number,
    h: number,
    color: string,
    accent: string,
    kind: RunnerKind,
    female: boolean,
    runPhase: number,
    sliding: boolean,
    jumping: boolean,
    flyLean = 0
): void {
    const light = shade(color, 35);
    const dark = shade(color, -40);
    const accentDark = shade(accent, -30);
    const legSwing = Math.sin(runPhase);
    const gliding = flyLean > 0.25;

    // Back cape / pack (depth behind body)
    if (kind === 'hero') {
        ctx.fillStyle = accentDark;
        ctx.beginPath();
        ctx.moveTo(cx - 4, y + h * 0.22);
        ctx.quadraticCurveTo(cx - 28, y + h * 0.55, cx - 10, y + h * 0.85);
        ctx.lineTo(cx + 2, y + h * 0.45);
        ctx.closePath();
        ctx.fill();
    }
    if (kind === 'adventurer') {
        ctx.fillStyle = accentDark;
        ctx.beginPath();
        ctx.roundRect(cx - w * 0.42, y + h * 0.28, 10, 16, 2);
        ctx.fill();
    }

    // Far leg (behind) — articulated thigh + shin, or trailing glide pose
    if (!sliding) {
        if (gliding) {
            drawGlideLeg(ctx, cx - 1, y + h * 0.52, accentDark, false, flyLean);
        } else {
            drawRunLeg(ctx, cx - 1, y + h * 0.52, runPhase + Math.PI, accentDark, jumping, false);
        }
    }

    // Torso (side slab with light/dark)
    const torsoW = sliding ? 22 : 16;
    const torsoH = h * (sliding ? 0.4 : 0.42);
    const torsoY = y + h * (sliding ? 0.35 : 0.22);
    const torsoX = cx - torsoW * 0.35;

    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.roundRect(torsoX + 3, torsoY + 1, torsoW, torsoH, 4);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(torsoX, torsoY, torsoW, torsoH, 4);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.fillRect(torsoX + 2, torsoY + 2, 4, torsoH - 4);

    if (kind === 'futurist') {
        ctx.fillStyle = accent;
        ctx.fillRect(torsoX + torsoW * 0.35, torsoY + 4, 5, torsoH - 8);
    }
    if (kind === 'hero') {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(torsoX + torsoW * 0.55, torsoY + 6);
        ctx.lineTo(torsoX + torsoW * 0.75, torsoY + 12);
        ctx.lineTo(torsoX + torsoW * 0.55, torsoY + 18);
        ctx.closePath();
        ctx.fill();
    }

    // Near leg (front)
    if (!sliding) {
        if (gliding) {
            drawGlideLeg(ctx, cx + 2, y + h * 0.52, accent, true, flyLean);
        } else {
            drawRunLeg(ctx, cx + 2, y + h * 0.52, runPhase, accent, jumping, true);
        }
    } else {
        // Duck: crouched legs
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.ellipse(cx + 4, y + h - 4, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e1e1e';
        ctx.beginPath();
        ctx.ellipse(cx + 14, y + h - 2, 8, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Arms — glide: both stretch forward; else run pump
    if (gliding) {
        const reach = 10 + flyLean * 8;
        ctx.strokeStyle = dark;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 2, torsoY + 6);
        ctx.lineTo(cx + reach - 4, torsoY + 2);
        ctx.stroke();
        ctx.strokeStyle = light;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx + 6, torsoY + 8);
        ctx.lineTo(cx + reach + 6, torsoY + 4);
        ctx.stroke();
    } else {
        const armPhase = -legSwing;
        ctx.strokeStyle = dark;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 2, torsoY + 6);
        ctx.lineTo(cx - 10 + armPhase * 4, torsoY + torsoH * 0.75 + (sliding ? 4 : armPhase * 5));
        ctx.stroke();

        ctx.strokeStyle = light;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx + 6, torsoY + 8);
        ctx.lineTo(cx + 14 - armPhase * 5, torsoY + 6 + (jumping ? -8 : -armPhase * 6));
        ctx.stroke();
    }

    // Head in profile
    const headR = female ? 8 : 8.5;
    const headX = cx + 6;
    const headY = sliding ? y + headR + 4 : y + headR + 2;

    if (kind === 'alien') {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(headX + 1, headY + 1, headR + 3, headR + 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(headX, headY, headR + 2, headR + 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e1e1e';
        ctx.beginPath();
        ctx.ellipse(headX + 4, headY - 1, 4, 5, 0.2, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Skull shadow
        ctx.fillStyle = '#c4a88a';
        ctx.beginPath();
        ctx.arc(headX + 1, headY + 1, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8d5c4';
        ctx.beginPath();
        ctx.arc(headX, headY, headR, 0, Math.PI * 2);
        ctx.fill();
        // Nose (profile)
        ctx.fillStyle = '#d4b89a';
        ctx.beginPath();
        ctx.moveTo(headX + headR - 2, headY);
        ctx.lineTo(headX + headR + 4, headY + 2);
        ctx.lineTo(headX + headR - 2, headY + 5);
        ctx.closePath();
        ctx.fill();
        // Eye
        ctx.fillStyle = '#1e1e1e';
        ctx.beginPath();
        ctx.arc(headX + 3, headY - 1, 1.8, 0, Math.PI * 2);
        ctx.fill();
        if (female) {
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.arc(headX - 2, headY - 2, headR + 1, Math.PI * 0.9, Math.PI * 1.85);
            ctx.fill();
        }
        if (kind === 'hero') {
            ctx.fillStyle = color;
            ctx.fillRect(headX - headR + 2, headY - 4, headR * 1.6, 5);
        }
    }

    if (kind === 'alien') {
        ctx.fillStyle = 'rgba(181, 206, 168, 0.25)';
        ctx.beginPath();
        ctx.ellipse(headX, headY, headR + 5, headR + 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

/** Articulated thigh + shin run cycle (side view, facing right). */
function drawRunLeg(
    ctx: CanvasRenderingContext2D,
    hipX: number,
    hipY: number,
    phase: number,
    color: string,
    jumping: boolean,
    near: boolean
): void {
    const swing = jumping ? Math.sin(phase) * 0.35 : Math.sin(phase) * 0.85;
    // Bend more on the recovery / trailing side of the stride
    const bend = jumping
        ? 0.45
        : 0.25 + Math.max(0, Math.cos(phase)) * 0.95;

    const thighLen = 11;
    const shinLen = 12;
    const thighA = swing;
    const shinA = swing + bend;

    const kneeX = hipX + Math.sin(thighA) * thighLen;
    const kneeY = hipY + Math.cos(thighA) * thighLen;
    const footX = kneeX + Math.sin(shinA) * shinLen;
    const footY = kneeY + Math.cos(shinA) * shinLen;

    ctx.strokeStyle = color;
    ctx.lineWidth = near ? 5.5 : 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    // Knee joint
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(kneeX, kneeY, near ? 2.4 : 2, 0, Math.PI * 2);
    ctx.fill();

    // Shoe pointing forward
    ctx.fillStyle = near ? '#1e1e1e' : '#2a2a2a';
    ctx.beginPath();
    ctx.ellipse(footX + 3, footY + 1, near ? 7.5 : 6.5, 3.2, 0.12, 0, Math.PI * 2);
    ctx.fill();
}

/** Static trailing legs for horizontal jetpack glide. */
function drawGlideLeg(
    ctx: CanvasRenderingContext2D,
    hipX: number,
    hipY: number,
    color: string,
    near: boolean,
    lean: number
): void {
    // Angle back (negative = behind torso when upright; reads as trailing when rotated horizontal)
    const trail = -0.55 - lean * 0.35 + (near ? 0.08 : -0.08);
    const thighLen = 11;
    const shinLen = 11;
    const kneeX = hipX + Math.sin(trail) * thighLen;
    const kneeY = hipY + Math.cos(trail) * thighLen;
    const shinA = trail + 0.15;
    const footX = kneeX + Math.sin(shinA) * shinLen;
    const footY = kneeY + Math.cos(shinA) * shinLen;

    ctx.strokeStyle = color;
    ctx.lineWidth = near ? 5.5 : 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    ctx.fillStyle = near ? '#1e1e1e' : '#2a2a2a';
    ctx.beginPath();
    ctx.ellipse(footX + 2, footY + 1, near ? 7 : 6, 3, 0.2, 0, Math.PI * 2);
    ctx.fill();
}

export type BugForm = 'bug' | 'ladybug' | 'mosquito' | 'frog';

const BUG_FORMS: BugForm[] = ['bug', 'ladybug', 'mosquito', 'frog'];

export function nextBugForm(current: BugForm): BugForm {
    const idx = BUG_FORMS.indexOf(current);
    let next = BUG_FORMS[Math.floor(Math.random() * BUG_FORMS.length)]!;
    if (next === current && BUG_FORMS.length > 1) {
        next = BUG_FORMS[(idx + 1) % BUG_FORMS.length]!;
    }
    return next;
}

export function drawBugMan(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    opts: {
        meter?: number;
        form?: BugForm;
        t?: number;
        mouthOpen?: number;
        scaleBoost?: number;
        hop?: number;
    } = {}
): void {
    const meter = opts.meter ?? 0;
    const form = opts.form ?? 'bug';
    const t = opts.t ?? 0;
    const mouthOpen = Math.min(1, Math.max(0, opts.mouthOpen ?? 0));
    const lean = Math.min(14, meter * 0.14);
    const hop = opts.hop ?? Math.sin(t * 9) * 3;
    const legCycle = Math.sin(t * 14);
    const scale = (1 + meter / 220) * (opts.scaleBoost ?? 1);

    ctx.save();
    ctx.translate(x, y - hop);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 2 + hop * 0.4, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (form === 'frog') {
        drawFrogBug(ctx, lean, mouthOpen, legCycle);
    } else if (form === 'mosquito') {
        drawMosquitoBug(ctx, lean, mouthOpen, t, legCycle);
    } else if (form === 'ladybug') {
        drawLadybug(ctx, lean, mouthOpen, legCycle);
    } else {
        drawDefaultBug(ctx, lean, mouthOpen, legCycle);
    }

    ctx.restore();
}

function drawDefaultBug(
    ctx: CanvasRenderingContext2D,
    lean: number,
    mouthOpen: number,
    legCycle: number
): void {
    ctx.fillStyle = '#c45a48';
    ctx.beginPath();
    ctx.ellipse(2, -12 - lean * 0.15, 12, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f48771';
    ctx.beginPath();
    ctx.ellipse(0, -14 - lean * 0.15, 11, 9, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#c45a48';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -20);
    ctx.quadraticCurveTo(-10, -32, -14, -28);
    ctx.moveTo(4, -22);
    ctx.quadraticCurveTo(8, -34, 12, -30);
    ctx.stroke();

    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(6, -15, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    ctx.fillStyle = '#5a2018';
    ctx.beginPath();
    ctx.ellipse(8, -8, 4 + mouthOpen * 8, 2 + mouthOpen * 7, 0, 0, Math.PI * 2);
    ctx.fill();

    drawBugLegs(ctx, '#f48771', legCycle);
}

function drawLadybug(
    ctx: CanvasRenderingContext2D,
    lean: number,
    mouthOpen: number,
    legCycle: number
): void {
    ctx.fillStyle = '#8b1a1a';
    ctx.beginPath();
    ctx.ellipse(1, -12 - lean * 0.1, 13, 11, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e63939';
    ctx.beginPath();
    ctx.ellipse(-1, -14, 12, 10, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Spots
    ctx.fillStyle = '#1e1e1e';
    for (const [sx, sy] of [
        [-4, -16],
        [4, -12],
        [-2, -8],
        [5, -18]
    ] as const) {
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
    }
    // Head
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.ellipse(10, -14, 5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(12, -15, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a1010';
    ctx.beginPath();
    ctx.ellipse(12, -9, 3 + mouthOpen * 6, 1.5 + mouthOpen * 6, 0, 0, Math.PI * 2);
    ctx.fill();
    drawBugLegs(ctx, '#1e1e1e', legCycle);
}

function drawMosquitoBug(
    ctx: CanvasRenderingContext2D,
    lean: number,
    mouthOpen: number,
    t: number,
    legCycle: number
): void {
    // Wings
    ctx.fillStyle = 'rgba(200, 220, 240, 0.45)';
    const wing = Math.sin(t * 40) * 4;
    ctx.beginPath();
    ctx.ellipse(-4, -22 + wing, 10, 4, -0.4, 0, Math.PI * 2);
    ctx.ellipse(2, -24 - wing, 9, 3.5, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5a6a4a';
    ctx.beginPath();
    ctx.ellipse(0, -12 - lean * 0.1, 7, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a9a6a';
    ctx.beginPath();
    ctx.ellipse(-1, -14, 6, 10, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Proboscis / mouth
    ctx.strokeStyle = '#3a4028';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, -10);
    ctx.lineTo(14 + mouthOpen * 6, -4 + mouthOpen * 4);
    ctx.stroke();
    if (mouthOpen > 0.2) {
        ctx.fillStyle = '#2a3018';
        ctx.beginPath();
        ctx.ellipse(8, -8, 3 + mouthOpen * 5, 2 + mouthOpen * 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(4, -18, 2.2, 0, Math.PI * 2);
    ctx.fill();

    drawBugLegs(ctx, '#5a6a4a', legCycle * 1.2);
}

function drawFrogBug(
    ctx: CanvasRenderingContext2D,
    lean: number,
    mouthOpen: number,
    legCycle: number
): void {
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.ellipse(1, -10 - lean * 0.1, 14, 11, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40916c';
    ctx.beginPath();
    ctx.ellipse(-1, -12, 13, 10, 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Eyes on stalks
    ctx.fillStyle = '#40916c';
    ctx.beginPath();
    ctx.arc(-4, -22, 5, 0, Math.PI * 2);
    ctx.arc(6, -23, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(-3, -22, 2, 0, Math.PI * 2);
    ctx.arc(7, -23, 2, 0, Math.PI * 2);
    ctx.fill();

    // Wide mouth
    ctx.fillStyle = '#1b4332';
    ctx.beginPath();
    ctx.ellipse(4, -6, 8 + mouthOpen * 10, 2 + mouthOpen * 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (mouthOpen > 0.15) {
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.ellipse(6, -4, 4, 3 + mouthOpen * 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Hop legs
    ctx.strokeStyle = '#2d6a4f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.quadraticCurveTo(-14, 4 + legCycle * 3, -10, 10);
    ctx.moveTo(6, -2);
    ctx.quadraticCurveTo(14, 4 - legCycle * 3, 12, 10);
    ctx.stroke();
}

function drawBugLegs(ctx: CanvasRenderingContext2D, color: string, legCycle: number): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(-12 - legCycle * 3, 8);
    ctx.moveTo(0, -3);
    ctx.lineTo(-2 + legCycle * 2, 9);
    ctx.moveTo(5, -4);
    ctx.lineTo(10 + legCycle * 3, 8);
    ctx.stroke();
}

export function drawPreview(
    ctx: CanvasRenderingContext2D,
    id: CharacterId | string,
    canvasW: number,
    canvasH: number
): void {
    ctx.clearRect(0, 0, canvasW, canvasH);
    const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, '#1a2230');
    grad.addColorStop(1, '#141820');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = 'rgba(30, 34, 42, 0.95)';
    ctx.fillRect(0, canvasH - 36, canvasW, 36);
    ctx.strokeStyle = 'rgba(86, 156, 214, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, canvasH - 36);
    ctx.lineTo(canvasW, canvasH - 36);
    ctx.stroke();

    const w = 52;
    const h = 68;
    drawRunner(ctx, id, (canvasW - w) / 2, canvasH - 36 - h, w, h, {
        t: performance.now() / 1000
    });
}
