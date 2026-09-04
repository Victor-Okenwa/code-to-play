import { DUAL_RUSH_CHANCE, RUSH_EVERY } from './constants';
import { createDetachedHead, createObstacleChunk, type TrackLoot, type TrackObstacle } from './track';

export interface ForcePush {
    timeLeft: number;
    phase: 'coins' | 'wave';
    dualQueued: boolean;
    spawnedHead: boolean;
}

export function rushEveryFor(difficulty: string): number {
    return RUSH_EVERY[difficulty] ?? 15;
}

export function createForcePush(dualFollow = false): ForcePush {
    return {
        timeLeft: 8,
        phase: 'coins',
        dualQueued: dualFollow,
        spawnedHead: false
    };
}

export function shouldDualRush(): boolean {
    return Math.random() < DUAL_RUSH_CHANCE;
}

export function tickForcePush(rush: ForcePush | null, dt: number): ForcePush | null {
    if (!rush) {
        return null;
    }
    rush.timeLeft -= dt;
    if (rush.timeLeft <= 4 && rush.phase === 'coins') {
        rush.phase = 'wave';
    }
    if (rush.timeLeft <= 0) {
        return null;
    }
    return rush;
}

export function spawnRushContent(
    rush: ForcePush,
    x: number,
    elapsed: number,
    difficulty: string,
    rushCount: number
): { obstacles: TrackObstacle[]; loot: TrackLoot[] } {
    if (rush.phase === 'coins') {
        const { loot } = createObstacleChunk(x, elapsed, difficulty, true);
        return { obstacles: [], loot: loot.filter(l => l.kind === 'coin' || l.kind === 'diamond') };
    }

    const chunk = createObstacleChunk(x, elapsed, difficulty, true);
    if (!rush.spawnedHead && rushCount >= 1 && Math.random() < 0.4) {
        rush.spawnedHead = true;
        chunk.obstacles.push(createDetachedHead(x + 90));
    }
    return chunk;
}

export function rushBannerAlpha(rush: ForcePush | null): number {
    if (!rush) {
        return 0;
    }
    return Math.min(1, rush.timeLeft / 2) * (0.7 + 0.3 * Math.sin(performance.now() / 120));
}
