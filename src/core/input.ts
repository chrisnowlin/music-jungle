/**
 * input.ts — keyboard + pointer input for desktop AND touch play.
 *
 * Roles are resolved from where the pointer lands:
 *   • mouse drag (anywhere on the play surface)  → camera orbit
 *   • touch drag on the RIGHT side               → camera orbit
 *   • touch drag on the LEFT side                → movement stick (joystick.ts)
 * Keys: WASD / arrows move · Q/E orbit · Space, F or Enter interact.
 * Safe knobs: YAW_SENS, PITCH_SENS, KEY_ORBIT_SPEED, MOVE_ZONE_FRAC.
 */
import type { ColliderSet } from '../world/colliders';

export interface InputState {
  move: { x: number; y: number };       // -1..1 (y = forward)
  camDelta: { x: number; y: number };   // radians to apply this frame
  interact: boolean;                    // edge-triggered
}

const YAW_SENS = 0.0052;
const PITCH_SENS = 0.0034;
const KEY_ORBIT_SPEED = 2.4; // rad/s while held
const MOVE_ZONE_FRAC = 0.45;

const keys = new Set<string>();
let interactQueued = false;

/* --- pointer-orbit state --- */
let orbitId: number | null = null;
let lastX = 0;
let lastY = 0;
let pendYaw = 0;
let pendPitch = 0;

function isPlaySurface(t: EventTarget | null): boolean {
  const n = t as HTMLElement | null;
  if (!n) return false;
  return n === window.__mjPlaySurfaces?.canvas || n === window.__mjPlaySurfaces?.touchLayer;
}

export function setPlaySurfaces(canvas: HTMLElement, touchLayer: HTMLElement): void {
  window.__mjPlaySurfaces = { canvas, touchLayer };
}

declare global {
  interface Window {
    __mjPlaySurfaces?: { canvas: HTMLElement; touchLayer: HTMLElement };
  }
}

export function initInput(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'f' || k === 'enter') {
      interactQueued = true;
      if (k === ' ') e.preventDefault();
    }
    keys.add(k);
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());

  const onPointerDown = (e: PointerEvent) => {
    if (orbitId !== null || !isPlaySurface(e.target)) return;
    // touch left zone belongs to the joystick
    if (e.pointerType !== 'mouse' && e.clientX < window.innerWidth * MOVE_ZONE_FRAC) return;
    orbitId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== orbitId) return;
    pendYaw += (e.clientX - lastX) * YAW_SENS;
    pendPitch += (e.clientY - lastY) * PITCH_SENS;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === orbitId) orbitId = null;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };
}

/** Poll once per frame. dt keeps keyboard orbit frame-rate independent. */
export function sampleInput(dt: number): InputState {
  let x = 0;
  let y = 0;
  if (keys.has('w') || keys.has('arrowup')) y += 1;
  if (keys.has('s') || keys.has('arrowdown')) y -= 1;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;

  let ky = 0;
  if (keys.has('q')) ky -= KEY_ORBIT_SPEED * dt;
  if (keys.has('e')) ky += KEY_ORBIT_SPEED * dt;

  const camDelta = { x: pendYaw + ky, y: pendPitch };
  pendYaw = 0;
  pendPitch = 0;

  const interact = interactQueued;
  interactQueued = false;
  return { move: { x, y }, camDelta, interact };
}
