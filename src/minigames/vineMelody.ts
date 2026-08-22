/**
 * vineMelody.ts — Strings mini-game: six pentatonic lily-pad nodes
 * (C4 D4 E4 G4 A4 C5 on harp samples; height on screen = pitch).
 * Orangutan plays a snippet, the student replays it.
 * Safe knobs: node tuning.
 */
import { el, div, button } from '../core/dom';
import { initAudio, playNote } from '../core/audio';
import { speak } from '../core/narrator';
import { Minigame, type GameContext, type Knobs } from './base';

const NODES = [60, 62, 64, 67, 69, 72]; // C major pentatonic
const LABELS = ['do', 're', 'mi', 'sol', 'la', 'do↑'];

interface VineKnobs extends Knobs {
  minLen: number;
  maxLen: number;
  flashHints: boolean;
}

export class VineMelody extends Minigame {
  private body!: HTMLDivElement;
  private nodeEls: HTMLButtonElement[] = [];
  private pattern: number[] = [];
  private inputIdx = 0;
  private accepting = false;

  constructor(ctx: GameContext) {
    super(ctx);
    initAudio();
    this.intro(
      ['🦧 Orangutan plays a little melody on the vines. Listen, then pluck it back!'],
      () => void this.startRound(),
    );
  }

  title(): string {
    return '🦧 Vine Melody Memory';
  }

  async startRound(): Promise<void> {
    const k = this.ctx.knobs as VineKnobs;
    const len = Math.min(Number(k.minLen) + Math.floor(Math.random() * (Number(k.maxLen) - Number(k.minLen) + 1)), NODES.length);
    this.pattern = Array.from({ length: len }, () => NODES[Math.floor(Math.random() * NODES.length)]);
    this.inputIdx = 0;
    this.accepting = false;

    // pads arranged low→high like pitch
    this.body = this.mount([
      el('p', { class: 'mg-hint' }, 'Listen… 👂'),
      div('vines', ...NODES.map((m, i) => {
        const b = button(`vine vine-${i}`, LABELS[i], () => void this.tap(i));
        (b.style as CSSStyleDeclaration).setProperty('--h', `${12 + i * 13}%`);
        return b;
      })),
      button('btn ghost mg-again', '▶ Hear it again', () => void this.playPattern()),
    ]);
    this.nodeEls = [...this.body.querySelectorAll<HTMLButtonElement>('.vine')];
    await this.playPattern();
  }

  private async playPattern(): Promise<void> {
    const k = this.ctx.knobs as VineKnobs;
    const stepMs = (60 / Number(k.bpm)) * 1000;
    for (let i = 0; i < this.pattern.length; i++) {
      const midi = this.pattern[i];
      const idx = NODES.indexOf(midi);
      if (k.flashHints || this.round === 1) this.flash(idx);
      void playNote('harp', midi);
      await sleep(stepMs);
    }
    await sleep(250);
    this.accepting = true;
    this.body.querySelector('.mg-hint')!.textContent = 'Your turn! Pluck it back 🪕';
    speak('Your turn!');
  }

  private flash(idx: number): void {
    const el_ = this.nodeEls[idx];
    el_.classList.add('lit');
    setTimeout(() => el_.classList.remove('lit'), 380);
  }

  private async tap(i: number): Promise<void> {
    if (!this.accepting) return;
    void playNote('harp', NODES[i]);
    const wantIdx = NODES.indexOf(this.pattern[this.inputIdx]);
    if (wantIdx === i) {
      this.flash(i);
      this.inputIdx++;
      if (this.inputIdx >= this.pattern.length) {
        this.accepting = false;
        speak('Beautiful!');
        await this.nextRound();
      }
    } else {
      this.accepting = false;
      await this.miss('So close — listen once more.');
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
