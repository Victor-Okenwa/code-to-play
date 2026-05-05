/**
 * SoundManager.ts - Audio management for games using DOM audio elements
 */

export class SoundManager {
    private static instance: SoundManager;
    private isMuted: boolean = false;

    private constructor() { }

    static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    /**
     * Play a sound by its audio element ID
     * @param elementId - The ID of the audio element in the DOM
     */
    playById(elementId: string): void {
        if (this.isMuted) {
            return;
        };

        const audioElement = document.getElementById(elementId) as HTMLAudioElement;
        if (audioElement) {
            // Clone the audio to allow overlapping sounds
            const audioClone = audioElement.cloneNode() as HTMLAudioElement;
            audioClone.volume = audioElement.volume;
            audioClone.play().catch(err => {
                console.warn(`Failed to play sound: ${elementId}`, err);
            });
        } else {
            console.warn(`Audio element with ID '${elementId}' not found`);
        }
    }

    setMuted(muted: boolean): void {
        this.isMuted = muted;
    }

    isSoundMuted(): boolean {
        return this.isMuted;
    }

    // Clean up resources (if needed in future)
    dispose(): void {
        // No resources to clean up since we're using DOM elements
    }
}

export const soundManager = SoundManager.getInstance();


