/**
 * save.ts — localStorage profiles: CRUD, versioned schema, migrations,
 * corrupt-save quarantine, JSON export/import with strict validation.
 * Safe knobs: SCHEMA_VERSION (bump + add a migration when the shape changes).
 * Keys: mj.v<version>.profiles, mj.v<version>.profile.<id>
 */

export type Mode = 'early' | 'upper';
export type Family = string;

export interface ProfileMeta {
  id: string;
  name: string;
  avatar: number; // preset avatar index
  createdAt: number;
}

export interface MinigameProgress {
  bestStars: number;
  plays: number;
  roundCheckpoint: { round: number; score: number; mistakes: number } | null;
}

export interface QuizRecord { seen: number; correct: number }

export interface SaveData {
  version: number;
  name: string;
  avatar: number;
  mode: Mode;
  createdAt: number;
  lastPlayedAt: number;
  playSeconds: number;
  settings: { narration: boolean; musicVol: number; sfxVol: number };
  discovered: string[];
  backpack: string[];
  sorted: Record<string, string[]>;
  badges: string[];
  minigames: Record<string, MinigameProgress>;
  quiz: Record<string, QuizRecord>;
  standards: Record<string, { seen: number; correct: number }>;
  pos: { x: number; z: number };
  firstSessionDone: boolean;
}

export const SCHEMA_VERSION = 1;

const PROFILES_KEY = `mj.v${SCHEMA_VERSION}.profiles`;
const PROFILE_KEY = (id: string) => `mj.v${SCHEMA_VERSION}.profile.${id}`;
const QUARANTINE_PREFIX = 'mj.quarantine.';

export function newSave(name: string, avatar: number, mode: Mode): SaveData {
  return {
    version: SCHEMA_VERSION,
    name,
    avatar,
    mode,
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
    playSeconds: 0,
    settings: { narration: true, musicVol: 0.8, sfxVol: 1 },
    discovered: [],
    backpack: [],
    sorted: {},
    badges: [],
    minigames: {},
    quiz: {},
    standards: {},
    pos: { x: 0, z: 0 },
    firstSessionDone: false,
  };
}

/* ---------------- validation ---------------- */

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Strict-ish structural check used by both boot-time reads and imports. */
export function validateSave(data: unknown): { ok: true; value: SaveData; migratedFrom?: number } | { ok: false; reason: string } {
  if (!isObj(data)) return { ok: false, reason: 'not an object' };
  const rawVersion = data['version'];
  const version: number = typeof rawVersion === 'number' ? rawVersion : 1;
  if (version < 1 || version > SCHEMA_VERSION) return { ok: false, reason: `unsupported version ${version}` };
  // future: while (version < SCHEMA_VERSION) data = migrations[version](data)
  const d = data as Record<string, unknown>;
  for (const k of ['name', 'mode', 'discovered', 'backpack', 'sorted', 'badges', 'minigames', 'quiz', 'pos']) {
    if (!(k in d)) return { ok: false, reason: `missing field ${k}` };
  }
  if (d['mode'] !== 'early' && d['mode'] !== 'upper') return { ok: false, reason: 'bad mode' };
  if (!Array.isArray(d['discovered'])) return { ok: false, reason: 'discovered not array' };
  if (!Array.isArray(d['backpack'])) return { ok: false, reason: 'backpack not array' };
  if (!isObj(d['sorted'])) return { ok: false, reason: 'sorted not object' };
  if (!Array.isArray(d['badges'])) return { ok: false, reason: 'badges not array' };
  if (!isObj(d['minigames']) || !isObj(d['quiz']) || !isObj(d['pos'])) return { ok: false, reason: 'bad nested objects' };
  const pos = d['pos'] as Record<string, unknown>;
  if (typeof pos['x'] !== 'number' || typeof pos['z'] !== 'number') return { ok: false, reason: 'bad position' };
  const save = d as unknown as SaveData;
  save.version = SCHEMA_VERSION;
  return { ok: true, value: save, migratedFrom: version !== SCHEMA_VERSION ? (version as number) : undefined };
}

/* ---------------- storage ---------------- */

function readJSON(key: string): unknown | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function writeJSON(key: string, v: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

export class SaveManager {
  listProfiles(): ProfileMeta[] {
    const raw = readJSON(PROFILES_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.filter(isObj).map((p) => ({
      id: String(p['id'] ?? ''),
      name: String(p['name'] ?? 'Explorer'),
      avatar: typeof p['avatar'] === 'number' ? p['avatar'] : 0,
      createdAt: typeof p['createdAt'] === 'number' ? p['createdAt'] : 0,
    })).filter((p) => p.id);
  }

  private writeProfiles(list: ProfileMeta[]): void {
    writeJSON(PROFILES_KEY, list);
  }

  createProfile(name: string, avatar: number, mode: Mode): ProfileMeta {
    const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    const meta: ProfileMeta = { id, name, avatar, createdAt: Date.now() };
    const list = this.listProfiles();
    list.push(meta);
    this.writeProfiles(list);
    this.writeProfile(id, newSave(name, avatar, mode));
    void navigator.storage?.persist?.().catch(() => undefined);
    return meta;
  }

  loadProfile(id: string): SaveData | null {
    const raw = readJSON(PROFILE_KEY(id));
    if (raw === undefined) return null;
    const res = validateSave(raw);
    if (!res.ok) {
      // quarantine corrupt data; caller decides whether to recreate
      try { localStorage.setItem(`${QUARANTINE_PREFIX}${id}.${Date.now()}`, JSON.stringify(raw)); } catch { /* full */ }
      return null;
    }
    return res.value;
  }

  writeProfile(id: string, data: SaveData): boolean {
    data.lastPlayedAt = Date.now();
    return writeJSON(PROFILE_KEY(id), data);
  }

  renameProfile(id: string, name: string): void {
    const list = this.listProfiles();
    const p = list.find((x) => x.id === id);
    if (p) {
      p.name = name;
      this.writeProfiles(list);
    }
    const data = this.loadProfile(id);
    if (data) {
      data.name = name;
      this.writeProfile(id, data);
    }
  }

  deleteProfile(id: string): void {
    this.writeProfiles(this.listProfiles().filter((p) => p.id !== id));
    try { localStorage.removeItem(PROFILE_KEY(id)); } catch { /* noop */ }
  }

  /** Reset progress but keep identity/mode/settings. */
  resetProfile(id: string): void {
    const cur = this.loadProfile(id);
    if (!cur) return;
    this.writeProfile(id, newSave(cur.name, cur.avatar, cur.mode));
  }

  /* ---------- portability: export / import ---------- */

  exportProfile(id: string): string | null {
    const data = this.loadProfile(id);
    if (!data) return null;
    return JSON.stringify(data, null, 1);
  }

  /**
   * Import a previously exported save. Never destroys existing profiles on
   * failure. If an existing profile has the same id it is REPLACED (restore
   * path), otherwise a new profile entry is created.
   */
  importProfile(jsonText: string): { ok: true; id: string } | { ok: false; reason: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText) as unknown;
    } catch {
      return { ok: false, reason: 'Not valid JSON' };
    }
    const res = validateSave(parsed);
    if (!res.ok) return { ok: false, reason: res.reason };
    const data = res.value;
    let id = '';
    // exported saves don't carry their key id; match by name+createdAt else mint new
    const list = this.listProfiles();
    const match = list.find((p) => p.name === data.name && p.createdAt === data.createdAt);
    if (match) id = match.id;
    else {
      id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
      list.push({ id, name: data.name, avatar: data.avatar, createdAt: data.createdAt });
      this.writeProfiles(list);
    }
    const written = this.writeProfile(id, data);
    if (!written) return { ok: false, reason: 'Storage refused the write (device full?)' };
    return { ok: true, id };
  }
}
