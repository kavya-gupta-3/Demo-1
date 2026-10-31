/**
 * The whole soundtrack is synthesised live with the Web Audio API — zero
 * audio files. A detuned drone retunes to each dragon's chord, wind rises
 * with scroll speed, every interaction has a voice, and on the "music"
 * hobby a generative pentatonic melody plays (with a live analyser driving
 * the equaliser on the page).
 */

const CHORDS: number[][] = [
  [55.0, 82.41, 110.0, 164.81],
  [73.42, 110.0, 146.83, 220.0],
  [61.74, 92.5, 123.47, 185.0],
  [65.41, 98.0, 130.81, 196.0],
  [69.3, 103.83, 138.59, 207.65],
  [82.41, 123.47, 164.81, 246.94],
  [58.27, 87.31, 116.54, 174.61],
];
const CUTOFF = [380, 900, 700, 620, 760, 1100, 520];
// D major pentatonic over two octaves — warm, "filmy"
const MELODY = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0];

export class Synth {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private verb!: ConvolverNode;
  private verbSend!: GainNode;
  private droneGain!: GainNode;
  private droneFilter!: BiquadFilterNode;
  private oscs: OscillatorNode[] = [];
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private analyser!: AnalyserNode;
  private noise!: AudioBuffer;
  private nextNote = 0;
  private stage = 0;
  enabled = false;
  music = 0;

  get available() {
    return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
  }

  private build() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.75;
    this.master.connect(comp).connect(this.analyser).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    // generated cave reverb
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(3.4, 2.4);
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.55;
    this.verbSend.connect(this.verb).connect(this.master);
    this.sfx.connect(this.verbSend);

    // drone
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = CUTOFF[0];
    this.droneFilter.Q.value = 5;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.05;
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.master);
    this.droneGain.connect(this.verbSend);
    CHORDS[0].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 6;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.9 : 0.32;
      o.connect(g).connect(this.droneFilter);
      o.start();
      this.oscs.push(o);
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(this.droneFilter.frequency);
    lfo.start();

    // wind
    this.noise = this.noiseBuffer(2);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.015;
    src.connect(this.windFilter).connect(this.windGain).connect(this.master);
    src.start();
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private noiseBuffer(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      b = 0.97 * b + 0.03 * (Math.random() * 2 - 1);
      d[i] = b * 3.5;
    }
    return buf;
  }

  async enable() {
    if (!this.available) return;
    if (!this.ctx) this.build();
    await this.ctx!.resume();
    const t = this.ctx!.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.85, t, 0.6);
    this.enabled = true;
    this.setStage(this.stage, true);
  }

  disable() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.15);
    this.enabled = false;
    window.setTimeout(() => {
      if (!this.enabled) void this.ctx?.suspend();
    }, 800);
  }

  setStage(i: number, force = false) {
    if (i === this.stage && !force) return;
    this.stage = i;
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    CHORDS[i].forEach((f, k) => this.oscs[k]?.frequency.setTargetAtTime(f, t, 1.2));
    this.droneFilter.frequency.setTargetAtTime(CUTOFF[i], t, 1.5);
    this.whoosh();
  }

  /** Per-frame: wind follows scroll speed, melody on the music hobby. */
  tick(scrollVelocity: number) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const v = Math.min(1, Math.abs(scrollVelocity) / 40);
    this.windGain.gain.setTargetAtTime(0.012 + v * 0.11, t, 0.25);
    this.windFilter.frequency.setTargetAtTime(380 + v * 1800, t, 0.3);
    if (this.music > 0.5) {
      if (this.nextNote < t) this.nextNote = t + 0.05;
      while (this.nextNote < t + 0.12) {
        const step = Math.random();
        const note = MELODY[Math.floor(Math.random() * MELODY.length)];
        if (step > 0.18) this.pluck(note, this.nextNote, 0.12 * this.music);
        this.nextNote += step > 0.85 ? 0.5 : 0.25;
      }
    }
  }

  /** 0‥255 levels for a visualiser. */
  levels(out: Uint8Array<ArrayBuffer>) {
    if (!this.ctx || !this.enabled) return false;
    this.analyser.getByteFrequencyData(out);
    return true;
  }

  private env(gain: GainNode, t: number, peak: number, attack: number, release: number) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  private pluck(freq: number, t: number, vol: number) {
    const ctx = this.ctx!;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.value = freq;
    mod.frequency.value = freq * 2;
    modGain.gain.setValueAtTime(freq * 1.6, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + 0.5);
    mod.connect(modGain).connect(car.frequency);
    car.connect(g).connect(this.sfx);
    this.env(g, t, vol, 0.005, 0.9);
    car.start(t);
    mod.start(t);
    car.stop(t + 1);
    mod.stop(t + 1);
  }

  blip(freq = 1400, vol = 0.04) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.04);
    o.connect(g).connect(this.sfx);
    this.env(g, t, vol, 0.002, 0.06);
    o.start(t);
    o.stop(t + 0.1);
  }

  click() {
    this.blip(520, 0.06);
  }

  whoosh() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
    f.frequency.exponentialRampToValueAtTime(300, t + 1.3);
    const g = ctx.createGain();
    src.connect(f).connect(g).connect(this.sfx);
    this.env(g, t, 0.35, 0.4, 0.9);
    src.start(t);
    src.stop(t + 1.5);
  }

  /** A dragon roar: falling saw + growl noise through a resonant filter. */
  roar(pitch = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(48 * pitch, t + 1.4);
    const am = ctx.createOscillator();
    am.frequency.value = 32;
    const amGain = ctx.createGain();
    amGain.gain.value = 0.5;
    const body = ctx.createGain();
    body.gain.value = 0.5;
    am.connect(amGain).connect(body.gain);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 8;
    f.frequency.setValueAtTime(900 * pitch, t);
    f.frequency.exponentialRampToValueAtTime(160, t + 1.5);
    const g = ctx.createGain();
    o.connect(body);
    src.connect(body);
    body.connect(f).connect(g).connect(this.sfx);
    this.env(g, t, 0.5, 0.08, 1.5);
    o.start(t);
    am.start(t);
    src.start(t);
    o.stop(t + 1.7);
    am.stop(t + 1.7);
    src.stop(t + 1.7);
  }

  zap() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    src.connect(f).connect(g).connect(this.sfx);
    for (let k = 0; k < 4; k++) {
      const s = t + k * 0.05 + Math.random() * 0.03;
      g.gain.setValueAtTime(0.25 * Math.random() + 0.1, s);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.04);
    }
    src.start(t);
    src.stop(t + 0.4);
    const thunder = ctx.createBufferSource();
    thunder.buffer = this.noise;
    const lf = ctx.createBiquadFilter();
    lf.type = 'lowpass';
    lf.frequency.value = 160;
    const tg = ctx.createGain();
    thunder.connect(lf).connect(tg).connect(this.sfx);
    this.env(tg, t + 0.15, 0.6, 0.05, 2.2);
    thunder.start(t + 0.15);
    thunder.stop(t + 2.6);
  }

  chime() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    [1318.5, 1567.98, 2093].forEach((f, i) => this.pluck(f, t + i * 0.07, 0.06));
  }
}
