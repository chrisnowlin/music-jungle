/**
 * base.ts — shared mini-game shell: intro card → round loop → star results,
 * per-round checkpoint writes (idempotent resume), DOM overlay UI.
 * Safe knobs: none — game configs live in minigames.json.
 */
import { div, button, clear, el } from '../core/dom';
import { emit } from '../core/events';
import { speak, cancel as narratorCancel } from '../core/narrator';
import type { Family } from '../content/families';

export interface Knobs {
  rounds: number;
  [k: string]: number | boolean;
}

export interface GameContext {
  family: Family;
  knobs: Knobs;
  /** checkpoint restore (round 1-based); null when starting fresh */
  checkpoint: { round: number; score: number; mistakes: number } | null;
  saveCheckpoint(c: { round: number; score: number; mistakes: number } | null): void;
}

export abstract class Minigame {
  protected root: HTMLDivElement;
  protected ctx: GameContext;
  protected score = 0;
  protected mistakes = 0;
  protected round = 1;
  private finished = false;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.root = div('mg-root');
    document.body.append(this.root);
    (window as { __mg?: Minigame }).__mg = this;
    if (ctx.checkpoint && ctx.checkpoint.round > 1) {
      this.round = ctx.checkpoint.round;
      this.score = ctx.checkpoint.score;
      this.mistakes = ctx.checkpoint.mistakes;
    }
  }

  /** Build the round UI and start playing. Call intro() first. */
  abstract startRound(): Promise<void> | void;
  /** Human title for the header. */
  abstract title(): string;

  protected mount(content: Node[]): HTMLDivElement {
    clear(this.root);
    const panel = div('mg-panel');
    const head = div('mg-head',
      el('span', { class: 'mg-title' }, `${this.title()}`),
      el('span', { class: 'mg-round' }, `Round ${this.round}/${this.ctx.knobs.rounds}`),
      el('span', { class: 'mg-lives' }, '❤️'.repeat(Math.max(0, (this.ctx.knobs.missesAllowed as number) - this.mistakes + 1))),
      button('mg-close', '✕', () => this.abort()),
    );
    const body = div('mg-body', ...content);
    panel.append(head, body);
    this.root.append(panel);
    return body;
  }

  protected intro(lines: string[], onGo: () => void): void {
    clear(this.root);
    const card = div('mg-intro');
    card.append(
      el('h2', {}, this.title()),
      ...lines.map((l) => el('p', {}, l)),
      button('btn primary', 'Let’s play!', onGo),
    );
    this.root.append(card);
    speak(`${this.title()}. ${lines.join(' ')}`);
  }

  /** Round ended correctly. */
  protected async nextRound(): Promise<void> {
    this.score++;
    this.ctx.saveCheckpoint({ round: this.round + 1, score: this.score, mistakes: this.mistakes });
    if (this.round >= (this.ctx.knobs.rounds as number)) return this.finish();
    this.round++;
    await this.startRound();
  }

  protected async miss(msg = 'Almost! Try the next one.'): Promise<void> {
    this.mistakes++;
    this.ctx.saveCheckpoint({ round: this.round, score: this.score, mistakes: this.mistakes });
    if (this.mistakes > (this.ctx.knobs.missesAllowed as number)) return this.finish();
    speak(msg);
    // retry same round
    await this.startRound();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const total = (this.ctx.knobs.missesAllowed as number) + 1;
    const remaining = total - this.mistakes;
    const stars = remaining >= total ? 3 : remaining >= Math.ceil(total * 0.5) ? 2 : remaining > 0 ? 1 : 1;
    this.ctx.saveCheckpoint(null);
    clear(this.root);
    const card = div('mg-results');
    card.append(
      el('div', { class: 'stars', style: `--n:${stars}` }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
      el('h2', {}, stars === 3 ? 'Perfect!' : stars === 2 ? 'Great job!' : 'You finished!'),
      el('p', {}, `You got ${this.score} of ${this.ctx.knobs.rounds} rounds.`),
      button('btn primary', 'Continue', () => {
        this.close();
        emit('minigame:done', { family: this.ctx.family, stars });
      }),
    );
    this.root.append(card);
    speak(`You earned ${stars} ${stars === 1 ? 'star' : 'stars'}! Great music making.`);
  }

  abort(): void {
    this.close();
    emit('minigame:done', { family: this.ctx.family, stars: -1 }); // aborted
  }

  close(): void {
    narratorCancel();
    this.root.remove();
  }
}
