/**
 * player.ts — third-person explorer: primitive-built character with walk bob,
 * camera-relative movement, terrain following, collider pushout, and
 * early-mode tap-to-auto-walk (straight line + slide + stuck timeout).
 * Safe knobs: SPEED, AUTOWALK consts.
 */
import * as THREE from 'three';
import { getHeight } from '../world/terrain';
import type { ColliderSet } from '../world/colliders';

const SPEED = 6.2;
const PLAYER_R = 0.55;
const STUCK_MS = 1500;
const STUCK_DIST = 0.25;

export class Player {
  group = new THREE.Group();
  private yaw = 0;
  private bobT = 0;
  private bodyPivot = new THREE.Group();
  autowalkTarget: { x: number; z: number } | null = null;
  private stuckTimer = 0;
  private lastPos = new THREE.Vector2(0, 0);
  onStuck?: () => void;

  constructor() {
    this.group.name = 'player';
    const skin = new THREE.MeshLambertMaterial({ color: '#e8b98c' });
    const shirt = new THREE.MeshLambertMaterial({ color: '#4f8f3b' });
    const pants = new THREE.MeshLambertMaterial({ color: '#7a5230' });
    const hat = new THREE.MeshLambertMaterial({ color: '#c9a15a' });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.85, 8), shirt);
    body.position.y = 0.75;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
    head.position.y = 1.45;
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 10), hat);
    hatBrim.position.y = 1.66;
    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.26, 8), hat);
    hatTop.position.y = 1.8;
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 6), pants);
    legL.position.set(-0.16, 0.25, 0);
    const legR = legL.clone();
    legR.position.x = 0.16;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.24), new THREE.MeshLambertMaterial({ color: '#b0592e' }));
    pack.position.set(0, 0.95, -0.34);
    this.bodyPivot.add(body, head, hatBrim, hatTop, legL, legR, pack);
    this.group.add(this.bodyPivot);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  teleport(x: number, z: number): void {
    this.group.position.set(x, getHeight(x, z), z);
    this.autowalkTarget = null;
  }

  cancelAutowalk(): void {
    if (this.autowalkTarget) {
      this.autowalkTarget = null;
      this.onStuck?.();
    }
  }

  /**
   * @param move input in camera space (x strafe, y forward)
   * @param camYaw current camera orbit yaw
   */
  update(dt: number, move: { x: number; y: number }, camYaw: number, colliders: ColliderSet): void {
    let mx = move.x;
    let mz = move.y;

    // auto-walk overrides manual input toward the target
    if (this.autowalkTarget) {
      const dx = this.autowalkTarget.x - this.group.position.x;
      const dz = this.autowalkTarget.z - this.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) {
        this.autowalkTarget = null;
        this.stuckTimer = 0;
      } else {
        mx = 0;
        mz = 1;
        this.yaw = Math.atan2(dx, dz); // face target directly
        // stuck detection
        const moved = this.lastPos.distanceTo(new THREE.Vector2(this.group.position.x, this.group.position.z));
        if (moved < STUCK_DIST * dt * 60 / 60) this.stuckTimer += dt * 1000; else this.stuckTimer = Math.max(0, this.stuckTimer - dt * 400);
        this.lastPos.set(this.group.position.x, this.group.position.z);
        if (this.stuckTimer > STUCK_MS) {
          this.autowalkTarget = null;
          this.stuckTimer = 0;
          this.onStuck?.();
        }
        void d;
      }
    } else {
      this.stuckTimer = 0;
    }

    const len = Math.hypot(mx, mz);
    const moving = len > 0.01;
    if (moving && !this.autowalkTarget) {
      mx /= len;
      mz /= len;
      // rotate by camera yaw
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const wx = mx * cos + mz * sin;
      const wz = -mx * sin + mz * cos;
      let nx = this.group.position.x + wx * SPEED * dt;
      let nz = this.group.position.z + wz * SPEED * dt;
      ({ x: nx, z: nz } = colliders.resolve(nx, nz, PLAYER_R));
      // slope limit — block climbing cliffs steeper than ~1.1
      const hHere = getHeight(nx, nz);
      const dh = hHere - getHeight(this.group.position.x, this.group.position.z);
      if (dh < Math.max(0.35, SPEED * dt * 1.35)) {
        this.group.position.x = nx;
        this.group.position.z = nz;
      }
      // face movement direction smoothly
      const targetYaw = Math.atan2(wx, wz);
      let dy = targetYaw - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * 12);
    }

    this.group.rotation.y = this.yaw;
    // stick to terrain + walk bob
    this.bobT += dt * (moving ? 11 : 3);
    const gy = getHeight(this.group.position.x, this.group.position.z);
    this.group.position.y = gy + (moving ? Math.abs(Math.sin(this.bobT)) * 0.09 : 0);
    this.bodyPivot.rotation.x = moving ? Math.sin(this.bobT) * 0.05 : 0;
  }
}
