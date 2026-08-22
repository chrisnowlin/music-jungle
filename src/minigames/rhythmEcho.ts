/**
 * rhythmEcho.ts — Percussion mini-game: gorilla plays a pattern on 4 pads
 * (real Philharmonia hits), the student echoes it.
 * Safe knobs: pads list; difficulty via minigames.json.
 */
import { el, div, button } from '../core/dom';
import { play, initAudio } from '../core/audio';
import { speak } from '../core/narrator';
import { Minigame, type GameContext, type Knobs } from './base';

const PADS = [
  { id: 'snaredrum', label: 'Snare', color: '#0072B2', key: '1' },
  { id: 'tomtom', label: 'Tom', color: '#56B4E9', key: '2' },
  { id: 'woodblock', label: 'Wood', color: '#E69F00', key: '3' },
  { id: 'bassdrum', label: 'Boom', color: '#CC79A7', key: '4' },
];

interface EchoKnobs extends Knobs {
  minLen: number;
  maxLen: number;
  bpm: number;
  rests: boolean;
  flashHints: boolean;
}

export class RhythmEcho extends Minigame {
  private pattern: number[] = [];
  private body!: HTMLDivElement;
  private padEls: HTMLButtonElement[] = [];
  private accepting = false;

  constructor(ctx: GameContext) {
    super(ctx);
    void this.introAndStart();
  }

  title(): string {
    return '🦍 Echo Drums';
  }

  private async introAndStart(): Promise<void> {
    initAudio();
    this.intro(
      ['Gorilla plays a drum pattern. Listen, then echo it back by tapping the same drums!'],
      () => void this.startRound(),
    );
  }

  async startRound(): Promise<void> {
    const k = this.ctx.knobs as EchoKnobs;
    const len = Number(k.minLen) + Math.floor(Math.random() * (Number(k.maxLen) - Number(k.minLen) + 1));
    this.pattern = Array.from({ length: Math.min(len, k.maxLen) }, () =>
      Math.floor(Math.random() * PADS.length));
    if (k.rests && Math.random() < 0.5) this.pattern.push(-1); // rest slot

    this.body = this.mount([
      el('p', { class: 'mg-hint' }, 'Listen… 👂'),
      div('pads', ...PADS.map((p, i) => {
        const b = button(`pad pad-${i}`, `${p.label}<small>(${p.key})</small>`, () => this.tap(i));
        (b.style as CSSStyleDeclaration).setProperty('--pad-c', p.color);
        return b;
      })),
      button('btn ghost mg-again', '▶ Hear it again', () => void this.playPattern()),
    ]);
    this.padEls = [...this.body.querySelectorAll<HTMLButtonElement>('.pad')];
    await this.playPattern();
  }

  private async playPattern(): Promise<void> {
    const k = this.ctx.knobs as EchoKnobs;
    const stepSec = 60 / k.bpm;
    for (let i = 0; i < this.pattern.length; i++) {
      const padIdx = this.pattern[i];
      if (padIdx < 0) continue; // rest
      play(PADS[padIdx].id, { when: undefined, bus: 'sfx' });
      if (k.flashHints) this.flash(this.padEls[padIdx], stepSec * 700);
      await sleep(stepSec * 1000);
    }
    await sleep(250);
    this.accepting = true;
    this.body.querySelector('.mg-hint')!.textContent = 'Your turn! Echo it 🥁';
    speak('Your turn!');
  }

  private flash(el_: HTMLElement, ms: number): void {
    el_.classList.add('lit');
    setTimeout(() => el_.classList.remove('lit'), ms);
  }

  private inputIdx = 0;

  private tap(i: number): void {
    if (!this.accepting) return;
    play(PADS[i].id, { bus: 'sfx' });
    this.flash(this.padEls[i], 160);
    const want = this.pattern[this.inputIdx];
    // skip rests in comparison
    while (want != null && want < 0) {
      this.inputIdx++;
    }
    if (this.pattern[this.inputIdx] === i) {
      this.inputIdx++;
      if (this.inputIdx >= this.pattern.filter((p) => p >= 0).length) {
        this.accepting = false;
        this.inputIdx = 0;
        speak('Yes!');
        void this.nextRound();
      }
    } else {
      this.accepting = false;
      this.inputIdx = 0;
      void this.miss('Not quite — listen again.');
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
