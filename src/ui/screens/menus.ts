/**
 * menus.ts — title screen + profile screens (create/bulk-create/import/select).
 * Safe knobs: AVATARS list.
 */
import { el, div, button, clear } from '../../core/dom';
import { store } from '../../game/state';
import { setNarration } from '../../core/narrator';
import type { Mode } from '../../core/save';

declare const __APP_VERSION__: string;

const AVATARS = ['🐒', '🦜', '🦁', '🐘', '🐊', '🦓', '🦥', '🦋'];

export function mountTitle(root: HTMLElement, onPlay: () => void, onTeachers: () => void): void {
  const s = div('screen hidden');
  s.id = 'title-screen';
  const holdBtn = button('btn ghost', '🍎 For Teachers', () => undefined);
  let holdT = 0;
  let held = false;
  const startHold = () => {
    held = false;
    holdT = window.setTimeout(() => {
      held = true;
      onTeachers();
    }, 2000);
  };
  const endHold = () => window.clearTimeout(holdT);
  holdBtn.addEventListener('pointerdown', startHold);
  holdBtn.addEventListener('pointerup', endHold);
  holdBtn.addEventListener('pointerleave', endHold);

  s.append(
    div('title-animals', '🐒 🦜 🦁 🐘'),
    el('h1', { class: 'title-logo' }, 'Music Jungle'),
    el('p', { class: 'title-sub' }, 'Explore the jungle. Discover the instrument families!'),
    div('title-buttons',
      button('btn primary', '▶ Play', onPlay),
      holdBtn,
      button('btn ghost', '⛶ Fullscreen', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => undefined);
        else void document.exitFullscreen();
        // iPad Safari: no fullscreen API for arbitrary elements; orientation lock best-effort
        (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape')?.catch?.(() => undefined);
      }),
    ),
    el('p', { class: 'title-footnote' }, `v${__APP_VERSION__} · works offline after first visit · add to Home Screen on iPad to keep progress`),
  );
  root.append(s);
}

export function mountProfiles(
  root: HTMLElement,
  onSelect: () => void,
  onBack: () => void,
): void {
  const s = div('screen hidden');
  s.id = 'profiles-screen';
  renderList();

  function renderList(): void {
    clear(s);
    const grid = div('profiles-grid');
    grid.append(...store.profiles.map((p) => {
      const data = store.saves.loadProfile(p.id);
      const mode = data?.mode ?? 'early';
      const card = button('profile-card',
        `${AVATARS[p.avatar % AVATARS.length]}`, p.name,
        el('span', { class: 'mode-pill' }, mode === 'early' ? 'Sprout K–2' : 'Explorer 3–5'),
      );
      card.addEventListener('click', () => {
        store.selectProfile(p.id);
        setNarration(data?.settings.narration ?? true);
        onSelect();
      });
      return card;
    }));
    grid.append(button('profile-card new', '➕', 'New Explorer'));
    s.append(
      el('h1', { class: 'title-logo', style: 'font-size:2rem' }, 'Who is exploring today?'),
      grid,
      div('row-actions', button('btn ghost', '← Back', onBack)),
    );
    // wire "new" card last child
    const cards = [...s.querySelectorAll<HTMLButtonElement>('.profile-card')];
    cards[cards.length - 1].addEventListener('click', () => renderCreate());
  }

  function renderCreate(): void {
    clear(s);
    let avatar = Math.floor(Math.random() * AVATARS.length);
    let mode: Mode = 'early';
    const nameInput = el('input', { type: 'text', placeholder: 'Type a name…', maxlength: '18' }) as HTMLInputElement;
    const bulk = el('textarea', { placeholder: 'Or paste a class list here — one name per line…', rows: '4' }) as HTMLTextAreaElement;

    const avatarRow = div('avatar-row', ...AVATARS.map((a, i) =>
      button(`avatar-choice${i === avatar ? ' selected' : ''}`, a)));
    const modeRow = div('radio-row',
      el('label', { class: 'selected' }, el('input', { type: 'radio', name: 'mode' }), '🌱 Sprout (K–2)'),
      el('label', {}, el('input', { type: 'radio', name: 'mode' }), '🧭 Explorer (3–5)'),
    );

    const form = div('form-card',
      el('h2', {}, 'New Explorer'),
      el('label', {}, 'Name'), nameInput,
      el('label', {}, 'Pick your jungle buddy'), avatarRow,
      el('label', {}, 'Reading level'), modeRow,
      el('label', {}, 'Teacher shortcut: bulk-create'), bulk,
      div('row-actions',
        button('btn danger', 'Cancel', renderList),
        button('btn primary', 'Create', () => {
          const names = bulk.value.split('\n').map((n) => n.trim()).filter(Boolean);
          if (names.length > 0) {
            names.forEach((n, i) => {
              const meta = store.saves.createProfile(n.slice(0, 18), i % AVATARS.length, mode);
              store.profiles = store.saves.listProfiles();
              void meta;
            });
            renderList();
            return;
          }
          const name = (nameInput.value || 'Explorer').slice(0, 18);
          store.saves.createProfile(name, avatar, mode);
          store.profiles = store.saves.listProfiles();
          renderList();
        }),
      ),
    );

    avatarRow.querySelectorAll('.avatar-choice').forEach((b, i) => {
      b.addEventListener('click', () => {
        avatar = i;
        avatarRow.querySelectorAll('.avatar-choice').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
      });
    });
    const labels = [...modeRow.querySelectorAll('label')];
    labels.forEach((l, i) => l.addEventListener('click', () => {
      mode = i === 0 ? 'early' : 'upper';
      labels.forEach((x) => x.classList.remove('selected'));
      l.classList.add('selected');
    }));

    s.append(form, div('row-actions', button('btn ghost', '← Back', renderList)));
  }

  root.append(s);
}
