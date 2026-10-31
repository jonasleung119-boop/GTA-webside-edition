// audio.js - Synthesized Web Audio API Sound System for Taipei GTA
// Completely self-contained with zero external asset dependencies

class SoundSystem {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.engineOsc = null;
        this.engineGain = null;
        this.sirenOsc = null;
        this.sirenGain = null;
        this.sirenLFO = null;
        this.screechGain = null;
        this.currentVehicleType = null;
        this.radioPlaying = false;
        this.radioTrackIdx = 0;
        this.radioTracks = ['Taipei Synthwave 101.5', 'Night Market Lo-Fi', 'Xinyi Neon Beats', 'Off'];
        this.radioInterval = null;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
    }

    resume() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    startEngine(vehicleType = 'car') {
        this.resume();
        if (!this.ctx || this.isMuted) return;
        this.stopEngine();
        this.currentVehicleType = vehicleType;

        const now = this.ctx.currentTime;
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();

        // Waveform: scooter is saw/square buzz, car is triangle/saw
        if (vehicleType === 'scooter') {
            this.engineOsc.type = 'sawtooth';
            this.engineOsc.frequency.setValueAtTime(65, now);
            this.engineGain.gain.setValueAtTime(0.08, now);
        } else if (vehicleType === 'truck') {
            this.engineOsc.type = 'sawtooth';
            this.engineOsc.frequency.setValueAtTime(40, now);
            this.engineGain.gain.setValueAtTime(0.12, now);
        } else {
            this.engineOsc.type = 'triangle';
            this.engineOsc.frequency.setValueAtTime(55, now);
            this.engineGain.gain.setValueAtTime(0.1, now);
        }

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(vehicleType === 'scooter' ? 600 : 350, now);

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start(now);
    }

    updateEngine(speed, maxSpeed = 100) {
        if (!this.engineOsc || !this.ctx || this.isMuted) return;
        const ratio = Math.min(Math.max(Math.abs(speed) / maxSpeed, 0), 1);
        const baseFreq = this.currentVehicleType === 'scooter' ? 70 : (this.currentVehicleType === 'truck' ? 45 : 55);
        const maxFreq = this.currentVehicleType === 'scooter' ? 240 : (this.currentVehicleType === 'truck' ? 140 : 180);
        
        const targetFreq = baseFreq + (maxFreq - baseFreq) * ratio;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);

        const targetGain = (this.currentVehicleType === 'scooter' ? 0.08 : 0.12) + (ratio * 0.08);
        this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }

    stopEngine() {
        if (this.engineOsc) {
            try {
                this.engineOsc.stop();
                this.engineOsc.disconnect();
            } catch (e) {}
            this.engineOsc = null;
        }
        if (this.engineGain) {
            try { this.engineGain.disconnect(); } catch (e) {}
            this.engineGain = null;
        }
    }

    playHorn(isScooter = false) {
        this.resume();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const gain = this.ctx.createGain();
        gain.connect(this.ctx.destination);

        if (isScooter) {
            // High-pitched Taiwanese scooter horn beep-beep
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.connect(gain);
            osc.start(now);
            osc.stop(now + 0.2);
        } else {
            // Dual chord car horn (440Hz + 554Hz)
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc2.type = 'sawtooth';
            osc1.frequency.setValueAtTime(440, now);
            osc2.frequency.setValueAtTime(554, now);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1200, now);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.42);
            osc2.stop(now + 0.42);
        }
    }

    playCrash() {
        this.resume();
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.25;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
    }

    startSiren() {
        this.resume();
        if (!this.ctx || this.sirenOsc || this.isMuted) return;
        const now = this.ctx.currentTime;

        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenLFO = this.ctx.createOscillator();

        this.sirenOsc.type = 'sawtooth';
        this.sirenOsc.frequency.setValueAtTime(750, now);

        // LFO wail between 650Hz and 950Hz
        this.sirenLFO.type = 'sine';
        this.sirenLFO.frequency.setValueAtTime(1.5, now);
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(180, now);

        this.sirenLFO.connect(lfoGain);
        lfoGain.connect(this.sirenOsc.frequency);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1500, now);

        this.sirenGain.gain.setValueAtTime(0.08, now);

        this.sirenOsc.connect(filter);
        filter.connect(this.sirenGain);
        this.sirenGain.connect(this.ctx.destination);

        this.sirenOsc.start(now);
        this.sirenLFO.start(now);
    }

    stopSiren() {
        if (this.sirenOsc) {
            try {
                this.sirenOsc.stop();
                this.sirenOsc.disconnect();
                this.sirenLFO.stop();
                this.sirenLFO.disconnect();
            } catch (e) {}
            this.sirenOsc = null;
            this.sirenLFO = null;
        }
        if (this.sirenGain) {
            try { this.sirenGain.disconnect(); } catch (e) {}
            this.sirenGain = null;
        }
    }

    playTireScreech() {
        this.resume();
        if (!this.ctx || this.screechGain || this.isMuted) return;
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.2;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.Q.setValueAtTime(4, now);

        this.screechGain = this.ctx.createGain();
        this.screechGain.gain.setValueAtTime(0.15, now);
        this.screechGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        noise.connect(filter);
        filter.connect(this.screechGain);
        this.screechGain.connect(this.ctx.destination);
        noise.start(now);

        setTimeout(() => {
            this.screechGain = null;
        }, 320);
    }

    cycleRadio() {
        this.resume();
        this.radioTrackIdx = (this.radioTrackIdx + 1) % this.radioTracks.length;
        const trackName = this.radioTracks[this.radioTrackIdx];
        if (trackName === 'Off') {
            this.stopRadio();
        } else {
            this.startRadio();
        }
        return trackName;
    }

    startRadio() {
        this.stopRadio();
        if (!this.ctx || this.isMuted) return;
        this.radioPlaying = true;

        // Procedural synth bass & arpeggio chords
        const notes = [
            [220, 261.6, 329.6], // Am
            [174.6, 220, 261.6], // F
            [261.6, 329.6, 392], // C
            [196.0, 246.9, 293.7] // G
        ];

        let chordStep = 0;
        let arpStep = 0;

        this.radioInterval = setInterval(() => {
            if (!this.radioPlaying || !this.ctx || this.isMuted) return;
            const now = this.ctx.currentTime;
            const currentChord = notes[chordStep];
            const noteFreq = currentChord[arpStep % currentChord.length];

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(noteFreq * (this.radioTrackIdx === 1 ? 0.5 : 1), now);

            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.25);

            arpStep++;
            if (arpStep % 4 === 0) {
                chordStep = (chordStep + 1) % notes.length;
            }
        }, 220);
    }

    stopRadio() {
        this.radioPlaying = false;
        if (this.radioInterval) {
            clearInterval(this.radioInterval);
            this.radioInterval = null;
        }
    }
}

window.soundSystem = new SoundSystem();
