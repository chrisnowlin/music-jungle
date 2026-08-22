/**
 * collection.ts — family camp displays: sorted instruments appear arranged
 * around each totem with a sparkle burst on arrival.
 * Safe knobs: ring layout radius/slots.
 */
import * as THREE from 'three';
import { BUILDERS } from '../objects/instruments';
import { INSTRUMENT_BY_ID } from './state';
import { LANDMARKS, getHeight } from '../world/terrain';
import type { Family } from '../content/families';

const RING_R = 3.2;
const placed = new Map<string, THREE.Group>();
let scene: THREE.Scene | null = null;
const sparkles: { pts: THREE.Points; t: number }[] = [];

export function initCollection(sc: THREE.Scene): void {
  scene = sc;
}

function slotTransform(family: Family, index: number): { x: number; z: number; rot: number } {
  const L = LANDMARKS[family === 'strings' ? 'cave' : family === 'woodwinds' ? 'grove' : family === 'brass' ? 'falls' : 'fire'];
  const a = (index / 5) * Math.PI * 2 + 0.4;
  const x = L.x + Math.sin(a) * RING_R;
  const z = L.z + Math.cos(a) * RING_R;
  return { x, z, rot: -a + Math.PI / 2 };
}

/** Show an instrument standing at its camp slot (idempotent). */
export function placeAtCamp(family: Family, instrumentId: string): void {
  if (!scene || placed.has(instrumentId)) return;
  const def = INSTRUMENT_BY_ID.get(instrumentId);
  const builder = BUILDERS[instrumentId];
  if (!def || !builder) return;
  const familyListKey = def.family; // display at its TRUE family camp
  const existing = [...placed.values()].length;
  void existing;
  const model = builder(def.accentColor);
  model.scale.setScalar(0.8);
  // find next free slot among same-family instruments
  const sameCount = countFamilyPlaced(familyListKey);
  const slot = slotTransform(family as Family, sameCount % 5);
  model.position.set(slot.x, getHeight(slot.x, slot.z), slot.z);
  model.rotation.y = slot.rot;
  scene.add(model);
  placed.set(instrumentId, model);
  burstSparkle(model.position.x, model.position.y + 0.8, model.position.z, def.accentColor);
}

function countFamilyPlaced(family: string): number {
  let n = 0;
  for (const id of placed.keys()) {
    if (INSTRUMENT_BY_ID.get(id)?.family === family) n++;
  }
  return n;
}

export function restoreCamps(sorted: Record<string, string[]>): void {
  for (const [fam, ids] of Object.entries(sorted)) {
    for (const id of ids) placeAtCamp(fam as Family, id);
  }
}

export function clearCollection(): void {
  for (const [, g] of placed) scene?.remove(g);
  placed.clear();
}

/* ---------- sparkles ---------- */

export function burstSparkle(x: number, y: number, z: number, colorHex: string): void {
  if (!scene) return;
  const N = 26;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = x + (Math.random() - 0.5) * 0.4;
    pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.4;
    pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: colorHex, size: 0.22, transparent: true, opacity: 1 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  sparkles.push({ pts, t: 0 });
}

export function updateSparkles(dt: number): void {
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i];
    s.t += dt;
    const arr = s.pts.geometry.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j < arr.count; j++) {
      arr.setY(j, arr.getY(j) + dt * 1.6);
      arr.setX(j, arr.getX(j) + Math.sin(s.t * 7 + j) * dt * 0.35);
    }
    arr.needsUpdate = true;
    (s.pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - s.t / 1.1);
    if (s.t > 1.1) {
      scene?.remove(s.pts);
      s.pts.geometry.dispose();
      (s.pts.material as THREE.Material).dispose();
      sparkles.splice(i, 1);
    }
  }
}
