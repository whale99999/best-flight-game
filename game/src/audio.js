// Skyline Courier — tiny WebAudio sounds, written inline, no audio files.
//
// Engine hum (a low sawtooth whose pitch follows the throttle), a ring chime,
// a star blip, a cloud-hit thud and a landing chord. Everything is created
// lazily on the first user gesture and guarded, so a browser without audio
// (or a headless screenshot run) simply stays silent instead of erroring.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 58;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  resume() {
    if (this.ensure() && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setEngine(throttle, flying) {
    if (!this.ctx || !this.engineOsc) return;
    const target = this.muted || !flying ? 0 : 0.02 + throttle * 0.035;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
    this.engineOsc.frequency.setTargetAtTime(52 + throttle * 48, this.ctx.currentTime, 0.15);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // A short sine note: frequency, seconds, peak gain, optional glide to.
  note(freq, seconds, gain, glideTo) {
    if (!this.ensure() || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, this.ctx.currentTime + seconds);
      g.gain.setValueAtTime(gain, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + seconds);
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + seconds + 0.02);
    } catch {
      // Silence on any audio failure; the game never depends on sound.
    }
  }

  ring() {
    this.note(880, 0.35, 0.16);
    window.setTimeout(() => this.note(1318, 0.45, 0.14), 70);
  }

  star() {
    this.note(1174, 0.16, 0.12, 1568);
  }

  hit() {
    this.note(110, 0.3, 0.28, 55);
  }

  land() {
    this.note(523, 0.4, 0.14);
    window.setTimeout(() => this.note(659, 0.4, 0.14), 110);
    window.setTimeout(() => this.note(784, 0.6, 0.14), 220);
  }
}
