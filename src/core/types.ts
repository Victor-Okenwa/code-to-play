export interface IGame {
    id: string;
    name: string;
    description: string;
    iconPath: string;
    isPremium: boolean;
}

export interface GameState {
    playsRemaining: number;
    linesWritten: number;
    isUnlocked: boolean;
}