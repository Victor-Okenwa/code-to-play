export type Currency = 'gold' | 'diamonds';

export type CharacterId =
    | 'green'
    | 'blue'
    | 'yellow'
    | 'red'
    | 'magenta'
    | 'white'
    | 'pelican'
    | 'swan'
    | 'eagle'
    | 'robo'
    | 'wooden';

export type CharacterKind = 'standard' | 'exotic';

export interface CharacterMods {
    speed: number;
    aerial: number;
    gravityReduce: number;
    resurrection: number;
}

export interface BirdCharacter {
    id: CharacterId;
    name: string;
    kind: CharacterKind;
    cost: number;
    currency: Currency;
    mods: CharacterMods;
    color: string;
    wing: string;
    body: string;
}

const NONE: CharacterMods = {
    speed: 1,
    aerial: 0,
    gravityReduce: 0,
    resurrection: 0
};

export const CHARACTERS: readonly BirdCharacter[] = [
    {
        id: 'green',
        name: 'Green Bird',
        kind: 'standard',
        cost: 0,
        currency: 'gold',
        mods: NONE,
        color: '#4ec9b0',
        wing: '#3aa894',
        body: 'oval'
    },
    {
        id: 'blue',
        name: 'Blue Bird',
        kind: 'standard',
        cost: 90,
        currency: 'gold',
        mods: NONE,
        color: '#4fc1ff',
        wing: '#2b8cc4',
        body: 'oval'
    },
    {
        id: 'yellow',
        name: 'Yellow Bird',
        kind: 'standard',
        cost: 150,
        currency: 'gold',
        mods: NONE,
        color: '#dcdcaa',
        wing: '#cecb7a',
        body: 'oval'
    },
    {
        id: 'red',
        name: 'Red Bird',
        kind: 'standard',
        cost: 20,
        currency: 'diamonds',
        mods: { ...NONE, speed: 1.4 },
        color: '#f48771',
        wing: '#d16969',
        body: 'oval'
    },
    {
        id: 'magenta',
        name: 'Magenta Bird',
        kind: 'standard',
        cost: 220,
        currency: 'gold',
        mods: NONE,
        color: '#c586c0',
        wing: '#9b6b96',
        body: 'oval'
    },
    {
        id: 'white',
        name: 'White Bird',
        kind: 'standard',
        cost: 270,
        currency: 'gold',
        mods: { ...NONE, resurrection: 1 },
        color: '#e8e8e8',
        wing: '#c8c8c8',
        body: 'oval'
    },
    {
        id: 'pelican',
        name: 'White Pelican',
        kind: 'exotic',
        cost: 40,
        currency: 'diamonds',
        mods: NONE,
        color: '#f3f3f3',
        wing: '#d0d0d0',
        body: 'pelican'
    },
    {
        id: 'swan',
        name: 'Red Swan',
        kind: 'exotic',
        cost: 70,
        currency: 'diamonds',
        mods: { ...NONE, aerial: 0.3, resurrection: 1 },
        color: '#e06c75',
        wing: '#be5046',
        body: 'swan'
    },
    {
        id: 'eagle',
        name: 'Golden Eagle',
        kind: 'exotic',
        cost: 100,
        currency: 'diamonds',
        mods: { ...NONE, speed: 1.4, gravityReduce: 0.15 },
        color: '#d7ba7d',
        wing: '#b8954a',
        body: 'eagle'
    },
    {
        id: 'robo',
        name: 'Robo Bird',
        kind: 'exotic',
        cost: 350,
        currency: 'diamonds',
        mods: { speed: 1.4, aerial: 0.3, gravityReduce: 0.15, resurrection: 1 },
        color: '#9cdcfe',
        wing: '#569cd6',
        body: 'robo'
    },
    {
        id: 'wooden',
        name: 'Wooden Bird',
        kind: 'exotic',
        cost: 350,
        currency: 'diamonds',
        mods: { speed: 1.4, aerial: 0.3, gravityReduce: 0.15, resurrection: 1 },
        color: '#ce9178',
        wing: '#a36a52',
        body: 'wood'
    }
];

export function getCharacter(id: string): BirdCharacter {
    return CHARACTERS.find(character => character.id === id) ?? CHARACTERS[0]!;
}

export function formatCost(character: BirdCharacter): string {
    if (character.cost === 0) {
        return 'Free';
    }
    return character.currency === 'gold'
        ? `${character.cost} gold`
        : `${character.cost} diamonds`;
}

export function formatMods(character: BirdCharacter): string {
    const parts: string[] = [];
    if (character.mods.speed > 1) {
        parts.push(`+${(character.mods.speed - 1).toFixed(1)}x speed`);
    }
    if (character.mods.aerial > 0) {
        parts.push(`+${character.mods.aerial.toFixed(1)} aerial`);
    }
    if (character.mods.gravityReduce > 0) {
        parts.push(`-${character.mods.gravityReduce.toFixed(2)} gravity`);
    }
    if (character.mods.resurrection > 0) {
        parts.push(`+${character.mods.resurrection} resurrection`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'No special ability';
}
