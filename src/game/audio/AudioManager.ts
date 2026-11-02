/** Original local sound design. All game sounds run on the Web Audio clock. */
export type SoundName = 'shot' | 'reload' | 'door' | 'pickup' | 'terminal' | 'empty' | 'impact' | 'hurt' | 'enemy' | 'complete' | 'jump' | 'land' | 'glass' | 'switch';
type Position = { x: number; y: number; z: number };
type AssetName = SoundName | 'step-outside' | 'step-inside' | 'outdoor' | 'indoor';
const assets: AssetName[] = ['shot', 'reload', 'door', 'pickup', 'terminal', 'empty', 'impact', 'hurt', 'enemy', 'complete', 'jump', 'land', 'glass', 'switch', 'step-outside', 'step-inside', 'outdoor', 'indoor'];
const levels: Partial<Record<AssetName, number>> = { shot: .48, reload: .5, door: .55, enemy: .48, impact: .28, hurt: .55, complete: .5, 'step-outside': .38, 'step-inside': .32 };

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private outdoor: GainNode | null = null;
  private indoor: GainNode | null = null;
  private buffers = new Map<AssetName, AudioBuffer>();
  private loops: AudioBufferSourceNode[] = [];
  private transients = new Set<AudioBufferSourceNode>();
  private initPromise: Promise<void> | null = null;
  private disposed = false;
  private paused = false;
  private masterVolume = .55;
  private effectsVolume = .75;
  private stepTimer = .25;
  private outside = true;

  /** Call synchronously from the Start/Resume user gesture to unlock browser audio. */
  init(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.context) {
      if (!this.paused) void this.context.resume().catch(() => {});
      return this.initPromise ?? Promise.resolve();
    }
    try {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return Promise.resolve();
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.effects = this.context.createGain();
      this.outdoor = this.context.createGain();
      this.indoor = this.context.createGain();
      this.master.gain.value = this.masterVolume;
      this.effects.gain.value = this.effectsVolume;
      this.outdoor.gain.value = .16;
      this.indoor.gain.value = 0;
      this.effects.connect(this.master);
      this.outdoor.connect(this.master);
      this.indoor.connect(this.master);
      // A conservative limiter keeps overlapping effects comfortable.
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -13;
      limiter.knee.value = 18;
      limiter.ratio.value = 5;
      this.master.connect(limiter);
      limiter.connect(this.context.destination);
      void this.context.resume().catch(() => {});
      this.initPromise = this.loadAssets();
      return this.initPromise;
    } catch {
      // Unsupported/restricted audio never prevents playing the mission.
      return Promise.resolve();
    }
  }

  private async loadAssets(): Promise<void> {
    const context = this.context;
    if (!context) return;
    await Promise.all(assets.map(async name => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/audio/${name}.wav`);
        if (!response.ok) throw new Error(`Audio ${name}: ${response.status}`);
        const data = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(data);
        if (!this.disposed) this.buffers.set(name, buffer);
      } catch (error) {
        console.warn(`Duskline: unavailable sound ${name}`, error);
      }
    }));
    if (this.disposed) return;
    this.startLoop('outdoor', this.outdoor);
    this.startLoop('indoor', this.indoor);
    if (this.paused) void context.suspend().catch(() => {});
  }

  private startLoop(name: 'outdoor' | 'indoor', gain: GainNode | null): void {
    const buffer = this.buffers.get(name);
    if (!this.context || !gain || !buffer) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    this.loops.push(source);
  }

  setVolumes(master: number, effects: number): void {
    this.masterVolume = Math.max(0, Math.min(1, master));
    this.effectsVolume = Math.max(0, Math.min(1, effects));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.masterVolume, this.context.currentTime, .06);
    if (this.effects && this.context) this.effects.gain.setTargetAtTime(this.effectsVolume, this.context.currentTime, .06);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.context) return;
    if (paused) {
      // Cancel in-flight effects so a reload/shot never reappears on resume.
      for (const source of this.transients) { try { source.stop(); } catch { /* ended */ } }
      this.transients.clear();
      void this.context.suspend().catch(() => {});
    } else {
      void this.context.resume().catch(() => {});
    }
  }

  update(dt: number, input: { area: string; moving: number; sprinting: boolean; position: Position; forward: Position }): void {
    const ctx = this.context;
    if (!ctx || this.paused || this.disposed) return;
    const listener = ctx.listener;
    const now = ctx.currentTime;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(input.position.x, now);
      listener.positionY.setValueAtTime(input.position.y, now);
      listener.positionZ.setValueAtTime(input.position.z, now);
      listener.forwardX.setValueAtTime(input.forward.x, now);
      listener.forwardY.setValueAtTime(input.forward.y, now);
      listener.forwardZ.setValueAtTime(input.forward.z, now);
      listener.upX.setValueAtTime(0, now);
      listener.upY.setValueAtTime(1, now);
      listener.upZ.setValueAtTime(0, now);
    } else {
      listener.setPosition(input.position.x, input.position.y, input.position.z);
      listener.setOrientation(input.forward.x, input.forward.y, input.forward.z, 0, 1, 0);
    }
    const outside = /YARD|EXTRACTION/i.test(input.area);
    if (outside !== this.outside) {
      this.outside = outside;
      this.outdoor?.gain.setTargetAtTime(outside ? .16 : .025, now, .7);
      this.indoor?.gain.setTargetAtTime(outside ? .015 : .2, now, .7);
    }
    if (input.moving > .15) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.emit(outside ? 'step-outside' : 'step-inside');
        this.stepTimer = input.sprinting ? .29 : .47;
      }
    } else this.stepTimer = .14;
  }

  play(name: SoundName, position?: Position): void { this.emit(name, position); }

  /** Non-sensitive runtime evidence for development diagnostics. */
  diagnostics() { return { initialized: !!this.context, state: this.context?.state ?? 'unavailable', loaded: this.buffers.size, activeEffects: this.transients.size, ambienceLoops: this.loops.length }; }

  private emit(name: AssetName, position?: Position): void {
    const ctx = this.context;
    const buffer = this.buffers.get(name);
    if (!ctx || !buffer || !this.effects || this.paused || this.disposed || this.transients.size > 32) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = name.startsWith('step') || name === 'shot' ? .95 + Math.random() * .1 : 1;
    const gain = ctx.createGain();
    gain.gain.value = levels[name] ?? .4;
    source.connect(gain);
    let panner: PannerNode | null = null;
    if (position) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 3;
      panner.maxDistance = 65;
      panner.rolloffFactor = 1.2;
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
      gain.connect(panner);
      panner.connect(this.effects);
    } else gain.connect(this.effects);
    this.transients.add(source);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
      this.transients.delete(source);
    };
    source.start();
  }

  dispose(): void {
    this.disposed = true;
    for (const source of [...this.loops, ...this.transients]) { try { source.stop(); source.disconnect(); } catch { /* already stopped */ } }
    this.loops.length = 0;
    this.transients.clear();
    this.buffers.clear();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}
