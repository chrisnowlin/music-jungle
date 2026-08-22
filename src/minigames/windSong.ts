/**
 * windSong.ts — Woodwinds mini-game, two phases:
 *  A) contour match: hear a flute motif, pick the shape card that matches
 *  B) breath control: hold the button to raise the air needle and keep it
 *     inside the target band (narrow + drifting in upper mode)
 * Safe knobs: via minigames.json.
 */
import { el, div, button } from '../core/dom';
import { initAudio, playNote } from '../core/audio';
import { speak } from '../core/narrator';
import { Minigame, type GameContext, type Knobs } from './base';

interface WindKnobs extends Knobs {
  bandWidth: number;
  drift: number;
}

const CONTOURS = [
  { id: 'up', name: 'Going up', path: 'M10,80 L40,55 L70,30' },
  { id: 'down', name: 'Going down', path: 'M10,30 L40,55 L70,80' },
  { id: 'hill', name: 'Hill', path: 'M10,75 Q40,15 70,75' },
  { id: 'valley', name: 'Valley', path: 'M10,25 Q40,85 70,25' },
];

export class WindSong extends Minigame {
  private body!: HTMLDivElement;
  private contourRounds = 3; // first half contours, then breath

  constructor(ctx: GameContext) {
    super(ctx);
    initAudio();
    this.intro(
      ['🦜 Two wind challenges! First hear a bird song and find its shape. Then hold your BREATH steady in the magic band!'],
      () => void this.startRound(),
    );
  }

  title(): string {
    return '🦜 Wind Song Match';
  }

  async startRound(): Promise<void> {
    if (this.round <= this.contourRounds) await this.contourRound();
    else await this.breathRound();
  }

  /* ---------- phase A: contour ---------- */

  private async contourRound(): Promise<void> {
    const answer = CONTOURS[Math.floor(Math.random() * CONTOURS.length)];
    const decoys = CONTOURS.filter((c) => c !== answer).sort(() => Math.random() - 0.5).slice(0, 2);
    const cards = [answer, ...decoys].sort(() => Math.random() - 0.5);

    // motif follows the contour shape
    const motifs: Record<string, number[]> = {
      up: [67, 69, 72], down: [72, 69, 67],
      hill: [64, 72, 64], valley: [72, 62, 72],
    };
    const seq = motifs[answer.id];

    this.body = this.mount([
      el('p', { class: 'mg-hint' }, 'Listen to the bird… 🎵'),
      div('contours', ...cards.map((c) => button('contour-card', `<svg viewBox="0 0 80 100"><path d="${c.path}" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/></svg>`, () => {
        void playNote('flute', 72);
        if (c.id === answer.id) {
          speak(`Yes — ${c.name}!`);
          void this.nextRound();
        } else {
          void this.miss('That was a different shape. Listen again!');
        }
      }))),
      button('btn ghost mg-again', '▶ Hear it again', () => void this.playMotif(seq)),
    ]);
    await sleep(500);
    await this.playMotif(seq);
  }

  private async playMotif(seq: number[]): Promise<void> {
    for (const m of seq) {
      void playNote('flute', m);
      await sleep(420);
    }
    speak('Which shape shows the bird song?');
  }

  /* ---------- phase B: breath meter ---------- */

  private async breathRound(): Promise<void> {
    const k = this.ctx.knobs as WindKnobs;
    let bandPos = 0.25 + Math.random() * 0.5;
    let dir = Math.random() < 0.5 ? -1 : 1;
    let holding = false;
    let level = 0;
    let insideSecs = 0;
    const needSecs = 1.6;
    let raf = 0;
    let done = false;

    this.body = this.mount([
      el('p', { class: 'mg-hint' }, 'Hold the button to blow air. Keep the bubble 🫧 inside the band!'),
      div('meter-wrap',
        div('meter-band', ''),
        div('meter-fill', ''),
        div('meter-bubble', '🫧'),
      ),
      button('btn primary big-hold', '🌬️ HOLD to blow', () => undefined),
    ]);
    const bandEl = this.body.querySelector<HTMLDivElement>('.meter-band')!;
    const fillEl = this.body.querySelector<HTMLDivElement>('.meter-fill')!;
    const bubbleEl = this.body.querySelector<HTMLDivElement>('.meter-bubble')!;
    const holdBtn = this.body.querySelector<HTMLButtonElement>('.big-hold')!;

    bandEl.style.bottom = `${bandPos * 100}%`;
    bandEl.style.height = `${k.bandWidth * 100}%`;

    const down = () => { holding = true; };
    const up = () => { holding = false; };
    holdBtn.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);

    let last = performance.now();
    const loop = (now: number): void => {
      if (done) return;
      const dt = (now - last) / 1000;
      last = now;
      level += (holding ? 0.55 : -0.7) * dt;
      level = Math.max(0, Math.min(1, level));
      if (k.drift > 0) {
        bandPos += dir * k.drift * dt;
        if (bandPos > 0.85 || bandPos < k.bandWidth + 0.05) dir *= -1;
        bandPos = Math.max(k.bandWidth / 2, Math.min(0.95, bandPos));
        bandEl.style.bottom = `${Math.max(0, bandPos - k.bandWidth / 2) * 100}%`;
      }
      fillEl.style.height = `${level * 100}%`;
      bubbleEl.style.left = `${8 + Math.sin(now / 300) * 4}%`;
      const bandCenter = bandPos;
      const inBand = Math.abs(level - bandCenter) <= k.bandWidth / 2;
      bubbleEl.style.bottom = `calc(${level * 100}% - 14px)`;
      document.body.classList.toggle('in-band', inBand);
      if (inBand) {
        insideSecs += dt;
        bandEl.classList.add('win');
      } else {
        bandEl.classList.remove('win');
      }
      if (insideSecs >= needSecs) {
        done = true;
        cancelAnimationFrame(raf);
        cleanup();
        speak('Wonderful wind control!');
        void this.nextRound();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const cleanup = (): void => {
      cancelAnimationFrame(raf);
      holdBtn.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
    // safety abort when panel is closed
    const observer = new MutationObserver(() => {
      if (!document.body.contains(this.root)) {
        done = true;
        cancelAnimationFrame(raf);
        cleanup();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: false });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
