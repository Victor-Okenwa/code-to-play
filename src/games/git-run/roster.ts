export type Currency = 'coins' | 'diamonds';

export type CharacterId =
    | 'main'
    | 'feat'
    | 'hotfix'
    | 'dev'
    | 'bisect'
    | 'release'
    | 'rebase'
    | 'origin';

export type RunnerKind = 'human' | 'adventurer' | 'futurist' | 'alien' | 'hero';
export type Gender = 'male' | 'female';

export interface RunnerMods {
    jumpHang: number;
    slideHang: number;
    magnetBonus: number;
    hpBonus: number;
}

export interface RunnerCharacter {
    id: CharacterId;
    name: string;
    cost: number;
    currency: Currency;
    mods: RunnerMods;
    color: string;
    accent: string;
    kind: RunnerKind;
    gender: Gender;
}

const NONE: RunnerMods = {
    jumpHang: 1,
    slideHang: 1,
    magnetBonus: 0,
    hpBonus: 0
};

export const CHARACTERS: readonly RunnerCharacter[] = [
    {
        id: 'main',
        name: 'Bob Main',
        cost: 0,
        currency: 'coins',
        mods: NONE,
        color: '#4fc1ff',
        accent: '#2b8cc4',
        kind: 'human',
        gender: 'male'
    },
    {
        id: 'feat',
        name: 'Mike Feat',
        cost: 270,
        currency: 'coins',
        mods: { ...NONE, jumpHang: 1.2 },
        color: '#ce9178',
        accent: '#a86a4e',
        kind: 'adventurer',
        gender: 'male'
    },
    {
        id: 'hotfix',
        name: 'Mary Hotfix',
        cost: 330,
        currency: 'coins',
        mods: { ...NONE, jumpHang: 1.35 },
        color: '#f48771',
        accent: '#c45a48',
        kind: 'human',
        gender: 'female'
    },
    {
        id: 'dev',
        name: 'Ned Dev',
        cost: 370,
        currency: 'coins',
        mods: { ...NONE, slideHang: 1.35 },
        color: '#4ec9b0',
        accent: '#2a8a78',
        kind: 'human',
        gender: 'male'
    },
    {
        id: 'bisect',
        name: 'Hank Bisect',
        cost: 40,
        currency: 'diamonds',
        mods: { ...NONE, magnetBonus: 40 },
        color: '#c586c0',
        accent: '#8e5a8a',
        kind: 'futurist',
        gender: 'male'
    },
    {
        id: 'release',
        name: 'Jay Release',
        cost: 80,
        currency: 'diamonds',
        mods: { ...NONE, hpBonus: 1 },
        color: '#b5cea8',
        accent: '#6a9a5a',
        kind: 'alien',
        gender: 'male'
    },
    {
        id: 'rebase',
        name: 'Ada Rebase',
        cost: 200,
        currency: 'diamonds',
        mods: { ...NONE, jumpHang: 1.25, slideHang: 1.2 },
        color: '#dcdcaa',
        accent: '#b0ad6a',
        kind: 'futurist',
        gender: 'female'
    },
    {
        id: 'origin',
        name: 'John Origin',
        cost: 450,
        currency: 'diamonds',
        mods: {
            jumpHang: 1.15,
            slideHang: 1.15,
            magnetBonus: 35,
            hpBonus: 1
        },
        color: '#569cd6',
        accent: '#d7ba7d',
        kind: 'hero',
        gender: 'male'
    }
];

export function getCharacter(id: string): RunnerCharacter {
    return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
}

export function formatCost(character: RunnerCharacter): string {
    if (character.cost <= 0) {
        return 'Free';
    }
    return `${character.cost} ${character.currency}`;
}

export function formatMods(character: RunnerCharacter): string {
    const parts: string[] = [];
    const m = character.mods;
    if (m.jumpHang > 1) {
        parts.push('Longer jump');
    }
    if (m.slideHang > 1) {
        parts.push('Longer duck');
    }
    if (m.magnetBonus > 0) {
        parts.push('Coin magnet');
    }
    if (m.hpBonus > 0) {
        parts.push('+1 HP');
    }
    return parts.length > 0 ? parts.join(' · ') : 'No special ability';
}
