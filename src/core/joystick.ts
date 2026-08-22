/**
 * joystick.ts — left-half floating virtual stick for touch movement.
 * Safe knobs: RADIUS (px), DEADZONE.
 */
export interface JoystickState { x: number; y: number; active: boolean }

const RADIUS = 64;
const DEADZONE = 0.12;

let stickX = 0;
let stickY = 0;
let activeId: number | null = null;
let originX = 0;
let originY = 0;
let ringEl: HTMLDivElement | null = null;
let knobEl: HTMLDivElement | null = null;

export function initJoystick(layer: HTMLElement): () => void {
  ringEl = document.createElement('div');
  ringEl.className = 'joy-ring hidden';
  knobEl = document.createElement('div');
  knobEl.className = 'joy-knob';
  ringEl.append(knobEl);
  layer.append(ringEl);

  const isMoveZone = (e: PointerEvent) =>
    e.pointerType !== 'mouse' && e.clientX < window.innerWidth * 0.45 && e.target === layer;

  const down = (e: PointerEvent) => {
    if (!isMoveZone(e) || activeId !== null) return;
    activeId = e.pointerId;
    originX = e.clientX;
    originY = e.clientY;
    ringEl!.style.left = `${originX - RADIUS}px`;
    ringEl!.style.top = `${originY - RADIUS}px`;
    ringEl!.classList.remove('hidden');
    update(e.clientX, e.clientY);
    try { layer.setPointerCapture?.(e.pointerId); } catch { /* synthetic/inactive pointer */ }
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    update(e.clientX, e.clientY);
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    stickX = 0;
    stickY = 0;
    ringEl!.classList.add('hidden');
  };
  const update = (cx: number, cy: number) => {
    let dx = cx - originX;
    let dy = cy - originY;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    knobEl!.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / RADIUS;
    const ny = dy / RADIUS;
    stickX = Math.abs(nx) > DEADZONE ? nx : 0;
    stickY = Math.abs(ny) > DEADZONE ? ny : 0;
  };

  layer.addEventListener('pointerdown', down);
  layer.addEventListener('pointermove', move);
  layer.addEventListener('pointerup', up);
  layer.addEventListener('pointercancel', up);
  return () => {
    layer.removeEventListener('pointerdown', down);
    layer.removeEventListener('pointermove', move);
    layer.removeEventListener('pointerup', up);
    layer.removeEventListener('pointercancel', up);
  };
}

/** Poll once per frame. y > 0 means forward. */
export function sampleJoystick(): JoystickState {
  return { x: stickX, y: -stickY, active: activeId !== null };
}
