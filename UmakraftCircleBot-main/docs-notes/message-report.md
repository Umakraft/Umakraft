# Reorganisation Report — `umamoe/` Directory

**Date:** 2026-07-08  
**Status:** ✅ ALL PHASES COMPLETED (1–5)

---

## Phase 1 — Core uma.moe files ✅

| Original | Moved to | Shim left at |
|---|---|---|
| `core/uma.js` | `umamoe/uma.js` | `core/uma.js` |
| `core/umaClient.js` | `umamoe/umaClient.js` | `core/umaClient.js` |
| `core/umaStats.js` | `umamoe/umaStats.js` | `core/umaStats.js` |
| `core/umaCache.js` | `umamoe/umaCache.js` | `core/umaCache.js` |
| `core/umaQueue.js` | `umamoe/umaQueue.js` | `core/umaQueue.js` |

Callers that needed zero changes: **30+ files** across commands/, tasks/, handlers/, utils/, scripts/

---

## Phase 2 — Timeline scraper ✅

| Original | Moved to | Shim left at |
|---|---|---|
| `timeline/timeline.js` | `umamoe/timeline/timeline.js` | `timeline/timeline.js` |
| `timeline/timelineScraper.js` | `umamoe/timeline/timelineScraper.js` | `timeline/timelineScraper.js` |
| `timeline/timelineScheduler.js` | `umamoe/timeline/timelineScheduler.js` | `timeline/timelineScheduler.js` |

Callers that needed zero changes: `tasks/index.js`, `commands/timeline_post.js`, `core/health.js`

---

## Phase 3 — Trainer scraper & leaderboard ✅

| Original | Moved to | Shim left at |
|---|---|---|
| `trainer/screenshotter.js` | `umamoe/trainer/screenshotter.js` | `trainer/screenshotter.js` |
| `trainer/trainerLeaderboard.js` | `umamoe/trainer/trainerLeaderboard.js` | `trainer/trainerLeaderboard.js` |

Callers that needed zero changes: `commands/store.js`, `handlers/onboardingHandler.js`

Special note: dynamic `import('./screenshotter.js')` inside `trainerLeaderboard.js` resolves correctly since both files share the same folder.

---

## Phase 4 — History pipeline ✅

| Original | Moved to | Shim left at |
|---|---|---|
| `utils/generatePastHistoryMd.js` | `umamoe/history/generatePastHistoryMd.js` | `utils/generatePastHistoryMd.js` |
| `utils/pastHistoryReader.js` | `umamoe/history/pastHistoryReader.js` | `utils/pastHistoryReader.js` |

Callers that needed zero changes: `tasks/monthlyHistoryExport.js`, `commands/profile.js`, `commands/memberlist.js`

Import path fixes applied:
- `../core/*` → `../../core/*`
- `../tasks/milestone-tiers.js` → `../../tasks/milestone-tiers.js`
- `PROJECT_ROOT = path.dirname(__dirname)` → `path.dirname(path.dirname(__dirname))` (2 levels up from `umamoe/history/`)
- `MD_FILE path.join(__dirname, '..', ...)` → `path.join(__dirname, '..', '..', ...)` (2 levels up to project root)

`PastHistoryTrainer.md` itself is a **generated data artifact** — it stays at the project root. Only the JS generator and reader moved.

---

## Phase 5 — Trainer utilities ✅

| Original | Moved to | Shim left at |
|---|---|---|
| `utils/skillScraper.js` | `umamoe/trainer/skillScraper.js` | `utils/skillScraper.js` |
| `utils/resumeCard.js` | `umamoe/trainer/resumeCard.js` | `utils/resumeCard.js` |
| `utils/profileBackfill.js` | `umamoe/profileBackfill.js` | `utils/profileBackfill.js` |

Callers that needed zero changes: `commands/store.js` (skillScraper), all resumeCard/profileBackfill callers

Import path fixes applied:
- `skillScraper`: `../core/log.js` → `../../core/log.js`
- `resumeCard`: `./characterData.js` → `../../utils/characterData.js`
- `profileBackfill`: `../core/umaClient.js` → `./umaClient.js` (same folder now)

---

## Final `umamoe/` Layout

```
umamoe/
├── index.js                            ← single-entry barrel for everything
├── uma.js                              ← barrel re-export
├── umaClient.js                        ← HTTP API client
├── umaStats.js                         ← stat engine
├── umaCache.js                         ← snapshot cache
├── umaQueue.js                         ← rate-limit queue
├── profileBackfill.js                  ← daily gain historical backfill
├── timeline/
│   ├── timeline.js                     ← orchestrator
│   ├── timelineScraper.js              ← Playwright + axios scraper
│   └── timelineScheduler.js            ← cron scheduler
├── trainer/
│   ├── screenshotter.js                ← Playwright profile screenshot
│   ├── trainerLeaderboard.js           ← #uma-results leaderboard builder
│   ├── skillScraper.js                 ← inherited skill name scraper
│   └── resumeCard.js                   ← Discord embed resume card builder
└── history/
    ├── generatePastHistoryMd.js        ← PastHistoryTrainer.md generator
    └── pastHistoryReader.js            ← PastHistoryTrainer.md parser
```

---

## Verification

- Bot workflow running after all 5 phases: ✅
- No import errors across any phase: ✅
- Zero changes required to any caller file: ✅
- `umamoe/index.js` exports all modules via a single import point: ✅
- `PastHistoryTrainer.md` stays at project root (generated artifact, not a source file): ✅
- Login retries are expected — stale encrypted token, not a code issue: ✅
