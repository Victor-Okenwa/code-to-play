import * as vscode from 'vscode';
import { AuthManager } from '../auth/AuthManager';
import { GameManager } from '../core/GameManager';
import { StorageManager } from '../core/StorageManager';
import { GameEvent } from '../core/types';
import { buildStatsSnapshot } from './snapshot';

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const WRITE_DEBOUNCE_MS = 30 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class StatsSync implements vscode.Disposable {
    private readonly gameEvent: vscode.Disposable;
    private readonly authEvent: vscode.Disposable;
    private timer: ReturnType<typeof setInterval> | undefined;
    private debounce: ReturnType<typeof setTimeout> | undefined;
    private inFlight = false;

    constructor(
        private readonly authManager: AuthManager,
        private readonly storageManager: StorageManager,
        private readonly gameManager: GameManager
    ) {
        this.gameEvent = this.gameManager.onGameEvent(({ event }) => {
            if (event === GameEvent.PLAY_ENDED || event === GameEvent.UNLOCKED) {
                this.syncSoon(0);
            } else if (event === GameEvent.PROGRESS_UPDATED) {
                this.syncSoon(WRITE_DEBOUNCE_MS);
            }
        });

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

    private syncSoon(delayMs: number): void {
        if (this.debounce) {
            clearTimeout(this.debounce);
        }
        this.debounce = setTimeout(() => {
            this.debounce = undefined;
            void this.sync();
        }, delayMs);
    }

    async sync(): Promise<void> {
        if (this.inFlight || this.authManager.getState().status !== 'signedIn') {
            return;
        }

        this.inFlight = true;
        try {
            const statusResponse = await this.authManager.authorizedFetch('/api/stats', {
                method: 'GET'
            });

            if (!statusResponse || !statusResponse.ok) {
                return;
            }

            const status: unknown = await statusResponse.json();
            if (!isRecord(status) || status.optedIn !== true) {
                return;
            }

            const snapshot = buildStatsSnapshot(
                this.storageManager,
                this.gameManager.getAllGames()
            );

            await this.authManager.authorizedFetch('/api/stats', {
                method: 'PUT',
                body: snapshot
            });
        } catch {
            // Keep local stats if the site is unreachable.
        } finally {
            this.inFlight = false;
        }
    }

    dispose(): void {
        this.gameEvent.dispose();
        this.authEvent.dispose();
        if (this.debounce) {
            clearTimeout(this.debounce);
        }
        if (this.timer) {
            clearInterval(this.timer);
        }
    }
}
