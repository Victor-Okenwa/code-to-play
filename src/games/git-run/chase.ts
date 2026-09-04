import { CATCH_DRIFT, CLEAN_STREAK, METER_HIT_SPIKE, METER_START } from './constants';

export interface ChaseState {
    meter: number;
    cleanTimer: number;
    rushBoost: number;
}

export function createChase(): ChaseState {
    return {
        meter: METER_START,
        cleanTimer: 0,
        rushBoost: 0
    };
}

export function tickChase(
    state: ChaseState,
    dt: number,
    difficulty: string,
    opts: { slowed?: boolean } = {}
): void {
    const drift = (CATCH_DRIFT[difficulty] ?? 3) * (opts.slowed ? 0.45 : 1) + state.rushBoost;
    state.meter = Math.min(100, state.meter + drift * dt);

    state.cleanTimer += dt;
    if (state.cleanTimer >= CLEAN_STREAK) {
        state.meter = Math.max(0, state.meter - 4 * dt);
    }
}

export function onHitSurvive(state: ChaseState): void {
    state.meter = Math.min(100, state.meter + METER_HIT_SPIKE);
    state.cleanTimer = 0;
}

export function onCoinLead(state: ChaseState, amount = 1): void {
    state.meter = Math.max(0, state.meter - amount);
}

export function isCaughtByMeter(state: ChaseState): boolean {
    return state.meter >= 100;
}

export function vignetteAlpha(meter: number): number {
    return Math.max(0, (meter - 40) / 80) * 0.55;
}
