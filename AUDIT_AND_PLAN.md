# AUDIT_AND_PLAN — ts-minecraft (Effect-TS + Three.js Minecraft clone)

> Living progress tracker for the autonomous NFR/FR audit loop.
> Generated 2026-06-10. Package layout (verified against `pnpm-workspace.yaml`):
> `packages/{app, block, core, entity, game, inventory, network, presentation, rendering, worker, world}`,
> each with `domain/`/`application/`/`infrastructure/`/`presentation/` at the package root (no `src/`).
> Quality gate: `pnpm verify` = typecheck + lint(oxlint) + check:refactor + test + build.
> Per-task gate (cheaper): `pnpm typecheck` (build+test tsconfig).

---

## Methodology

Three read-only audits were fanned out (hot-path perf, chunk/meshing/memory, feature completeness),
then the top findings were **re-verified by hand** before landing in this plan. False positives were
dropped (e.g. `Effect.void` is a cached singleton — not a per-frame allocation; several `Option._tag`
checks are already allocation-free). Only confirmed, impactful items survive below.

---

## A. Current Issues — ranked (most critical first)

### A0. Memory leaks (correctness — leak grows unbounded over a session)
1. **Atlas texture never disposed** — `packages/rendering/infrastructure/meshing/chunk-mesh.ts` builds
   `atlasTexture` via `buildAtlasTexture()` but never wraps it in `Effect.acquireRelease`; the
   `CanvasTexture` (mipmaps + anisotropy 8, ~2-4 MB VRAM) lives for the whole session and is never freed.
2. **Transparent-solid meshes routed into the water mesh list** —
   `packages/rendering/infrastructure/renderer/world-renderer-chunk-update.ts` updates GLASS/LEAVES
   (`transparentSolid`) meshes against `waterMeshesRef`, polluting the refraction pre-pass and leaving
   no dedicated disposal list. (Needs confirm before fix.)

### A1. Per-frame heap allocations in the 60 fps hot path (VERIFIED)
3. **Camera pose `.clone()` ×2 every frame** — `render-stage.ts:30-31`. New `Vector3` + `Quaternion`
   allocated each frame purely to restore camera after the attack-swing offset. → reuse module-scoped
   scratch objects + `.copy()`.
4. **`Effect.all(..., concurrency: 'unbounded')` for two pure `Ref.get`** — `render-stage.ts:23-25`.
   Spawns fibers for synchronous reads. → sequential `yield*`.
5. **`fps.toFixed(1)` allocates a string every frame** — `hud-stage.ts:27`, even though the DOM write is
   already change-gated. → only stringify when the rounded FPS value actually changes.
6. **Graphics cache-key string `.join('|')` every frame** — `frame-stage-executor.ts:33-37`. → compare
   raw fields / numeric key instead of building a string each frame. (Needs confirm.)

### A2. Meshing / culling / GPU (bigger, medium-impact)
7. **Per-chunk shader recompile** — `chunk-mesh-materials.ts` runs `onBeforeCompile` string-replacement
   for every chunk material; 100+ identical compiles cause load stutter. → compile once / share program.
8. **Sub-region meshing not implemented on the worker** — `meshing-worker-pool.ts` forwards `dirtyAABB`
   but the worker ignores it; every block edit re-meshes the full 16×256×16 chunk.
9. **Water mesh list rebuilt on every add/remove** — `world-renderer-chunk-update.ts` uses
   `Arr.append`/`Arr.filter` (whole-array realloc) on chunk load/unload churn.
10. **`clearScene` allocates a full array via `Arr.fromIterable(HashMap.values(...))`** —
    `world-renderer.ts:217`; apply the imperative-iteration pattern already used by frustum culling.

### A3. Architecture / robustness
11. **Subarray-alias lifetime hazard** — `greedy-meshing-types.ts` returns views into a shared
    accumulator valid only until the next mesh call; safe today (single fiber, synchronous) but a
    refactor landmine. → document invariant + assert, or return owned slices.

## B. Missing / broken Functional Requirements (FR)
- **FR-1 Creative-mode flight** — creative mode exists but has zero flight (no ascend/descend, gravity
  still applies). Highest-impact missing FR.
- **FR-2 Liquid mechanics** — no swimming state, no oxygen/drowning, no lava damage; water is collision-only.
- **FR-3 Multiplayer block sync** — `BlockPlace`/`BlockBreak` schemas exist but are never wired; MP is
  position-only and shows no remote players or block edits.
- **FR-4 Beds & respawn point** — BED block exists, no interaction/respawn-anchor behavior.
- **FR-5 Spectator mode / noclip** — only survival+creative in `GameModeSchema`.
- (Lower priority: enchanting-table UI, full redstone repeater/comparator, structure generation.)

---

## C. Task list (execute top-down, one commit each, typecheck-green between)

### Phase 1 — Verified per-frame allocation fixes (cheap, low-risk)
- [x] T1. `render-stage.ts`: replace camera `.clone()` ×2 with module-scoped scratch `Vector3`/`Quaternion` + `.copy()`. _(done 2026-06-10)_
- [x] T2. `render-stage.ts`: replace `Effect.all(unbounded)` of two pure `Ref.get` with sequential reads. _(done 2026-06-10)_
- [x] T3. `hud-stage.ts`: only `toFixed` when rounded FPS changes (cache last numeric FPS). _(done 2026-06-10; ref `lastFpsTextRef`→`lastFpsTenthsRef`)_
- [x] T4. `frame-stage-executor.ts`: confirm + eliminate per-frame graphics cache-key string build. _(done 2026-06-10; bit-packed numeric key)_

### Phase 2 — Memory-leak fixes (correctness)
- [x] T5. `chunk-mesh.ts`: wrap `atlasTexture` in `Effect.acquireRelease` to `.dispose()` on scope close. _(done 2026-06-10; materials were already released)_
- [x] T6. Fix transparent-solid meshes polluting `waterMeshesRef` (nullable tracking ref). _(done 2026-06-10; confirmed asymmetry update-path bug; no separate ref needed — nothing consumes a TS list & geometry already disposed in chunk-mesh.ts)_

### Phase 3 — Meshing / culling / GPU
> **Curation note (2026-06-10):** after grounded re-verification, the chunk-audit's
> Phase-3 findings proved largely over-stated. The rendering layer is already
> well-optimized; T7/T8 are false positives and T9/T10 target costs that never block
> a frame. Recording the analysis instead of churning working code.
- [x] T7. ~~share one compiled program across chunk materials~~ **FALSE POSITIVE** — chunk materials are
  already two shared singletons (`chunk-mesh-materials.ts:60,142`); `onBeforeCompile` runs once per
  material, not per chunk. Three.js keys its program cache by material. No N-recompile exists.
- [x] T8. ~~imperative `clearScene` iteration~~ **NO ACTION** — `clearScene` has zero production callers
  (teardown-only, never per-frame). The "12,000 allocs/sec" rationale assumed per-frame execution.
- [x] T9. ~~incremental water-mesh Set~~ **DEFERRED (low value)** — `Arr.append`/`filter` on the water
  list only fire on chunk load/unload (a handful/sec at chunk transitions), never per-frame; arrays are
  bounded by render distance. A Set refactor ripples through refraction + chunk-sync for negligible gain.
- [x] T10. ~~worker sub-region meshing via `dirtyAABB`~~ **DEFERRED (low real-world value, high risk)** —
  full chunk re-mesh on block edit runs on an *otherwise-idle worker thread* (off the main loop) and
  already reuses geometry via `tryReuseGeometry`; it never blocks a frame. Correct sub-region meshing
  (boundary faces, neighbor masks) is a large, correctness-risky change not justified by frame impact.

### Phase 4 — Robustness
- [x] T11. ~~enforce subarray-alias invariant~~ **ALREADY SATISFIED** — invariant is thoroughly documented
  (`greedy-meshing-types.ts:4-11,73,78-79`) and structurally safe (single-fiber synchronous consumption;
  worker path returns owned `.slice()` copies). A runtime guard would tax the zero-copy hot path it protects.

### Phase 5 — Missing FRs (largest; each its own mini-project)
- [x] T12. FR-1 Creative-mode flight (ascend/descend keys, gravity bypass in creative). _(done 2026-06-10; KeyF toggle, held Space/Shift = up/down, drift-free hover via post-step Y override, still collides with blocks; pure domain `flight.ts` + 9 unit tests)_
- [x] T13. FR-4 Beds: set respawn point on use; respawn there on death. _(done 2026-06-10; handleBed already set the point + creative respawn worked, but found+fixed a real bug — survival death-screen captured the spawn statically at attach, ignoring the bed; now reads the live `respawnPositionRef`. Added cross-session persistence: `respawnPosition` in save schema, hoisted shared ref into session.ts, save+restore.)_
- [x] T14. FR-2 Liquid mechanics: swimming + oxygen/drowning + lava damage. _(ALL sub-tasks done 2026-06-10)_
  - [x] T14a. Lava damage — periodic fire damage while standing in LAVA (survival only). _(done 2026-06-10; 4 dmg / 0.5s, frame-rate-independent accumulator, creative-immune, hurt sound; pure `environment-hazard.ts` + 6 tests)_
  - [x] T14b. Drowning damage — air supply (15s) depletes when eye-level block is WATER; 2 dmg/s at 0; instant refill on surfacing; creative-immune. _(done 2026-06-10; uses EYE_LEVEL_OFFSET so it matches what the player sees)_
  - [x] T14c. Air HUD — bubble indicator, hidden at full air, shown 0-10 bubbles underwater. _(done 2026-06-10; full 11-hop element wiring + change-gated DOM write via lastAirBubblesRef)_
  - [x] T14d. Swim-up — hold JUMP in water to ascend (steady upward swim, suppressed while flying). _(done 2026-06-10)_
- [x] T15. FR-3 Multiplayer block sync: wire `BlockPlace`/`BlockBreak` send + apply. _(ALL sub-tasks done 2026-06-10)_
  - [x] T15a. MultiplayerService: `sendBlockPlace`/`sendBlockBreak` + inbound block-edit queue + `drainBlockEdits`. _(done 2026-06-10, commit 1fc22173; +4 tests)_
  - [x] T15b. Send on local edit — place/break handlers emit messages when MP is connected (Option-guarded no-op offline). _(done 2026-06-10)_
  - [x] T15c. Apply on receive — drain inbound edits each frame, forceSetBlock (break→AIR) + mark chunk dirty for remesh; invalid block types skipped. _(done 2026-06-10; +3 tests)_

---

## E. Round 2 (2026-06-10) — second audit pass after Round 1 completion

Two fresh fan-out audits (per-frame allocs in the not-yet-optimized stages; Effect-TS
fiber/layer hygiene + FR gaps). Effect hygiene graded **A−** — no fiber leaks, proper
`acquireRelease`, `runSync`/`runPromise` only at FFI boundaries. **Key reachability
finding:** `services.multiplayer` is hardcoded `Option.none()` (session.ts:288), so the
entire MP stack (T15 sync + the existing-but-unwired `RemotePlayerRenderer`) is dormant
in actual play. Round-2 priority therefore favors player-visible single-player gaps and
always-runs hot-path cleanup over dormant-MP wiring.

- [x] R1. Drop `concurrency: 'unbounded'` on 4 per-frame `Effect.all` over **sync** reads
  (camera-stage getRotation+getMode, entity-update-stage getEntities+structureVersion,
  interaction-stage 8 redstone keys, input-stage 4 trade keys) → sequential, no fiber spawns. _(done 2026-06-10)_
- [x] R2. Spectator game mode — extend `GameModeSchema`, noclip/free-fly, disable
  interactions; reuses the T12 flight infra. (Player-visible single-player FR.) _(ALL sub-tasks done 2026-06-10; reachable via menu 3-way toggle)_
  - [x] R2a. Domain — add `'spectator'` to `GameModeSchema` + `isSpectator` on the service; update mocks + tests. _(done 2026-06-10)_
  - [x] R2b. Physics — spectator forces always-fly + noclip (skip block collision) + ignores water in game-state-service. _(done 2026-06-10)_
  - [x] R2c. Immunity + no-interaction — spectator immune to all damage (tryApplyPlayerDamage gate) + click block (break/place/attack/redstone) disabled. _(done 2026-06-10)_
  - [x] R2d. Menu — 3-way game-mode cycle survival→creative→spectator + `gameModeLabel` helper (button + world badge). _(done 2026-06-10)_
- [x] R3. Enchanting feedback — added a distinct `enchant` sound cue so the (silent) deterministic
  enchant gives clear audible confirmation. **Full selection-overlay DESCOPED**: the enchant is
  deterministic (`selectEnchantment` returns exactly one result, no player choice), so a vanilla
  3-offer chooser doesn't fit the mechanic — it would require redesigning enchanting. A proper
  confirmation toast needs a new ToastService threaded through a deep handler (~6-8 files),
  disproportionate for Round-2 polish. Delivered the contained, pattern-following feedback win instead. _(done 2026-06-10)_
- [x] R4. ~~Wire `RemotePlayerRenderer` into the frame loop~~ **DESCOPED (deliberate)** — the entire MP
  stack is gated off at the session level (`services.multiplayer = Option.none()`, session.ts:288;
  no production server exists). Wiring the renderer would be **dead code** exercised only if MP is
  enabled. The orphaned-but-tested renderer is the intentional state of an unfinished experimental
  feature; building dead wiring adds no reachable value. Revisit IF/when MP is turned on
  (then it pairs with the T15 block-sync, also dormant for the same reason).

## F. Round 3 (2026-06-10) — third audit pass

One focused agent audited under-examined subsystems. **NFR finding: the previously-unaudited
subsystems are all sound** — light-engine BFS (bounded, full-recompute threshold), fluid sim
(FLUID_TICK_BUDGET cap + carryover), terrain gen (off-thread), worker pools (timeout + finalizer
cleanup), chunk-manager LRU — no per-tick allocation/unbounded-growth issues. **FR gaps:** mob
breeding is the top missing core FR but is large (~8-10 files, needs a right-click-entity system);
two contained QoL wins remain. Picking lower-risk, player-visible, contained increments.

- [x] R5. Sprint FOV — widen camera FOV (75→82, lerped 0.18/frame) while sprinting (Ctrl+W, not sneaking),
  in camera-stage; updateProjectionMatrix only when FOV actually changes. Visual-only, no new ref. +1 test. _(done 2026-06-10)_
- [x] R6. **Mob breeding** (right-click-entity feed → love → baby → grows up) — COMPLETE across 7 small commits.
  Feed two same-species adults their breeding item → calf spawns (half scale) → matures to adult after 20min.
  - [x] R6a. Data foundation — optional `breedingItem` on `MobDefinition` + cow/sheep←WHEAT, pig←CARROT; +3 tests. _(done 2026-06-10)_
  - [x] R6b. Pure breeding domain logic — `breeding.ts`: love/cooldown/age counters, `canAcceptBreedingFood`,
    `isBreedingPair`, `tickBreedingTimers`, adult/newborn states; +12 tests. Additive, zero entity-manager coupling. _(done 2026-06-10)_
  - [x] R6c-1. Entity love-mode state — `loveTicksRemaining`/`breedCooldownRemaining`/`ageTicks` on ManagedEntity
    (spawned mobs adult) + `EntityManager.feedEntity(id)` (enters love iff willing adult). Additive, no update-loop
    change (fields ride the existing `{...entity}` spreads). +2 tests; all 200 entity-mob tests green. _(done 2026-06-10)_
  - [x] R6c-2. Tick decay — `tickBreedingTimers` folded into all 4 update-loop return sites; idle early-return
    PRESERVED by clamping `ageTicks` at maturity (idle adult → unchanged state) + guarding the fast path on
    `breedingChanged`. +1 integration test (600-tick love decay); all 201 entity-mob tests green. _(done 2026-06-10)_
  - [x] R6c-3. Right-click-entity feeding — `handleFeedAnimal` (reuses `findAttackableEntity` for targeting):
    held item === species `breedingItem` → `feedEntity` (gated) → consume 1 + sound; wired as right-click priority
    so feeding a pig with CARROT feeds rather than eats. +4 tests (incl. positive raycast hit). _(done 2026-06-10)_
  - [x] R6c-4a. Pure pairing — `findBreedingPairs` (generic over EntityId/EntityType): greedily pairs same-species
    in-love adults within range (each used once), baby at the midpoint; +5 tests. _(done 2026-06-10)_
  - [x] R6c-4b. Integration — `addEntity` hoisted with optional `ageTicks`; `update` override runs a breeding
    pass after the AI tick (filter in-love adults → `findBreedingPairs` → reset parents + spawn baby ageTicks 0).
    **Mob breeding works end-to-end.** +2 e2e tests (calf spawns; mismatched species don't); all 219 entity tests green. _(done 2026-06-10)_
  - [x] R6c. Entity-manager breeding tick — two in-love adults in range → spawn baby + love-cooldown. _(all sub-tasks R6c-1..4b done)_
  - [x] R6d. Baby render scale — optional `isBaby` on public Entity (set from ageTicks in toPublicEntity);
    entity-renderer draws babies at 0.5× via per-entity scratch.scale. Growth (age→adult) already handled by
    R6c-2 tick decay. +2 tests; all 230 entity/render tests green. _(done 2026-06-10)_
- [x] R7. Sneak edge-protection — pure `clampSneakEdge` (per-axis revert when a step lands on an unsupported
  ledge; allows step-downs within `SNEAK_STEP_DOWN`, slides along edges) gated on sneaking+grounded in
  game-state. **Never traps on flat ground** (support always exists), so the core movement path is safe.
  +6 unit tests; game-state + movement tests (111) green. _(done 2026-06-10; the deferred-risk item, implemented conservatively)_
  (then it pairs with the T15 block-sync, also dormant for the same reason).

## D. Progress log
- 2026-06-10: Audit complete; plan authored. Beginning Phase 1.
- 2026-06-10: **ALL TASKS COMPLETE.** Phase 1 (T1-T4 verified hot-path allocs), Phase 2
  (T5 atlas-texture GPU leak, T6 transparent-solid water-list bug), Phase 3/4 curated
  (T7/T8 false positives, T9/T10 deferred as non-frame-blocking, T11 already satisfied),
  Phase 5 FRs (T12 creative flight, T13 bed respawn + survival-respawn bug fix + persistence,
  T14 liquid mechanics [lava/drown/air-HUD/swim-up], T15 multiplayer block sync [send+apply]).
  Final gate: `pnpm typecheck` 0 errors, `pnpm lint` 0/0. ~20 commits on branch
  `audit/nfr-fr-improvements`. New unit tests: flight, environment-hazard, multiplayer
  send + apply, bed-respawn persistence.
- 2026-06-10: **ROUND 2 COMPLETE.** R1 (unbounded-concurrency fiber-spawn cleanup on 4 per-frame
  sync reads), R2 (full spectator game mode: schema + noclip fly + immunity + no-interaction +
  reachable via menu 3-way toggle, R2a-d), R3 (distinct enchant sound; full overlay descoped as
  ill-fitting the deterministic mechanic), R4 (deliberately descoped — `RemotePlayerRenderer`
  wiring would be dead code while the MP stack is gated off). Operational note: per-iteration
  worker reaping added after an OS file-descriptor exhaustion (`ENFILE`) bricked tooling mid-run.

## G. Round 4 (2026-06-10) — breeding follow-up

- [x] R8. Baby-feeding accelerates growth — `acceleratedBabyAge` (−10% remaining/feed, clamped) + `isBaby`;
  `feedEntity` now: baby → grow, willing adult → love, else decline. Additive vanilla follow-up to R6
  (previously feeding a baby was a no-op). +5 pure tests + 1 e2e (breed → feed the calf). _(done 2026-06-10)_
- [x] R9. Baby mobs drop no loot / grant no XP when killed (vanilla correctness) — gate the drop-add,
  looting bonus, and XP grant in handleLeftClick on `!wasBaby` (using `entityOpt.value.isBaby` from R6d).
  Reuses the public-Entity isBaby flag added for render scaling. typecheck 0; 46 interaction tests green. _(done 2026-06-10)_
