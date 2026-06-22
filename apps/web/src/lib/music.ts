// Procedural jazz/funk music engine (Web Audio API).
//
// Synthesizes a Balatro-style loop entirely in code — walking bass,
// swing drums, Rhodes-style electric piano chords and a pentatonic lead,
// all routed through a slowly modulated filter for that psychedelic
// movement. No external audio assets, so it is 100% copyright-free and
// works offline (important inside MiniPay / web3 wallet browsers where
// external URLs can be blocked or fail).

type MaybeAudioContext = AudioContext & { resume?: () => Promise<void> };

const noteFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// 4-bar progression in D minor (jazzy/funky turnaround).
// Each bar: [root, chord tones] used for bass walking + Rhodes voicing.
const PROGRESSION = [
  { root: 38, chord: [50, 53, 57, 60] }, // Dm7  (D F A C)
  { root: 43, chord: [50, 55, 59, 62] }, // G7   (G B D F  — voiced up)
  { root: 38, chord: [50, 53, 57, 60] }, // Dm7
  { root: 45, chord: [49, 52, 57, 61] }, // A7   (A C# E G)
];

// Walking bass — 4 quarter notes per bar, beat 4 is a chromatic approach
// to the next bar's root (classic jazz voice-leading).
const BASS = [
  [38, 41, 45, 42], // Dm7 -> G7   (D F A F#)
  [43, 47, 50, 49], // G7  -> Dm7  (G B D C#)
  [38, 41, 45, 44], // Dm7 -> A7   (D F A G#)
  [45, 49, 52, 39], // A7  -> Dm7  (A C# E D#)
];

// Drum patterns — 8 eighth-notes per bar, 4 bars = 32 steps.
// Swing is applied to the off-beat (odd) eighths in the scheduler.
const STEPS = 32;
const KICK = [
  1, 0, 0, 1, 1, 0, 0, 0, // bar 1
  1, 0, 0, 1, 1, 0, 0, 0, // bar 2
  1, 0, 0, 1, 1, 0, 0, 0, // bar 3
  1, 0, 0, 1, 1, 0, 0, 1, // bar 4 (extra kick on the "and of 4" turnaround)
];
const SNARE = [
  0, 0, 1, 0, 0, 0, 1, 0,
  0, 0, 1, 0, 0, 0, 1, 0,
  0, 0, 1, 0, 0, 0, 1, 0,
  0, 0, 1, 0, 0, 0, 1, 0,
];
const HAT = Array(STEPS).fill(1); // eighths throughout

// Lead melody — D minor pentatonic (D F G A C) + occasional Eb blue note.
// -1 = rest. Voiced around D4–D5 (MIDI 62–74).
const LEAD = [
  69, -1, 72, -1, 74, -1, 72, 69, // bar 1: A C D C A
  67, -1, 70, -1, 72, -1, 70, 67, // bar 2: G Bb C Bb G  (G7 colour)
  65, -1, 69, -1, 72, -1, 69, 65, // bar 3: F A C A F
  70, 72, 74, -1, 72, 70, 69, -1, // bar 4: Bb C D C Bb A (turnaround)
];

const TEMPO = 104; // BPM — laid-back funky jazz
const SWING = 0.62; // off-beat eighth delay ratio (0.5 = straight, 0.66 = heavy)

export class MusicEngine {
  private ctx: MaybeAudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;

  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private step = 0;
  private volume = 0.5;
  private running = false;

  /** True if Web Audio is available in this environment. */
  static supported(): boolean {
    return typeof window !== "undefined" && typeof AudioContext !== "undefined";
  }

  /** Create / resume the AudioContext. Must be triggered by a user gesture. */
  async start(): Promise<boolean> {
    if (!MusicEngine.supported()) return false;
    if (!this.ctx) this.initGraph();

    const ctx = this.ctx!;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }

    if (this.running) return true;
    this.running = true;
    this.step = 0;
    this.nextStepTime = ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.scheduler(), 25);
    return true;
  }

  /** Stop scheduling and suspend the context (frees the audio thread). */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx && this.ctx.state === "running") {
      this.ctx.suspend().catch(() => {});
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  dispose(): void {
    this.stop();
    if (this.lfo) {
      try { this.lfo.stop(); } catch { /* already stopped */ }
      this.lfo = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  // ─── Internal: build the master signal chain ───
  private initGraph(): void {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    this.ctx = new Ctx() as MaybeAudioContext;
    const ctx = this.ctx;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 24;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.005;
    this.comp.release.value = 0.18;

    // Slowly sweeping low-pass for the psychedelic Balatro movement.
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 1400;
    this.filter.Q.value = 0.8;

    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = 0.08; // ~12s cycle
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 700;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);
    this.lfo.start();

    this.master = ctx.createGain();
    this.master.gain.value = this.volume;

    // instrument bus -> filter -> compressor -> master -> out
    this.filter.connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(ctx.destination);
  }

  private bus(): AudioNode {
    return this.filter!;
  }

  // ─── Scheduler (lookahead pattern, Chris Wilson "A Tale of Two Clocks") ───
  private scheduler(): void {
    if (!this.ctx || !this.running) return;
    const ctx = this.ctx;
    const eighth = 60 / TEMPO / 2; // duration of one 8th note
    while (this.nextStepTime < ctx.currentTime + 0.12) {
      const bar = Math.floor(this.step / 8) % 4;
      const local = this.step % 8;

      // Swing: delay odd (off-beat) eighths.
      const swingDelay = local % 2 === 1 ? eighth * (SWING - 0.5) * 2 : 0;
      const t = this.nextStepTime + swingDelay;

      this.scheduleStep(this.step, bar, local, t);
      this.nextStepTime += eighth;
      this.step = (this.step + 1) % STEPS;
    }
  }

  private scheduleStep(step: number, bar: number, local: number, t: number): void {
    // Drums
    if (KICK[step]) this.kick(t);
    if (SNARE[step]) this.snare(t);
    if (HAT[step]) this.hat(t, local % 2 === 1 ? 0.18 : 0.3);

    // Bass on the beat (local 0,2,4,6 = quarter notes)
    if (local % 2 === 0) {
      const q = local / 2;
      const midi = BASS[bar][q];
      this.bass(midi, t, 60 / TEMPO / 2 * 1.8);
    }

    // Rhodes: sustain the chord at the top of each bar + a soft stab on beat 3
    if (local === 0) {
      this.rhodes(PROGRESSION[bar].chord, t, 60 / TEMPO * 3.6, 0.16);
    } else if (local === 4) {
      this.rhodes(PROGRESSION[bar].chord, t, 60 / TEMPO * 0.9, 0.1);
    }

    // Lead melody
    const note = LEAD[step];
    if (note > 0) this.lead(note, t, 60 / TEMPO / 2 * 0.9);
  }

  // ─── Voices ───
  private env(gain: GainNode, t: number, a: number, d: number, s: number, r: number, peak: number, sustain: number) {
    const g = gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + a);
    g.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
    g.setValueAtTime(Math.max(sustain, 0.0001), t + a + d);
    g.exponentialRampToValueAtTime(0.0001, t + a + d + s + r);
  }

  private bass(midi: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = noteFreq(midi);
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = noteFreq(midi - 12); // sub-octave for weight
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    lp.Q.value = 4;
    const g = ctx.createGain();
    this.env(g, t, 0.008, 0.06, Math.max(dur - 0.1, 0.05), 0.08, 0.5, 0.28);
    osc.connect(lp); sub.connect(lp); lp.connect(g); g.connect(this.bus());
    osc.start(t); sub.start(t);
    const stopAt = t + dur + 0.12;
    osc.stop(stopAt); sub.stop(stopAt);
  }

  private rhodes(midiList: number[], t: number, dur: number, peak: number): void {
    const ctx = this.ctx!;
    for (const midi of midiList) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = noteFreq(midi);
      // FM modulator for the Rhodes bell tone.
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.value = noteFreq(midi) * 2;
      const modGain = ctx.createGain();
      modGain.gain.value = noteFreq(midi) * 0.4;
      mod.connect(modGain); modGain.connect(osc.frequency);

      const g = ctx.createGain();
      this.env(g, t, 0.02, 0.25, Math.max(dur - 0.4, 0.2), 0.4, peak, peak * 0.35);
      osc.connect(g); g.connect(this.bus());
      osc.start(t); mod.start(t);
      const stopAt = t + dur + 0.5;
      osc.stop(stopAt); mod.stop(stopAt);
    }
  }

  private lead(midi: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = noteFreq(midi);
    // gentle vibrato
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 5.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = noteFreq(midi) * 0.006;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = noteFreq(midi) * 2;
    bp.Q.value = 1;

    const g = ctx.createGain();
    this.env(g, t, 0.01, 0.08, Math.max(dur - 0.12, 0.05), 0.12, 0.22, 0.12);
    osc.connect(bp); bp.connect(g); g.connect(this.bus());
    osc.start(t); lfo.start(t);
    const stopAt = t + dur + 0.2;
    osc.stop(stopAt); lfo.stop(stopAt);
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g); g.connect(this.bus());
    osc.start(t); osc.stop(t + 0.24);
  }

  private snare(t: number): void {
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "highpass";
    bp.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    noise.connect(bp); bp.connect(g); g.connect(this.bus());
    noise.start(t); noise.stop(t + 0.18);
  }

  private hat(t: number, peak: number): void {
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    noise.connect(hp); hp.connect(g); g.connect(this.bus());
    noise.start(t); noise.stop(t + 0.06);
  }
}
