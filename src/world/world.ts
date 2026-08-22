/**
 * world.ts — assembles terrain, sky, foliage, water, landmarks, pedestals,
 * totems and the stage into one scene; exposes colliders + updaters.
 * Safe knobs: pedestal ring layout per landmark.
 */
import * as THREE from 'three';
import { buildTerrain, LANDMARKS, getHeight, type LandmarkId } from './terrain';
import { buildSky } from './sky';
import { buildFoliage, type FoliageSet } from './foliage';
import { buildWater } from './water';
import { buildLandmarks } from './landmarks';
import { ColliderSet } from './colliders';
import { buildPedestal, buildTotem, type Pedestal } from '../objects/pedestal';
import { INSTRUMENTS } from '../game/state';

export interface World {
  scene: THREE.Scene;
  colliders: ColliderSet;
  foliage: FoliageSet;
  pedestals: Map<string, Pedestal>;
  update(dt: number, t: number): void;
  applyTier(density: number): void;
}

export function buildWorld(): World {
  const scene = new THREE.Scene();
  const colliders = new ColliderSet();
  const updaters: ((dt: number, t: number) => void)[] = [];

  const terrain = buildTerrain();
  scene.add(terrain.mesh);

  const sky = buildSky(scene);
  void sky;

  const water = buildWater(LANDMARKS.falls.x + 10, LANDMARKS.falls.z + 14);
  scene.add(water.group);
  updaters.push((dt, t) => water.update(dt, t));

  const landmarks = buildLandmarks();
  scene.add(landmarks.group);
  for (const c of landmarks.colliders) colliders.add(c);
  updaters.push((dt, t) => landmarks.update(dt, t));

  const foliage = buildFoliage(7);
  scene.add(foliage.group);
  updaters.push(() => undefined); // foliage static

  /* ---- pedestals: ring of instruments near each landmark ---- */
  const pedestals = new Map<string, Pedestal>();
  const byLandmark = new Map<string, typeof INSTRUMENTS>();
  for (const inst of INSTRUMENTS) {
    const list = byLandmark.get(inst.landmark) ?? [];
    list.push(inst);
    byLandmark.set(inst.landmark, list);
  }
  const landmarkCenter: Record<string, LandmarkId> = {
    cave: 'cave', grove: 'grove', falls: 'falls', fire: 'fire',
  };
  for (const [lmKey, list] of byLandmark.entries()) {
    const center = LANDMARKS[landmarkCenter[lmKey] ?? 'station'];
    const n = list.length;
    list.forEach((inst, i) => {
      // arc facing back toward map center
      const towardCenter = Math.atan2(-center.x, -center.z);
      const a = towardCenter + (i / Math.max(1, n)) * Math.PI * 1.2 + Math.PI * 0.4;
      const r = 6.2 + (i % 2) * 1.8;
      let px = center.x + Math.sin(a) * r;
      let pz = center.z + Math.cos(a) * r;
      // nudge off paths
      if (Math.hypot(px, pz) < 14) {
        px += Math.sin(a) * 3;
        pz += Math.cos(a) * 3;
      }
      const ped = buildPedestal(px, pz, inst.accentColor);
      ped.group.position.y = getHeight(px, pz);
      scene.add(ped.group);
      pedestals.set(inst.id, ped);
      updaters.push((_dt, t) => ped.update(t));
    });
  }

  /* ---- family totems near camp centers ---- */
  const totemSpots: Record<string, { x: number; z: number }> = {
    strings: { x: LANDMARKS.cave.x, z: LANDMARKS.cave.z + 9.5 },
    woodwinds: { x: LANDMARKS.grove.x, z: LANDMARKS.grove.z - 9.5 },
    brass: { x: LANDMARKS.falls.x + 11, z: LANDMARKS.falls.z - 10 },
    percussion: { x: LANDMARKS.fire.x, z: LANDMARKS.fire.z + 8.5 },
  };
  for (const [fam, spot] of Object.entries(totemSpots)) {
    const totem = buildTotem(fam as never, spot.x, spot.z);
    totem.position.y = getHeight(spot.x, spot.z);
    scene.add(totem);
    colliders.add({ x: spot.x, z: spot.z, r: 0.75 });
  }

  return {
    scene,
    colliders,
    foliage,
    pedestals,
    update(dt, t) {
      for (const u of updaters) u(dt, t);
    },
    applyTier(density) {
      foliage.rebuild(density);
      colliders.set([...landmarks.colliders]);
      // re-add tree colliders is skipped on low tier (density<=0.5 adds none)
    },
  };
}
