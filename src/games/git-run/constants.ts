export const CANVAS_WIDTH = 520;
export const CANVAS_HEIGHT = 280;

/** Single ground line (feet) — landscape Chrome-dino style. */
export const GROUND_Y = 220;

export const PLAYER_X = 72;
export const PLAYER_W = 40;
export const PLAYER_H = 48;
/** Collision width (narrower than draw for fair jumps). */
export const PLAYER_HIT_W = 26;
export const JUMP_LIFT = 92;
/** Clearance under hanging bars when ducking (must exceed duck hitbox height). */
export const DUCK_GAP = 38;
export const BUG_BEHIND = 42;
/** Bug starts off-screen left and catches up. */
export const BUG_ENTER_X = -70;
export const BUG_CATCHUP_TIME = 2.4;

export const JUMP_DURATION = 0.78;
export const SLIDE_DURATION = 0.88;

export const SCROLL_BASE: Record<string, number> = {
    easy: 140,
    medium: 175,
    hard: 210
};

export const CATCH_DRIFT: Record<string, number> = {
    easy: 2.2,
    medium: 3.5,
    hard: 5.0
};

export const DIAMOND_CHANCE: Record<string, number> = {
    easy: 0.08,
    medium: 0.12,
    hard: 0.18
};

export const RUSH_EVERY: Record<string, number> = {
    easy: 20,
    medium: 15,
    hard: 15
};

export const DUAL_RUSH_CHANCE = 0.38;

export const COIN_R = 8;
export const DIAMOND_R = 9;
export const PICKUP_SIZE = 36;
export const HEALTH_PICKUP_SIZE = 46;

/** Minimum horizontal gap between consecutive obstacle chunks (px of scroll travel). */
export const SPAWN_GAP_BASE: Record<string, number> = {
    easy: 250,
    medium: 220,
    hard: 195
};
export const SPAWN_GAP_MIN = 175;
/** Spacing between a jump obstacle and the following duck obstacle in a pair. */
export const PAIR_GAP = 310;

export const SWALLOW_DURATION = 1.85;
export const BUG_FORM_EVERY = 7;

export const POWER_DURATION: Record<string, number> = {
    magnet: 6,
    jetpack: 13.5,
    x2: 6,
    boost: 0
};

export const POWER_DROP_WEIGHTS: Record<string, number> = {
    magnet: 32,
    x2: 28,
    shield: 14,
    jetpack: 14,
    boost: 8,
    health: 4
};

export const MAGNET_BASE_R = 70;
export const HIT_INVULN = 0.8;
export const CLEAN_STREAK = 3;
export const METER_HIT_SPIKE = 25;
export const METER_START = 15;
