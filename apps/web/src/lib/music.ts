// Original procedural lounge-jazz music engine built entirely with Web Audio.
// It uses no samples or external assets and only starts after a user gesture.

type AudioContextConstructor = new () => AudioContext;

type Harmony = {
  root: number;
  chord: readonly number[];
  scale: readonly number[];
};

const noteFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const browserWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return browserWindow.AudioContext ?? browserWindow.webkitAudioContext ?? null;
}

function softCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(1024 * 4));
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}

function makeRoomIR(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 1.15);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const envelope = Math.pow(1 - i / length, 2.6);
    data[i] = (Math.random() * 2 - 1) * envelope;
  }
  return buffer;
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// An original eight-bar form centered on C minor. Rootless voicings keep the
// harmony colorful while leaving room for the bass.
const FORM: readonly Harmony[] = [
  { root: 36, chord: [51, 55, 58, 62], scale: [60, 62, 63, 65, 67, 69, 70] },
  { root: 44, chord: [55, 58, 60, 63], scale: [60, 62, 63, 65, 67, 68, 70] },
  { root: 41, chord: [51, 56, 58, 63], scale: [60, 62, 63, 65, 67, 68, 70] },
  { root: 43, chord: [53, 56, 59, 63], scale: [59, 60, 62, 63, 65, 67, 68] },
  { root: 36, chord: [51, 55, 58, 62], scale: [60, 62, 63, 65, 67, 69, 70] },
  { root: 39, chord: [50, 53, 55, 60], scale: [60, 62, 63, 65, 67, 69, 70] },
  { root: 38, chord: [48, 53, 56, 60], scale: [60, 62, 63, 65, 66, 68, 70] },
  { root: 43, chord: [53, 57, 59, 63], scale: [59, 60, 63, 65, 67, 68, 69] },
];

const STEPS_PER_BAR = 8;
const STEPS = FORM.length * STEPS_PER_BAR;
const TEMPO = 92;
const SWING = 0.62;

type Variation = {
  lead: number[];
  bass: number[][];
  kick: boolean[];
  brush: boolean[];
};

// Seeded variation makes every pass evolve while remaining stable before it
// is scheduled by the lookahead clock.
function makeVariation(cycle: number): Variation {
  let state = (0x9e3779b9 ^ Math.imul(cycle + 1, 0x85ebca6b)) >>> 0;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };

  const lead = Array<number>(STEPS).fill(-1);
  const bass: number[][] = [];
  const kick = Array<boolean>(STEPS).fill(false);
  const brush = Array<boolean>(STEPS).fill(false);
  let previousLead = 67;

  FORM.forEach((harmony, bar) => {
    const nextRoot = FORM[(bar + 1) % FORM.length].root;
    const bassBar = [harmony.root, harmony.root + (random() < 0.5 ? 7 : 3), harmony.root + 5, nextRoot - 1];
    if (random() < 0.35) bassBar[2] = harmony.root + 10;
    bass.push(bassBar);

    for (let local = 0; local < STEPS_PER_BAR; local++) {
      const step = bar * STEPS_PER_BAR + local;
      kick[step] = local === 0 || local === 4 || (local === 7 && random() < 0.3);
      brush[step] = local === 2 || local === 6 || (local === 5 && random() < 0.22);

      const density = bar === FORM.length - 1 ? 0.58 : 0.42;
      if (local === 0 || random() > density) continue;
      const candidates = harmony.scale.filter((note) => Math.abs(note - previousLead) <= 5);
      const pool = candidates.length > 0 ? candidates : harmony.scale;
      previousLead = pool[Math.floor(random() * pool.length)] + (random() < 0.12 ? 12 : 0);
      lead[step] = previousLead;
    }
  });

  return { lead, bass, kick, brush };
}

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private pianoBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private activeSources = new Set<AudioScheduledSourceNode>();
  private persistentSources: OscillatorNode[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private startPromise: Promise<boolean> | null = null;
  private suspendPromise: Promise<void> | null = null;
  private nextStepTime = 0;
  private step = 0;
  private cycle = 0;
  private variation = makeVariation(0);
  private volume = 0.5;
  private requested = false;
  private running = false;

  static supported(): boolean {
    return getAudioContextConstructor() !== null;
  }

  async start(): Promise<boolean> {
    this.requested = true;
    if (this.running) return true;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startInternal();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async startInternal(): Promise<boolean> {
    const Context = getAudioContextConstructor();
    if (!Context) return false;
    if (!this.ctx) this.initGraph(Context);

    if (this.suspendPromise) await this.suspendPromise;
    const ctx = this.ctx;
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    if (ctx.state === "closed") return false;
    if (!this.requested) return false;
    if (this.running) return true;

    this.running = true;
    this.master!.gain.cancelScheduledValues(ctx.currentTime);
    this.master!.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.04);
    this.step = 0;
    this.variation = makeVariation(this.cycle);
    this.nextStepTime = ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.scheduler(), 25);
    return true;
  }

  stop(): void {
    this.requested = false;
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // A source can already have ended between scheduler ticks.
      }
      source.disconnect();
    }
    this.activeSources.clear();

    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    this.master?.gain.cancelScheduledValues(ctx.currentTime);
    this.master?.gain.setValueAtTime(0, ctx.currentTime);
    this.suspendPromise = ctx.suspend().catch(() => {}).finally(() => {
      this.suspendPromise = null;
    });
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.ctx && this.running) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  dispose(): void {
    this.stop();
    for (const source of this.persistentSources) {
      try {
        source.stop();
      } catch {
        // The context may already be closed.
      }
      source.disconnect();
    }
    this.persistentSources = [];
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.pianoBus = null;
    this.noise = null;
  }

  private initGraph(Context: AudioContextConstructor): void {
    const ctx = new Context();
    this.ctx = ctx;
    this.noise = makeNoise(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1850;
    filter.Q.value = 0.75;

    const warmth = ctx.createWaveShaper();
    warmth.curve = softCurve(1.25);
    warmth.oversample = "2x";

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 2.8;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.22;

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.82;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.musicBus.connect(filter);
    filter.connect(warmth);
    warmth.connect(compressor);

    const dry = ctx.createGain();
    dry.gain.value = 0.88;
    const reverb = ctx.createConvolver();
    reverb.buffer = makeRoomIR(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.12;
    compressor.connect(dry).connect(this.master);
    compressor.connect(reverb).connect(wet).connect(this.master);
    this.master.connect(ctx.destination);

    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.055;
    const filterDepth = ctx.createGain();
    filterDepth.gain.value = 720;
    filterLfo.connect(filterDepth).connect(filter.frequency);
    filterLfo.start();

    this.pianoBus = ctx.createGain();
    this.pianoBus.gain.value = 0.7;
    const tremolo = ctx.createOscillator();
    tremolo.frequency.value = 4.25;
    const tremoloDepth = ctx.createGain();
    tremoloDepth.gain.value = 0.18;
    tremolo.connect(tremoloDepth).connect(this.pianoBus.gain);
    this.pianoBus.connect(this.musicBus);
    tremolo.start();
    this.persistentSources = [filterLfo, tremolo];
  }

  private scheduler(): void {
    if (!this.ctx || !this.running) return;
    const eighth = 60 / TEMPO / 2;
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      const bar = Math.floor(this.step / STEPS_PER_BAR);
      const local = this.step % STEPS_PER_BAR;
      const swingDelay = local % 2 === 1 ? eighth * (SWING - 0.5) * 2 : 0;
      this.scheduleStep(this.step, bar, local, this.nextStepTime + swingDelay);
      this.nextStepTime += eighth;
      this.step = (this.step + 1) % STEPS;
      if (this.step === 0) {
        this.cycle++;
        this.variation = makeVariation(this.cycle);
      }
    }
  }

  private scheduleStep(step: number, bar: number, local: number, time: number): void {
    if (this.variation.kick[step]) this.kick(time);
    if (this.variation.brush[step]) this.brush(time, 0.16);
    this.hat(time, local % 2 === 1 ? 0.055 : 0.085);

    if (local % 2 === 0) {
      this.bass(this.variation.bass[bar][local / 2], time, 0.5);
    }
    if (local === 0) this.piano(FORM[bar].chord, time, 2.25, 0.12);
    if (local === 5 && bar % 2 === 1) this.piano(FORM[bar].chord, time, 0.42, 0.055);

    const lead = this.variation.lead[step];
    if (lead > 0) this.lead(lead, time, local === 7 ? 0.24 : 0.4);
  }

  private track<T extends AudioScheduledSourceNode>(source: T): T {
    this.activeSources.add(source);
    source.addEventListener("ended", () => {
      this.activeSources.delete(source);
      source.disconnect();
    }, { once: true });
    return source;
  }

  private envelope(gain: GainNode, time: number, attack: number, decay: number, duration: number, peak: number, sustain: number): void {
    const releaseStart = time + Math.max(attack + decay, duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), time + attack + decay);
    gain.gain.setValueAtTime(Math.max(0.0001, sustain), releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + 0.12);
  }

  private bass(midi: number, time: number, duration: number): void {
    const ctx = this.ctx!;
    const body = this.track(ctx.createOscillator());
    body.type = "triangle";
    body.frequency.value = noteFreq(midi);
    const harmonic = this.track(ctx.createOscillator());
    harmonic.type = "sine";
    harmonic.frequency.value = noteFreq(midi + 12);
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.18;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 430;
    filter.Q.value = 1.3;
    const gain = ctx.createGain();
    this.envelope(gain, time, 0.012, 0.09, duration, 0.34, 0.2);
    body.connect(filter);
    harmonic.connect(harmonicGain).connect(filter);
    filter.connect(gain).connect(this.musicBus!);
    body.start(time);
    harmonic.start(time);
    body.stop(time + duration + 0.14);
    harmonic.stop(time + duration + 0.14);
  }

  private piano(notes: readonly number[], time: number, duration: number, peak: number): void {
    const ctx = this.ctx!;
    for (const midi of notes) {
      const carrier = this.track(ctx.createOscillator());
      const modulator = this.track(ctx.createOscillator());
      carrier.frequency.value = noteFreq(midi);
      modulator.frequency.value = noteFreq(midi) * 2;
      const modulation = ctx.createGain();
      modulation.gain.value = noteFreq(midi) * 0.14;
      const gain = ctx.createGain();
      this.envelope(gain, time, 0.012, 0.24, duration, peak, peak * 0.26);
      modulator.connect(modulation).connect(carrier.frequency);
      carrier.connect(gain).connect(this.pianoBus!);
      carrier.start(time);
      modulator.start(time);
      carrier.stop(time + duration + 0.15);
      modulator.stop(time + duration + 0.15);
    }
  }

  private lead(midi: number, time: number, duration: number): void {
    const ctx = this.ctx!;
    const oscillator = this.track(ctx.createOscillator());
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(noteFreq(midi) * 0.97, time);
    oscillator.frequency.exponentialRampToValueAtTime(noteFreq(midi), time + 0.045);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = noteFreq(midi) * 1.8;
    filter.Q.value = 1.15;
    const gain = ctx.createGain();
    this.envelope(gain, time, 0.02, 0.1, duration, 0.11, 0.07);
    oscillator.connect(filter).connect(gain).connect(this.musicBus!);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.14);
  }

  private noiseVoice(time: number, duration: number, frequency: number, peak: number, type: BiquadFilterType): void {
    const ctx = this.ctx!;
    const source = this.track(ctx.createBufferSource());
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter).connect(gain).connect(this.musicBus!);
    const offset = Math.random() * Math.max(0, this.noise!.duration - duration);
    source.start(time, offset, duration);
  }

  private kick(time: number): void {
    const ctx = this.ctx!;
    const oscillator = this.track(ctx.createOscillator());
    oscillator.frequency.setValueAtTime(105, time);
    oscillator.frequency.exponentialRampToValueAtTime(43, time + 0.11);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.46, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    oscillator.connect(gain).connect(this.musicBus!);
    oscillator.start(time);
    oscillator.stop(time + 0.2);
  }

  private brush(time: number, peak: number): void {
    this.noiseVoice(time, 0.13, 1900, peak, "highpass");
  }

  private hat(time: number, peak: number): void {
    this.noiseVoice(time, 0.035, 7200, peak, "highpass");
  }
}
