export interface Wallet {
    gold: number;
    diamonds: number;
    unlocked: string[];
    selected: string;
}

const DEFAULT_WALLET: Wallet = {
    gold: 0,
    diamonds: 0,
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
    gold?: number;
    diamonds?: number;
    unlocked?: string[];
    selected?: string;
}): void {
    wallet = {
        gold: Math.max(0, Math.floor(message.gold ?? wallet.gold)),
        diamonds: Math.max(0, Math.floor(message.diamonds ?? wallet.diamonds)),
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

export function addCurrency(kind: 'gold' | 'diamonds', amount: number): void {
    if (kind === 'gold') {
        wallet.gold += amount;
    } else {
        wallet.diamonds += amount;
    }
    persistNow();
}

export function spend(kind: 'gold' | 'diamonds', amount: number, unlockId: string): boolean {
    if (kind === 'gold') {
        if (wallet.gold < amount) {
            return false;
        }
        wallet.gold -= amount;
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
            command: 'ciBirdSaveEconomy',
            gold: wallet.gold,
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
