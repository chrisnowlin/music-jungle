/**
 * cameraRig.ts — damped third-person boom camera. Orbit via input camDelta.
 * Safe knobs: DIST, pitch clamps.
 */
import * as THREE from 'three';
import { getHeight } from '../world/terrain';

const DIST = 8;
const PITCH_MIN = -0.12;
const PITCH_MAX = 1.05;

export class CameraRig {
  yaw = Math.PI;      // behind player looking forward
  pitch = 0.42;
  private curYaw = Math.PI;
  private curPitch = 0.42;
  private look = new THREE.Vector3();

  update(dt: number, playerPos: THREE.Vector3, camDeltaX: number, camera: THREE.PerspectiveCamera): void {
    this.yaw += camDeltaX;
    this.pitch = THREE.MathUtils.clamp(this.pitch, PITCH_MIN, PITCH_MAX);
    const k = Math.min(1, dt * 10);
    this.curYaw += (this.yaw - this.curYaw) * k;
    this.curPitch += (this.pitch - this.curPitch) * k;

    const target = this.look.set(playerPos.x, playerPos.y + 1.7, playerPos.z);
    const cp = Math.cos(this.curPitch);
    let cx = target.x + Math.sin(this.curYaw) * DIST * cp;
    let cz = target.z + Math.cos(this.curYaw) * DIST * cp;
    let cy = target.y + Math.sin(this.curPitch) * DIST;
    // keep camera above terrain
    const groundY = getHeight(cx, cz) + 0.9;
    if (cy < groundY) cy = groundY;
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 14));
    camera.lookAt(target);
  }
}
