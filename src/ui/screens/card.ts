/**
 * card.ts — discovery card, family sort modal, camp explainer panel.
 * Safe knobs: none.
 */
import { el, div, button } from '../../core/dom';
import { instrumentIcon } from '../../objects/iconSnapshot';
import { store, INSTRUMENT_BY_ID } from '../../game/state';
import { FAMILIES, FAMILY_INFO, type Family } from '../../content/families';
import { play } from '../../core/audio';
import { speak, cancel as narratorCancel } from '../../core/narrator';

export function showDiscoveryCard(
  instrumentId: string,
  onAdd: () => void,
  onClose: () => void,
): void {
  const def = INSTRUMENT_BY_ID.get(instrumentId)!;
  const name = store.instrumentName(instrumentId);
  const fact = store.mode === 'early' ? def.factEarly : def.factUpper;
  const veil = div('modal-veil');
  const card = div('card');
  const icon = el('img', { class: 'instrument-icon', alt: name }) as HTMLImageElement;
  icon.src = instrumentIcon(instrumentId);
  const replay = button('btn ghost', '🔊 Hear it again', () => {
    initAudioSafe();
    void play(def.sample + '.phrase', { bus: 'sfx' });
  });
  const addBtn = button('btn primary', '🎒 Add to Backpack', () => {
    veil.remove();
    narratorCancel();
    onAdd();
  });
  card.append(
    icon,
    el('h2', {}, `You found the ${name}!`),
    el('p', { class: 'fact' }, fact),
    div('row', replay, addBtn),
    button('btn ghost', 'Not yet', () => {
      veil.remove();
      narratorCancel();
      onClose();
    }),
  );
  veil.append(card);
  document.body.append(veil);
  // auto-play phrase once
  initAudioSafe();
  void play(def.sample + '.phrase', { bus: 'sfx' });
  speak(`You found the ${name}! ${fact}`);
}

function initAudioSafe(): void {
  void import('../../core/audio').then((m) => m.initAudio());
}

/* ---------- sorting ---------- */

export function showSortModal(
  totemFamily: Family,
  onSorted: (instrumentId: string, chosen: Family, correct: boolean) => void,
): void {
  const s = store.session;
  if (!s || s.backpack.length === 0) return;
  const early = store.mode === 'early';
  let candidates: Family[] = FAMILIES.slice();
  let narrowed = false;
  const veil = div('modal-veil');
  const card = div('card');
  const chipRow = div('chip-row');
  const famRow = div('family-btns');
  const hint = el('p', { class: 'fact' }, 'Tap an instrument, then tap its family home!');
  let selected: string | null = null;

  function renderChips(): void {
    chipRow.replaceChildren();
    for (const id of s!.backpack) {
      const chip = button('chip',
        el('img', { src: instrumentIcon(id), alt: '' }),
        store.instrumentName(id),
      );
      if (selected === id) chip.classList.add('selected');
      chip.addEventListener('click', () => {
        selected = id;
        renderChips();
        renderFamilies();
        speak(store.instrumentName(id));
      });
      chipRow.append(chip);
    }
  }

  function renderFamilies(): void {
    famRow.replaceChildren();
    for (const f of candidates) {
      const info = FAMILY_INFO[f];
      const b = button('family-btn', `${info.mascot} ${info.label}`);
      b.style.background = info.color;
      b.addEventListener('click', () => {
        if (!selected) {
          hint.textContent = 'First tap an instrument from your backpack!';
          return;
        }
        const correct = INSTRUMENT_BY_ID.get(selected)?.family === f;
        if (!correct && early && !narrowed && candidates.length > 2) {
          narrowed = true;
          const trueFam = (INSTRUMENT_BY_ID.get(selected)!.family) as Family;
          candidates = ([f, trueFam] as Family[]).filter((v, i, a) => a.indexOf(v) === i);
        }
        const instId = selected;
        veil.remove();
        narratorCancel();
        onSorted(instId, f, correct);
      });
      famRow.append(b);
    }
  }

  card.append(el('h2', {}, `${FAMILY_INFO[totemFamily].mascot} Family Sorting`), hint, chipRow, famRow,
    button('btn ghost', 'Done for now', () => {
      veil.remove();
      narratorCancel();
    }));
  veil.append(card);
  document.body.append(veil);
  renderChips();
  renderFamilies();
  speak('Tap an instrument, then tap its family home!');
}

/* ---------- explainer ---------- */

export function showExplainer(family: Family, onClose: () => void): void {
  const info = FAMILY_INFO[family];
  const early = store.mode === 'early';
  const stepsText = info.steps.map((s) => (early ? s.textEarly : s.textUpper)).join('. ');
  const veil = div('modal-veil');
  const card = div('card');
  card.style.borderTop = `10px solid ${info.color}`;
  const readBtn = button('btn ghost', '🔊 Read it to me');
  readBtn.addEventListener('click', () => speak(`${info.howSoundUpper} ${stepsText}`));
  const gotBtn = button('btn primary', 'Got it!');
  gotBtn.addEventListener('click', () => {
    veil.remove();
    narratorCancel();
    onClose();
  });
  card.append(
    el('h2', {}, `${info.mascot} How does the ${info.label} family make sound?`),
    el('p', { class: 'fact' }, early ? info.howSoundEarly : info.howSoundUpper),
    div('steps', ...info.steps.map((st, i) =>
      div('step',
        el('span', { class: 'ico' }, st.icon),
        el('span', {}, `${i + 1}. ${early ? st.textEarly : st.textUpper}`),
      ))),
    div('row', readBtn, gotBtn),
  );
  veil.append(card);
  document.body.append(veil);
  speak(`${early ? info.howSoundEarly : info.howSoundUpper}`);
}
