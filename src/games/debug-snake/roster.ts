export type Currency = 'bugs' | 'pink';

export type SnakeId = 'green' | 'blue' | 'yellow' | 'purple' | 'red' | 'robot';

export interface SnakeMods {
    speed: number;
    resurrection: number;
}

export interface SnakeCharacter {
    id: SnakeId;
    name: string;
    cost: number;
    currency: Currency;
    mods: SnakeMods;
    color: string;
    accent: string;
    kind: 'standard' | 'robot';
}

const NONE: SnakeMods = { speed: 1, resurrection: 0 };

export const SNAKES: readonly SnakeCharacter[] = [
    {
        id: 'green',
        name: 'Green Snake',
        cost: 0,
        currency: 'bugs',
        mods: NONE,
        color: '#4ec9b0',
        accent: '#2e7d6c',
        kind: 'standard'
    },
    {
        id: 'blue',
        name: 'Blue Snake',
        cost: 100,
        currency: 'bugs',
        mods: NONE,
        color: '#4fc1ff',
        accent: '#2b8cc4',
        kind: 'standard'
    },
    {
        id: 'yellow',
        name: 'Yellow Snake',
        cost: 150,
        currency: 'bugs',
        mods: NONE,
        color: '#dcdcaa',
        accent: '#cecb7a',
        kind: 'standard'
    },
    {
        id: 'purple',
        name: 'Purple Snake',
        cost: 170,
        currency: 'bugs',
        mods: NONE,
        color: '#c586c0',
        accent: '#9b6b96',
        kind: 'standard'
    },
    {
        id: 'red',
        name: 'Red Snake',
        cost: 150,
        currency: 'pink',
        mods: { speed: 1.15, resurrection: 0 },
        color: '#f48771',
        accent: '#d16969',
        kind: 'standard'
    },
    {
        id: 'robot',
        name: 'Robot Snake',
        cost: 400,
        currency: 'pink',
        mods: { speed: 1.15, resurrection: 1 },
        color: '#9cdcfe',
        accent: '#569cd6',
        kind: 'robot'
    }
];

export function getSnake(id: string): SnakeCharacter {
    return SNAKES.find(snake => snake.id === id) ?? SNAKES[0]!;
}

export function formatCost(snake: SnakeCharacter): string {
    if (snake.cost === 0) {
        return 'Free';
    }
    return snake.currency === 'bugs'
        ? `${snake.cost} bugs`
        : `${snake.cost} pink balls`;
}

export function formatMods(snake: SnakeCharacter): string {
    const parts: string[] = [];
    if (snake.mods.speed > 1) {
        parts.push(`+${(snake.mods.speed - 1).toFixed(2)} speed`);
    }
    if (snake.mods.resurrection > 0) {
        parts.push(`+${snake.mods.resurrection} resurrection`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'No special ability';
}
