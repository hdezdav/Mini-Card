// Procedural Balatro-style music engine (Web Audio API).
//
// Synthesizes a psychedelic lounge/funk loop entirely in code — walking
// upright bass, swing brushed drums, a Rhodes-style electric piano with a
// heavy pulsing tremolo (the signature Balatro EP wobble), rich rootless
// jazz voicings (9ths / 13ths / #9), and a muted-trumpet lead. Everything
// runs through a slowly sweeping resonant low-pass plus a gentle tape-style
// saturation for warmth. No external audio assets, so it is 100%
// copyright-free and works offline (important inside MiniPay / web3 wallet
// browsers where external URLs can be blocked or fail).

type MaybeAudioContext = AudioContext & { resume?: () => Promise<void> };

const noteFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// Soft-clipping curve for tape/brass saturation. `amount` controls how hard
// the signal is driven — 1.2 = subtle warmth, 2.2 = brassy edge.
function softCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount);
  }
  return c;
}

// Synthesized small-room impulse response for the master reverb — puts the
// whole ensemble in a lounge space. Stereo, with decorrelated channels and a
// few early reflections for a sense of room size.
function makeRoomIR(ctx: AudioContext, seconds = 1.8, decay = 2.2): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    const phase = ch === 1 ? 0.7 : 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      let env = Math.pow(1 - t, decay);
      if (i === Math.floor(len * 0.025)) env *= 1.22;
      if (i === Math.floor(len * 0.06)) env *= 1.14;
      if (i === Math.floor(len * 0.11)) env *= 1.07;
      data[i] = (Math.random() * 2 - 1) * env * (0.6 + 0.4 * Math.sin(i * 0.009 + phase));
    }
  }
  return buf;
}

// 4-bar progression in D minor (psychedelic lounge turnaround).
// Each bar: [root, rootless chord voicing]. The voicings use upper
// extensions (9 / 13 / #9) for that colorful, slightly "out" Balatro feel.
const PROGRESSION = [
  { root: 38, chord: [53, 57, 60, 64] }, // Dm9  (F A C E   — b3 5 b7 9)
  { root: 43, chord: [53, 57, 59, 64] }, // G13  (F A B E   — b7 9 3 13)
  { root: 38, chord: [53, 57, 60, 64] }, // Dm9
  { root: 45, chord: [52, 55, 58, 61] }, // A7#9 (E G Bb C# — 5 b7 #9 3)
];

// Walking bass — 4 quarter notes per bar, beat 4 is a chromatic approach
// to the next bar's root (classic jazz voice-leading).
const BASS = [
  [38, 41, 45, 42], // Dm9 -> G13  (D F# A F)
  [43, 47, 50, 49], // G13 -> Dm9  (G B D C#)
  [38, 41, 45, 44], // Dm9 -> A7#9 (D F A G#)
  [45, 49, 52, 39], // A7#9 -> Dm9 (A C# E Eb)
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
const HAT = Array(STEPS).fill(1); // brushed eighths throughout

// Lead melody — D minor pentatonic (D F G A C) + blue notes.
// -1 = rest. Voiced around D4–D5 (MIDI 62–74).
const LEAD = [
  69, -1, 72, -1, 74, -1, 72, 69, // bar 1: A C D C A
  71, -1, 74, -1, 72, -1, 71, 69, // bar 2: B D C B A  (hits G13's 3rd & 9th)
  65, -1, 69, -1, 72, -1, 69, 65, // bar 3: F A C A F
  70, 72, 74, -1, 72, 70, 69, -1, // bar 4: Bb C D C Bb A (turnaround, #9 colour)
];

const TEMPO = 100; // BPM — laid-back lounge
const SWING = 0.65; // off-beat eighth delay ratio (0.5 = straight, 0.66 = heavy)

export class MusicEngine {
  private ctx: MaybeAudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;

  // Rhodes tremolo bus — the woozy pulsing gain that defines the Balatro EP.
  private rhodesBus: GainNode | null = null;
  private rhodesTrem: OscillatorNode | null = null;
  private rhodesTremDepth: GainNode | null = null;
  private rhodesPan: StereoPannerNode | null = null;
  private brassCurve: Float32Array<ArrayBuffer> | null = null;

  // Master reverb (lounge space) + dry/wet split.
  private reverb: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;

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
    if (this.rhodesTrem) {
      try { this.rhodesTrem.stop(); } catch { /* already stopped */ }
      this.rhodesTrem = null;
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
    this.comp.threshold.value = -16;
    this.comp.knee.value = 26;
    this.comp.ratio.value = 3;
    this.comp.attack.value = 0.006;
    this.comp.release.value = 0.2;

    // Gentle tape-style saturation for warmth across the whole mix.
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = softCurve(1.3);
    this.shaper.oversample = "2x";

    // Slowly sweeping resonant low-pass for the psychedelic Balatro movement.
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 1500;
    this.filter.Q.value = 0.9;

    this.lfo = ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = 0.09; // ~11s cycle
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 1100; // sweeps ~400Hz → ~2600Hz
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);
    this.lfo.start();

    this.master = ctx.createGain();
    this.master.gain.value = this.volume;

    // Master reverb — convolution with a synthesized lounge-room IR. The mix
    // splits into a dry path and a wet (reverb) path after the compressor,
    // both summing at master so the whole ensemble sits in one space.
    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 0.85;
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeRoomIR(ctx, 1.8, 2.2);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.15; // wet mix — present but subtle

    // instrument bus -> filter -> saturator -> compressor -> [dry | wet] -> master -> out
    this.filter.connect(this.shaper);
    this.shaper.connect(this.comp);
    this.comp.connect(this.dryGain);
    this.dryGain.connect(this.master);
    this.comp.connect(this.reverb);
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);
    this.master.connect(ctx.destination);

    // ─── Rhodes tremolo bus ───
    // A gain node whose level is modulated by a ~5.4Hz sine LFO, giving the
    // electric piano its woozy, pulsing Balatro wobble. All Rhodes notes
    // route through here, then through a stereo panner (Rhodes sits left) to
    // the filter.
    this.rhodesBus = ctx.createGain();
    this.rhodesBus.gain.value = 0.75;
    this.rhodesTrem = ctx.createOscillator();
    this.rhodesTrem.type = "sine";
    this.rhodesTrem.frequency.value = 5.4;
    this.rhodesTremDepth = ctx.createGain();
    this.rhodesTremDepth.gain.value = 0.28; // depth: gain ranges ~0.47 → 1.03
    this.rhodesTrem.connect(this.rhodesTremDepth);
    this.rhodesTremDepth.connect(this.rhodesBus.gain);
    this.rhodesTrem.start();
    this.rhodesPan = ctx.createStereoPanner();
    this.rhodesPan.pan.value = -0.3; // Rhodes panned left
    this.rhodesBus.connect(this.rhodesPan);
    this.rhodesPan.connect(this.filter);

    // Pre-computed brassy soft-clip curve for the muted-trumpet lead.
    this.brassCurve = softCurve(2.2);
  }

  private bus(): AudioNode {
    return this.filter!;
  }

  // Connect a voice into the filter, panned across the stereo field. Returns
  // a StereoPanner (pan != 0) or the filter directly (center). Panning before
  // the shared filter keeps the sweeping low-pass on the whole stereo mix.
  private out(pan: number): AudioNode {
    if (pan === 0) return this.filter!;
    const p = this.ctx!.createStereoPanner();
    p.pan.value = pan;
    p.connect(this.filter!);
    return p;
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
    // Drums (brushed / soft)
    if (KICK[step]) this.kick(t);
    if (SNARE[step]) this.snare(t);
    if (HAT[step]) this.hat(t, local % 2 === 1 ? 0.13 : 0.19);

    // Bass on the beat (local 0,2,4,6 = quarter notes)
    if (local % 2 === 0) {
      const q = local / 2;
      const midi = BASS[bar][q];
      this.bass(midi, t, 60 / TEMPO / 2 * 1.8);
    }

    // Rhodes: sustain the chord at the top of each bar + a soft stab on beat 3
    if (local === 0) {
      this.rhodes(PROGRESSION[bar].chord, t, 60 / TEMPO * 3.6, 0.15);
    } else if (local === 4) {
      this.rhodes(PROGRESSION[bar].chord, t, 60 / TEMPO * 0.9, 0.09);
    }

    // Muted-trumpet lead
    const note = LEAD[step];
    if (note > 0) this.trumpet(note, t, 60 / TEMPO / 2 * 0.9);
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

  // Round upright-bass: saw + sine sub-octave through a soft low-pass, with a
  // short finger-pluck transient at the attack for a real plucked feel.
  private bass(midi: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = noteFreq(midi);
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = noteFreq(midi - 12); // sub-octave for weight
    const oscG = ctx.createGain(); oscG.gain.value = 0.45;
    const subG = ctx.createGain(); subG.gain.value = 0.7; // rounder, sub-heavy
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    lp.Q.value = 2.2;
    const g = ctx.createGain();
    this.env(g, t, 0.012, 0.09, Math.max(dur - 0.12, 0.06), 0.09, 0.42, 0.24);
    osc.connect(oscG); sub.connect(subG);
    oscG.connect(lp); subG.connect(lp); lp.connect(g); g.connect(this.bus());
    osc.start(t); sub.start(t);
    const stopAt = t + dur + 0.12;
    osc.stop(stopAt); sub.stop(stopAt);

    // Pluck transient — a tiny filtered-noise flick at the finger attack.
    const pLen = Math.floor(ctx.sampleRate * 0.018);
    const pBuf = ctx.createBuffer(1, pLen, ctx.sampleRate);
    const pDat = pBuf.getChannelData(0);
    for (let i = 0; i < pLen; i++) pDat[i] = (Math.random() * 2 - 1) * (1 - i / pLen);
    const pNoise = ctx.createBufferSource();
    pNoise.buffer = pBuf;
    const pBp = ctx.createBiquadFilter();
    pBp.type = "bandpass";
    pBp.frequency.value = noteFreq(midi) * 2;
    pBp.Q.value = 1.2;
    const pG = ctx.createGain();
    pG.gain.setValueAtTime(0.0001, t);
    pG.gain.exponentialRampToValueAtTime(0.12, t + 0.001);
    pG.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    pNoise.connect(pBp); pBp.connect(pG); pG.connect(this.bus());
    pNoise.start(t); pNoise.stop(t + 0.03);
  }

  // Rhodes-style electric piano: FM-sine bell tone routed through the
  // tremolo bus for the woozy Balatro wobble.
  private rhodes(midiList: number[], t: number, dur: number, peak: number): void {
    const ctx = this.ctx!;
    for (const midi of midiList) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = noteFreq(midi);
      // FM modulator for the Rhodes bell tone (darker than before).
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.value = noteFreq(midi) * 2;
      const modGain = ctx.createGain();
      modGain.gain.value = noteFreq(midi) * 0.22;
      mod.connect(modGain); modGain.connect(osc.frequency);

      const g = ctx.createGain();
      this.env(g, t, 0.015, 0.3, Math.max(dur - 0.5, 0.25), 0.45, peak, peak * 0.3);
      osc.connect(g); g.connect(this.rhodesBus!); // -> tremolo -> filter
      osc.start(t); mod.start(t);
      const stopAt = t + dur + 0.5;
      osc.stop(stopAt); mod.stop(stopAt);
    }
  }

  // Muted-trumpet lead: sawtooth with a quick lip-slide ("doit") into the
  // note, delayed vibrato, a bandpass for the muted-horn character, and a
  // brassy soft-clip for edge.
  private trumpet(midi: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    // "Doit" — slide up into the pitch from just below for that brass attack.
    osc.frequency.setValueAtTime(noteFreq(midi) * 0.94, t);
    osc.frequency.exponentialRampToValueAtTime(noteFreq(midi), t + 0.05);

    // Delayed vibrato: brass vibrato only comes in after the attack settles.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 5.6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, t);
    lfoGain.gain.linearRampToValueAtTime(noteFreq(midi) * 0.007, t + 0.22);
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = noteFreq(midi) * 1.5;
    bp.Q.value = 1.8;

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.brassCurve;
    shaper.oversample = "2x";

    const g = ctx.createGain();
    this.env(g, t, 0.025, 0.14, Math.max(dur - 0.18, 0.1), 0.14, 0.2, 0.13);
    osc.connect(bp); bp.connect(shaper); shaper.connect(g); g.connect(this.out(0.32));
    osc.start(t); lfo.start(t);
    const stopAt = t + dur + 0.3;
    osc.stop(stopAt); lfo.stop(stopAt);
  }

  // Soft, round kick with a beater "click" transient at the attack.
  private kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g); g.connect(this.bus());
    osc.start(t); osc.stop(t + 0.22);

    // Beater click — a 3ms high-frequency noise flick for the pedal attack.
    const nLen = Math.floor(ctx.sampleRate * 0.004);
    const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
    const nDat = nBuf.getChannelData(0);
    for (let i = 0; i < nLen; i++) nDat[i] = (Math.random() * 2 - 1) * (1 - i / nLen);
    const click = ctx.createBufferSource();
    click.buffer = nBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6000;
    const cG = ctx.createGain();
    cG.gain.setValueAtTime(0.0001, t);
    cG.gain.exponentialRampToValueAtTime(0.22, t + 0.0008);
    cG.gain.exponentialRampToValueAtTime(0.0001, t + 0.006);
    click.connect(hp); hp.connect(cG); cG.connect(this.bus());
    click.start(t); click.stop(t + 0.01);
  }

  // Brushed snare / cross-stick — noise burst plus a tonal snare-wire body
  // for a snappier, more realistic hit. Panned slightly left.
  private snare(t: number): void {
    const ctx = this.ctx!;
    const out = this.out(-0.18);

    // Tonal body — two detuned oscillators for the snare-wire resonance.
    const bodyA = ctx.createOscillator();
    bodyA.type = "triangle";
    bodyA.frequency.value = 220;
    const bodyB = ctx.createOscillator();
    bodyB.type = "triangle";
    bodyB.frequency.value = 331;
    const bG = ctx.createGain();
    bG.gain.setValueAtTime(0.0001, t);
    bG.gain.exponentialRampToValueAtTime(0.1, t + 0.004);
    bG.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    bodyA.connect(bG); bodyB.connect(bG); bG.connect(out);
    bodyA.start(t); bodyB.start(t);
    bodyA.stop(t + 0.1); bodyB.stop(t + 0.1);

    // Brushed noise burst.
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "highpass";
    bp.frequency.value = 1700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    noise.connect(bp); bp.connect(g); g.connect(out);
    noise.start(t); noise.stop(t + 0.16);
  }

  // Brushed hi-hat — short, soft, high noise tick.
  private hat(t: number, peak: number): void {
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 8000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    noise.connect(hp); hp.connect(g); g.connect(this.out(0.22));
    noise.start(t); noise.stop(t + 0.06);
  }
}
