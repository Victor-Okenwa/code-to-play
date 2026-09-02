import * as vscode from 'vscode';
import { StorageKey, PRO_TRIAL_DAYS } from '../core/types';
import {
    AUTH_PROFILE_STATE_KEY,
    DEV_API_BASE_URL,
    DEVICE_GRANT_TYPE,
    EXTENSION_CLIENT_ID,
    PROD_API_BASE_URL,
    SESSION_TOKEN_SECRET_KEY
} from './constants';
import { AuthProfile, AuthState } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseAuthProfile(value: unknown): AuthProfile | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    const id = asString(value.id);
    const name = asString(value.name);
    const email = asString(value.email);

    if (!id || !name || !email) {
        return undefined;
    }

    const image = typeof value.image === 'string' ? value.image : null;

    return { id, name, email, image };
}

function parseDeviceCodeResponse(value: unknown): {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string;
    intervalMs: number;
    expiresAt: number;
} | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    const deviceCode = asString(value.device_code);
    const userCode = asString(value.user_code);
    const verificationUri = asString(value.verification_uri);
    const verificationUriComplete = asString(value.verification_uri_complete);

    if (!deviceCode || !userCode || !verificationUri || !verificationUriComplete) {
        return undefined;
    }

    const intervalSeconds = typeof value.interval === 'number' && value.interval > 0
        ? value.interval
        : 5;
    const expiresIn = typeof value.expires_in === 'number' && value.expires_in > 0
        ? value.expires_in
        : 1800;

    return {
        deviceCode,
        userCode,
        verificationUri,
        verificationUriComplete,
        intervalMs: intervalSeconds * 1000,
        expiresAt: Date.now() + expiresIn * 1000
    };
}

function oauthError(value: unknown): string | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    return asString(value.error);
}

function errorDescription(value: unknown): string | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    return asString(value.error_description);
}

export class AuthManager implements vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    private pending: { userCode: string; verificationUri: string } | undefined;
    private pollAbort: AbortController | undefined;

    constructor(private readonly context: vscode.ExtensionContext) {}

    getApiBaseUrl(): string {
        return this.context.extensionMode === vscode.ExtensionMode.Development
            ? DEV_API_BASE_URL
            : PROD_API_BASE_URL;
    }

    getState(): AuthState {
        if (this.pending) {
            return {
                status: 'pending',
                userCode: this.pending.userCode,
                verificationUri: this.pending.verificationUri
            };
        }

        const profile = this.getCachedProfile();
        if (profile) {
            return { status: 'signedIn', profile };
        }

        return { status: 'signedOut' };
    }

    async refreshSession(): Promise<void> {
        const token = await this.context.secrets.get(SESSION_TOKEN_SECRET_KEY);
        if (!token) {
            await this.clearProfile();
            this.fireChange();
            return;
        }

        try {
            const response = await this.request('/api/auth/get-session', {
                method: 'GET',
                token
            });

            if (response.status === 401) {
                await this.clearAuth();
                return;
            }

            if (!response.ok) {
                return;
            }

            const payload: unknown = await response.json();
            if (payload === null) {
                await this.clearAuth();
                return;
            }

            const profile = isRecord(payload) ? parseAuthProfile(payload.user) : undefined;
            if (!profile) {
                return;
            }

            await this.context.globalState.update(AUTH_PROFILE_STATE_KEY, profile);
            this.fireChange();
        } catch {
            // Keep the cached profile when the network is down.
        }
    }

    async signIn(): Promise<void> {
        this.pollAbort?.abort();

        try {
            const response = await this.request('/api/auth/device/code', {
                method: 'POST',
                body: { client_id: EXTENSION_CLIENT_ID }
            });
            const payload: unknown = await response.json().catch(() => undefined);

            if (!response.ok) {
                const message = errorDescription(payload) ?? 'Could not start sign-in. Is the Code to Play site reachable?';
                void vscode.window.showErrorMessage(message);
                return;
            }

            const device = parseDeviceCodeResponse(payload);
            if (!device) {
                void vscode.window.showErrorMessage('Sign-in returned an unexpected response.');
                return;
            }

            this.pending = {
                userCode: device.userCode,
                verificationUri: device.verificationUri
            };
            this.fireChange();

            const opened = await vscode.env.openExternal(
                vscode.Uri.parse(device.verificationUriComplete)
            );

            const actions = opened ? ['Copy code'] : ['Open browser', 'Copy code'];
            void vscode.window
                .showInformationMessage(
                    `Approve this code in the browser: ${device.userCode}`,
                    ...actions
                )
                .then((selection) => {
                    if (selection === 'Copy code') {
                        void vscode.env.clipboard.writeText(device.userCode);
                    }

                    if (selection === 'Open browser') {
                        void vscode.env.openExternal(
                            vscode.Uri.parse(device.verificationUriComplete)
                        );
                    }
                });

            await this.pollForToken(device);
        } catch {
            this.pending = undefined;
            this.fireChange();
            void vscode.window.showErrorMessage(
                'Could not reach Code to Play. Check your connection and try again.'
            );
        }
    }

    async signOut(): Promise<void> {
        this.pollAbort?.abort();
        this.pending = undefined;

        const token = await this.context.secrets.get(SESSION_TOKEN_SECRET_KEY);
        if (token) {
            try {
                await this.request('/api/auth/sign-out', {
                    method: 'POST',
                    token
                });
            } catch {
                // Local sign-out still proceeds if the site is unreachable.
            }
        }

        await this.clearAuth();
        void vscode.window.showInformationMessage('Signed out of Code to Play.');
    }

    async openDashboard(): Promise<void> {
        await this.openSitePath('/dashboard');
    }

    async openSubscription(): Promise<void> {
        await this.openSitePath('/dashboard/subscription');
    }

    async openPricing(): Promise<void> {
        await this.openSitePath('/pricing');
    }

    private isProUnlocked(): boolean {
        const state = this.context.globalState.get<{ isProUnlocked?: boolean }>(
            StorageKey.GLOBAL_PLAY_STATE
        );
        return state?.isProUnlocked === true;
    }

    async handleAccountClick(): Promise<void> {
        const state = this.getState();

        if (state.status === 'signedOut') {
            await this.signIn();
            return;
        }

        if (state.status === 'pending') {
            await vscode.env.clipboard.writeText(state.userCode);
            await vscode.env.openExternal(vscode.Uri.parse(state.verificationUri));
            void vscode.window.showInformationMessage(
                `Code copied: ${state.userCode}. Enter it at ${state.verificationUri}`
            );
            return;
        }

        const selected = await vscode.window.showQuickPick(
            [
                {
                    label: this.isProUnlocked() ? 'Manage subscription' : 'Go Pro',
                    description: this.isProUnlocked()
                        ? 'Call Stack, Merge Conflict, Kernel Panic, and extra play spaces'
                        : `${PRO_TRIAL_DAYS}-day free trial · Call Stack, Merge Conflict, Kernel Panic, and extra play spaces`,
                    action: this.isProUnlocked() ? 'subscription' as const : 'pricing' as const
                },
                {
                    label: 'Get more Play Spaces',
                    description: 'Buy extra spaces when you need a break',
                    action: 'pricing' as const
                },
                {
                    label: 'Open dashboard',
                    action: 'dashboard' as const
                },
                {
                    label: 'Sign out',
                    action: 'signOut' as const
                }
            ],
            { placeHolder: state.profile.email }
        );

        if (selected?.action === 'pricing') {
            await this.openPricing();
        }

        if (selected?.action === 'subscription') {
            await this.openSubscription();
        }

        if (selected?.action === 'dashboard') {
            await this.openDashboard();
        }

        if (selected?.action === 'signOut') {
            await this.signOut();
        }
    }

    async handlePlaysClick(): Promise<void> {
        const selected = await vscode.window.showQuickPick(
            [
                {
                    label: 'Go Pro',
                    description: `${PRO_TRIAL_DAYS}-day free trial · Call Stack, Merge Conflict, Kernel Panic, and extra play spaces`,
                    action: 'pricing' as const
                },
                {
                    label: 'Get more Play Spaces',
                    description: 'Buy extra spaces when you need a break',
                    action: 'pricing' as const
                }
            ],
            { placeHolder: 'Get more plays' }
        );

        if (selected?.action === 'pricing') {
            await this.openPricing();
        }
    }

    private async openSitePath(path: string): Promise<void> {
        await vscode.env.openExternal(
            vscode.Uri.parse(`${this.getApiBaseUrl()}${path}`)
        );
    }

    dispose(): void {
        this.pollAbort?.abort();
        this._onDidChange.dispose();
    }

    private async pollForToken(device: {
        deviceCode: string;
        intervalMs: number;
        expiresAt: number;
    }): Promise<void> {
        this.pollAbort = new AbortController();
        const { signal } = this.pollAbort;
        let intervalMs = device.intervalMs;

        while (!signal.aborted && Date.now() < device.expiresAt) {
            await this.delay(intervalMs, signal);
            if (signal.aborted) {
                return;
            }

            try {
                const response = await this.request('/api/auth/device/token', {
                    method: 'POST',
                    body: {
                        grant_type: DEVICE_GRANT_TYPE,
                        device_code: device.deviceCode,
                        client_id: EXTENSION_CLIENT_ID
                    },
                    signal
                });
                const payload: unknown = await response.json().catch(() => undefined);

                if (response.ok) {
                    const accessToken = isRecord(payload)
                        ? asString(payload.access_token)
                        : undefined;

                    if (!accessToken) {
                        this.pending = undefined;
                        this.fireChange();
                        void vscode.window.showErrorMessage('Sign-in did not return a session.');
                        return;
                    }

                    await this.context.secrets.store(SESSION_TOKEN_SECRET_KEY, accessToken);
                    this.pending = undefined;
                    this.fireChange();
                    await this.refreshSession();
                    void vscode.window.showInformationMessage('Signed in to Code to Play.');
                    return;
                }

                const error = oauthError(payload);
                if (error === 'authorization_pending') {
                    continue;
                }

                if (error === 'slow_down') {
                    intervalMs += 1000;
                    continue;
                }

                this.pending = undefined;
                this.fireChange();

                if (error === 'access_denied') {
                    void vscode.window.showWarningMessage('Sign-in was denied.');
                    return;
                }

                if (error === 'expired_token') {
                    void vscode.window.showErrorMessage('Sign-in code expired. Try again.');
                    return;
                }

                void vscode.window.showErrorMessage(
                    errorDescription(payload) ?? 'Sign-in failed. Try again.'
                );
                return;
            } catch (error) {
                if (signal.aborted) {
                    return;
                }

                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }

                // Keep polling through brief network drops.
            }
        }

        if (!signal.aborted) {
            this.pending = undefined;
            this.fireChange();
            void vscode.window.showErrorMessage('Sign-in timed out. Try again.');
        }
    }

    async authorizedFetch(
        path: string,
        options: {
            method: 'GET' | 'POST' | 'PUT';
            body?: unknown;
            signal?: AbortSignal;
        }
    ): Promise<Response | undefined> {
        const token = await this.context.secrets.get(SESSION_TOKEN_SECRET_KEY);
        if (!token) {
            return undefined;
        }

        return this.request(path, { ...options, token });
    }

    private async request(
        path: string,
        options: {
            method: 'GET' | 'POST' | 'PUT';
            body?: unknown;
            token?: string;
            signal?: AbortSignal;
        }
    ): Promise<Response> {
        const baseUrl = this.getApiBaseUrl();
        const headers = new Headers({
            Accept: 'application/json'
        });

        if (options.body !== undefined) {
            headers.set('Content-Type', 'application/json');
        }

        if (options.token) {
            headers.set('Authorization', `Bearer ${options.token}`);
        }

        return fetch(`${baseUrl}${path}`, {
            method: options.method,
            headers,
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
            signal: options.signal
        });
    }

    private getCachedProfile(): AuthProfile | undefined {
        return parseAuthProfile(this.context.globalState.get(AUTH_PROFILE_STATE_KEY));
    }

    private async clearProfile(): Promise<void> {
        await this.context.globalState.update(AUTH_PROFILE_STATE_KEY, undefined);
    }

    private async clearAuth(): Promise<void> {
        await this.context.secrets.delete(SESSION_TOKEN_SECRET_KEY);
        await this.clearProfile();
        this.fireChange();
    }

    private fireChange(): void {
        this._onDidChange.fire();
    }

    private delay(ms: number, signal: AbortSignal): Promise<void> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                signal.removeEventListener('abort', onAbort);
                resolve();
            }, ms);

            const onAbort = () => {
                clearTimeout(timeout);
                resolve();
            };

            signal.addEventListener('abort', onAbort, { once: true });
        });
    }
}
