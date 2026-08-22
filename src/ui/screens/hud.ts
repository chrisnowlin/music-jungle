/**
 * hud.ts — in-world HUD: compass, progress, prompt, action button, pause menu,
 * toasts. Also owns tap-to-auto-walk dispatch (early mode).
 * Safe knobs: none.
 */
import { el, div, button, clear } from '../../core/dom';
import { store, INSTRUMENT_BY_ID } from '../../game/state';
import { setVolumes, getVolumes, initAudio } from '../../core/audio';
import { setNarration, narrationEnabled } from '../../core/narrator';

export interface HudRefs {
  root: HTMLElement;
  prompt: HTMLDivElement;
  compass: HTMLButtonElement;
  toast: HTMLDivElement;
  setCompass(angle: number, distance: number): void;
  setPrompt(text: string | null, screenPos?: { x: number; y: number }): void;
  refresh(): void;
  showToast(text: string): void;
  onPause(onResume: () => void, onQuit: () => void): void;
}

const AVATAR_EMOJI = ['🐒', '🦜', '🦁', '🐘', '🐊', '🦓', '🦥', '🦋'];

export function buildHud(onOpenPause: () => void, onAction: () => void, onCompassTap: () => void): HudRefs {
  const root = div('hidden');
  root.id = 'hud';
  const compass = button('compass', '🧭');
  compass.addEventListener('click', onCompassTap);
  const found = el('span', { class: 'found-num' }, '0/18');
  const badges = el('span', { class: 'badges-strip' }, '');
  const progress = div('hud-badge-count', '🔍', found, badges);
  const pause = button('icon-btn', '☰');
  pause.addEventListener('click', onOpenPause);
  const action = button('action-btn', '✋');
  action.addEventListener('click', onAction);
  const prompt = div('prompt-label hidden', '');
  const toast = div('toast', '');
  root.append(
    div('hud-top-left', compass, progress),
    div('hud-top-right', pause),
    action, prompt, toast,
  );

  let toastTimer = 0;
  const refs: HudRefs = {
    root,
    prompt,
    compass,
    toast,
    setCompass(angle, distance) {
      compass.style.transform = `rotate(${angle}rad)`;
      compass.title = `${Math.round(distance)}m`;
    },
    setPrompt(text, screenPos) {
      if (!text) {
        prompt.classList.add('hidden');
        return;
      }
      prompt.textContent = text;
      prompt.classList.remove('hidden');
      if (screenPos) {
        prompt.style.bottom = 'auto';
        prompt.style.top = `${screenPos.y + 40}px`;
        prompt.style.left = `${screenPos.x}px`;
        prompt.style.transform = 'translateX(-50%)';
      } else {
        prompt.style.top = 'auto';
        prompt.style.bottom = '130px';
        prompt.style.left = '50%';
      }
    },
    refresh() {
      const s = store.session;
      if (!s) return;
      found.textContent = `${s.discovered.length}/18`;
      clear(badges);
      for (const b of s.badges) {
        const info = { strings: '🐒', woodwinds: '🦜', brass: '🦁', percussion: '🐘' }[b] ?? '⭐';
        badges.append(el('span', {}, info));
      }
    },
    showToast(text) {
      toast.textContent = text;
      toast.classList.add('on');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove('on'), 2600);
    },
    onPause(onResume, onQuit) {
      initAudio();
      const veil = div('modal-veil');
      const card = div('card');
      const vols = getVolumes();
      const narrBtn = button('btn ghost', narrationEnabled() ? '🔊 Narration: ON' : '🔇 Narration: OFF', () => undefined);
      const music = el('input', { type: 'range', min: '0', max: '1', step: '0.1', value: String(vols.music) }) as HTMLInputElement;
      const sfx = el('input', { type: 'range', min: '0', max: '1', step: '0.1', value: String(vols.sfx) }) as HTMLInputElement;
      music.addEventListener('input', () => setVolumes(parseFloat(music.value), parseFloat(sfx.value)));
      sfx.addEventListener('input', () => setVolumes(parseFloat(music.value), parseFloat(sfx.value)));
      narrBtn.addEventListener('click', () => {
        const next = !narrationEnabled();
        setNarration(next);
        if (store.session) store.session.settings.narration = next;
        narrBtn.textContent = next ? '🔊 Narration: ON' : '🔇 Narration: OFF';
        store.persist();
      });
      card.append(
        el('h2', {}, `${AVATAR_EMOJI[(store.session?.avatar ?? 0) % 8]} ${store.session?.name ?? ''}`),
        el('label', {}, 'Narration'), narrBtn,
        el('label', {}, 'Music'), music,
        el('label', {}, 'Sound effects'), sfx,
        div('row-actions',
          button('btn danger', 'Save & quit', onQuit),
          button('btn primary', '▶ Keep exploring', () => {
            veil.remove();
            onResume();
          }),
        ),
      );
      veil.append(card);
      document.body.append(veil);
    },
  };
  return refs;
}

/* compass targeting is computed in main.ts where pedestal positions live */
