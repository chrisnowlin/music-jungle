/**
 * colliders.ts — circle-vs-circle pushout on the heightfield. No physics engine.
 * Safe knobs: none.
 */
export interface Collider { x: number; z: number; r: number }

export class ColliderSet {
  private items: Collider[] = [];

  set(items: Collider[]): void {
    this.items = items;
  }

  add(c: Collider): void {
    this.items.push(c);
  }

  /** Resolve player position against all colliders (player radius ~0.55). */
  resolve(x: number, z: number, pr = 0.55): { x: number; z: number } {
    for (const c of this.items) {
      const dx = x - c.x;
      const dz = z - c.z;
      const minD = c.r + pr;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (minD - d) / d;
        x += dx * push;
        z += dz * push;
      }
    }
    // map bounds
    const lim = 116;
    return { x: Math.max(-lim, Math.min(lim, x)), z: Math.max(-lim, Math.min(lim, z)) };
  }
}
