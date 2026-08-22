# 🌴 Music Jungle

A free 3D browser game that teaches elementary students (K–5) the four instrument
families — **strings, woodwinds, brass, percussion** — through jungle exploration.
Built with three.js; runs on Chromebooks and iPads; works offline after the first visit.

**Play:** https://chrisnowlin.github.io/music-jungle/

## How it teaches (NC K–5 alignment)

Students explore a 240×240-unit jungle, discover **18 hidden instruments** at four
landmarks (Waterfall Falls = brass, Cave of Strings = strings, Whispering Grove =
woodwinds, Fire Circle = percussion), hear real Philharmonia Orchestra recordings of
each instrument, collect them, and sort them into family camps. Each camp has an
narrated "How this family makes sound" explainer (vibrating strings / air split by a
reed / buzzing lips / struck-shaken-scraped) and unlocks a family mini-game:

| Family | Mini-game | Concept |
|---|---|---|
| Percussion | 🦍 Echo Drums | pattern echo on real drum samples |
| Strings | 🦧 Vine Melody Memory | pentatonic pitch memory on harp samples |
| Woodwinds | 🦜 Wind Song Match | contour matching + breath control |
| Brass | 🦁 Buzz Lab | lip-buzz pitch steering on a harmonic ladder |

Finishing a mini-game with any stars earns that family's badge. All four badges unlock
the **Rainbow Stage concert** and a printable certificate. Every discovery and Ranger
Check question is tagged to an NC Essential Standards for Music code; the teacher CSV
export includes per-standard accuracy.

Two reading tracks: 🌱 Sprout (K–2, icon-heavy, narrated, minimal reading) and
🧭 Explorer (3–5, full facts and vocabulary). The game is fully completable with
narration off.

## Teacher quick start

1. Open the URL (or scan your QR code) on student devices — once. The app then works offline.
2. Tap **▶ Play → ➕ New Explorer**. Paste your whole class list (one name per line)
   to bulk-create profiles, or create one at a time. Profiles are per-device.
3. Students tap their own card to play. Progress autosaves every few seconds.

### iPads — important
Open in Safari, then **Share → Add to Home Screen** and launch from the home-screen icon.
Home-screen installs are exempt from Safari's 7-day storage cleanup; regular tabs are NOT.
The dashboard shows whether storage is protected. For bulletproof progress, use
**Dashboard → ⬇ Save file** (per-student `.musicjungle.json`) and **⬆ Import** to move or restore.

### Session pacing (30–40 min classes)
| Session | Goal |
|---|---|
| 1 | Tutorial walk, first landmark, sort 3 instruments |
| 2–4 | One new landmark per session + camp challenge |
| 5 | Final landmark, Rainbow Stage concert, certificates |

### If something goes wrong mid-class
| Symptom | Fix |
|---|---|
| No sound | Check device silent switch / volume; tap the screen once |
| Black screen | Reload the page (progress saves automatically) |
| "Wake the jungle!" | Just wait a second — graphics driver hiccup; it resumes itself |
| Progress lost | Dashboard → ⬆ Import a saved explorer file |
| Old version stuck | Hard-refresh; the title screen shows v1.0.0 |

### Teacher dashboard
From the title screen, **press and hold 🍎 For Teachers** for 2 seconds. Per-explorer:
found/sorted/badges/stars/quiz accuracy/minutes/last played. Actions: rename, switch
reading level, reset progress (two-step), delete (two-step), download save file,
CSV export of all stats (opens in Sheets/Excel), printable summary.

Student data never leaves the device except when *you* export a file.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | WASD / arrow keys | drag LEFT side of screen (floating stick) |
| Look / rotate camera | drag the mouse · hold **Q** / **E** | drag RIGHT side of screen |
| Interact | Space, F, or Enter | big ✋ button |

A first-time "How to play" card and a persistent hint chip teach these in-game.

## For developers

```bash
npm install
npm run dev        # local dev server
npm test           # vitest unit tests (save system, quiz engine, gates)
npm run typecheck  # strict TS
npm run build      # production build to dist/
npm run preview    # serve dist/
```

Deploy: push to `main` — GitHub Actions publishes to Pages automatically
(`.github/workflows/deploy.yml`).

### Project layout
- `src/core/` — audio (Web Audio + synth fallbacks), input/joystick, narrator,
  save/profiles (localStorage, versioned, quarantine), quality tiers, context-loss recovery
- `src/world/` — procedural terrain/water/sky/foliage/landmarks/colliders
- `src/player/` — third-person controller + camera rig
- `src/objects/` — 18 procedural instrument builders, pedestals/totems, icon snapshots
- `src/game/` — state store, discovery registry, collection, progression gates, quiz engine
- `src/minigames/` — shared shell + four family games (per-round checkpoints)
- `src/ui/screens/` — title/profiles/HUD/cards/quiz/dashboard/certificate/jam
- `src/content/` — instruments, quizzes (early/upper, NC-tagged), minigame configs
- `scripts/` — audio acquisition/conversion pipeline (`pick-samples.py`, `get-audio.sh`)
- `public/assets/audio/instruments/` — bundled instrument samples (~1.3 MB)

All world geometry and every instrument is built procedurally in code — zero downloaded models.
