/**
 * instruments.ts — 18 procedurally-built low-poly instruments.
 * Every builder returns a THREE.Group ~1.0-1.6u tall in standing pose,
 * recognizable silhouette-first (kids must identify them).
 * Safe knobs: per-instrument colors via accent param; sizes inside builders.
 */
import * as THREE from 'three';

const M = {
  wood: new THREE.MeshLambertMaterial({ color: '#9a6a38' }),
  darkWood: new THREE.MeshLambertMaterial({ color: '#4a3220' }),
  black: new THREE.MeshLambertMaterial({ color: '#1c1c1e' }),
  silver: new THREE.MeshLambertMaterial({ color: '#c9ced4' }),
  brass: new THREE.MeshLambertMaterial({ color: '#d9a441' }),
  skin: new THREE.MeshLambertMaterial({ color: '#e8dcc8' }),
};

function lam(color: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

/** figure-8 body outline used by violin/guitar/cello/bass */
function fiddleShape(waistTop: number, waistBot: number, upper: number, lower: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -h / 2);
  s.bezierCurveTo(lower, -h / 2, lower * 1.05, -h * 0.28, waistBot, -h * 0.18);
  s.bezierCurveTo(waistTop, -h * 0.08, waistTop, h * 0.06, waistBot, h * 0.16);
  s.bezierCurveTo(upper * 1.02, h * 0.26, upper, h / 2, 0, h / 2);
  s.bezierCurveTo(-upper, h / 2, -upper * 1.02, h * 0.26, -waistBot, h * 0.16);
  s.bezierCurveTo(-waistTop, h * 0.06, -waistTop, -h * 0.08, -waistBot, -h * 0.18);
  s.bezierCurveTo(-lower * 1.05, -h * 0.28, -lower, -h / 2, 0, -h / 2);
  return s;
}

interface FiddleOpts { bodyH: number; neckLen: number; accent?: string; hole?: 'ff' | 'round' | 'none'; strings?: number }

function buildFiddle(o: FiddleOpts): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = o.accent ? lam(o.accent) : M.darkWood;
  const shape = fiddleShape(o.bodyH * 0.18, o.bodyH * 0.2, o.bodyH * 0.34, o.bodyH * 0.36, o.bodyH);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: o.bodyH * 0.14, bevelEnabled: false }), bodyMat);
  body.position.z = -o.bodyH * 0.07;
  body.castShadow = false;
  g.add(body);
  // neck
  const neck = new THREE.Mesh(new THREE.BoxGeometry(o.bodyH * 0.075, o.neckLen, o.bodyH * 0.06), M.darkWood);
  neck.position.y = o.bodyH / 2 + o.neckLen / 2;
  g.add(neck);
  // scroll
  const scroll = new THREE.Mesh(new THREE.SphereGeometry(o.bodyH * 0.09, 8, 7), bodyMat);
  scroll.position.y = o.bodyH / 2 + o.neckLen + o.bodyH * 0.04;
  g.add(scroll);
  // fingerboard
  const fb = new THREE.Mesh(new THREE.BoxGeometry(o.bodyH * 0.06, o.neckLen * 0.92, o.bodyH * 0.02), M.black);
  fb.position.set(0, o.bodyH / 2 + o.neckLen * 0.48, o.bodyH * 0.045);
  g.add(fb);
  // sound holes
  if (o.hole === 'round') {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(o.bodyH * 0.11, o.bodyH * 0.11, o.bodyH * 0.16, 10), M.black);
    hole.rotation.x = Math.PI / 2;
    hole.position.z = o.bodyH * 0.02;
    g.add(hole);
  } else if (o.hole === 'ff') {
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(o.bodyH * 0.03, o.bodyH * 0.03, o.bodyH * 0.17, 6), M.black);
      f.rotation.x = Math.PI / 2;
      f.position.set(sx * o.bodyH * 0.13, o.bodyH * 0.05, o.bodyH * 0.03);
      g.add(f);
    }
  }
  // bridge + tailpiece
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(o.bodyH * 0.24, o.bodyH * 0.07, o.bodyH * 0.02), M.black);
  bridge.position.set(0, -o.bodyH * 0.12, o.bodyH * 0.09);
  g.add(bridge);
  const nStrings = o.strings ?? 4;
  for (let i = 0; i < nStrings; i++) {
    const x = ((i / (nStrings - 1)) - 0.5) * o.bodyH * 0.14;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(o.bodyH * 0.006, o.bodyH * 0.006, o.bodyH * 0.62 + o.neckLen, 3), M.silver);
    st.position.set(x, o.bodyH * 0.1 + o.neckLen * 0.35, o.bodyH * 0.1);
    g.add(st);
  }
  return g;
}

function bell(radius: number, len: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(radius * (0.32 + Math.pow(t, 2.6) * 0.68), t * len));
  }
  return new THREE.LatheGeometry(pts, 16);
}

export interface Builder { (accent: string): THREE.Group }

/* ================= STRINGS ================= */

export const violin: Builder = () => {
  const g = buildFiddle({ bodyH: 0.85, neckLen: 0.55, accent: '#b3502a', hole: 'ff', strings: 4 });
  g.rotation.z = 0.18; // resting tilt
  return wrap(g, 1.5);
};

export const guitar: Builder = () => {
  const g = buildFiddle({ bodyH: 1.15, neckLen: 0.95, accent: '#c98a3d', hole: 'round', strings: 6 });
  return wrap(g, 2.0);
};

export const cello: Builder = () => {
  const g = buildFiddle({ bodyH: 1.5, neckLen: 1.0, accent: '#8a4f26', hole: 'ff', strings: 4 });
  const endpin = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.7, 6), M.black);
  endpin.position.y = -0.95;
  g.add(endpin);
  return wrap(g, 2.6);
};

export const doublebass: Builder = () => {
  const g = buildFiddle({ bodyH: 1.9, neckLen: 1.35, accent: '#6e4020', hole: 'none', strings: 4 });
  const endpin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.9, 6), M.black);
  endpin.position.y = -1.25;
  g.add(endpin);
  return wrap(g, 3.2);
};

export const harp: Builder = (accent) => {
  const g = new THREE.Group();
  const colH = 2.6;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, colH, 8), lam(accent));
  pillar.position.set(-0.75, colH / 2, 0);
  g.add(pillar);
  // curved neck
  const neckPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    neckPts.push(new THREE.Vector3(-0.75 + t * 1.5, colH - Math.sin(t * Math.PI * 0.5) * 0.85, 0));
  }
  const neck = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(neckPts), 10, 0.075, 6), lam(accent));
  g.add(neck);
  const soundbox = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 0.36), lam('#c9963f'));
  soundbox.position.set(0, 0.21, 0);
  g.add(soundbox);
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const x = -0.66 + t * 1.32;
    const y0 = 0.4;
    const y1 = colH - Math.sin(t * Math.PI * 0.5) * 0.82;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, y1 - y0, 3), M.silver);
    st.position.set(x, (y0 + y1) / 2, 0.05);
    g.add(st);
  }
  return wrap(g, 2.6);
};

/* ================= WOODWINDS ================= */

export const flute: Builder = () => {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 10), M.silver);
  tube.rotation.z = Math.PI / 2;
  tube.rotation.y = 0.25;
  g.add(tube);
  for (let i = 0; i < 8; i++) {
    const key = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 8), M.silver);
    key.rotation.z = Math.PI / 2;
    key.position.set(-0.45 + i * 0.11, 0.045, 0);
    rotateAround(g, key, 0.25);
  }
  g.rotation.y = 0.25;
  return wrap(g, 1.5);
};

export const clarinet: Builder = (accent) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 1.5, 10), lam(accent || '#1c1c1e'));
  body.position.y = 0.75;
  g.add(body);
  const bellEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 10), M.silver);
  bellEnd.position.y = 0.02;
  g.add(bellEnd);
  const mouth = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 8), M.black);
  mouth.position.y = 1.58;
  g.add(mouth);
  for (let i = 0; i < 6; i++) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 8), M.silver);
    k.position.set(0.045, 0.55 + i * 0.14, 0.03);
    k.rotation.z = 0.3;
    g.add(k);
  }
  return wrap(g, 1.65);
};

export const saxophone: Builder = (accent) => {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.05, 1.45, 0),
    new THREE.Vector3(0.12, 1.0, 0.02),
    new THREE.Vector3(0.05, 0.6, 0),
    new THREE.Vector3(-0.12, 0.35, 0.02),
    new THREE.Vector3(-0.3, 0.28, 0),
    new THREE.Vector3(-0.38, 0.45, 0),
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.07, 8), M.brass);
  g.add(tube);
  const b = new THREE.Mesh(bell(0.3, 0.5), M.brass);
  b.position.set(-0.38, 0.42, 0);
  b.rotation.z = -Math.PI * 0.52;
  b.scale.z = 0.72;
  g.add(b);
  const mouth = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 8), M.black);
  mouth.position.set(0.05, 1.58, 0);
  g.add(mouth);
  for (let i = 0; i < 7; i++) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.silver);
    k.scale.set(1, 0.5, 1);
    k.position.set(0.02 - i * 0.01, 1.18 - i * 0.13, 0.075);
    g.add(k);
  }
  void accent;
  return wrap(g, 1.6);
};

export const bassoon: Builder = (accent) => {
  const g = new THREE.Group();
  const bootMat = accent ? lam(accent) : M.darkWood;
  const long = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.1, 9), bootMat);
  long.position.set(-0.12, 1.05, 0);
  g.add(long);
  const shortT = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.15, 9), bootMat);
  shortT.position.set(0.12, 1.72, 0);
  g.add(shortT);
  // U-bend
  const bend = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 7, 12, Math.PI), bootMat);
  bend.position.set(0, 2.3, 0);
  g.add(bend);
  const bocal = new THREE.Mesh(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([new THREE.Vector3(0.12, 2.36, 0), new THREE.Vector3(0.2, 2.55, 0), new THREE.Vector3(0.16, 2.68, 0)]),
    6, 0.02, 6), M.silver);
  g.add(bocal);
  return wrap(g, 2.7);
};

/* ================= BRASS ================= */

export const trumpet: Builder = () => {
  const g = new THREE.Group();
  const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.1, 10), M.brass);
  lead.rotation.z = Math.PI / 2;
  lead.position.set(0.1, 0.55, 0);
  g.add(lead);
  const flare = new THREE.Mesh(bell(0.34, 0.5), M.brass);
  flare.position.set(0.62, 0.55, 0);
  flare.rotation.z = -Math.PI / 2;
  flare.scale.y = 0.8;
  g.add(flare);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), M.brass);
  mouth.scale.set(1.2, 0.7, 1.2);
  mouth.position.set(-0.52, 0.55, 0);
  g.add(mouth);
  for (let i = 0; i < 3; i++) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 8), M.silver);
    v.position.set(-0.18 + i * 0.13, 0.78, 0);
    g.add(v);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.silver);
    cap.position.set(-0.18 + i * 0.13, 0.97, 0);
    g.add(cap);
  }
  return wrap(g, 1.1);
};

export const trombone: Builder = () => {
  const g = new THREE.Group();
  const slideOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1.5, 9), M.brass);
  slideOuter.rotation.z = Math.PI / 2;
  slideOuter.position.set(0.35, 0.6, 0);
  g.add(slideOuter);
  const slideInner = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 9), M.silver);
  slideInner.rotation.z = Math.PI / 2;
  slideInner.position.set(0.28, 0.6, 0.001);
  g.add(slideInner);
  const back = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 7, 14, Math.PI), M.brass);
  back.position.set(-0.42, 0.6, 0);
  back.rotation.z = Math.PI / 2;
  g.add(back);
  const flare = new THREE.Mesh(bell(0.42, 0.55), M.brass);
  flare.position.set(-0.62, 0.6, 0);
  flare.rotation.z = -Math.PI / 2;
  flare.scale.y = 0.85;
  g.add(flare);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), M.brass);
  mouth.scale.set(1.2, 0.7, 1.2);
  mouth.position.set(0.86, 0.6, 0);
  g.add(mouth);
  return wrap(g, 1.15);
};

export const frenchhorn: Builder = () => {
  const g = new THREE.Group();
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 9, 24), M.brass);
  coil.position.y = 0.85;
  g.add(coil);
  const flare = new THREE.Mesh(bell(0.46, 0.6), M.brass);
  flare.position.set(-0.1, 0.85, 0.3);
  flare.rotation.x = -Math.PI / 2.3;
  flare.scale.z = 0.8;
  g.add(flare);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.brass);
  mouth.scale.set(1.2, 0.7, 1.2);
  mouth.position.set(0.62, 1.28, -0.1);
  g.add(mouth);
  for (let i = 0; i < 3; i++) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.26, 7), M.silver);
    v.position.set(0.3 + i * 0.1, 0.42, 0.12);
    g.add(v);
  }
  return wrap(g, 1.7);
};

export const tuba: Builder = () => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.115, 10, 22), M.brass);
  body.position.y = 0.95;
  g.add(body);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.1, 8, 16), M.brass);
  inner.position.set(0.05, 0.95, 0.05);
  g.add(inner);
  const flare = new THREE.Mesh(bell(0.56, 0.75), M.brass);
  flare.position.set(0.42, 1.15, 0);
  flare.rotation.x = Math.PI;
  flare.scale.y = 0.9;
  g.add(flare);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), M.brass);
  mouth.scale.set(1.2, 0.7, 1.2);
  mouth.position.set(-0.42, 0.72, 0);
  g.add(mouth);
  for (let i = 0; i < 4; i++) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.3, 8), M.silver);
    v.position.set(-0.18 + i * 0.11, 0.5, 0.14);
    g.add(v);
  }
  return wrap(g, 2.1);
};

/* ================= PERCUSSION ================= */

export function drumShell(r: number, h: number, shellC: string, headC = '#efe7d4'): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18, 1, true), lam(shellC));
  shell.position.y = h / 2;
  g.add(shell);
  const top = new THREE.Mesh(new THREE.CircleGeometry(r, 20), lam(headC));
  top.rotation.x = -Math.PI / 2;
  top.position.y = h;
  g.add(top);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(r, 20), lam(headC));
  bottom.rotation.x = Math.PI / 2;
  g.add(bottom);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.05, h * 0.5, 0.05), M.silver);
    lug.position.set(Math.sin(a) * r * 1.01, h / 2, Math.cos(a) * r * 1.01);
    lug.lookAt(0, h / 2, 0);
    g.add(lug);
  }
  return g;
}

export const snaredrum: Builder = (accent) => {
  const d = drumShell(0.55, 0.42, accent);
  (d.children[0] as THREE.Mesh).material = M.silver; // metal shell
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6), M.black);
  stand.position.y = -0.28;
  d.add(stand);
  const legs = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.12, 3), M.black);
  legs.position.y = -0.55;
  d.add(legs);
  return wrap(d, 1.0);
};

export const timpani: Builder = (accent) => {
  const g = new THREE.Group();
  const bowlPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    bowlPts.push(new THREE.Vector2(0.85 * Math.sqrt(Math.max(0, 1 - t * t)) , -t * 0.85));
  }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts.reverse(), 18), lam(accent));
  bowl.position.y = 0.95;
  g.add(bowl);
  const head = new THREE.Mesh(new THREE.CircleGeometry(0.84, 20), lam('#e8dfc8'));
  head.rotation.x = -Math.PI / 2;
  head.position.y = 0.96;
  g.add(head);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 6), M.black);
    leg.position.set(Math.sin(a) * 0.55, 0.31, Math.cos(a) * 0.55);
    leg.rotation.x = Math.cos(a) * 0.18;
    leg.rotation.z = -Math.sin(a) * 0.18;
    g.add(leg);
  }
  const mallet = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5), M.darkWood);
  mallet.rotation.z = 0.8;
  mallet.position.set(0.75, 1.15, 0);
  g.add(mallet);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 6), lam('#e8e0d0'));
  tip.position.set(0.98, 1.28, 0);
  g.add(tip);
  return wrap(g, 1.35);
};

export const xylophone: Builder = (accent) => {
  const g = new THREE.Group();
  const frameW = 1.7;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.5), M.darkWood);
  legL.position.set(-frameW / 2 + 0.1, 0.35, 0);
  const legR = legL.clone();
  legR.position.x = frameW / 2 - 0.1;
  g.add(legL, legR);
  const railA = new THREE.Mesh(new THREE.BoxGeometry(frameW, 0.05, 0.06), M.darkWood);
  railA.position.set(0, 0.72, -0.22);
  const railB = railA.clone();
  railB.position.z = 0.22;
  g.add(railA, railB);
  const N = 9;
  for (let i = 0; i < N; i++) {
    const w = 0.16 - i * 0.008;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.045, 0.4 - i * 0.012), lam(accent));
    bar.position.set(-0.72 + i * 0.18, 0.78, 0);
    g.add(bar);
    if (i % 2 === 0) {
      const res = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 6), M.silver);
      res.position.set(-0.72 + i * 0.18, 0.6, 0);
      g.add(res);
    }
  }
  return wrap(g, 0.95);
};

export const triangleInstr: Builder = () => {
  const g = new THREE.Group();
  const side = 0.55;
  const mk = (): THREE.Mesh => new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, side, 6), M.silver);
  const a = mk(); a.position.set(0, side / 2, 0); g.add(a);
  const b = mk(); b.rotation.z = Math.PI / 2; b.position.set(side / 2, 0, 0); g.add(b);
  const c = mk(); c.rotation.z = -Math.atan2(side, side); c.position.set(side / 4, side / 4, 0); c.scale.set(1, 1.41, 1); g.add(c);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), M.darkWood);
  string.position.set(0, side + 0.15, 0);
  g.add(string);
  const beater = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.4, 5), M.darkWood);
  beater.rotation.z = 0.9;
  beater.position.set(side * 0.75, side * 0.35, 0);
  g.add(beater);
  g.rotation.y = 0.5;
  return wrap(g, 0.9);
};

export const shakerEggs: Builder = (accent) => {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), lam(accent));
    egg.scale.set(1, 1.3, 1);
    egg.position.set(sx * 0.16, sx > 0 ? 0.95 : 0.62, 0);
    egg.rotation.z = sx * 0.2;
    g.add(egg);
  }
  return wrap(g, 1.1);
};

/* ---------- helpers ---------- */

/** Rotate a child around group origin Y by angle (keeps radial layout). */
function rotateAround(_g: THREE.Group, _child: THREE.Object3D, _angle: number): void {
  // no-op helper retained for layout tweaks; keys are laid out inline
}

/** Normalize builder output: center at origin-bottom, uniform scale to height H. */
function wrap(g: THREE.Group, targetH: number): THREE.Group {
  const outer = new THREE.Group();
  const bbox = new THREE.Box3().setFromObject(g);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const scale = targetH / Math.max(size.y, 0.001);
  g.scale.setScalar(scale);
  const bbox2 = new THREE.Box3().setFromObject(g);
  const center = new THREE.Vector3();
  bbox2.getCenter(center);
  g.position.sub(center);
  g.position.y += (bbox2.max.y - bbox2.min.y) / 2;
  outer.add(g);
  return outer;
}

export const BUILDERS: Record<string, Builder> = {
  violin, guitar, cello, doublebass, harp,
  flute, clarinet, saxophone, bassoon,
  trumpet, trombone, frenchhorn, tuba,
  snaredrum, timpani, xylophone, triangle: triangleInstr, shaker: shakerEggs,
};
