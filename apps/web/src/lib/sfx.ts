// Procedural sound-effects engine (Web Audio API) for MiniCard.
//
// All card / play / scoring / shop cues are synthesized in code — no audio
// assets — so everything is copyright-free and works offline inside MiniPay
// / web3 wallet browsers. SFX share one AudioContext with the music engine's
// scheduling but live on their own lightweight graph: a short master gain ->
// destination, so muting / volume is independent of the music loop.
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

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;

    this.shaper.connect(this.comp);
    this.comp.connect(this.master);
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
      case "select":   return this.blip(t, 72, 0.06, "square", 0.22);
      case "deselect": return this.blip(t, 64, 0.06, "square", 0.18);
      case "play":     return this.chordStab(t, [57, 60, 64], 0.22);
      case "chip":     return this.blip(t, 84, 0.05, "triangle", 0.2, 0.0, 0.0, true);
      case "mult":     return this.blip(t, 67, 0.08, "sawtooth", 0.22, 0.0, 0.0, true);
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
  private blip(
    t: number,
    midi: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    slideTo?: number,
    slideTime?: number,
    up = false,
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
    osc.connect(g); g.connect(this.out());
    osc.start(t);
    osc.stop(t + dur + 0.1);
  }

  // Short bright chord stab for "Play Hand".
  private chordStab(t: number, midiList: number[], dur: number): void {
    const ctx = this.ctx!;
    for (const midi of midiList) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = noteFreq(midi);
      const g = ctx.createGain();
      this.env(g, t, 0.005, 0.04, Math.max(dur - 0.08, 0.05), 0.08, 0.18, 0.08);
      osc.connect(g); g.connect(this.out());
      osc.start(t);
      osc.stop(t + dur + 0.12);
    }
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
      this.blip(t + i * step, midi, step * 2.2, "square", 0.2);
    });
  }

  // Triumphant rising fanfare for clearing a blind (win).
  private fanfare(t: number): void {
    const notes = [60, 64, 67, 72, 76];
    notes.forEach((midi, i) => {
      const tt = t + i * 0.09;
      this.chordStab(tt, [midi, midi + 7], 0.18);
    });
    // final bright stab
    this.chordStab(t + notes.length * 0.09, [72, 76, 79], 0.4);
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
      osc.connect(g); g.connect(this.out());
      osc.start(tt);
      osc.stop(tt + 0.5);
    });
  }

  // Short noise "deal" tick — a card sliding off the deck.
  private deal(t: number): void {
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      // short decaying noise burst
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    noise.connect(bp); bp.connect(g); g.connect(this.out());
    noise.start(t); noise.stop(t + 0.09);
  }

  // Airy swoosh for discarding cards.
  private swoosh(t: number): void {
    const ctx = this.ctx!;
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(3600, t + 0.16);
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    noise.connect(bp); bp.connect(g); g.connect(this.out());
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
