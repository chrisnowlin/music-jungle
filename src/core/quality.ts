/**
 * quality.ts — device tiers + runtime FPS probe with hysteresis (downgrade-only).
 * Safe knobs: TIERS, probe windows.
 */
import { on } from './events';

export type Tier = 'high' | 'mid' | 'low';

export interface TierConfig {
  dpr: number;
  grass: boolean;
  density: number; // multiplier on instanced counts
}

export const TIERS: Record<Tier, TierConfig> = {
  high: { dpr: Math.min(window.devicePixelRatio || 1, 1.5), grass: true, density: 1 },
  mid: { dpr: 1.25, grass: true, density: 0.7 },
  low: { dpr: 1, grass: false, density: 0.45 },
};

const ORDER: Tier[] = ['low', 'mid', 'high'];

let tier: Tier = guessTier();
export function currentTier(): Tier {
  return tier;
}
export function tierConfig(): TierConfig {
  return TIERS[tier];
}

function guessTier(): Tier {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 2 || mem <= 2) return 'low';
  if (cores <= 4) return 'mid';
  return 'high';
}

/* ---------------- runtime probe ---------------- */

let frames = 0;
let probing = false;
let probeStart = 0;
const SKIP_MS = 3000;   // discard shader-compile jank
const WINDOW_MS = 7000; // rolling sample window

export function startProbe(): void {
  if (probing) return;
  probing = true;
  frames = 0;
  probeStart = performance.now();
}

/** Call every frame while playing. Downgrades at most once per session. */
export function tickProbe(): void {
  if (!probing) return;
  const now = performance.now();
  if (now - probeStart < SKIP_MS) return;
  frames++;
  if (now - probeStart >= SKIP_MS + WINDOW_MS) {
    probing = false;
    const fps = (frames * 1000) / (now - probeStart - SKIP_MS);
    const idx = ORDER.indexOf(tier);
    if (fps < 32 && idx > 0) setTier(ORDER[idx - 1]);
    else if (fps < 45 && tier === 'high') setTier('mid');
  }
}

function setTier(next: Tier): void {
  if (next === tier) return;
  tier = next;
  // rebuild instanced foliage densities via world refresh
  window.dispatchEvent(new CustomEvent('mj-tier', { detail: tier }));
}

// world listens for tier changes
on('screen', () => undefined); // keep bus referenced
