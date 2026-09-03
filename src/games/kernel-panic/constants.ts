export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 480;

export const PLAYER_BASE_SPEED = 240;
export const PLAYER_SPEED_BONUS = 1.25;
export const FIRE_RATE_BONUS_MULT = 0.85;

export const DIAMOND_CHANCE: Record<string, number> = {
    easy: 0.1,
    medium: 0.15,
    hard: 0.2
};

export const RUSH_EVERY: Record<string, number> = {
    easy: 20,
    medium: 15,
    hard: 15
};

export const BOSS_HP = 20;
export const BOSS_SIZE = 100;
export const BOSS_SPEED_MULT = 0.5;
export const BOSS_MIN_DELAY = 8;
export const BOSS_MAX_DELAY = 15;
export const BOSS_WARN_FLASHES = 3;

export const RUSH_ALIEN_HITS = 4;
export const RUSH_LASER_COUNT = 3;

export const LOOT_GOLD_R = 7;
export const LOOT_DIAMOND_R = 8;
