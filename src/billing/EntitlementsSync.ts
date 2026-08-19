import * as vscode from 'vscode';
import { AuthManager } from '../auth/AuthManager';
import { GameManager } from '../core/GameManager';

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEntitlements(value: unknown): {
    isPro: boolean;
    purchasedPlaySpaces: number;
} | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    const purchased = value.purchasedPlaySpaces;
    if (typeof value.isPro !== 'boolean' || typeof purchased !== 'number') {
        return undefined;
    }

    return {
        isPro: value.isPro,
        purchasedPlaySpaces: Math.max(0, Math.floor(purchased))
    };
}

export class EntitlementsSync implements vscode.Disposable {
    private readonly authEvent: vscode.Disposable;
    private timer: ReturnType<typeof setInterval> | undefined;
    private inFlight = false;

    constructor(
        private readonly authManager: AuthManager,
        private readonly gameManager: GameManager
    ) {
        this.authEvent = this.authManager.onDidChange(() => {
            void this.sync();
        });
    }

    start(): void {
        this.timer = setInterval(() => {
            void this.sync();
        }, SYNC_INTERVAL_MS);
        void this.sync();
    }

    async sync(): Promise<void> {
        if (this.inFlight || this.authManager.getState().status !== 'signedIn') {
            return;
        }

        this.inFlight = true;
        try {
            const response = await this.authManager.authorizedFetch(
                '/api/me/entitlements',
                { method: 'GET' }
            );

            if (!response || !response.ok) {
                return;
            }

            const payload = parseEntitlements(await response.json());
            if (!payload) {
                return;
            }

            await this.gameManager.applyServerEntitlements(payload);
        } catch {
            // Keep local Pro state if the site is unreachable.
        } finally {
            this.inFlight = false;
        }
    }

    dispose(): void {
        this.authEvent.dispose();
        if (this.timer) {
            clearInterval(this.timer);
        }
    }
}
