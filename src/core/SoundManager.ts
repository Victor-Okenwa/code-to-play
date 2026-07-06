/**
 * core/SoundManager.ts - Singleton Sound Manager for Games
 * 
 * Manages audio playback with:
 * - Configuration from VS Code settings
 * - Mute/volume control
 * - Global access from all games
 * - No ES6 imports (works in webview)
 */

// Declare as global to avoid module resolution issues
declare global {
    interface Window {
        SoundManager: typeof SoundManager;
        soundManager: SoundManager;
    }
}

class SoundManager {
    private isMuted: boolean = false;
    private volume: number = 1.0;
    private audioElements: Map<string, HTMLAudioElement> = new Map();

    constructor() {
        this.initializeAudio();
    }

    private initializeAudio(): void {
        console.log("[SoundManager] Initializing audio elements...");

        //  Find all audio elements in the DOM
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach((audio) => {
            const id = audio.id;
            if (id) {
                this.audioElements.set(id, audio);
                audio.volume = this.volume;
                console.log(`[SoundManager] Registered audio element: ${id}`);
            }
        });


        // Listen for messages from extension with configuration
        if (window.addEventListener) {
            window.addEventListener('message', (event) => {
                const message = event.data;
                if (message.command === 'updateSoundConfig') {
                    this.updateConfig(message.config);
                }
            });
        }

        console.log(`[SoundManager] Initialized with ${this.audioElements.size} audio elements`);
    }

    /**
 * Update sound configuration from VS Code settings
 */
    updateConfig(config: { soundEnabled?: boolean; soundVolume?: number }): void {
        console.log('[SoundManager] Updating config:', config);

        if (config.soundEnabled !== undefined) {
            this.isMuted = !config.soundEnabled;
        }

        if (config.soundVolume !== undefined) {
            this.volume = Math.max(0, Math.min(1, config.soundVolume));

            // Update all audio elements
            for (const audio of this.audioElements.values()) {
                audio.volume = this.volume;
            }
        }
    }

    /**
     * Play a sound by its audio element ID
     * @param elementId - The ID of the audio element in the DOM
     */
    playById(elementId: string): void {
        if (this.isMuted) {
            console.log(`[SoundManager] Sound muted, skipping: ${elementId}`);
            return;
        }

        const audioElement = this.audioElements.get(elementId);

        if (!audioElement) {
            console.warn(`[SoundManager] Audio element not found: ${elementId}`);
            console.warn(`[SoundManager] Available: ${Array.from(this.audioElements.keys()).join(', ')}`);
            return;
        }

        const source = audioElement.querySelector('source');
        const src = source?.src || audioElement.src;
        if (!src) {
            console.warn(`[SoundManager] No audio source for: ${elementId}`);
            return;
        }

        try {
            const audio = new Audio(src);
            audio.volume = this.volume;

            console.log(`[SoundManager] Playing sound: ${elementId} (volume: ${this.volume})`);

            audio.play().catch(err => {
                console.warn(`[SoundManager] Failed to play sound ${elementId}:`, err);
            });
        } catch (error) {
            console.error(`[SoundManager] Error playing sound ${elementId}:`, error);
        }
    }


    setMuted(muted: boolean): void {
        this.isMuted = muted;
    }

    toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }

    isSoundMuted(): boolean {
        return this.isMuted;
    }

    /**
     * Set volume (0-1)
     */
    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));

        // Update all audio elements
        for (const audio of this.audioElements.values()) {
            audio.volume = this.volume;
        }

        console.log(`[SoundManager] Volume set to: ${this.volume}`);
    }

    /**
     * Get current volume
     */
    getVolume(): number {
        return this.volume;
    }

    /**
     * Preload audio elements
     */
    preloadAll(): void {
        for (const audio of this.audioElements.values()) {
            audio.load();
        }
        console.log('[SoundManager] Preloaded all audio elements');
    }
    // Clean up resources (if needed in future)
    dispose(): void {
        // No resources to clean up since we're using DOM elements
    }
}

// Create global instance
const soundManager = new SoundManager();

// Also expose to window for global access
if (typeof window !== 'undefined') {
    window.SoundManager = SoundManager;
    window.soundManager = soundManager;
}

export { SoundManager, soundManager };


