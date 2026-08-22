/**
 * extras.ts — Rainbow Stage finale concert (repeatable, class-demo camera),
 * printable certificate, and Jungle Jam free-play.
 * Safe knobs: melody arrangement below.
 */
import { el, div, button } from '../../core/dom';
import { initAudio, playNote, play } from '../../core/audio';
import { speak } from '../../core/narrator';
import { INSTRUMENT_BY_ID, store } from '../../game/state';
import { instrumentIcon } from '../../objects/iconSnapshot';
import * as THREE from 'three';

/* ---------- finale ---------- */

/** Simple arranged tune: [midiOffset, beats] — played by the whole "jungle band". */
const TUNE: [number, number][] = [
  [0, 1], [4, 1], [7, 1], [12, 2],
  [7, 1], [4, 1], [0, 2],
];
const BAND = ['violin', 'flute', 'trumpet', 'xylophone', 'harp'];

export interface FinaleHandle {
  stop(): void;
}

export function playFinale(onDone: () => void): FinaleHandle {
  initAudio();
  const handles: { stop: () => void }[] = [];
  let beat = 0;
  for (const [semi, beats] of TUNE) {
    BAND.forEach((id, vi) => {
      const def = INSTRUMENT_BY_ID.get(id)!;
      void play(def.sample, {
        semi: semi - 12 - vi, // spread the band
        when: beat * 0.45,
        bus: 'music',
        gain: 0.5,
      }).catch(() => undefined);
    });
    // timpani on the strong beats
    if (beat % 4 === 0) void play('timpani', { when: beat * 0.45, bus: 'music', gain: 0.6 });
    beat += beats;
  }
  speak('The whole jungle is playing for you! You are a true Jungle Ranger of Instruments!');
  const timer = window.setTimeout(onDone, beat * 450 + 1500);
  return {
    stop() {
      window.clearTimeout(timer);
      for (const h of handles) h.stop();
    },
  };
}

export function confettiBurst(scene: THREE.Scene, origin: THREE.Vector3): void {
  const N = 120;
  const pos = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const palette = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = origin.x;
    pos[i * 3 + 1] = origin.y + 2;
    pos[i * 3 + 2] = origin.z;
    const c = new THREE.Color(palette[i % palette.length]);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.3, vertexColors: true }));
  scene.add(pts);
  const t0 = performance.now();
  const anim = (): void => {
    const t = (performance.now() - t0) / 1000;
    const arr = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      arr.setX(i, arr.getX(i) + Math.sin(t * 5 + i) * 0.02);
      arr.setY(i, arr.getY(i) + 0.05 - t * 0.09);
      arr.setZ(i, arr.getZ(i) + Math.cos(t * 4 + i * 1.3) * 0.02);
    }
    arr.needsUpdate = true;
    (pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - t / 4);
    (pts.material as THREE.Material).transparent = true;
    if (t < 4 && pts.parent) requestAnimationFrame(anim);
    else scene.remove(pts);
  };
  anim();
}

/* ---------- certificate ---------- */

export function showCertificate(): void {
  const s = store.session!;
  const veil = div('modal-veil');
  const cert = div('certificate');
  cert.append(
    el('div', { style: 'font-size:44px' }, '🐒 🦜 🦁 🐘'),
    el('h1', {}, 'Jungle Ranger Certificate'),
    el('p', {}, 'This certifies that'),
    el('div', { class: 'big-name' }, s.name),
    el('p', {}, 'discovered all 18 instruments and earned all four family badges!'),
    el('div', { class: 'badges' }, s.badges.map((b: string) =>
      (({ strings: '🐒', woodwinds: '🦜', brass: '🦁', percussion: '🐘' } as Record<string, string>)[b] ?? '⭐')).join(' ')),
    el('p', {}, `${new Date().toLocaleDateString()} · Music Jungle`),
    div('row',
      button('btn primary', '🖨 Print it!', () => window.print()),
      button('btn ghost', 'Keep exploring', () => veil.remove()),
    ),
  );
  veil.append(cert);
  document.body.append(veil);
}

/* ---------- jungle jam ---------- */

const JAM_SCALE = [60, 62, 64, 67, 69, 72];

export function showJam(onClose: () => void): void {
  initAudio();
  const s = store.session!;
  const veil = div('modal-veil');
  const card = div('card');
  card.style.width = 'min(720px,96vw)';
  card.append(el('h2', {}, '🎵 Jungle Jam'), el('p', { class: 'fact' }, 'Tap your instruments to play!'));
  const grid = div('jam-grid');
  const sortedAll: string[] = (Object.values(s.sorted) as string[][]).flat();
  for (const id of sortedAll.length ? sortedAll : ['snaredrum']) {
    const chip = button('jam-chip',
      el('img', { src: instrumentIcon(id), alt: store.instrumentName(id) }),
      store.instrumentName(id),
    );
    chip.addEventListener('click', () => {
      const def = INSTRUMENT_BY_ID.get(id)!;
      const midi = def.family === 'percussion' ? undefined : JAM_SCALE[Math.floor(Math.random() * JAM_SCALE.length)];
      if (midi == null) void play(def.sample);
      else void playNote(def.sample, midi + (def.sample === 'timpani' ? 12 : 0));
    });
    grid.append(chip);
  }
  card.append(grid,
    div('row', button('btn primary', 'Done jamming', () => {
      veil.remove();
      onClose();
    })));
  veil.append(card);
  document.body.append(veil);
}
