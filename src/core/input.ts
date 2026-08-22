/**
 * input.ts — keyboard + mouse input for desktop play.
 * Touch movement lives in joystick.ts; camera orbit is shared here.
 * Safe knobs: MOVE_SPEED handled by player.ts.
 */

export interface InputState {
  move: { x: number; y: number };   // -1..1 (y = forward)
  camDelta: { x: number };          // orbit velocity
  interact: boolean;                // edge-triggered
}

const keys = new Set<string>();
let interactQueued = false;
let dragging = false;
let lastPointerX = 0;
let camVel = 0;

export function initInput(canvas: HTMLElement): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'e') {
      interactQueued = true;
      e.preventDefault();
    }
    keys.add(k);
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
  const onPointerDown = (e: PointerEvent) => {
    // right half of screen orbits on touch; any drag orbits with mouse
    if (e.pointerType !== 'mouse' && e.clientX < window.innerWidth * 0.45) return;
    dragging = true;
    lastPointerX = e.clientX;
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    camVel += (e.clientX - lastPointerX) * 0.0045;
    lastPointerX = e.clientX;
  };
  const onPointerUp = () => { dragging = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };
}

/** Poll once per frame. */
export function sampleInput(): InputState {
  let x = 0;
  let y = 0;
  if (keys.has('w') || keys.has('arrowup')) y += 1;
  if (keys.has('s') || keys.has('arrowdown')) y -= 1;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('q')) camVel += -0.03;
  if (keys.has('e2')) camVel += 0.03; // reserved
  const interact = interactQueued;
  interactQueued = false;
  const out: InputState = { move: { x, y }, camDelta: { x: camVel }, interact };
  camVel *= 0.55;
  return out;
}
