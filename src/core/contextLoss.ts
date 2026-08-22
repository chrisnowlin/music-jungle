/**
 * contextLoss.ts — WebGL context loss recovery.
 * Safe knobs: overlay copy.
 */
export function initContextLoss(canvas: HTMLElement, onLost: () => void, onRestored: () => void): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'ctx-overlay hidden';
  overlay.innerHTML = `
    <div class="ctx-card">
      <div style="font-size:56px">🌴</div>
      <h2>Wake the jungle!</h2>
      <p>The screen took a nap. Tap anywhere to keep exploring.</p>
    </div>`;
  document.body.append(overlay);

  let paused = false;
  const lost = (e: Event) => {
    e.preventDefault(); // required to allow restore
    paused = true;
    overlay.classList.remove('hidden');
    onLost();
  };
  const restored = () => {
    paused = false;
    overlay.classList.add('hidden');
    onRestored();
  };
  canvas.addEventListener('webglcontextlost', lost, false);
  canvas.addEventListener('webglcontextrestored', restored, false);
  overlay.addEventListener('pointerdown', () => overlay.classList.add('hidden'));

  return () => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
    overlay.remove();
  };
}

export function isContextPaused(): boolean {
  return document.querySelector('.ctx-overlay:not(.hidden)') != null;
}
