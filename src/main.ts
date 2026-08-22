/**
 * main.ts — bootstrap: renderer, world, screens, game loop, wiring.
 * Safe knobs: renderer pixel ratio comes from quality.ts tiers.
 */
import './ui/styles.css';
import * as THREE from 'three';
import { el, div, button } from './core/dom';
import { initInput, sampleInput } from './core/input';
import { initJoystick, sampleJoystick } from './core/joystick';
import { initAudio, startAmbient, stopAmbient } from './core/audio';
import { narratorSupported } from './core/narrator';
import { store, INSTRUMENT_BY_ID } from './game/state';
import { validateBanks, drawMicroQuestion } from './game/quizEngine';
import { showQuiz } from './ui/screens/quizView';
import { buildWorld } from './world/world';
import { getHeight, LANDMARKS } from './world/terrain';
import { Player } from './player/player';
import { CameraRig } from './player/cameraRig';
import { Discovery } from './game/discovery';
import { initCollection, placeAtCamp, restoreCamps, updateSparkles, burstSparkle } from './game/collection';
import { minigameUnlocked, finaleUnlocked, badgeForStars } from './game/progression';
import { currentTier, tierConfig, startProbe, tickProbe } from './core/quality';
import { initContextLoss, isContextPaused } from './core/contextLoss';
import { emit } from './core/events';
import { mountTitle, mountProfiles } from './ui/screens/menus';
import { buildHud } from './ui/screens/hud';
import { showDiscoveryCard, showSortModal, showExplainer } from './ui/screens/card';
import { mountDashboard } from './ui/screens/dashboard';
import { playFinale, confettiBurst, showCertificate, showJam, type FinaleHandle } from './ui/screens/extras';
import { RhythmEcho } from './minigames/rhythmEcho';
import { VineMelody } from './minigames/vineMelody';
import { WindSong } from './minigames/windSong';
import { BuzzLab } from './minigames/buzzLab';
import type { Family } from './content/families';
import mgConfig from './content/minigames.json';

interface MinigameCfg {
  id: string;
  titleEarly: string;
  titleUpper: string;
  early: Record<string, number | boolean>;
  upper: Record<string, number | boolean>;
}

declare const __APP_VERSION__: string;

/* ---------- boot ---------- */
validateBanks();
const appRoot = document.getElementById('app')!;

const canvasHost = div('');
canvasHost.style.cssText = 'position:absolute;inset:0;';
appRoot.append(canvasHost);

const renderer = new THREE.WebGLRenderer({ antialias: currentTier() === 'high', powerPreference: 'high-performance' });
renderer.setPixelRatio(tierConfig().dpr);
renderer.setSize(window.innerWidth, window.innerHeight);
canvasHost.append(renderer.domElement);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 90);
const world = buildWorld();
initCollection(world.scene);

const player = new Player();
player.teleport(LANDMARKS.station.x + 6, LANDMARKS.station.z + 8);
world.scene.add(player.group);
const rig = new CameraRig();
const discovery = new Discovery();

/* restore progress visuals */
if (store.session) {
  player.teleport(store.session.pos.x || player.position.x, store.session.pos.z || player.position.z);
  restoreCamps(store.session.sorted);
  for (const [id, ped] of world.pedestals) {
    if (store.session.discovered.includes(id)) ped.setDiscovered(true);
  }
}

/* ---------- screens ---------- */
const screens: Record<string, HTMLElement> = {};
let hudRefs: ReturnType<typeof buildHud> | null = null;
let paused = false;

function setScreen(name: 'title' | 'profiles' | 'play' | 'dashboard'): void {
  for (const [k, node] of Object.entries(screens)) {
    node.classList.toggle('hidden', k !== name && !(name === 'play' && k === 'hud'));
  }
  store.setScreen(name);
  if (name !== 'play') document.getElementById('touch-layer')?.classList.add('hidden');
}

mountTitle(appRoot,
  () => setScreen('profiles'),
  () => setScreen('dashboard'),
);

mountProfiles(appRoot, () => enterWorld(), () => setScreen('title'));

const dashNode: HTMLElement = mountDashboard(appRoot, () => setScreen('title'));

screens['title'] = document.getElementById('title-screen')!;
screens['profiles'] = document.getElementById('profiles-screen')!;
screens['dashboard'] = dashNode;

function enterWorld(): void {
  if (!store.session) return;
  initAudio();
  // rebuild HUD for this profile
  document.getElementById('hud')?.remove();
  document.getElementById('touch-layer')?.remove();
  const hud = buildHud(
    () => {
      paused = true;
      hudRefs!.onPause(() => { paused = false; }, () => {
        savePosition();
        location.reload();
      });
    },
    () => discovery.triggerCurrent(),
    () => {
      // early mode: tap compass → auto-walk toward nearest undiscovered
      if (store.mode === 'early') {
        const t = nearestUndiscovered();
        if (t) player.autowalkTarget = { x: t.x, z: t.z };
      }
    },
  );
  hudRefs = hud;
  appRoot.append(hud.root);
  hud.root.classList.remove('hidden');
  const touchLayer = div('');
  touchLayer.id = 'touch-layer';
  appRoot.append(touchLayer);
  if (disposeJoystick) disposeJoystick();
  disposeJoystick = initJoystick(touchLayer);
  hud.refresh();
  registerInteractables();
  setScreen('play');
  startAmbient();
  startProbe();
  if (!store.session.firstSessionDone) {
    hud.showToast(narratorSupported() ? 'Follow the 🧭 to find hidden instruments!' : 'Walk to the glowing pedestals!');
    store.session.firstSessionDone = true;
  } else {
    hud.showToast('Welcome back, explorer!');
  }
}

/* ---------- discovery registration ---------- */

function registerInteractables(): void {
  // pedestals
  for (const [id, ped] of world.pedestals) {
    const def = INSTRUMENT_BY_ID.get(id)!;
    discovery.register({
      id: `ped-${id}`,
      pos: ped.group.position.clone(),
      radius: 2.5,
      prompt: () => `🔎 Find out what this is…`,
      enabled: () => !store.session!.discovered.includes(id),
      onInteract: () => onDiscover(id, ped.group.position.x, ped.group.position.z),
    });
    void def;
  }
  // totems
  const totemSpots: Record<string, { x: number; z: number }> = {
    strings: { x: LANDMARKS.cave.x, z: LANDMARKS.cave.z + 9.5 },
    woodwinds: { x: LANDMARKS.grove.x, z: LANDMARKS.grove.z - 9.5 },
    brass: { x: LANDMARKS.falls.x + 11, z: LANDMARKS.falls.z - 10 },
    percussion: { x: LANDMARKS.fire.x, z: LANDMARKS.fire.z + 8.5 },
  };
  for (const fam of Object.keys(totemSpots)) {
    const spot = totemSpots[fam];
    discovery.register({
      id: `totem-${fam}`,
      pos: new THREE.Vector3(spot.x, getHeight(spot.x, spot.z), spot.z),
      radius: 3.4,
      prompt: () => `${fam === 'brass' ? '🦁 Waterfall Falls' : fam === 'strings' ? '🐒 Cave of Strings' : fam === 'woodwinds' ? '🦜 Whispering Grove' : '🐘 Fire Circle'} camp`,
      onInteract: () => openCamp(fam as Family),
    });
  }
  // stage
  discovery.register({
    id: 'stage',
    pos: new THREE.Vector3(LANDMARKS.stage.x, 0, LANDMARKS.stage.z),
    radius: 7.5,
    prompt: () => finaleUnlocked(store.session!) ? '🎪 Rainbow Stage — START THE CONCERT!' : `🎪 Rainbow Stage (${store.session!.badges.length}/4 badges needed)`,
    onInteract: () => tryFinale(),
  });
}

function onDiscover(id: string, _x: number, _z: number): void {
  const ped = world.pedestals.get(id)!;
  store.discover(id);
  ped.setDiscovered(true);
  emit('discovered', { instrumentId: id });
  showDiscoveryCard(id,
    () => {
      store.addToBackpack(id);
      burstSparkle(ped.group.position.x, ped.group.position.y + 1.4, ped.group.position.z, '#ffe082');
      hudRefs?.showToast(`${store.instrumentName(id)} added to backpack!`);
      hudRefs?.refresh();
      showQuiz([drawMicroQuestion(store.mode)], 'micro', () => undefined); // skippable via ✕? micro has Finish
    },
    () => undefined,
  );
}

function openCamp(family: Family): void {
  showExplainer(family, () => {
    const s = store.session!;
    if (!minigameUnlocked(s, family) || s.badges.includes(family)) {
      // sorting is always available; minigame only when gated-in and not already badged
      showSortModal(family, (instrumentId, chosen, correct) => {
        handleSort(instrumentId, chosen, correct);
      });
      return;
    }
    // offer choices via stacked modals: explainer done → menu
    openCampMenu(family);
  });
}

function openCampMenu(family: Family): void {
  const veil = div('modal-veil');
  const card = div('card');
  const s = store.session!;
  const canMinigame = minigameUnlocked(s, family) && !s.badges.includes(family);
  card.append(
    el('h2', {}, family === 'strings' ? '🐒 Strings Camp' : family === 'woodwinds' ? '🦜 Woodwinds Camp' : family === 'brass' ? '🦁 Brass Camp' : '🐘 Percussion Camp'),
    button('btn primary', '🎒 Sort my instruments', () => {
      veil.remove();
      showSortModal(family, (id, chosen, correct) => handleSort(id, chosen, correct));
    }),
    canMinigame
      ? button('btn', '🎮 Play the camp challenge!', () => {
          veil.remove();
          launchMinigame(family);
        })
      : el('p', { class: 'fact' }, s.badges.includes(family)
          ? 'You already earned this badge — amazing!'
          : `Sort ${3 - (s.sorted[family]?.length ?? 0)} more ${family} instruments to unlock the challenge!`),
    div('row', button('btn ghost', 'Close', () => veil.remove())),
  );
  veil.append(card);
  document.body.append(veil);
}

function handleSort(instrumentId: string, chosen: Family, correct: boolean): void {
  const def = INSTRUMENT_BY_ID.get(instrumentId)!;
  if (correct) {
    store.sortInto(instrumentId, chosen);
    placeAtCamp(def.family as Family, instrumentId);
    hudRefs?.refresh();
    hudRefs?.showToast(`✅ Yes! The ${def.nameEarly} lives with the ${chosen} family!`);
  } else {
    hudRefs?.showToast(`Hmm — the ${def.nameEarly} isn't in the ${chosen} family. Try again!`);
  }
}

/* ---------- mini-games ---------- */

function launchMinigame(family: Family): void {
  const cfgRaw = require_minigames();
  const cfg = cfgRaw.find((c: MinigameCfg) => c.id === family)!;
  const knobs = store.mode === 'early' ? cfg.early : cfg.upper;
  const s = store.session!;
  s.minigames[family] ??= { bestStars: 0, plays: 0, roundCheckpoint: null };
  const ctx = {
    family,
    knobs,
    checkpoint: s.minigames[family].roundCheckpoint,
    saveCheckpoint: (c: { round: number; score: number; mistakes: number } | null) => {
      s.minigames[family].roundCheckpoint = c;
      store.persist();
    },
  };
  let GameClass: new (ctx: never) => unknown;
  switch (family) {
    case 'percussion': GameClass = RhythmEcho as never; break;
    case 'strings': GameClass = VineMelody as never; break;
    case 'woodwinds': GameClass = WindSong as never; break;
    default: GameClass = BuzzLab as never; break;
  }
  void new GameClass(ctx as never);
  const off = emitOnDone(family);
  function cleanupListener(): void {
    off();
  }
  function emitOnDone(_f: Family): () => void {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<{ stars: number }>).detail;
      cleanupListener();
      if (detail.stars < 0) return; // aborted mid-game — checkpoint kept
      const st = store.session!.minigames[family];
      st.plays++;
      st.bestStars = Math.max(st.bestStars ?? 0, detail.stars);
      st.roundCheckpoint = null;
      for (const b of badgeForStars(family, detail.stars, store.session!)) {
        store.session!.badges.push(b);
        hudRefs?.refresh();
        confettiBurst(world.scene, player.position.clone().add(new THREE.Vector3(0, 2, 0)));
        hudRefs?.showToast(`🏅 You earned the ${family.toUpperCase()} BADGE!`);
      }
      store.persist();
      if (finaleUnlocked(store.session!)) {
        setTimeout(() => hudRefs?.showToast('🎪 All badges earned! Head to the Rainbow Stage at the map center!'), 1200);
      }
    };
    window.addEventListener(`mj-minigame-done-${_f}`, handler);
    return () => window.removeEventListener(`mj-minigame-done-${_f}`, handler);
  }
}

// base.ts emits via events bus; bridge it to window events used above
import { on } from './core/events';
on('minigame:done', ({ family, stars }) => {
  window.dispatchEvent(new CustomEvent(`mj-minigame-done-${family}`, { detail: { stars } }));
});

function require_minigames(): MinigameCfg[] {
  return mgConfig as unknown as MinigameCfg[];
}

/* ---------- finale ---------- */

let finaleHandle: FinaleHandle | null = null;

function tryFinale(): void {
  if (!finaleUnlocked(store.session!)) return;
  if (finaleHandle) return;
  finaleHandle = playFinale(() => {
    confettiBurst(world.scene, new THREE.Vector3(LANDMARKS.stage.x, getHeight(LANDMARKS.stage.x, LANDMARKS.stage.z), LANDMARKS.stage.z));
    finaleHandle = null;
    showCertificate();
    emit('finale:done', {});
  });
}

// jam access from pause menu would be nice; expose via triple-tap compass in upper mode
let tapCount = 0;
let tapTimer = 0;
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (!target.classList.contains('compass')) return;
  if (store.mode !== 'early') {
    tapCount++;
    window.clearTimeout(tapTimer);
    tapTimer = window.setTimeout(() => { tapCount = 0; }, 900);
    if (tapCount >= 3) {
      tapCount = 0;
      showJam(() => undefined);
    }
  }
});

/* ---------- helpers ---------- */

function nearestUndiscovered(): { x: number; z: number } | null {
  const s = store.session!;
  let best: { x: number; z: number; d: number } | null = null;
  for (const def of INSTRUMENT_BY_ID.values()) {
    if (s.discovered.includes(def.id)) continue;
    const ped = world.pedestals.get(def.id);
    if (!ped) continue;
    const d = Math.hypot(ped.group.position.x - player.position.x, ped.group.position.z - player.position.z);
    if (!best || d < best.d) best = { x: ped.group.position.x, z: ped.group.position.z, d };
  }
  return best;
}

function savePosition(): void {
  if (!store.session) return;
  store.session.pos = { x: player.position.x, z: player.position.z };
  store.persist();
}

player.onStuck = () => hudRefs?.showToast("The jungle is thick here — walk manually a moment!");

/* ---------- input & loop ---------- */

const disposeFns: (() => void)[] = [];
disposeFns.push(initInput(renderer.domElement));
disposeFns.push(initContextLoss(renderer.domElement, () => { paused = true; }, () => { paused = false; }));
let disposeJoystick: (() => void) | null = null;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// periodic autosave
window.setInterval(() => {
  if (store.screen === 'play') savePosition();
}, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') savePosition();
});

// tier changes rebuild foliage
window.addEventListener('mj-tier', () => {
  renderer.setPixelRatio(tierConfig().dpr);
  world.applyTier(tierConfig().density);
});

setScreen('title');

// debug/testing hook
declare global { interface Window { __mj?: Record<string, unknown> } }
window.__mj = { player, store, rig, world, discovery, launchMinigame };

const clock = new THREE.Clock();
let compassTick = 0;
let frameCount = 0;

function loop(): void {
  requestAnimationFrame(loop);
  frameCount++;
  (window as { __mj?: Record<string, unknown> }).__mj!.frames = frameCount;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (store.screen === 'play' && !paused && !isContextPaused()) {
    const inp = sampleInput();
    (window as { __mj?: Record<string, unknown> }).__mj!.lastInput = inp;
    const joy = sampleJoystick();
    const move = {
      x: THREE.MathUtils.clamp(inp.move.x + joy.x, -1, 1),
      y: THREE.MathUtils.clamp(inp.move.y + joy.y, -1, 1),
    };
    if (move.x !== 0 || move.y !== 0) player.cancelAutowalk();
    player.update(dt, move, rig.yaw, world.colliders);

    rig.update(dt, player.position, inp.camDelta.x, camera);
    world.update(dt, t);
    updateSparkles(dt);
    tickProbe();

    // discovery proximity + interact
    const near = discovery.update(player.position);
    if (inp.interact && !document.querySelector('.modal-veil, .mg-root')) discovery.triggerCurrent();
    if (near) {
      const v = near.pos.clone().project(camera);
      const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
      hudRefs?.setPrompt(`${near.prompt()}  ·  ✋ / Space`, v.z < 1 ? { x: sx, y: sy } : undefined);
    } else {
      hudRefs?.setPrompt(null);
    }

    // compass every ~150ms
    if (++compassTick % 9 === 0) {
      const tgt = nearestUndiscovered();
      if (tgt) {
        const dx = tgt.x - player.position.x;
        const dz = tgt.z - player.position.z;
        hudRefs?.setCompass(Math.atan2(dx, dz) - rig.yaw - Math.PI, Math.hypot(dx, dz));
      }
    }
  } else if (store.screen !== 'play') {
    // idle title spin backdrop: slow orbit around stage
    const r = 26;
    const a = t * 0.06;
    camera.position.set(LANDMARKS.station.x + Math.sin(a) * r, getHeight(LANDMARKS.station.x, LANDMARKS.station.z) + 10, LANDMARKS.station.z + Math.cos(a) * r);
    camera.lookAt(LANDMARKS.station.x, getHeight(LANDMARKS.station.x, LANDMARKS.station.z) + 2, LANDMARKS.station.z);
    world.update(dt, t);
  }

  renderer.render(world.scene, camera);
}
loop();

export {}; // module
