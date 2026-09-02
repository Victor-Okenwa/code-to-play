export interface Wallet {
    bugs: number;
    pink: number;
    unlocked: string[];
    selected: string;
}

const DEFAULT_WALLET: Wallet = {
    bugs: 0,
    pink: 0,
    unlocked: ['green'],
    selected: 'green'
};

let wallet: Wallet = { ...DEFAULT_WALLET, unlocked: [...DEFAULT_WALLET.unlocked] };

declare const vscode: {
    postMessage(message: Record<string, unknown>): void;
};

export function getWallet(): Wallet {
    return wallet;
}

export function applyEconomy(message: {
    bugs?: number;
    pink?: number;
    unlocked?: string[];
    selected?: string;
}): void {
    wallet = {
        bugs: Math.max(0, Math.floor(message.bugs ?? wallet.bugs)),
        pink: Math.max(0, Math.floor(message.pink ?? wallet.pink)),
        unlocked: Array.isArray(message.unlocked) && message.unlocked.length > 0
            ? [...new Set(['green', ...message.unlocked])]
            : [...wallet.unlocked],
        selected: typeof message.selected === 'string' ? message.selected : wallet.selected
    };
    if (!wallet.unlocked.includes(wallet.selected)) {
        wallet.selected = 'green';
    }
}

export function isUnlocked(id: string): boolean {
    return wallet.unlocked.includes(id);
}

export function selectOwned(id: string): boolean {
    if (!isUnlocked(id)) {
        return false;
    }
    wallet.selected = id;
    persistNow();
    return true;
}

export function addCurrency(kind: 'bugs' | 'pink', amount: number): void {
    if (kind === 'bugs') {
        wallet.bugs += amount;
    } else {
        wallet.pink += amount;
    }
    persistNow();
}

export function spend(kind: 'bugs' | 'pink', amount: number, unlockId: string): boolean {
    if (kind === 'bugs') {
        if (wallet.bugs < amount) {
            return false;
        }
        wallet.bugs -= amount;
    } else {
        if (wallet.pink < amount) {
            return false;
        }
        wallet.pink -= amount;
    }
    if (!wallet.unlocked.includes(unlockId)) {
        wallet.unlocked.push(unlockId);
    }
    wallet.selected = unlockId;
    persistNow();
    return true;
}

export function persistNow(): void {
    try {
        vscode.postMessage({
            command: 'debugSnakeSaveEconomy',
            bugs: wallet.bugs,
            pink: wallet.pink,
            unlocked: wallet.unlocked,
            selected: wallet.selected
        });
    } catch {
        // Webview may not be connected in isolation
    }
}

export function requestReady(): void {
    try {
        vscode.postMessage({ command: 'ready' });
    } catch {
        // ignore
    }
}
