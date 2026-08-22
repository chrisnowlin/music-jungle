/**
 * buzzLab.ts — Brass mini-game: press-and-hold to sustain a lip buzz,
 * drag up/down to change lip tension → pitch. Steer into harmonic zones.
 * Uses the real trumpet sample pitch-shifted; synth fallback if missing.
 * Safe knobs: zone count/width via minigames.json.
 */
import { el, div, button } from '../core/dom';
import { initAudio, playNote } from '../core/audio';
import { speak } from '../core/narrator';
import { Minigame, type GameContext, type Knobs } from './base';

interface BuzzKnobs extends Knobs {
  zones: number;
  bandWidth: number;
  holdSecs: number;
  drift: number;
}

// bugle-style harmonic ladder relative to trumpet sample base (As3 ≈ MIDI 58)
const HARMONICS = [0, 7, 12, 16, 19]; // partials mapped to semitones

export class BuzzLab extends Minigame {
  private body!: HTMLDivElement;

  constructor(ctx: GameContext) {
    super(ctx);
    initAudio();
    this.intro(
      ['🦁 Lions buzz their lips to make brass sounds! HOLD the button and slide your finger (or arrow keys) to change your lip tension. Land inside the target band!'],
      () => void this.startRound(),
    );
  }

  title(): string {
    return '🦁 Buzz Lab';
  }

  async startRound(): Promise<void> {
    const k = this.ctx.knobs as BuzzKnobs;
    const zoneCount = k.zones as number;
    const target = Math.floor(Math.random() * zoneCount);
    const zoneCenter = (i: number) => (i + 1) / (zoneCount + 1);

    let level = 0.05; // current "tension" 0..1
    let holding = false;
    let holdT = 0;
    let done = false;
    let raf = 0;
    let lastSound = -99;
    let driftDir = Math.random() < 0.5 ? -1 : 1;
    let targetPos = zoneCenter(target);

    const zoneLabels = ['Loose lips 😴', 'Warming up 🙂', 'Buzzing! 😀', 'Super tight 🤩'].slice(0, zoneCount);

    this.body = this.mount([
      el('p', { class: 'mg-hint' }, `Hold + slide into the ${zoneLabels[target]} band!`),
      div('buzz-wrap',
        ...Array.from({ length: zoneCount }, (_, i) =>
          div(`buzz-zone${i === target ? ' target' : ''}`, el('span', {}, zoneLabels[i]))),
        div('buzz-fill', ''),
        div('buzz-cursor', '👄'),
      ),
      button('btn primary big-hold', '👄 HOLD & SLIDE', () => undefined),
      button('btn ghost', '🔊 Hear the note', () => void playNote('trumpet', 58 + HARMONICS[Math.min(target, HARMONICS.length - 1)])),
    ]);
    const wrapEl = this.body.querySelector<HTMLDivElement>('.buzz-wrap')!;
    const fillEl = this.body.querySelector<HTMLDivElement>('.buzz-fill')!;
    const cursorEl = this.body.querySelector<HTMLDivElement>('.buzz-cursor')!;
    const holdBtn = this.body.querySelector<HTMLButtonElement>('.big-hold')!;
    wrapEl.querySelectorAll('.buzz-zone').forEach((z, i) => {
      (z as HTMLElement).style.bottom = `${(zoneCenter(i) - (k.bandWidth as number) / 2) * 100}%`;
      (z as HTMLElement).style.height = `${(k.bandWidth as number) * 100}%`;
    });

    const setLevel = (v: number): void => {
      level = Math.max(0, Math.min(1, v));
      fillEl.style.width = `${level * 100}%`;
      cursorEl.style.left = `${level * 100}%`;
    };
    setLevel(0.05);

    const down = () => { holding = true; };
    const up = () => { holding = false; };
    const move = (e: PointerEvent) => {
      if (!holding) return;
      const rect = wrapEl.getBoundingClientRect();
      // horizontal slider model
      setLevel((e.clientX - rect.left) / rect.width);
    };
    holdBtn.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointermove', move);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setLevel(level + 0.06);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setLevel(level - 0.06);
    };
    window.addEventListener('keydown', onKey);

    let last = performance.now();
    const loop = (now: number): void => {
      if (done) return;
      const dt = (now - last) / 1000;
      last = now;
      if (holding && k.drift > 0) {
        targetPos += driftDir * (k.drift as number) * dt;
        if (targetPos > 0.9 || targetPos < 0.1) driftDir *= -1;
      }
      const inBand = holding && Math.abs(level - targetPos) <= (k.bandWidth as number) / 2;
      for (const [i, z] of [...wrapEl.querySelectorAll('.buzz-zone')].entries()) {
        z.classList.toggle('win', i === target && inBand);
      }
      if (holding) {
        holdT = inBand ? holdT + dt : 0;
        // sonify: map level→harmonic ladder
        const semi = HARMONICS[Math.min(HARMONICS.length - 1, Math.floor(level * HARMONICS.length))];
        if (Math.abs(semi - lastSound) > 2.9) {
          lastSound = semi;
          void playNote('trumpet', 58 + semi, { stopAfter: 0.5 });
        }
        if (holdT >= (k.holdSecs as number)) {
          done = true;
          cancelAnimationFrame(raf);
          cleanup();
          speak('Perfect buzzing!');
          void this.nextRound();
          return;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const cleanup = (): void => {
      cancelAnimationFrame(raf);
      holdBtn.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('keydown', onKey);
    };
    const observer = new MutationObserver(() => {
      if (!document.body.contains(this.root)) {
        done = true;
        cleanup();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true });
  }
}
