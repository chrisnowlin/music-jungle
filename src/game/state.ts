/**
 * state.ts — central session store. One source of truth; UI subscribes via events.
 * Safe knobs: none — shape mirrors save.ts SaveData.
 */
import { emit } from '../core/events';
import { SaveManager, newSave, type Mode, type ProfileMeta, type SaveData } from '../core/save';
import { TOTAL_INSTRUMENTS } from './progression';
import { type Family } from '../content/families';
import instrumentsJson from '../content/instruments.json';

export interface InstrumentDef {
  id: string;
  family: string;
  landmark: string;
  nameEarly: string;
  nameUpper: string;
  factEarly: string;
  factUpper: string;
  accentColor: string;
  sample: string;
  melody: number[];
}

export const INSTRUMENTS: InstrumentDef[] = instrumentsJson as InstrumentDef[];
export const INSTRUMENT_BY_ID = new Map(INSTRUMENTS.map((i) => [i.id, i]));

// plan guard: roster count derives from data, never hardcoded
if (INSTRUMENTS.length !== TOTAL_INSTRUMENTS) {
  // eslint-disable-next-line no-console
  console.warn(`roster mismatch: ${INSTRUMENTS.length} in JSON vs ${TOTAL_INSTRUMENTS} expected`);
}

export type Screen = 'title' | 'profiles' | 'play' | 'dashboard';

class Store {
  readonly saves = new SaveManager();
  profiles: ProfileMeta[] = this.saves.listProfiles();
  activeId: string | null = null;
  session: SaveData | null = null;
  screen: Screen = 'title';

  selectProfile(id: string): void {
    const data = this.saves.loadProfile(id);
    if (!data) return;
    this.activeId = id;
    this.session = data;
  }

  get mode(): Mode {
    return this.session?.mode ?? 'early';
  }

  /** Names/facts respect reading mode everywhere. */
  instrumentName(id: string): string {
    const def = INSTRUMENT_BY_ID.get(id);
    if (!def) return id;
    return this.mode === 'early' ? def.nameEarly : def.nameUpper;
  }

  setScreen(s: Screen): void {
    this.screen = s;
    emit('screen', { screen: s });
  }

  persist(): void {
    if (this.activeId && this.session) this.saves.writeProfile(this.activeId, this.session);
  }

  resetSessionToFresh(name: string, avatar: number, mode: Mode): void {
    this.session = newSave(name, avatar, mode);
  }

  /* ---- mutations (each persists) ---- */

  discover(instrumentId: string): void {
    const s = this.session;
    if (!s || s.discovered.includes(instrumentId)) return;
    s.discovered.push(instrumentId);
    emit('discovered', { instrumentId });
    this.persist();
  }

  addToBackpack(instrumentId: string): boolean {
    const s = this.session;
    if (!s || s.backpack.includes(instrumentId)) return false;
    if (!s.discovered.includes(instrumentId)) return false;
    s.backpack.push(instrumentId);
    emit('backpack:added', { instrumentId });
    this.persist();
    return true;
  }

  removeFromBackpack(instrumentId: string): void {
    const s = this.session;
    if (!s) return;
    s.backpack = s.backpack.filter((b) => b !== instrumentId);
    this.persist();
  }

  sortInto(instrumentId: string, family: string): void {
    const s = this.session;
    if (!s) return;
    const list = s.sorted[family] ?? (s.sorted[family] = []);
    if (!list.includes(instrumentId)) list.push(instrumentId);
    this.removeFromBackpack(instrumentId);
    emit('sorted', { instrumentId, family: family as Family, correct: INSTRUMENT_BY_ID.get(instrumentId)?.family === family });
    this.persist();
  }
}

export const store = new Store();
