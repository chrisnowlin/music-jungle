/**
 * iconSnapshot.ts — runtime icon pipeline: renders each procedural instrument
 * once into a small offscreen scene and caches the PNG dataURL in memory.
 * Safe knobs: SIZE, lighting.
 */
import * as THREE from 'three';
import { BUILDERS } from './instruments';
import { INSTRUMENT_BY_ID } from '../game/state';

const SIZE = 256;
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;

function ensureRig(): void {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE);
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight('#ffffff', '#889977', 1.05);
  const key = new THREE.DirectionalLight('#fff8e8', 1.5);
  key.position.set(2, 3, 4);
  scene.add(hemi, key);
  camera = new THREE.OrthographicCamera(-1.9, 1.9, 1.9, -1.9, 0.01, 30);
  camera.position.set(2.6, 2.2, 4.2);
  camera.lookAt(0, 0.2, 0);
}

/** Lazily render + cache; returns a dataURL usable as <img src>. */
export function instrumentIcon(id: string): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = INSTRUMENT_BY_ID.get(id);
  const builder = BUILDERS[id];
  if (!def || !builder) return '';
  ensureRig();
  const model = builder(def.accentColor);
  model.rotation.y = Math.PI * 0.28;
  scene!.add(model);
  renderer!.render(scene!, camera!);
  const url = renderer!.domElement.toDataURL('image/png');
  scene!.remove(model);
  disposeGroup(model);
  cache.set(id, url);
  return url;
}

function disposeGroup(g: THREE.Group): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
    }
  });
}
