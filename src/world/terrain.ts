/**
 * terrain.ts — procedural heightfield with vertex-colored biome paint,
 * flattened landmark pads and sandy paths between regions.
 * Safe knobs: SIZE, SEGMENTS, height amplitudes, PATHS/LANDMARKS radii.
 */
import * as THREE from 'three';

export const MAP_SIZE = 240;
export const HALF = MAP_SIZE / 2;

/** Landmark centers (x,z). */
export const LANDMARKS = {
  station: { x: 0, z: 8 },
  stage: { x: 0, z: -42 },
  falls: { x: -72, z: -66 },   // brass (NW)
  cave: { x: 74, z: 68 },      // strings (SE)
  grove: { x: 76, z: -64 },    // woodwinds (NE)
  fire: { x: -74, z: 66 },     // percussion (SW)
} as const;

export type LandmarkId = keyof typeof LANDMARKS;

const PATHS: [THREE.Vector2, THREE.Vector2][] = (() => {
  const v = (a: { x: number; z: number }) => new THREE.Vector2(a.x, a.z);
  const st = v(LANDMARKS.station);
  return [
    [st, v(LANDMARKS.falls)],
    [st, v(LANDMARKS.cave)],
    [st, v(LANDMARKS.grove)],
    [st, v(LANDMARKS.fire)],
    [st, v(LANDMARKS.stage)],
    [v(LANDMARKS.stage), v(LANDMARKS.falls)],
    [v(LANDMARKS.stage), v(LANDMARKS.grove)],
    [v(LANDMARKS.fire), v(LANDMARKS.cave)],
  ];
})();

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const distToSeg = (px: number, pz: number, a: THREE.Vector2, b: THREE.Vector2): number => {
  const abx = b.x - a.x;
  const abz = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (pz - a.y) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(px - (a.x + abx * t), pz - (a.y + abz * t));
};

/** Deterministic height used by physics + prop placement. */
export function getHeight(x: number, z: number): number {
  let h =
    smoothNoise(x * 0.02, z * 0.02) * 6 +
    smoothNoise(x * 0.05 + 40, z * 0.05 + 40) * 2.2 +
    smoothNoise(x * 0.11 + 90, z * 0.11 + 90) * 0.7;
  h -= 4.4; // center average around 0
  // flatten pads around every landmark
  for (const key of Object.keys(LANDMARKS) as LandmarkId[]) {
    const L = LANDMARKS[key];
    const d = Math.hypot(x - L.x, z - L.z);
    if (d < 16) h = THREE.MathUtils.lerp(0, h, THREE.MathUtils.smoothstep(d, 6, 16));
  }
  // gentle path flattening
  let pd = Infinity;
  for (const [a, b] of PATHS) pd = Math.min(pd, distToSeg(x, z, a, b));
  if (pd < 5) h *= THREE.MathUtils.smoothstep(pd, 2.2, 5) * 0.85 + 0.15;
  // pond depression under the falls
  const F = LANDMARKS.falls;
  const fd = Math.hypot(x - (F.x + 10), z - (F.z + 14));
  if (fd < 12) h -= (1 - THREE.MathUtils.smoothstep(fd, 4, 12)) * 2.6;
  return h;
}

export interface TerrainResult {
  mesh: THREE.Mesh;
  /** sandy path test used for prop placement */
  isPath(x: number, z: number): boolean;
}

export function buildTerrain(): TerrainResult {
  const SEG = 110;
  const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  const cGrassA = new THREE.Color('#69a84f');
  const cGrassB = new THREE.Color('#4d8f43');
  const cPath = new THREE.Color('#cbb27a');
  const cSand = new THREE.Color('#d8c48e');
  const cRock = new THREE.Color('#8f8f86');
  const cDeep = new THREE.Color('#3e7a3c');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = getHeight(x, z);
    pos.setY(i, h);
    const n = smoothNoise(x * 0.08 + 200, z * 0.08 + 200);
    const col = new THREE.Color().lerpColors(cGrassA, cGrassB, n);
    if (h < -3.4) col.lerp(cDeep, 0.5);
    let pd = Infinity;
    for (const [a, b] of PATHS) pd = Math.min(pd, distToSeg(x, z, a, b));
    if (pd < 2.6) col.copy(cPath);
    else if (pd < 3.6) col.lerp(cPath, THREE.MathUtils.smoothstep(pd, 2.6, 3.6));
    // sandy patches near landmarks
    for (const key of Object.keys(LANDMARKS) as LandmarkId[]) {
      const L = LANDMARKS[key];
      const d = Math.hypot(x - L.x, z - L.z);
      if (d < 13 && key !== 'falls') col.lerp(cSand, (1 - THREE.MathUtils.smoothstep(d, 6, 13)) * 0.55);
      if (d < 13 && key === 'falls') col.lerp(cRock, (1 - THREE.MathUtils.smoothstep(d, 6, 13)) * 0.5);
    }
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  return {
    mesh,
    isPath: (x: number, z: number) => {
      for (const [a, b] of PATHS) if (distToSeg(x, z, a, b) < 3.4) return true;
      return false;
    },
  };
}
