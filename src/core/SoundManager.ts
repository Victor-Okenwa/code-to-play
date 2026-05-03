/**
 * SoundManager.ts - Audio management for games
 */

export class SoundManager {
    private static instance: SoundManager;
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private isMuted: boolean = false;

    private constructor() {
        this.initializeSounds();
    }

    static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    private initializeSounds(): void {
        const soundDefinitions = {
            'slurp': 'slurp.mp3',
            'pop': 'pop.mp3',
        }

        Object.entries(soundDefinitions).forEach(([name, file]) => {
            const audio = new Audio();
            audio.src = this.getSoundUrl(file);
            audio.preload = 'auto';
            audio.volume = 0.3;

            // Add error handling
            audio.addEventListener('error', () => {
                console.warn(`Failed to load sound: ${file}`);
            });
            this.sounds.set(name, audio);
        })
    }

    private getSoundUrl(filename: string): string {
        return `vscode-resource:${window.location.protocol}//${window.location.host}/media/sfx/${filename}`
    }

    play(soundName: string): void {
        if (this.isMuted) { return };

        const audio = this.sounds.get(soundName);
        if (audio) {
            // Clone the audio to allow overlapping sounds
            const audioClone = audio.cloneNode() as HTMLAudioElement;
            audioClone.volume = audio.volume;
            audioClone.play().catch(err => {
                console.warn(`Failed to play sound: ${soundName}`, err);
            })
        }
    }

    setMuted(muted: boolean): void {
        this.isMuted = muted;
    }

    isSoundMuted(): boolean {
        return this.isMuted;
    }

    // Clean up resources
    dispose(): void {
        this.sounds.forEach(audio => {
            audio.pause();
            audio.src = '';
        });
        this.sounds.clear();
    }
}

export const soundManager = SoundManager.getInstance();


