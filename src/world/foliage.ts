/**
 * foliage.ts — fully procedural low-poly vegetation, merged into per-variant
 * geometries with baked vertex colors, drawn via InstancedMesh (1 draw call
 * per variant). Rebuildable at runtime when the quality tier changes.
 * Safe knobs: COUNTS, palette colors.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getHeight, LANDMARKS } from './terrain';

export interface FoliageSet {
  group: THREE.Group;
  colliders: { x: number; z: number; r: number }[];
  dispose(): void;
  rebuild(density: number): void;
}

const PALETTE = {
  leafA: new THREE.Color('#3f8f3f'),
  leafB: new THREE.Color('#57a83b'),
  leafC: new THREE.Color('#2f7a4f'),
  trunkA: new THREE.Color('#7a5230'),
  trunkB: new THREE.Color('#5d3d22'),
  rockA: new THREE.Color('#93938a'),
  rockB: new THREE.Color('#77776e'),
  flowerA: new THREE.Color('#e8636f'),
  flowerB: new THREE.Color('#f2b134'),
};

function paint(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** slight random vertex jitter for a hand-made low-poly look */
function jitter(geo: THREE.BufferGeometry, amt: number): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i,
      pos.getX(i) + (Math.random() - 0.5) * amt,
      pos.getY(i) + (Math.random() - 0.5) * amt,
      pos.getZ(i) + (Math.random() - 0.5) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}


/** Merge helper: normalizes all parts to non-indexed so attributes stay compatible. */
function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
}

function pineGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = paint(jitter(new THREE.CylinderGeometry(0.28, 0.42, 1.6, 6), 0.06).translate(0, 0.8, 0), PALETTE.trunkB);
  parts.push(trunk);
  const tiers: [number, number][] = [[2.2, 2.6], [1.7, 2.2], [1.15, 1.9]];
  let y = 1.4;
  const cols = [PALETTE.leafC, PALETTE.leafA, PALETTE.leafB];
  tiers.forEach(([r, h], i) => {
    parts.push(paint(jitter(new THREE.ConeGeometry(r, h, 7), 0.12).translate(0, y + h / 2, 0), cols[i]));
    y += h * 0.62;
  });
  return mergeParts(parts);
}

function roundTreeGeo(): THREE.BufferGeometry {
  const parts = [
    paint(jitter(new THREE.CylinderGeometry(0.3, 0.45, 2.2, 6), 0.05).translate(0, 1.1, 0), PALETTE.trunkA),
    paint(jitter(new THREE.IcosahedronGeometry(1.7, 0), 0.16).translate(0, 3.0, 0), PALETTE.leafA),
    paint(jitter(new THREE.IcosahedronGeometry(1.1, 0), 0.14).translate(0.9, 2.4, 0.4), PALETTE.leafB),
    paint(jitter(new THREE.IcosahedronGeometry(0.95, 0), 0.14).translate(-0.85, 2.5, -0.35), PALETTE.leafC),
  ];
  return mergeParts(parts);
}

function palmGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // curved trunk from stacked tilted cylinders
  let x = 0;
  let z = 0;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.CylinderGeometry(0.18, 0.24, 1.1, 5);
    seg.translate(0, 0.55, 0);
    seg.rotateZ(i * 0.14);
    const nx = Math.sin(i * 0.14) * 1.1;
    seg.translate(x, i * 1.02, z);
    x += nx * 0.35;
    parts.push(paint(seg, PALETTE.trunkB));
  }
  const topY = 5.1;
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.SphereGeometry(1.25, 5, 3, 0, Math.PI * 1.2);
    frond.scale(1, 0.16, 0.34);
    frond.rotateY((i / 6) * Math.PI * 2 + 0.3);
    frond.rotateX(-0.32);
    frond.translate(x + Math.sin((i / 6) * Math.PI * 2) * 0.7, topY, z + Math.cos((i / 6) * Math.PI * 2) * 0.7);
    parts.push(paint(frond, i % 2 ? PALETTE.leafB : PALETTE.leafC));
  }
  parts.push(paint(new THREE.IcosahedronGeometry(0.34, 0).translate(x, topY, z), PALETTE.trunkA));
  return mergeParts(parts);
}

function bushGeo(): THREE.BufferGeometry {
  const parts = [
    paint(jitter(new THREE.IcosahedronGeometry(0.75, 0), 0.1).translate(0, 0.55, 0), PALETTE.leafC),
    paint(jitter(new THREE.IcosahedronGeometry(0.5, 0), 0.09).translate(0.45, 0.45, 0.2), PALETTE.leafB),
  ];
  return mergeParts(parts);
}

function rockGeo(): THREE.BufferGeometry {
  return paint(jitter(new THREE.DodecahedronGeometry(0.8, 0), 0.14).scale(1, 0.72, 1).translate(0, 0.35, 0),
    Math.random() > 0.5 ? PALETTE.rockA : PALETTE.rockB);
}

function grassGeo(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.ConeGeometry(0.07, 0.65 + Math.random() * 0.3, 3);
    b.translate(0, 0.33, 0);
    b.rotateX((Math.random() - 0.5) * 0.5);
    b.rotateZ((Math.random() - 0.5) * 0.5);
    b.translate((i - 1) * 0.13, 0, (Math.random() - 0.5) * 0.1);
    blades.push(paint(b, i === 1 ? PALETTE.leafB : PALETTE.leafC));
  }
  return mergeParts(blades);
}

function flowerGeo(): THREE.BufferGeometry {
  const stem = paint(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4).translate(0, 0.25, 0), PALETTE.leafC);
  const head = paint(new THREE.IcosahedronGeometry(0.16, 0), Math.random() > 0.5 ? PALETTE.flowerA : PALETTE.flowerB);
  head.translate(0, 0.56, 0);
  return mergeParts([stem, head]);
}

interface Variant {
  key: string;
  geo: () => THREE.BufferGeometry;
  baseCount: number;
  scaleMin: number;
  scaleMax: number;
  colliderRadius?: number;
}

const VARIANTS: Variant[] = [
  { key: 'pine', geo: pineGeo, baseCount: 130, scaleMin: 0.8, scaleMax: 1.5, colliderRadius: 0.7 },
  { key: 'round', geo: roundTreeGeo, baseCount: 90, scaleMin: 0.8, scaleMax: 1.4, colliderRadius: 0.8 },
  { key: 'palm', geo: palmGeo, baseCount: 26, scaleMin: 0.9, scaleMax: 1.3, colliderRadius: 0.5 },
  { key: 'bush', geo: bushGeo, baseCount: 150, scaleMin: 0.7, scaleMax: 1.4 },
  { key: 'rock', geo: rockGeo, baseCount: 90, scaleMin: 0.6, scaleMax: 1.8, colliderRadius: 0.7 },
  { key: 'grass', geo: grassGeo, baseCount: 420, scaleMin: 0.7, scaleMax: 1.4 },
  { key: 'flower', geo: flowerGeo, baseCount: 120, scaleMin: 0.8, scaleMax: 1.3 },
];

const HALF_MAP = 116;

function randPos(rng: () => number): { x: number; z: number } {
  return { x: (rng() * 2 - 1) * HALF_MAP, z: (rng() * 2 - 1) * HALF_MAP };
}

export function buildFoliage(seed = 7): FoliageSet {
  const group = new THREE.Group();
  group.name = 'foliage';
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const meshes = new Map<string, THREE.InstancedMesh>();
  const allColliders: { x: number; z: number; r: number }[] = [];

  // deterministic placement
  let s = seed;
  const rng = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  function clearCollidersFor(key: string): void {
    // colliders are only added for tree/rock variants on rebuild — keep simple by rebuilding all
  }

  function rebuild(density: number): void {
    s = seed;
    allColliders.length = 0;
    for (const [, m] of meshes) {
      group.remove(m);
      m.dispose();
    }
    meshes.clear();

    for (const v of VARIANTS) {
      const count = Math.max(8, Math.round(v.baseCount * density));
      const inst = new THREE.InstancedMesh(v.geo(), material, count);
      inst.name = `foliage-${v.key}`;
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      let placed = 0;
      let guard = 0;
      while (placed < count && guard++ < count * 30) {
        const p = randPos(rng);
        // keep spawn/stage clear and paths walkable
        if (Math.hypot(p.x - LANDMARKS.station.x, p.z - LANDMARKS.station.z) < 10) continue;
        if (Math.hypot(p.x - LANDMARKS.stage.x, p.z - LANDMARKS.stage.z) < 11) continue;
        if (v.key !== 'grass' && v.key !== 'flower' && v.key !== 'bush') {
          let nearPath = false;
          for (const L of Object.values(LANDMARKS)) {
            if (Math.hypot(p.x - L.x, p.z - L.z) < 15) { nearPath = true; break; }
          }
          if (nearPath) continue;
        }
        const y = getHeight(p.x, p.z);
        if (y < -3.2 && v.key !== 'rock') continue; // no trees in the pond
        const sc = v.scaleMin + rng() * (v.scaleMax - v.scaleMin);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
        scl.set(sc, sc, sc);
        m4.compose(new THREE.Vector3(p.x, y, p.z), q, scl);
        inst.setMatrixAt(placed, m4);
        placed++;
        if (v.colliderRadius && density > 0.5) {
          allColliders.push({ x: p.x, z: p.z, r: v.colliderRadius * sc });
        }
      }
      inst.count = placed;
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = true;
      meshes.set(v.key, inst);
      group.add(inst);
    }
  }

  rebuild(1);

  return {
    group,
    get colliders() { return allColliders; },
    dispose() {
      for (const m of meshes.values()) m.dispose();
      material.dispose();
    },
    rebuild,
  };
}
