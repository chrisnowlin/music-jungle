/**
 * sky.ts — gradient sky dome, fog, lights. One hemisphere + one directional.
 * Safe knobs: colors, sun position.
 */
import * as THREE from 'three';

export interface SkyResult {
  mesh: THREE.Mesh;
  lights: THREE.Object3D;
  update(t: number): void;
}

export function buildSky(scene: THREE.Scene): SkyResult {
  const geo = new THREE.SphereGeometry(82, 24, 12);
  const colors: number[] = [];
  const top = new THREE.Color('#3fa9f5');
  const mid = new THREE.Color('#bfe3ff');
  const bot = new THREE.Color('#eaf6df');
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 82; // -1..1
    const c = y > 0
      ? new THREE.Color().lerpColors(mid, top, Math.pow(y, 0.75))
      : new THREE.Color().lerpColors(bot, mid, Math.max(0, 1 + y * 2));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  scene.add(mesh);

  scene.fog = new THREE.FogExp2('#cfe8c0', 0.011);

  const hemi = new THREE.HemisphereLight('#dff3ff', '#5a7d4a', 0.95);
  const sun = new THREE.DirectionalLight('#fff3d6', 1.35);
  sun.position.set(-60, 90, -40);
  const lights = new THREE.Group();
  lights.add(hemi, sun);
  scene.add(lights);

  return {
    mesh,
    lights,
    update(_t) { /* static lighting — cheap on Chromebooks */ },
  };
}
