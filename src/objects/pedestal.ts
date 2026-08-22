/**
 * pedestal.ts + totem.ts — interaction furniture. Pedestals hold undiscovered
 * instruments with a pulsing glow; totems anchor family camps (sorting,
 * explainer, mini-game, ranger check).
 * Safe knobs: glow pulse speed, sizes.
 */
import * as THREE from 'three';
import type { Family } from '../content/families';
import { FAMILY_INFO } from '../content/families';
import { textTexture } from '../world/landmarks';

export interface Pedestal {
  group: THREE.Group;
  glow: THREE.Mesh;
  update(t: number): void;
  setDiscovered(d: boolean): void;
}

export function buildPedestal(x: number, z: number, accent: string): Pedestal {
  const group = new THREE.Group();
  const gy = 0; // caller positions group on terrain
  group.position.set(x, gy, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.55, 10), new THREE.MeshLambertMaterial({ color: '#9b9488' }));
  base.position.y = 0.27;
  group.add(base);
  const glowMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const glow = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.45, 24), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.06;
  group.add(glow);
  return {
    group,
    glow,
    update(t) {
      const s = 1 + Math.sin(t * 2.6) * 0.12;
      glow.scale.set(s, s, s);
      glowMat.opacity = 0.4 + Math.sin(t * 2.6) * 0.18;
    },
    setDiscovered(d) {
      glowMat.opacity = d ? 0.12 : 0.55;
      glowMat.color.set(d ? '#888888' : accent);
    },
  };
}

export function buildTotem(family: Family, x: number, z: number): THREE.Group {
  const info = FAMILY_INFO[family];
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.6, 8), new THREE.MeshLambertMaterial({ color: '#7a5230' }));
  post.position.y = 1.3;
  g.add(post);
  // stacked painted heads
  const cols = [info.color, info.softColor, info.color];
  for (let i = 0; i < 3; i++) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.05 - i * 0.14, 0.55, 0.55), new THREE.MeshLambertMaterial({ color: cols[i] }));
    head.position.y = 2.15 + i * 0.62;
    g.add(head);
    // simple face: two eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#241f1a' });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), eyeMat);
      eye.position.set(sx * 0.18, 0.06, 0.29 + i * 0);
      head.add(eye);
    }
  }
  // banner with family name
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 0.6),
    new THREE.MeshBasicMaterial({ map: textTexture(info.label.toUpperCase(), info.color), transparent: false }),
  );
  banner.position.set(0, 3.95, 0.02);
  g.add(banner);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.6), new THREE.MeshBasicMaterial({ color: info.color }));
  back.rotation.y = Math.PI;
  back.position.set(0, 3.95, -0.01);
  g.add(back);
  return g;
}
