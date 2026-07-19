# THE GREAT SPLITTING PLAN

**Goal:** Simplify and unify the full pipeline from `umamoe` through to `Broadcast`/`distribution` by eliminating duplication, collapsing thin shims, and establishing clear ownership for each concern. Every phase reduces lines and responsibilities without losing behaviour.

---

## Current Pipeline (as-is)

```
umamoe/Miner
  └─▶ umamoe/Inspector        validates raw data
        └─▶ umamoe/Vault       stores validated envelope
              └─▶ umamoe/Courier        packages for transport
                    └─▶ umamoe/Refinery  processes into refined artifact
                          └─▶ Refinery/Depot  queues for broadcast

Broadcast/Broker  (polls Depot every 5 min)
  └─▶ Broadcast/archive-inspector/ArchiveInspector  re-validates + dedup
        └─▶ Broadcast/Archive                         persists record
              └─▶ Broadcast/archive_transporter        fetches & hands off
                    └─▶ Broadcast/Announcer            delivers to Discord
```

Problems visible in this picture:
- `Vault` and `Archive` are the same thing with different names.
- `Courier` and `ArchiveTransporter` are both pass-through shims (~30–93 lines each, no real logic).
- `Inspector` and `ArchiveInspector` both validate-then-store; identical pattern, different targets.
- `Refinery/Depot` is a functional copy of `Vault/adapters/inmemory.js`.
- `Refinery/refinery.js` contains its own inline `FileAdapter`, duplicating `Vault/adapters/file.js`.
- `umamoe/index.js` is a 93-line barrel importing 19 files and exporting 32 names.
- `tasks/index.js` is 328 lines — instantiates the whole Broadcast pipeline inline.

---

## Phase 1 — Unify the Storage Layer

**Target duplication:**
| File | Lines | What it actually is |
|---|---|---|
| `umamoe/Vault/vault.js` | 83 | Generic keyed store w/ adapter plug-in |
| `umamoe/Vault/adapters/inmemory.js` | 67 | Map-backed adapter |
| `umamoe/Vault/adapters/file.js` | 90 | JSON-file adapter |
| `Broadcast/Archive/archive.js` | 102 | Same as Vault + delivery-flag fields |
| `Refinery/Depot/depot.js` | 50 | Duplicate of `inmemory.js` |
| `Refinery/refinery.js` inline FileAdapter | ~13 | Duplicate of `file.js` |

**Action:** Promote `Vault` into a shared `core/Store` (or keep the path as `umamoe/Vault` but export it from `core`).
- Add an optional `deliveryFlags` capability to the base store (replaces Archive's only difference).
- Delete `Refinery/Depot/depot.js` — replace all usages with `new Vault({ adapter: 'inmemory' })`.
- Delete the inline `FileAdapter` inside `refinery.js` — use `Vault({ adapter: 'file' })`.
- `Broadcast/Archive` becomes a thin config wrapper:
  ```js
  // Broadcast/Archive/archive.js  (after)
  import { Vault } from '../../core/Store.js';
  export const Archive = new Vault({ adapter: 'file', deliveryFlags: true });
  ```

**Lines saved:** ~245 (depot + duplicate FileAdapter + most of archive.js body).

---

## Phase 2 — Collapse the Thin Shims

### 2a. Merge `Courier` into `Inspector`

`Courier` (93 lines) does:
1. Calls `validateTransportability` (checks a field exists).
2. Passes the package onward.
3. Exports three `log*` wrappers that duplicate the project-wide logger.

`Inspector` (73 lines) already validates and routes to `Vault`. The "transport" step is just handing the validated envelope to the next stage — that belongs at the end of `Inspector.receive()`.

**Action:**
- Delete `umamoe/Courier/courier.js`.
- Move `validateTransportability` check into `Inspector.receive()` as a final validation step.
- Remove the three `log*` re-exports (use `core/log.js` directly at call sites).

**Lines saved:** ~93 + removes one hop in the pipeline.

### 2b. Merge `ArchiveTransporter` into `Broker`

`ArchiveTransporter` (30 lines) does exactly one thing: `archive.getByKey(key)` then calls `announcer.deliver(record)`. `Broker` already orchestrates every other step and calls `ArchiveTransporter` directly.

**Action:**
- Delete `Broadcast/archive_transporter/archiveTransporter.js`.
- Inline the two-line fetch-and-deliver into `Broker._deliver(key)`.
- Update `Broadcast/index.js` barrel to remove the export.

**Lines saved:** ~30 + one fewer class to instantiate in `tasks/index.js`.

---

## Phase 3 — Unify the Two Inspectors

`umamoe/Inspector/inspector.js` (73 lines) and `Broadcast/archive-inspector/archiveInspector.js` (82 lines) share the same pattern:

```
receive(envelope)
  validateExistence(envelope)
  validateStructure(envelope)
  validateMetadata(envelope)
  store.insert(envelope)
```

They differ only in: (a) the store they write to and (b) the schema they validate against.

**Action:**
- Create `core/Inspector.js` — a parameterised base class that accepts `{ schema, store }`.
- `umamoe/Inspector/inspector.js` becomes:
  ```js
  import { Inspector } from '../../core/Inspector.js';
  import { umamoeSchema } from './schema.js';
  export default new Inspector({ schema: umamoeSchema, store: Vault });
  ```
- `Broadcast/archive-inspector/archiveInspector.js` becomes the same, with `archiveSchema`.

**Lines saved:** ~100 (shared logic lives once); both files shrink to ~10 lines each.

---

## Phase 4 — Slim the Barrel (`umamoe/index.js`)

Currently exports 32 names from 19 imports. Consumers of this barrel either want:
- **Pipeline classes** (`callMiner`, `Vault`, `Refinery`, `Inspector`, `Courier`) — used by Broadcast/tasks.
- **High-level helpers** (`fetchTrainerProfile`, `runTimelineUpdate`, etc.) — used by Discord commands.
- **Submodule access** (timeline, trainer, history) — used by individual task files.

**Action:** Split into three focused barrels:
```
umamoe/pipeline.js     — Miner, Inspector, Vault, Refinery (pipeline only)
umamoe/helpers.js      — fetchTrainerProfile, runTimelineUpdate, etc.
umamoe/index.js        — re-exports both (kept for back-compat, can be removed later)
```
Update `tasks/index.js` and `Broadcast/Broker/broker.js` to import from `umamoe/pipeline.js` directly instead of the fat barrel.

**Lines saved in `umamoe/index.js`:** ~60 (the barrel itself doesn't shrink, but its dependents import less and tree-shaking becomes possible).

---

## Phase 5 — Extract Broadcast Boot from `tasks/index.js`

`tasks/index.js` (328 lines) instantiates the full Broadcast pipeline inline (lines 236–245) in addition to scheduling 10+ unrelated jobs.

**Action:**
- Create `Broadcast/boot.js`:
  ```js
  // Broadcast/boot.js
  import { Archive } from './Archive/archive.js';
  import { ArchiveInspector } from './archive-inspector/archiveInspector.js';
  import { Announcer } from './Announcer/announcer.js';
  import { Broker } from './Broker/broker.js';

  export function createBroadcastBroker(client) {
    const archive = new Archive();
    const inspector = new ArchiveInspector({ archive });
    const announcer = new Announcer({ archive, client });
    return new Broker({ archive, inspector, announcer });
  }
  ```
- `tasks/index.js` import becomes one line:
  ```js
  import { createBroadcastBroker } from '../Broadcast/boot.js';
  ```

**Lines saved in `tasks/index.js`:** ~30; Broadcast boot logic is now testable in isolation.

---

## Phase 6 — Adapter Registry Cleanup

`Adapters/adapter.js` (49 lines) dynamically loads files from `umamoe/Vault/adapters/` using `pathToFileURL`. After Phase 1 there are only two adapters (`inmemory`, `file`). Dynamic loading adds complexity and makes static analysis impossible.

**Action:**
- Replace the dynamic loader with a static registry:
  ```js
  import { InMemoryAdapter } from '../umamoe/Vault/adapters/inmemory.js';
  import { FileAdapter }     from '../umamoe/Vault/adapters/file.js';
  const registry = { inmemory: InMemoryAdapter, file: FileAdapter };
  export function getAdapter(name) { return registry[name]; }
  ```
- Delete the `pathToFileURL` + dynamic-import path.

**Lines saved:** ~20; enables IDE autocomplete and static analysis.

---

## After All Phases — Target Pipeline

```
umamoe/Miner
  └─▶ core/Inspector (umamoe schema + Vault store)
        └─▶ core/Store (Vault, file adapter)
              └─▶ umamoe/Refinery  ──▶  core/Store (inmemory, replaces Depot)

Broadcast/Broker  (polls Store every 5 min)
  └─▶ core/Inspector (archive schema + Archive store)
        └─▶ Broadcast/Archive  (= Vault with deliveryFlags)
              └─▶  Broker._deliver()  [was ArchiveTransporter]
                    └─▶ Broadcast/Announcer
```

Approximate lines eliminated: **~550–600** across deleted files and collapsed logic.
Files deleted: `Courier/courier.js`, `archive_transporter/archiveTransporter.js`, `Refinery/Depot/depot.js`.
Files created: `core/Store.js`, `core/Inspector.js`, `Broadcast/boot.js`, `umamoe/pipeline.js`.

---

## Unrelated / Out-of-Scope — Note Only

These items exist in the repo but are **not part of the pipeline** and should not be touched in this plan. They are noted here so they are not accidentally dragged into scope.

| Path | What it is | Recommended action |
|---|---|---|
| `attached_assets/` | CSV data files (2025–2026), UI mockups, design docs | Leave in place; document ownership in a `attached_assets/README.md` |
| `distribution/` | `build_dist.js` + compiled `dist/` output | Separate concern (build tooling); belongs in a `scripts/` directory or `.gitignore`d dist output |
| `utils/skillScraper.js`, `utils/resumeCard.js` | Generic helpers duplicated in `umamoe/trainer/` | Decide canonical location and delete the duplicate; do not merge into pipeline |
| `tests/` | Full test suite | Keep as-is; update imports only when pipeline files move |
| `Contracts/`, `Policy/`, `Telemetry/`, `Errors/`, `Interaction/`, `Retriever/` | Architectural spec docs + stub JS | Leave stubs; do not implement or collapse until each has a real use case |

---

## Execution Order

| Phase | Depends on | Risk |
|---|---|---|
| 1 — Unify Storage | — | Medium (Vault/Archive used widely) |
| 2a — Drop Courier | Phase 1 (Inspector writes to unified Store) | Low |
| 2b — Drop ArchiveTransporter | Phase 1 | Low |
| 3 — Unified Inspector | Phase 1 | Medium (schema files must be extracted first) |
| 4 — Split barrel | Phase 2 | Low |
| 5 — Broadcast boot file | Phase 2b | Low |
| 6 — Adapter registry | Phase 1 | Low |

Start with Phase 1 — everything else unblocks from it.
