/**
 * Ambient Garden Audio Synthesizer using Web Audio API
 * 100% self-contained, no external audio files required.
 */
class GardenAudio {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.masterGain = null;
        this.windGain = null;
        this.noiseNode = null;
        this.windFilter = null;
        this.windLfo = null;
        this.birdInterval = null;
        this.chimeInterval = null;
        this.isMuted = true;
    }

    init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        // Master gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.setupWind();
    }

    setupWind() {
        // Pink noise buffer for soft organic breeze
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
            b6 = white * 0.115926;
        }

        this.noiseNode = this.ctx.createBufferSource();
        this.noiseNode.buffer = noiseBuffer;
        this.noiseNode.loop = true;

        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'lowpass';
        this.windFilter.frequency.value = 350;
        this.windFilter.Q.value = 1.8;

        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0.4;

        // Slow LFO for natural gust swells
        this.windLfo = this.ctx.createOscillator();
        this.windLfo.frequency.value = 0.15; // slow breathing cycle
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 220; // modulation range

        this.windLfo.connect(lfoGain);
        lfoGain.connect(this.windFilter.frequency);

        this.noiseNode.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.masterGain);

        this.noiseNode.start();
        this.windLfo.start();
    }

    startBirds() {
        if (this.birdInterval) clearInterval(this.birdInterval);
        const scheduleNextBird = () => {
            const delay = 3500 + Math.random() * 5000;
            this.birdInterval = setTimeout(() => {
                if (!this.isMuted) {
                    this.playBirdChirp();
                }
                scheduleNextBird();
            }, delay);
        };
        scheduleNextBird();
    }

    playBirdChirp() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const baseFreq = 2200 + Math.random() * 1400;

        // 2 to 4 sweet micro-chirps
        const chirps = 2 + Math.floor(Math.random() * 3);
        let timeOffset = 0;

        for (let i = 0; i < chirps; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            const chirpStart = now + timeOffset;
            const chirpDuration = 0.08 + Math.random() * 0.06;

            // Natural bird swoop pitch modulation
            const f1 = baseFreq + (Math.random() * 600 - 300);
            const f2 = f1 + (Math.random() > 0.5 ? 800 : -600);
            osc.frequency.setValueAtTime(f1, chirpStart);
            osc.frequency.exponentialRampToValueAtTime(Math.max(100, f2), chirpStart + chirpDuration * 0.7);

            gain.gain.setValueAtTime(0.001, chirpStart);
            gain.gain.linearRampToValueAtTime(0.07, chirpStart + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, chirpStart + chirpDuration);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(chirpStart);
            osc.stop(chirpStart + chirpDuration);

            timeOffset += chirpDuration + 0.04 + Math.random() * 0.05;
        }
    }

    playChime(note = null) {
        if (!this.ctx) return;
        // Pentatonic peaceful scale frequencies
        const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        const freq = note || pentatonic[Math.floor(Math.random() * pentatonic.length)];

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Subtle bell harmonic
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.76, now);

        const duration = 2.5;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + duration);
        osc2.stop(now + duration);
    }

    toggle() {
        if (!this.ctx) {
            this.init();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.isMuted = !this.isMuted;
        const targetGain = this.isMuted ? 0.0001 : 0.7;
        this.masterGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.4);

        if (!this.isMuted) {
            this.startBirds();
            this.playChime();
        } else {
            if (this.birdInterval) clearTimeout(this.birdInterval);
        }

        return !this.isMuted;
    }
}

window.gardenAudio = new GardenAudio();
