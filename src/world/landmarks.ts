/**
 * landmarks.ts — the five named places: Ranger Station, Rainbow Stage,
 * Waterfall Falls cliff area, Cave of Strings, Whispering Grove, Fire Circle.
 * Returns colliders for the player physics.
 * Safe knobs: colors/sizes; positions come from terrain.ts LANDMARKS.
 */
import * as THREE from 'three';
import { getHeight, LANDMARKS } from './terrain';

export interface LandmarksResult {
  group: THREE.Group;
  colliders: { x: number; z: number; r: number }[];
  update(dt: number, t: number): void;
}

const mat = (c: string, opts: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color: c, ...opts });

function boxMesh(w: number, h: number, d: number, c: string, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  m.position.set(x, y, z);
  return m;
}

function cylMesh(rt: number, rb: number, h: number, c: string, x: number, y: number, z: number, seg = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
  m.position.set(x, y, z);
  return m;
}

export function buildLandmarks(): LandmarksResult {
  const group = new THREE.Group();
  group.name = 'landmarks';
  const colliders: { x: number; z: number; r: number }[] = [];
  const animatable: ((dt: number, t: number) => void)[] = [];

  /* ---- Ranger Station (spawn) ---- */
  {
    const S = LANDMARKS.station;
    const y = getHeight(S.x, S.z);
    const hut = new THREE.Group();
    hut.position.set(S.x, y, S.z);
    hut.add(boxMesh(6, 2.6, 4.6, '#a9754f', 0, 1.3, 0));
    hut.add(boxMesh(5.6, 2.2, 4.2, '#8a5a3a', 0, 1.1, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.2, 4), mat('#c0553a'));
    roof.position.y = 3.7;
    roof.rotation.y = Math.PI / 4;
    hut.add(roof);
    hut.add(boxMesh(1.3, 2, 0.15, '#5d3d22', 0, 1, 2.32));
    hut.add(boxMesh(1.6, 1.2, 0.12, '#dff3ff', -1.8, 1.6, 2.32));
    // sign post
    hut.add(cylMesh(0.09, 0.11, 2.4, '#7a5230', 3.6, 1.2, 2.4, 6));
    const sign = boxMesh(2.2, 0.8, 0.12, '#e8d9a8', 3.6, 2.5, 2.4);
    hut.add(sign);
    const signTxt = new THREE.Mesh(
      new THREE.PlaneGeometry(2.05, 0.66),
      new THREE.MeshBasicMaterial({ map: textTexture('RANGER STATION'), transparent: true }),
    );
    signTxt.position.set(0, 0, 0.07);
    sign.add(signTxt);
    group.add(hut);
    colliders.push({ x: S.x, z: S.z, r: 3.4 });
  }

  /* ---- Rainbow Stage (finale) ---- */
  {
    const S = LANDMARKS.stage;
    const y = getHeight(S.x, S.z);
    const stage = new THREE.Group();
    stage.position.set(S.x, y, S.z);
    stage.add(cylMesh(6.4, 7, 0.7, '#d8c48e', 0, 0.35, 0, 26));
    stage.add(cylMesh(5.4, 5.9, 0.5, '#cbb27a', 0, 0.85, 0, 24));
    // rainbow arch: 7 colored torus halves
    const rainbow = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#5e35b1', '#8e24aa'];
    rainbow.forEach((c, i) => {
      const t = new THREE.Mesh(
        new THREE.TorusGeometry(6.8 - i * 0.42, 0.16, 6, 30, Math.PI),
        new THREE.MeshBasicMaterial({ color: c }),
      );
      t.position.y = 0.9;
      stage.add(t);
    });
    group.add(stage);
    animatable.push((_dt, t) => {
      stage.rotation.y = 0; // static; concert mode orbits the camera instead
      void t;
    });
  }

  /* ---- Waterfall Falls (brass) — pond/cliff built by water.ts, add rocky ring ---- */
  {
    const F = LANDMARKS.falls;
    const y = getHeight(F.x, F.z);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = 8 + (i % 3);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + (i % 2) * 0.5, 0), mat('#7d7d74'));
      rock.position.set(F.x + Math.sin(a) * r, getHeight(F.x + Math.sin(a) * r, F.z + Math.cos(a) * r) + 0.3, F.z + Math.cos(a) * r);
      rock.rotation.set(i, i * 1.3, i * 0.7);
      group.add(rock);
    }
    colliders.push({ x: F.x - 10, z: F.z - 14, r: 6 }); // cliff face
    void y;
  }

  /* ---- Cave of Strings (strings) ---- */
  {
    const C = LANDMARKS.cave;
    const y = getHeight(C.x, C.z);
    const cave = new THREE.Group();
    cave.position.set(C.x, y, C.z);
    // dome with an opening facing the station
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(7.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      mat('#6e6a63'),
    );
    dome.position.y = 0;
    cave.add(dome);
    // dark entrance disc
    const hole = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), new THREE.MeshBasicMaterial({ color: '#241f1a' }));
    hole.position.set(0, 2.2, -7.2);
    hole.rotation.y = Math.PI;
    cave.add(hole);
    // stalagmites
    for (let i = 0; i < 5; i++) {
      const a = -0.6 + i * 0.5;
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.4 + (i % 2) * 0.2, 1.6 + (i % 3) * 0.5, 6), mat('#8b867d'));
      s.position.set(Math.sin(a) * 5.4, 0.6, Math.cos(a) * 5.4);
      cave.add(s);
    }
    group.add(cave);
    colliders.push({ x: C.x, z: C.z - 7.4, r: 2.2 });
    colliders.push({ x: C.x - 5.6, z: C.z, r: 2.6 });
    colliders.push({ x: C.x + 5.6, z: C.z, r: 2.6 });
    colliders.push({ x: C.x, z: C.z + 6.4, r: 3 });
  }

  /* ---- Whispering Grove (woodwinds): dense pretty trees + fireflies ---- */
  {
    const G = LANDMARKS.grove;
    const y = getHeight(G.x, G.z);
    const ring = new THREE.Group();
    ring.position.set(G.x, y, G.z);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 8.6;
      const trunk = cylMesh(0.22, 0.34, 3.4, '#5d3d22', Math.sin(a) * r, 1.7, Math.cos(a) * r, 6);
      ring.add(trunk);
      const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9 + (i % 3) * 0.4, 0), mat(i % 2 ? '#3f8f3f' : '#57a83b'));
      canopy.position.set(Math.sin(a) * r, 3.9 + (i % 2) * 0.4, Math.cos(a) * r);
      canopy.rotation.y = i;
      ring.add(canopy);
      colliders.push({ x: G.x + Math.sin(a) * r, z: G.z + Math.cos(a) * r, r: 0.7 });
    }
    // fireflies
    const N = 40;
    const fp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      fp[i * 3] = (Math.random() - 0.5) * 14;
      fp[i * 3 + 1] = 0.8 + Math.random() * 2.6;
      fp[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    const flies = new THREE.Points(fg, new THREE.PointsMaterial({ color: '#ffe98a', size: 0.28, transparent: true, opacity: 0.95 }));
    ring.add(flies);
    animatable.push((_dt, t) => {
      const arr = fg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) {
        arr.setY(i, 0.9 + Math.sin(t * 1.4 + i * 1.7) * 0.7 + 1);
        arr.setX(i, arr.getX(i) + Math.sin(t * 0.7 + i) * 0.004);
      }
      arr.needsUpdate = true;
    });
    group.add(ring);
  }

  /* ---- Fire Circle (percussion) ---- */
  {
    const F = LANDMARKS.fire;
    const y = getHeight(F.x, F.z);
    const ring = new THREE.Group();
    ring.position.set(F.x, y, F.z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 4.6;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 + (i % 2) * 0.2, 0), mat('#8b867d'));
      stone.position.set(Math.sin(a) * r, 0.3, Math.cos(a) * r);
      stone.rotation.set(i, i * 0.8, 0);
      ring.add(stone);
    }
    // logs
    const log1 = cylMesh(0.28, 0.28, 2.6, '#7a5230', 0, 0.3, 0, 7);
    log1.rotation.z = Math.PI / 2;
    log1.rotation.y = 0.4;
    const log2 = cylMesh(0.26, 0.26, 2.4, '#5d3d22', 0, 0.55, 0, 7);
    log2.rotation.z = Math.PI / 2;
    log2.rotation.y = -0.7;
    ring.add(log1, log2);
    // flame cones (flicker via scale)
    const flames: THREE.Mesh[] = [];
    const fcols = ['#f59e0b', '#ef4444', '#fb923c'];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.5 - i * 0.13, 1.5 - i * 0.3, 7), mat(fcols[i]));
      f.position.y = 0.9 + i * 0.28;
      ring.add(f);
      flames.push(f);
    }
    animatable.push((_dt, t) => {
      flames.forEach((f, i) => {
        const s = 1 + Math.sin(t * 9 + i * 2.1) * 0.14 + Math.sin(t * 23 + i) * 0.05;
        f.scale.set(s, s, s);
      });
    });
    group.add(ring);
    colliders.push({ x: F.x, z: F.z, r: 1.6 });
  }

  return {
    group,
    colliders,
    update(dt, t) {
      for (const fn of animatable) fn(dt, t);
    },
  };
}

/** Simple canvas text texture for signs. */
export function textTexture(text: string, bg = 'rgba(0,0,0,0)'): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext('2d')!;
  if (bg !== 'rgba(0,0,0,0)') {
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 64);
  }
  g.fillStyle = '#4a3319';
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 2;
  return tex;
}
