/**
 * dashboard.ts — teacher dashboard: per-profile stats, rename/mode/delete/reset,
 * JSON export/import (per profile), stats CSV export, printable summary.
 * Entry is press-and-hold from title (kid-proofing, not security).
 * Safe knobs: none.
 */
import { el, div, button, clear, download, confirmButton } from '../../core/dom';
import { store } from '../../game/state';
import { FAMILIES } from '../../content/families';
import { totalSorted, totalStars, finaleUnlocked } from '../../game/progression';
import type { Mode, SaveData, QuizRecord } from '../../core/save';

function escapeHtml(v: string): string {
  return v.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] ?? c));
}

export function mountDashboard(root: HTMLElement, onBack: () => void): HTMLElement {
  const s = div('screen hidden');
  s.id = 'dashboard-screen';

  function render(): void {
    clear(s);
    const card = div('dash-card');
    const head = div('dash-head',
      el('h2', {}, '🍎 Teacher Dashboard'),
      el('span', { class: 'storage-note' }, storageLine()),
      button('btn ghost', '← Back to title', onBack),
    );
    card.append(head);

    const table = el('table', { class: 'dash-table' }) as HTMLTableElement;
    table.innerHTML = `
      <thead><tr>
        <th>Explorer</th><th>Level</th><th>Found</th><th>Sorted</th><th>Badges</th>
        <th>★</th><th>Quiz</th><th>Minutes</th><th>Last played</th><th>Actions</th>
      </tr></thead>`;
    const tbody = el('tbody') as HTMLTableSectionElement;
    for (const p of store.profiles) {
      const d = store.saves.loadProfile(p.id);
      if (!d) continue;
      tbody.append(row(p.id, d));
    }
    table.append(tbody);
    card.append(table);

    card.append(div('dash-actions',
      button('btn ghost', '⬇ Export all stats (CSV)', exportCsv),
      button('btn ghost', '⬆ Import a saved explorer', () => importFile()),
      button('btn ghost', '🖨 Print summary', () => window.print()),
    ));
    s.append(card);
  }

  function row(id: string, d: SaveData): HTMLTableRowElement {
    const tr = el('tr') as HTMLTableRowElement;
    const acc = quizAccuracy(d);
    const mins = Math.round(d.playSeconds / 60);
    const last = new Date(d.lastPlayedAt).toLocaleString();
    const actions = div('dash-actions');
    const renameBtn = button('btn ghost', '✏️', () => {
      const name = window.prompt('New name:', d.name);
      if (name) {
        store.saves.renameProfile(id, name.slice(0, 18));
        store.profiles = store.saves.listProfiles();
        render();
      }
    });
    const modeBtn = button('btn ghost', d.mode === 'early' ? '🌱→🧭' : '🧭→🌱', () => {
      const next: Mode = d.mode === 'early' ? 'upper' : 'early';
      d.mode = next;
      store.saves.writeProfile(id, d);
      render();
    });
    const resetBtn = confirmButton('btn ghost', '↺ Reset', 'Sure?', () => {
      store.saves.resetProfile(id);
      render();
    });
    const delBtn = confirmButton('btn danger', '🗑 Delete', 'Really delete?', () => {
      store.saves.deleteProfile(id);
      store.profiles = store.saves.listProfiles();
      render();
    });
    const exportBtn = button('btn ghost', '⬇ Save file', () => {
      const json = store.saves.exportProfile(id);
      if (json) download(`${d.name.replace(/\W+/g, '_')}.musicjungle.json`, json);
    });
    actions.append(renameBtn, modeBtn, resetBtn, delBtn, exportBtn);
    tr.innerHTML = `
      <td><strong>${escapeHtml(d.name)}</strong></td>
      <td>${d.mode === 'early' ? '🌱 K–2' : '🧭 3–5'}</td>
      <td>${d.discovered.length}/18</td>
      <td>${totalSorted({ discovered: d.discovered, backpack: d.backpack, sorted: d.sorted, badges: d.badges, minigames: d.minigames })}</td>
      <td>${d.badges.length ? d.badges.map(badgeEmoji).join(' ') : '—'}</td>
      <td>${totalStars({ minigames: d.minigames, badges: [], sorted: {}, discovered: [], backpack: [] })}</td>
      <td>${acc}</td>
      <td>${mins}</td>
      <td>${last}</td>`;
    const tdActions = el('td') as HTMLTableCellElement;
    tdActions.append(actions);
    tr.append(tdActions);
    return tr;
  }

  function badgeEmoji(f: string): string {
    return { strings: '🐒', woodwinds: '🦜', brass: '🦁', percussion: '🐘' }[f] ?? '⭐';
  }

  function quizAccuracy(d: SaveData): string {
    let seen = 0;
    let correct = 0;
    for (const r of Object.values(d.quiz) as QuizRecord[]) {
      seen += r.seen;
      correct += r.correct;
    }
    return seen === 0 ? '—' : `${Math.round((correct / seen) * 100)}% (${correct}/${seen})`;
  }

  function storageLine(): string {
    let line = '';
    if (navigator.storage?.persisted) {
      void navigator.storage.persisted().then((p) => {
        line = p ? '✅ Storage protected' : '⚠️ Storage can be cleared by the browser — use Save files for backup';
      });
    }
    if (navigator.storage?.estimate) {
      void navigator.storage.estimate().then((e) => {
        const mb = ((e.usage ?? 0) / 1048576).toFixed(1);
        line += ` · ${mb} MB used`;
      });
    }
    return line;
  }

  function importFile(): void {
    const input = el('input', { type: 'file', accept: '.json,application/json' }) as HTMLInputElement;
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      const text = await f.text();
      const res = store.saves.importProfile(text);
      store.profiles = store.saves.listProfiles();
      window.alert(res.ok ? `Imported! Welcome back, explorer.` : `Import failed: ${res.reason}`);
      render();
    });
    input.click();
  }

  function exportCsv(): void {
    const header = ['name', 'mode', 'found', 'sortedTotal', 'badges', 'stars', 'quizSeen', 'quizCorrect', 'minutes', 'lastPlayed', 'standards'];
    const lines = [header.join(',')];
    for (const p of store.profiles) {
      const d = store.saves.loadProfile(p.id);
      if (!d) continue;
      let qs = 0;
      let qc = 0;
      for (const r of Object.values(d.quiz) as QuizRecord[]) {
        qs += r.seen;
        qc += r.correct;
      }
      const standards = (Object.entries(d.standards) as [string, { seen: number; correct: number }][]).map(([k, v]) => `${k}:${v.correct}/${v.seen}`).join('; ');
      lines.push([
        csvEscape(d.name), d.mode, d.discovered.length, totalSorted({ discovered: d.discovered, backpack: d.backpack, sorted: d.sorted, badges: d.badges, minigames: d.minigames }),
        d.badges.join(';'), totalStars({ minigames: d.minigames, badges: [], sorted: {}, discovered: [], backpack: [] }),
        qs, qc, Math.round(d.playSeconds / 60), new Date(d.lastPlayedAt).toISOString(), `"${standards}"`,
      ].join(','));
    }
    download('music-jungle-stats.csv', lines.join('\n'), 'text/csv');
  }

  function csvEscape(v: string): string {
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  render();
  root.append(s);
  return s;
}

// keep imports referenced for dashboard summary completeness
void FAMILIES;
void finaleUnlocked;
