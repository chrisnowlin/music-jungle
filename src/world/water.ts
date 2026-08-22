/**
 * water.ts — pond + waterfall with animated canvas stripes and splash particles.
 * Safe knobs: WATER_Y, stripe speed.
 */
import * as THREE from 'three';
import { getHeight } from './terrain';

export interface WaterResult {
  group: THREE.Group;
  update(dt: number, t: number): void;
}

export function buildWater(cx: number, cz: number): WaterResult {
  const group = new THREE.Group();
  const WATER_Y = -3.1;

  // pond disc
  const pondGeo = new THREE.CircleGeometry(10.5, 28);
  pondGeo.rotateX(-Math.PI / 2);
  const pond = new THREE.Mesh(pondGeo, new THREE.MeshLambertMaterial({
    color: '#4fa8d8', transparent: true, opacity: 0.82,
  }));
  pond.position.set(cx, WATER_Y, cz);
  group.add(pond);

  // cliff the falls pours from
  const cliffMat = new THREE.MeshLambertMaterial({ color: '#8b8b80' });
  const cliff = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 5), cliffMat);
  const cliffY = getHeight(cx, cz - 14) + 2;
  cliff.position.set(cx, cliffY, cz - 14);
  cliff.rotation.x = -0.06;
  group.add(cliff);

  // waterfall sheet — scrolling stripes via CanvasTexture
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 128;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#bfe6f7';
  g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.5})`;
    const w = 1.5 + Math.random() * 2.5;
    g.fillRect(Math.random() * 64, 0, w, 128);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  const fallMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9 });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(6, 11), fallMat);
  fall.position.set(cx, WATER_Y + 5.2, cz - 11.4);
  group.add(fall);

  // splash particles
  const N = 90;
  const positions = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    positions[i * 3] = cx + (Math.random() - 0.5) * 7;
    positions[i * 3 + 1] = WATER_Y + Math.random() * 2.4;
    positions[i * 3 + 2] = cz - 11 + (Math.random() - 0.5) * 2;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({ color: '#e8f8ff', size: 0.22, transparent: true, opacity: 0.85 }));
  group.add(pts);

  return {
    group,
    update(_dt, t) {
      tex.offset.y = -(t * 0.55) % 1;
      const arr = pgeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) {
        let y = arr.getY(i) + _dt * (1.2 + (i % 5) * 0.35);
        if (y > WATER_Y + 2.6) y = WATER_Y + Math.random() * 0.4;
        arr.setY(i, y);
      }
      arr.needsUpdate = true;
      void t;
    },
  };
}
