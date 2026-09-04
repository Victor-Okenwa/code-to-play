export interface Wallet {
    coins: number;
    diamonds: number;
    unlocked: string[];
    selected: string;
}

const DEFAULT_WALLET: Wallet = {
    coins: 0,
    diamonds: 0,
    unlocked: ['main'],
    selected: 'main'
};

let wallet: Wallet = { ...DEFAULT_WALLET, unlocked: [...DEFAULT_WALLET.unlocked] };

declare const vscode: {
    postMessage(message: Record<string, unknown>): void;
};

export function getWallet(): Wallet {
    return wallet;
}

export function applyEconomy(message: {
    coins?: number;
    diamonds?: number;
    unlocked?: string[];
    selected?: string;
}): void {
    wallet = {
        coins: Math.max(0, Math.floor(message.coins ?? wallet.coins)),
        diamonds: Math.max(0, Math.floor(message.diamonds ?? wallet.diamonds)),
        unlocked: Array.isArray(message.unlocked) && message.unlocked.length > 0
            ? [...new Set(['main', ...message.unlocked])]
            : [...wallet.unlocked],
        selected: typeof message.selected === 'string' ? message.selected : wallet.selected
    };
    if (!wallet.unlocked.includes(wallet.selected)) {
        wallet.selected = 'main';
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

export function addCurrency(kind: 'coins' | 'diamonds', amount: number): void {
    if (kind === 'coins') {
        wallet.coins += amount;
    } else {
        wallet.diamonds += amount;
    }
    persistNow();
}

export function spend(kind: 'coins' | 'diamonds', amount: number, unlockId: string): boolean {
    if (kind === 'coins') {
        if (wallet.coins < amount) {
            return false;
        }
        wallet.coins -= amount;
    } else {
        if (wallet.diamonds < amount) {
            return false;
        }
        wallet.diamonds -= amount;
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
            command: 'gitRunSaveEconomy',
            coins: wallet.coins,
            diamonds: wallet.diamonds,
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
