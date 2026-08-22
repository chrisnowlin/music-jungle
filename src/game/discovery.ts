/**
 * discovery.ts — proximity registry: nearest interactable in range drives the
 * HUD prompt; interact key/button triggers its callback.
 * Safe knobs: default radius.
 */
import * as THREE from 'three';

export interface Interactable {
  id: string;
  pos: THREE.Vector3;
  radius: number;
  prompt: () => string;
  onInteract: () => void;
  enabled?: () => boolean;
}

export class Discovery {
  private items = new Map<string, Interactable>();
  current: Interactable | null = null;

  register(item: Interactable): void {
    this.items.set(item.id, item);
  }

  unregister(id: string): void {
    this.items.delete(id);
    if (this.current?.id === id) this.current = null;
  }

  /** Returns the nearest enabled interactable within range. */
  update(playerPos: THREE.Vector3): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.items.values()) {
      if (it.enabled && !it.enabled()) continue;
      const d = Math.hypot(it.pos.x - playerPos.x, it.pos.z - playerPos.z);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    this.current = best;
    return best;
  }

  triggerCurrent(): void {
    this.current?.onInteract();
  }
}
