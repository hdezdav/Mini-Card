// Procedural sound-effects engine (Web Audio API) for MiniCard.
//
// All card / play / scoring / shop cues are synthesized in code — no audio
// assets — so everything is copyright-free and works offline inside MiniPay
// / web3 wallet browsers.
//
// Realism layer:
//   - Convolution reverb bus with a synthesized room impulse response gives
//     every cue a sense of space (cards on a felt table in a small room).
//   - Stereo panning spreads sounds across the field — deal/discard sweep
//     left↔right so repeated cards don't sound identical.
//   - Layered voices: a sub osc + noise transient on stabs/chips adds body.
//   - Per-call variation: deal & swoosh randomize filter freq + pan so no two
//     cards sound exactly the same.
//
// Browser autoplay policy: AudioContext can only be created/resumed from a
// user gesture. The first SFX call from a real interaction (card click, play
// button) is that gesture, so SFX "just work" once the user starts playing.

type MaybeAudioContext = AudioContext & { resume?: () => Promise<void> };

const noteFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// Soft-clip curve for the brassy / punchy transients.
function softCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 512;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount);
  }
  return c;
}

// Build a short room impulse response for convolution reverb.
// Models a small room: exponential decay with a touch of early reflections.
function makeImpulseResponse(ctx: AudioContext, seconds = 1.4, decay = 2.8): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // Exponential decay envelope
      let env = Math.pow(1 - t, decay);
      // A couple of early reflections for a sense of room size
      if (i === Math.floor(len * 0.03)) env *= 1.25;
      if (i === Math.floor(len * 0.07)) env *= 1.15;
      if (i === Math.floor(len * 0.13)) env *= 1.08;
      // Slight inter-channel decorrelation for a wider stereo image
      const phase = ch === 1 ? 0.7 : 0;
      data[i] = (Math.random() * 2 - 1) * env * (0.6 + 0.4 * Math.sin(i * 0.01 + phase));
    }
  }
  return buf;
}

export type SfxName =
  | "select"
  | "deselect"
  | "play"
  | "chip"
  | "mult"
  | "joker"
  | "buy"
  | "sell"
  | "win"
  | "lose"
  | "deal"
  | "discard";

export class SfxEngine {
  private ctx: MaybeAudioContext | null = null;
  private master: GainNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private curve: Float32Array<ArrayBuffer> | null = null;
  // Reverb bus
  private reverb: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;

  private volume = 0.6;
  private enabled = true;
  private running = false;

  /** True if Web Audio is available in this environment. */
  static supported(): boolean {
    return typeof window !== "undefined" && typeof AudioContext !== "undefined";
  }

  /** Lazily build the graph on first use (from a user gesture). */
  private ensure(): boolean {
    if (this.ctx) return true;
    if (!SfxEngine.supported()) return false;
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    this.ctx = new Ctx() as MaybeAudioContext;
    const ctx = this.ctx;

    this.curve = softCurve(1.6);
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = this.curve;
    this.shaper.oversample = "2x";

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -10;
    this.comp.knee.value = 20;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.12;

    // Reverb bus — convolution with a synthesized small-room IR.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulseResponse(ctx, 1.4, 2.8);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.22; // wet mix
    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 0.85; // dry mix

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;

    // Routing: voices -> shaper -> comp -> [dry -> master] + [reverb -> reverbGain -> master]
    // Voices connect to shaper (the "out()" node). After the comp we split
    // into a dry path and a wet (reverb) path, both summing at master.
    this.shaper.connect(this.comp);
    this.comp.connect(this.dryGain);
    this.dryGain.connect(this.master);
    this.comp.connect(this.reverb);
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);
    this.master.connect(ctx.destination);
    return true;
  }

  /** Resume the context (must follow a user gesture). Idempotent. */
  async resume(): Promise<void> {
    if (!this.ensure()) return;
    const ctx = this.ctx!;
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    this.running = ctx.state === "running";
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.03);
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.03);
    }
  }

  /** Is the SFX graph live and producing sound? */
  isRunning(): boolean {
    return this.running;
  }

  dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.master = null;
    this.shaper = null;
    this.comp = null;
    this.reverb = null;
    this.reverbGain = null;
    this.dryGain = null;
  }

  // ─── Public: play a named cue ───
  play(name: SfxName): void {
    if (!this.enabled) return;
    if (!this.ensure()) return;
    const ctx = this.ctx!;
    // Best-effort resume — if suspended (no gesture yet), this is a no-op and
    // the cue is simply dropped. Real interactions resume it fine.
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const t = ctx.currentTime;
    switch (name) {
      case "select":   return this.blip(t, 72, 0.06, "square", 0.22, 0.0, 0.0, false, 0.0);
      case "deselect": return this.blip(t, 64, 0.06, "square", 0.18, 0.0, 0.0, false, 0.0);
      case "play":     return this.chordStab(t, [57, 60, 64], 0.22, 0);
      case "chip":     return this.blip(t, 84, 0.05, "triangle", 0.2, 0.0, 0.0, true, this.randPan());
      case "mult":     return this.blip(t, 67, 0.08, "sawtooth", 0.22, 0.0, 0.0, true, this.randPan());
      case "joker":    return this.zap(t, 60, 83);
      case "buy":      return this.arpeggio(t, [60, 64, 67, 72], 0.05);
      case "sell":     return this.arpeggio(t, [72, 67, 64, 60], 0.05);
      case "win":      return this.fanfare(t);
      case "lose":     return this.descend(t);
      case "deal":     return this.deal(t);
      case "discard":  return this.swoosh(t);
    }
  }

  // ─── Voices ───
  private out(): AudioNode {
    return this.shaper!;
  }

  // Random stereo pan in [-0.5, 0.5] for per-call variation.
  private randPan(): number {
    return Math.random() * 1.0 - 0.5;
  }

  // Connect a node through a stereo panner to the output bus.
  private withPan(node: AudioNode, pan: number): AudioNode {
    if (pan === 0) return node;
    const ctx = this.ctx!;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    node.connect(panner);
    return panner;
  }

  private env(gain: GainNode, t: number, a: number, d: number, s: number, r: number, peak: number, sustain: number) {
    const g = gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + a);
    g.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
    g.setValueAtTime(Math.max(sustain, 0.0001), t + a + d);
    g.exponentialRampToValueAtTime(0.0001, t + a + d + s + r);
  }

  // Single oscillator blip — the workhorse for select / chip / mult ticks.
  // `up` adds a quick upward pitch slide for a brighter "tick".
  // `pan` spreads the voice in the stereo field. A subtle sub-octave sine adds
  // body so the tick isn't a thin bare oscillator.
  private blip(
    t: number,
    midi: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    slideTo?: number,
    slideTime?: number,
    up = false,
    pan = 0,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(noteFreq(midi) * (up ? 0.9 : 1), t);
    if (slideTo !== undefined && slideTime) {
      osc.frequency.exponentialRampToValueAtTime(noteFreq(slideTo), t + slideTime);
    } else if (up) {
      osc.frequency.exponentialRampToValueAtTime(noteFreq(midi), t + 0.02);
    }
    const g = ctx.createGain();
    this.env(g, t, 0.004, 0.02, Math.max(dur - 0.05, 0.02), 0.04, peak, peak * 0.4);

    // Sub-octave sine for body (one octave down, quieter)
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = noteFreq(midi - 12);
    const subG = ctx.createGain();
    this.env(subG, t, 0.004, 0.03, Math.max(dur - 0.05, 0.02), 0.05, peak * 0.3, peak * 0.12);

    const outNode = this.withPan(g, pan);
    const subOut = this.withPan(subG, pan);
    osc.connect(g); g.connect(outNode); outNode.connect(this.out());
    sub.connect(subG); subG.connect(subOut); subOut.connect(this.out());
    osc.start(t); sub.start(t);
    osc.stop(t + dur + 0.1); sub.stop(t + dur + 0.1);
  }

  // Short bright chord stab for "Play Hand". Layered with a noise transient
  // for a percussive "hit" attack, and panned slightly wide for width.
  private chordStab(t: number, midiList: number[], dur: number, pan = 0): void {
    const ctx = this.ctx!;
    const spread = 0.18;
    midiList.forEach((midi, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = noteFreq(midi);
      const g = ctx.createGain();
      this.env(g, t, 0.005, 0.04, Math.max(dur - 0.08, 0.05), 0.08, 0.18, 0.08);
      // Spread chord voices across the stereo field
      const voicePan = pan + (i - (midiList.length - 1) / 2) * spread;
      const outNode = this.withPan(g, voicePan);
      osc.connect(g); g.connect(outNode); outNode.connect(this.out());
      osc.start(t);
      osc.stop(t + dur + 0.12);
    });
    // Noise transient for a percussive attack
    this.noiseTick(t, 0.04, 3000, 0.06, pan);
  }

  // Rising "zap" for joker triggers — pitch sweeps up with a bright timbre.
  private zap(t: number, fromMidi: number, toMidi: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(noteFreq(fromMidi), t);
    osc.frequency.exponentialRampToValueAtTime(noteFreq(toMidi), t + 0.18);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(noteFreq(fromMidi) * 2, t);
    bp.frequency.exponentialRampToValueAtTime(noteFreq(toMidi) * 2, t + 0.18);
    bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(bp); bp.connect(g); g.connect(this.out());
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // Quick ascending / descending arpeggio for buy / sell.
  private arpeggio(t: number, midiList: number[], step: number): void {
    midiList.forEach((midi, i) => {
      // Pan each note a little further right for a sense of motion
      this.blip(t + i * step, midi, step * 2.2, "square", 0.2, 0.0, 0.0, false, (i / (midiList.length - 1) - 0.5) * 0.6);
    });
  }

  // Triumphant rising fanfare for clearing a blind (win).
  private fanfare(t: number): void {
    const notes = [60, 64, 67, 72, 76];
    notes.forEach((midi, i) => {
      const tt = t + i * 0.09;
      this.chordStab(tt, [midi, midi + 7], 0.18, (i - 2) * 0.12);
    });
    // final bright stab
    this.chordStab(t + notes.length * 0.09, [72, 76, 79], 0.4, 0);
  }

  // Falling minor descent for game over (lose).
  private descend(t: number): void {
    const notes = [67, 64, 60, 56];
    notes.forEach((midi, i) => {
      const tt = t + i * 0.12;
      const ctx = this.ctx!;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = noteFreq(midi);
      const g = ctx.createGain();
      this.env(g, tt, 0.01, 0.08, 0.18, 0.2, 0.22, 0.12);
      // Sub for body
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.value = noteFreq(midi - 12);
      const subG = ctx.createGain();
      this.env(subG, tt, 0.01, 0.1, 0.18, 0.25, 0.1, 0.05);
      const pan = (i - 1.5) * 0.15;
      const outNode = this.withPan(g, pan);
      const subOut = this.withPan(subG, pan);
      osc.connect(g); g.connect(outNode); outNode.connect(this.out());
      sub.connect(subG); subG.connect(subOut); subOut.connect(this.out());
      osc.start(tt); sub.start(tt);
      osc.stop(tt + 0.5); sub.stop(tt + 0.5);
    });
  }

  // Reusable short filtered-noise tick (used by chordStab attack & deal).
  private noiseTick(t: number, dur: number, freq: number, peak: number, pan = 0): void {
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const outNode = this.withPan(g, pan);
    noise.connect(bp); bp.connect(g); g.connect(outNode); outNode.connect(this.out());
    noise.start(t); noise.stop(t + dur + 0.02);
  }

  // Short noise "deal" tick — a card sliding off the deck.
  // Randomized filter freq + pan so each dealt card sounds slightly different.
  private deal(t: number): void {
    const pan = this.randPan();
    const freq = 2000 + Math.random() * 900; // 2000–2900 Hz
    this.noiseTick(t, 0.08, freq, 0.18, pan);
    // Add a faint low "thud" body so it reads as a card hitting the table
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    const outNode = this.withPan(g, pan);
    osc.connect(g); g.connect(outNode); outNode.connect(this.out());
    osc.start(t); osc.stop(t + 0.1);
  }

  // Airy swoosh for discarding cards. Randomized sweep range + pan.
  private swoosh(t: number): void {
    const ctx = this.ctx!;
    const pan = this.randPan();
    const startFreq = 700 + Math.random() * 400;
    const endFreq = 3000 + Math.random() * 1200;
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(startFreq, t);
    bp.frequency.exponentialRampToValueAtTime(endFreq, t + 0.16);
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    const outNode = this.withPan(g, pan);
    noise.connect(bp); bp.connect(g); g.connect(outNode); outNode.connect(this.out());
    noise.start(t); noise.stop(t + 0.19);
  }
}

// ─── Shared singleton ───
// One engine for the whole app — SFX are short and occasional, so a single
// AudioContext + master gain is plenty. Created lazily on first use.

let _engine: SfxEngine | null = null;

export function getSfx(): SfxEngine {
  if (!_engine) _engine = new SfxEngine();
  return _engine;
}
