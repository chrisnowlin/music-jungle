/**
 * progression.ts — gates and badge math. All family counts derive from content.
 * Safe knobs: MINIGAME_UNLOCK_COUNT, STAR thresholds.
 */
import { FAMILIES, type Family } from '../content/families';

export const MINIGAME_UNLOCK_COUNT = 3;
export const TOTAL_INSTRUMENTS = 18; // cross-checked against instruments.json at boot

export interface ProgressSnapshot {
  discovered: string[];
  backpack: string[];
  sorted: Record<string, string[]>;
  badges: string[];
  minigames: Record<string, { bestStars: number }>;
}

export function sortedCount(snap: ProgressSnapshot, family: Family): number {
  return snap.sorted[family]?.length ?? 0;
}

export function totalSorted(snap: ProgressSnapshot): number {
  return FAMILIES.reduce((n, f) => n + sortedCount(snap, f), 0);
}

/** A camp mini-game unlocks once the student sorted >= N of that family. */
export function minigameUnlocked(snap: ProgressSnapshot, family: Family): boolean {
  return sortedCount(snap, family) >= MINIGAME_UNLOCK_COUNT;
}

export function badgeEarned(snap: ProgressSnapshot, family: Family): boolean {
  return snap.badges.includes(family);
}

/** Badge is earned by finishing the mini-game with at least one star. */
export function badgeForStars(family: Family, stars: number, snap: ProgressSnapshot): Family[] {
  if (stars < 1 || snap.badges.includes(family)) return [];
  return [family];
}

export function finaleUnlocked(snap: ProgressSnapshot): boolean {
  return FAMILIES.every((f) => snap.badges.includes(f));
}

export function totalStars(snap: ProgressSnapshot): number {
  return FAMILIES.reduce((n, f) => n + (snap.minigames[f]?.bestStars ?? 0), 0);
}
