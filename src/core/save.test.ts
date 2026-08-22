import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager, newSave, validateSave, SCHEMA_VERSION, type SaveData } from './save';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null { return this.m.get(k) ?? null; }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
}

function installStorage(): void {
  const s = new MemStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true, writable: true });
}

beforeEach(installStorage);

describe('SaveManager profiles', () => {
  it('creates, lists and loads profiles', () => {
    const sm = new SaveManager();
    const p = sm.createProfile('Maya', 2, 'early');
    expect(sm.listProfiles()).toHaveLength(1);
    const data = sm.loadProfile(p.id);
    expect(data?.name).toBe('Maya');
    expect(data?.mode).toBe('early');
    expect(data?.version).toBe(SCHEMA_VERSION);
  });

  it('roundtrips a mutated save', () => {
    const sm = new SaveManager();
    const p = sm.createProfile('Ben', 0, 'upper');
    const data = sm.loadProfile(p.id)!;
    data.discovered.push('violin', 'harp');
    data.sorted['strings'] = ['violin'];
    data.quiz['q1'] = { seen: 2, correct: 1 };
    sm.writeProfile(p.id, data);
    const again = sm.loadProfile(p.id)!;
    expect(again.discovered).toEqual(['violin', 'harp']);
    expect(again.sorted['strings']).toEqual(['violin']);
    expect(again.quiz['q1']).toEqual({ seen: 2, correct: 1 });
  });

  it('renames in both index and save', () => {
    const sm = new SaveManager();
    const p = sm.createProfile('Old', 0, 'early');
    sm.renameProfile(p.id, 'New');
    expect(sm.listProfiles()[0].name).toBe('New');
    expect(sm.loadProfile(p.id)?.name).toBe('New');
  });

  it('deletes profile and save', () => {
    const sm = new SaveManager();
    const p = sm.createProfile('Gone', 0, 'early');
    sm.deleteProfile(p.id);
    expect(sm.listProfiles()).toHaveLength(0);
    expect(sm.loadProfile(p.id)).toBeNull();
  });

  it('resets progress but keeps identity', () => {
    const sm = new SaveManager();
    const p = sm.createProfile('Keeper', 3, 'upper');
    const d = sm.loadProfile(p.id)!;
    d.discovered.push('harp');
    sm.writeProfile(p.id, d);
    sm.resetProfile(p.id);
    const after = sm.loadProfile(p.id)!;
    expect(after.discovered).toEqual([]);
    expect(after.name).toBe('Keeper');
    expect(after.mode).toBe('upper');
  });
});

describe('corruption handling', () => {
  it('quarantines corrupt JSON and returns null instead of throwing', () => {
    const sm = new SaveManager();
    const p = sm.createProfile('Corrupt', 0, 'early');
    localStorage.setItem(`mj.v${SCHEMA_VERSION}.profile.${p.id}`, '{not json!!');
    expect(sm.loadProfile(p.id)).toBeNull();
  });

  it('rejects structurally invalid saves', () => {
    expect(validateSave({ nope: true }).ok).toBe(false);
    expect(validateSave(null).ok).toBe(false);
    const good = newSave('A', 0, 'early');
    expect(validateSave(good).ok).toBe(true);
    const bad = { ...good, mode: 'wizard' } as unknown;
    expect(validateSave(bad).ok).toBe(false);
    const badPos = { ...good, pos: { x: 'x', z: 0 } } as unknown;
    expect(validateSave(badPos).ok).toBe(false);
  });
});

describe('import/export portability', () => {
  it('exports then imports into a fresh storage (device move)', () => {
    const sm1 = new SaveManager();
    const p = sm1.createProfile('Roamer', 1, 'early');
    const d = sm1.loadProfile(p.id)!;
    d.discovered = ['harp'];
    sm1.writeProfile(p.id, d);
    const exported = sm1.exportProfile(p.id)!;

    installStorage(); // simulate new device
    const sm2 = new SaveManager();
    const res = sm2.importProfile(exported);
    expect(res.ok).toBe(true);
    const restored = sm2.loadProfile((res as { ok: true; id: string }).id)!;
    expect(restored.name).toBe('Roamer');
    expect(restored.discovered).toEqual(['harp']);
    expect(sm2.listProfiles()).toHaveLength(1);
  });

  it('replaces an existing matching profile on re-import (idempotent restore)', () => {
    const sm = new SaveManager();
    const p = sm.createProfile('Twin', 0, 'early');
    const exported = sm.exportProfile(p.id)!;
    const d = sm.loadProfile(p.id)!;
    d.discovered = ['violin'];
    sm.writeProfile(p.id, d);
    const res = sm.importProfile(exported);
    expect(res.ok).toBe(true);
    expect(sm.listProfiles()).toHaveLength(1); // no duplicate
    expect(sm.loadProfile(p.id)!.discovered).toEqual([]);
  });

  it('rejects malformed payloads without touching existing profiles', () => {
    const sm = new SaveManager();
    const p = sm.createProfile('Safe', 0, 'early');
    const before = sm.listProfiles().length;
    for (const bad of ['{', 'null', '[]', JSON.stringify({ version: 99 }), JSON.stringify({ version: 1 })]) {
      const res = sm.importProfile(bad);
      expect(res.ok).toBe(false);
    }
    expect(sm.listProfiles()).toHaveLength(before);
    expect(sm.loadProfile(p.id)).not.toBeNull();
  });
});

describe('validateSave edge cases', () => {
  it('accepts a minimal older-version save (migration path stub)', () => {
    const old = { ...newSave('X', 0, 'early'), version: 1 } as SaveData;
    const res = validateSave(old);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.version).toBe(SCHEMA_VERSION);
  });
});
