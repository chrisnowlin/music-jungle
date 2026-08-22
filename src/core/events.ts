/**
 * events.ts — typed publish/subscribe bus.
 * Safe knobs: add new event names to the EventMap union as features need them.
 */
import type { Family } from '../content/families';

export interface EventMap {
  'screen': { screen: string };
  'discovered': { instrumentId: string };
  'backpack:added': { instrumentId: string };
  'sorted': { instrumentId: string; family: Family; correct: boolean };
  'badge': { family: Family };
  'quiz:done': { correct: number; total: number; context: string };
  'minigame:done': { family: Family; stars: number };
  'finale:done': Record<string, never>;
}

type Handler<T> = (payload: T) => void;

const handlers = new Map<keyof EventMap, Set<Handler<never>>>();

export function on<K extends keyof EventMap>(key: K, fn: Handler<EventMap[K]>): () => void {
  let set = handlers.get(key);
  if (!set) {
    set = new Set();
    handlers.set(key, set);
  }
  set.add(fn as Handler<never>);
  return () => set.delete(fn as Handler<never>);
}

export function emit<K extends keyof EventMap>(key: K, payload: EventMap[K]): void {
  const set = handlers.get(key);
  if (!set) return;
  for (const h of [...set]) (h as Handler<EventMap[K]>)(payload);
}
