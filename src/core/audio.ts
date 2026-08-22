/**
 * audio.ts — Web Audio engine: sample playback with pitch shifting, buses, synth fallbacks.
 * Safe knobs: MASTER_GAIN, per-play gain/rate. Samples live in /assets/audio/instruments.
 * All decoded buffers stay resident (~1-2 MB total) — no eviction by design (see plan).
 */
import samples from '../content/samples.json';

const BASE = 'assets/audio/instruments/';
const MASTER_GAIN = 0.9;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
const cache = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<AudioBuffer>>();

export type Bus = 'music' | 'sfx';
let volumes = { music: 0.8, sfx: 1 };

/** Must be called from a user gesture once (autoplay policy). */
export function initAudio(): void {
  if (!ctx) {
    const AC: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    const comp = ctx.createDynamicsCompressor();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
    applyVolumes();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function applyVolumes(): void {
  if (!musicBus || !sfxBus) return;
  musicBus.gain.value = volumes.music;
  sfxBus.gain.value = volumes.sfx;
}

export function setVolumes(music: number, sfx: number): void {
  volumes = { music, sfx };
  applyVolumes();
}

export function getVolumes(): { music: number; sfx: number } {
  return { ...volumes };
}

async function load(file: string): Promise<AudioBuffer> {
  if (!ctx) throw new Error('audio not initialized');
  const hit = cache.get(file);
  if (hit) return hit;
  let p = pending.get(file);
  if (!p) {
    p = fetch(BASE + file)
      .then((r) => {
        if (!r.ok) throw new Error(`sample ${file} missing`);
        return r.arrayBuffer();
      })
      .then((ab) => decode(ab))
      .then((buf) => {
        cache.set(file, buf);
        pending.delete(file);
        return buf;
      })
      .catch((e) => {
        pending.delete(file);
        throw e;
      });
    pending.set(file, p);
  }
  return p;
}

/** Decode helper split out so tests can stub it. */
export async function decode(ab: ArrayBuffer): Promise<AudioBuffer> {
  if (!ctx) throw new Error('audio not initialized');
  return await new Promise<AudioBuffer>((res, rej) => {
    // Safari legacy callback form
    const r = ctx!.decodeAudioData(ab as unknown as ArrayBuffer, res as (b: AudioBuffer) => void, rej);
    if (r && typeof (r as unknown as Promise<AudioBuffer>).then === 'function') {
      (r as unknown as Promise<AudioBuffer>).then(res, rej);
    }
  });
}

export interface PlayOpts {
  /** semitone offset from the sample's recorded pitch */
  semi?: number;
  gain?: number;
  when?: number;
  bus?: Bus;
  loop?: boolean;
  stopAfter?: number;
}

const NOTE_SEMI: Record<string, number> = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };

export function noteToSemi(note: string): number {
  const m = /^([A-G]s?)(\d)$/.exec(note);
  if (!m) return 0;
  return NOTE_SEMI[m[1]] + 12 * (parseInt(m[2], 10) + 1);
}

/**
 * Play a named sample ("violin", "snaredrum", "harp.phrase"...).
 * Pitched instruments accept `semi` to transpose via playbackRate.
 * Returns a handle with stop(); resolves after the buffer starts.
 */
export async function play(id: string, opts: PlayOpts = {}): Promise<{ stop: () => void }> {
  if (!ctx) initAudio();
  const bus = opts.bus === 'music' ? musicBus! : sfxBus!;
  try {
    const buf = await load(id + '.mp3');
    return startBuffer(buf, opts, bus);
  } catch {
    // synth fallback so gameplay never breaks on a missing asset
    return playSynthFallback(id, opts, bus);
  }
}

function startBuffer(buf: AudioBuffer, opts: PlayOpts, bus: GainNode): { stop: () => void } {
  const src = ctx!.createBufferSource();
  src.buffer = buf;
  if (opts.semi != null && opts.semi !== 0) src.playbackRate.value = Math.pow(2, opts.semi / 12);
  if (opts.loop) src.loop = true;
  const g = ctx!.createGain();
  g.gain.value = opts.gain ?? 1;
  src.connect(g);
  g.connect(bus);
  const t0 = ctx!.currentTime + (opts.when ?? 0);
  src.start(t0);
  if (opts.stopAfter != null) src.stop(t0 + opts.stopAfter);
  return {
    stop: () => {
      try { src.stop(); } catch { /* already ended */ }
      g.disconnect();
    },
  };
}

/* ---------- melodic helpers ---------- */

/** Play one tuned note of an instrument (semitone offset relative to A440 MIDI math). */
export function playNote(sampleId: string, targetMidi: number, opts: Omit<PlayOpts, 'semi'> = {}): Promise<{ stop: () => void }> {
  const info = (samples as Record<string, { note: string | null }>)[sampleId];
  const baseMidi = info?.note ? noteToSemi(info.note) : 60;
  return play(sampleId, { ...opts, semi: targetMidi - baseMidi });
}

export interface NoteSpec { midi: number; beat: number; durBeats: number }

/** Sequence notes (beats at given BPM) — used for discovery melodies and minigames. */
export function playSequence(sampleId: string, seq: NoteSpec[], bpm = 100, gain = 0.9): { stop: () => void }[] {
  const secPerBeat = 60 / bpm;
  const handles: { stop: () => void }[] = [];
  for (const n of seq) {
    void playNote(sampleId, n.midi, {
      when: n.beat * secPerBeat,
      gain,
      stopAfter: n.durBeats * secPerBeat * 1.05,
      bus: 'sfx',
    }).then((h) => handles.push(h));
  }
  return handles;
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/* ---------- ambient jungle music ---------- */

let ambientTimer = 0;
let ambientOn = false;
const AMBIENT_SCALE = [60, 62, 64, 67, 69, 72, 74];

/** Gentle randomized xylophone plinkers; runs on the music bus so the slider controls it. */
export function startAmbient(): void {
  if (ambientOn) return;
  ambientOn = true;
  const tick = (): void => {
    if (!ambientOn) return;
    if (ctx && ctx.state === 'running') {
      const n = AMBIENT_SCALE[Math.floor(Math.random() * AMBIENT_SCALE.length)];
      void playNote('xylophone', n + (Math.random() < 0.3 ? -12 : 0), { bus: 'music', gain: 0.22 });
      if (Math.random() < 0.25) {
        void playNote('xylophone', AMBIENT_SCALE[Math.floor(Math.random() * AMBIENT_SCALE.length)] + 12, {
          when: 0.28, bus: 'music', gain: 0.14,
        });
      }
    }
    ambientTimer = window.setTimeout(tick, 1400 + Math.random() * 2200);
  };
  tick();
}

export function stopAmbient(): void {
  ambientOn = false;
  window.clearTimeout(ambientTimer);
}

/* ---------- synth fallbacks (per family flavor) ---------- */

async function playSynthFallback(id: string, opts: PlayOpts, bus: GainNode): Promise<{ stop: () => void }> {
  const c = ctx!;
  const t0 = c.currentTime + (opts.when ?? 0);
  const dur = opts.stopAfter ?? 0.6;
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(bus);
  const osc = c.createOscillator();
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';

  let baseMidi = 60;
  const info = (samples as Record<string, { note: string | null }>)[id];
  if (info?.note) baseMidi = noteToSemi(info.note);
  const f = midiToFreq(baseMidi + (opts.semi ?? 0));

  const kind =
    id.startsWith('snare') || id.startsWith('tom') || id.startsWith('wood') || id.startsWith('bassd') || id.startsWith('shak')
      ? 'perc'
      : id === 'triangle' ? 'perc' : 'tone';
  if (kind === 'perc' && id !== 'triangle') {
    // noise burst
    const len = Math.max(0.08, dur);
    const nb = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate);
    const data = nb.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const ns = c.createBufferSource();
    ns.buffer = nb;
    ns.connect(g);
    g.gain.setValueAtTime(0.8 * (opts.gain ?? 1), t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
    ns.start(t0); ns.stop(t0 + len);
    return { stop: () => { try { ns.stop(); } catch { /* noop */ } } };
  }

  osc.type = id.startsWith('trumpet') || id.startsWith('trombone') || id.startsWith('tuba') || id.startsWith('french') ? 'sawtooth'
    : id.startsWith('flute') || id.startsWith('clarinet') || id.startsWith('basso') || id.startsWith('sax') ? 'triangle'
    : 'square';
  osc.frequency.value = id === 'triangle' ? 2600 : f;
  filter.frequency.setValueAtTime(kind === 'perc' ? 6000 : f * 3, t0);
  osc.connect(filter);
  filter.connect(g);
  const peak = 0.35 * (opts.gain ?? 1);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.03);
  g.gain.setTargetAtTime(peak * 0.7, t0 + 0.03, 0.25);
  g.gain.setTargetAtTime(0.0001, t0 + Math.max(0.05, dur - 0.15), 0.06);
  osc.start(t0);
  osc.stop(t0 + dur + 0.4);
  return {
    stop: () => {
      try { osc.stop(); } catch { /* noop */ }
      g.disconnect();
    },
  };
}
