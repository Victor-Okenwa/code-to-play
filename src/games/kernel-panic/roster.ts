export type Currency = 'gold' | 'diamonds';

export type CharacterId =
    | 'blue'
    | 'green'
    | 'yellow'
    | 'white'
    | 'red'
    | 'pink'
    | 'rocket'
    | 'alien';

export type CraftBody = 'ship' | 'rocket' | 'alien';

export interface CraftMods {
    speed: number;
    fireRateBonus: number;
    hpBonus: number;
    spreadShot: boolean;
}

export interface CraftCharacter {
    id: CharacterId;
    name: string;
    cost: number;
    currency: Currency;
    mods: CraftMods;
    color: string;
    accent: string;
    body: CraftBody;
}

const NONE: CraftMods = {
    speed: 1,
    fireRateBonus: 0,
    hpBonus: 0,
    spreadShot: false
};

export const CHARACTERS: readonly CraftCharacter[] = [
    {
        id: 'blue',
        name: 'Blue Spaceship',
        cost: 0,
        currency: 'gold',
        mods: NONE,
        color: '#3aa8e0',
        accent: '#165a82',
        body: 'ship'
    },
    {
        id: 'green',
        name: 'Green Spaceship',
        cost: 130,
        currency: 'gold',
        mods: NONE,
        color: '#4ec9b0',
        accent: '#2a8a78',
        body: 'ship'
    },
    {
        id: 'yellow',
        name: 'Yellow Spaceship',
        cost: 180,
        currency: 'gold',
        mods: NONE,
        color: '#dcdcaa',
        accent: '#b0ad6a',
        body: 'ship'
    },
    {
        id: 'white',
        name: 'White Spaceship',
        cost: 230,
        currency: 'gold',
        mods: NONE,
        color: '#e8e8e8',
        accent: '#a0a0a0',
        body: 'ship'
    },
    {
        id: 'red',
        name: 'Red Spaceship',
        cost: 30,
        currency: 'diamonds',
        mods: { ...NONE, fireRateBonus: 1 },
        color: '#f48771',
        accent: '#c45a4a',
        body: 'ship'
    },
    {
        id: 'pink',
        name: 'Pink Spaceship',
        cost: 280,
        currency: 'gold',
        mods: NONE,
        color: '#c586c0',
        accent: '#9b6b96',
        body: 'ship'
    },
    {
        id: 'rocket',
        name: 'Space Rocket',
        cost: 100,
        currency: 'diamonds',
        mods: { speed: 1.25, fireRateBonus: 1, hpBonus: 1, spreadShot: false },
        color: '#e8e8e8',
        accent: '#e06c75',
        body: 'rocket'
    },
    {
        id: 'alien',
        name: 'Alien Craft',
        cost: 500,
        currency: 'diamonds',
        mods: { speed: 1.25, fireRateBonus: 1, hpBonus: 1, spreadShot: true },
        color: '#4ec9b0',
        accent: '#7ee7ff',
        body: 'alien'
    }
];

export function getCharacter(id: string): CraftCharacter {
    return CHARACTERS.find(character => character.id === id) ?? CHARACTERS[0]!;
}

export function formatCost(character: CraftCharacter): string {
    if (character.cost === 0) {
        return 'Free';
    }
    return character.currency === 'gold'
        ? `${character.cost} gold`
        : `${character.cost} diamonds`;
}

export function formatMods(character: CraftCharacter): string {
    const parts: string[] = [];
    if (character.mods.speed > 1) {
        parts.push(`+${(character.mods.speed - 1).toFixed(2)}x speed`);
    }
    if (character.mods.fireRateBonus > 0) {
        parts.push(`+${character.mods.fireRateBonus} fire rate`);
    }
    if (character.mods.hpBonus > 0) {
        parts.push(`+${character.mods.hpBonus} HP`);
    }
    if (character.mods.spreadShot) {
        parts.push('spread shot');
    }
    return parts.length > 0 ? parts.join(' · ') : 'No special ability';
}
