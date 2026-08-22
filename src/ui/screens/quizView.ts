/**
 * quizView.ts — quiz overlay used by micro-quizzes and ranger checks.
 * Handles listenPick (audio), icon choices, feedback + explain, non-TTS safe.
 * Safe knobs: none.
 */
import { el, div, button } from '../../core/dom';
import { initAudio, play, playNote } from '../../core/audio';
import { speak, cancel as narratorCancel } from '../../core/narrator';
import { shuffledChoices, checkAnswer, type QuizQuestion } from '../../game/quizEngine';
import { instrumentIcon } from '../../objects/iconSnapshot';
import { store } from '../../game/state';
import { emit } from '../../core/events';

export interface QuizResult { correct: number; total: number }

export function showQuiz(
  questions: QuizQuestion[],
  context: string,
  onDone: (r: QuizResult) => void,
): void {
  initAudio();
  let idx = 0;
  let correct = 0;
  const veil = div('modal-veil');
  const card = div('card');
  veil.append(card);
  document.body.append(veil);

  function render(): void {
    narratorCancel();
    const q = questions[idx];
    card.replaceChildren();
    const progress = el('p', { class: 'mg-round', style: 'margin:0' }, `${idx + 1} of ${questions.length}`);
    card.append(progress, el('h2', {}, q.prompt));

    if (q.type === 'listenPick' && q.audioInstrument) {
      const listen = button('listen-big', '👂', () => {
        void play(q.audioInstrument!, { bus: 'sfx' });
      });
      listen.addEventListener('click', () => undefined);
      card.append(div('center-col', listen, el('small', {}, 'Tap to listen')));
      void play(q.audioInstrument, { bus: 'sfx' });
    }

    const list = div('quiz-choices');
    const shuffled = shuffledChoices(q);
    let answered = false;
    for (const c of shuffled) {
      const b = button('quiz-choice');
      if (c.instrument) {
        const img = el('img', { src: instrumentIcon(c.instrument), alt: '' }) as HTMLImageElement;
        b.append(img);
      }
      b.append(el('span', {}, c.label));
      b.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const good = checkAnswer(q, c.id);
        if (good) correct++;
        b.classList.add(good ? 'good' : 'bad');
        if (!good) {
          const answerBtn = [...list.querySelectorAll<HTMLButtonElement>('.quiz-choice')]
            .find((_, i) => shuffled[i].id === q.answerId);
          answerBtn?.classList.add('good');
        }
        // record into save
        const s = store.session;
        if (s) {
          const rec = s.quiz[q.id] ?? { seen: 0, correct: 0 };
          rec.seen++;
          if (good) rec.correct++;
          s.quiz[q.id] = rec;
          if (q.standard) {
            const st = s.standards[q.standard] ?? { seen: 0, correct: 0 };
            st.seen++;
            if (good) st.correct++;
            s.standards[q.standard] = st;
          }
          store.persist();
        }
        const explainBox = div('explain-box',
          el('strong', {}, good ? '✅ ' : '💡 '),
          q.explain);
        card.append(explainBox);
        speak(q.explain);
        card.append(div('row', button('btn primary', idx + 1 < questions.length ? 'Next' : 'Finish', () => {
          idx++;
          if (idx < questions.length) render();
          else {
            veil.remove();
            narratorCancel();
            emit('quiz:done', { correct, total: questions.length, context });
            onDone({ correct, total: questions.length });
          }
        })));
      });
      list.append(b);
    }
    card.append(list);
    // narration for non-readers (never required — text always visible)
    speak(q.prompt);
  }

  render();
}

/** Convenience: play a pitched reference note for instrumentPick prompts. */
export function previewNote(sampleId: string): void {
  void playNote(sampleId, 60);
}
