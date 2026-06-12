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

## O. Round 12 (2026-06-10) — FR: crop growth system

The top deferred FR gap from Round 11: crop growth. Implemented a side-table
CropGrowthService that tracks planted-crop ages outside the flat Uint8Array block
array, solving the "no per-block metadata" constraint without new block types.

**Design:** WHEAT_CROP always drops WHEAT_SEEDS (correct unripe behavior); bonus WHEAT
added only when harvest() returns true (ripe = age ≥ 2, or untracked = village crop
assumed mature). Two 60-second ticks to full maturity (simpler than vanilla's ~10-35min
random, playable in a session). Growth wired into frame-maintenance accumulator.

- [x] R27. `crop-growth.ts` domain — pure fns: CROP_MAX_AGE=2, isRipeCrop, advanceCropAge,
  CROP_GROWTH_INTERVAL_SECS=60. +10 unit tests. _(done 2026-06-10)_
- [x] R28. `CropGrowthService` — Ref<HashMap<string,number>> side-table; plant/harvest/tickAll;
  wired in layers/session/FrameHandlerServices/test mocks. _(done 2026-06-10)_
- [x] R29. `block-service.config.ts` drop override changed WHEAT_CROP→WHEAT_SEEDS; interaction-
  block-handler adds bonus WHEAT if ripe; interaction-farming-handler calls plant() on seed plant;
  frame-maintenance ticks crops every 60s. +8 integration tests; typecheck 0; 4495 tests total. _(done 2026-06-10)_

**Round 12 complete.** Crop growth now works end-to-end: plant seeds → wait 2min → harvest ripe
wheat + seeds. Village crops (untracked) still drop wheat immediately. 4495 tests passing.

## P. Round 13 (2026-06-10) — FR: hold-to-break with hardness-based timing

**Gap**: Blocks broke instantly on a single left-click — a core vanilla mechanic missing. The block
domain already had `hardness` on every block config; `isMouseDown(button)` already existed on InputService.
Only the timing logic and per-frame accumulation were absent.

**What was done**:
- `packages/block/domain/break-speed.ts` — pure `getBlockHardness(blockType)` (static lookup from
  `initialBlocks` at module load) + `computeBreakTicks(hardness, tool)`: `ceil(hardness*3/speedMult)`.
  Tool tiers: wooden=×2, stone=×4, iron=×6, diamond=×8. Zero hardness → 0 (instant). 13 unit tests.
- `FrameStageRefs.breakProgressRef: MutableRef<{blockKey,ticks,totalTicks}|null>` — tracks active break.
- `handleBlockBreakProgress` (new function in `interaction-block-handler.ts`): per-frame timed break.
  Accumulates ticks when `isMouseDown(0)=true`; resets when target changes or mouse released; on
  threshold fires the full break (block removal + sound + particles + XP + WHEAT harvest + Fortune).
- `handleLeftClick` now handles entity attacks ONLY (edge trigger preserved for attack cooldown). Block
  break removed from its body.
- `interaction-stage.ts` reads `isMouseDown(0)` each frame, calls `handleBlockBreakProgress` when held.
  `breakProgressRef` is reset synchronously when mouse is released.
- `<progress id="break-progress">` in `index.html` — yellow accent-color bar below the crosshair;
  `updateBreakProgressHud()` shows/hides it via `setAttribute('value')` / `style.display`.

**Test updates**: 2 existing tests updated to use `isMouseDown` mock (chunk-sync + interaction-stage).

**Example timings** (at 60 fps):
| Block | Bare hands | Wooden pickaxe | Diamond pickaxe |
|-------|-----------|---------------|----------------|
| DIRT (h=8) | 0.4s | 0.2s | 0.05s |
| STONE (h=25) | 1.25s | 0.63s | 0.16s |
| COAL_ORE (h=35) | 1.75s | 0.88s | 0.22s |
| OBSIDIAN (h=90) | 4.5s | 2.25s | 0.56s |

typecheck 0 errors; lint 0/0; **4508 tests passing** (+13 new; commit `0304008b`). _(done 2026-06-10)_

**Remaining deferred**:
- Item-drop entities + pickup radius — blocks still go directly to inventory (no world item entities).
- Crack texture overlay during break progress — particle system only uses block-atlas UVs; no per-stage
  crack animation. Visual feedback is the progress bar only.
- Baby mob visual differentiation — cosmetic, deferred from R11d.

## Q. Round 14 (2026-06-10) — tool pre-check UX fix + crop growth persistence

**Gaps fixed**:

**1. Tool-requirement pre-check before break progress**
- When a player held left-click on a pickaxe-required block (STONE, ores, OBSIDIAN) without a pickaxe, the
  progress bar would fill to 100% over 1–4 seconds, then `breakBlock` would fail silently (caught by
  `logErrors`), the bar would reset, and the block would stay. Confusing UX.
- `canHarvestBlock` was already correct in `block-utils.ts` but not exported from `@ts-minecraft/world`.
- Fix: export `canHarvestBlock` from `packages/world/index.ts`; in `handleBlockBreakProgress` call it
  immediately after resolving `blockType` — if it returns false, reset `breakProgressRef`, hide the HUD
  bar, and return. The player sees no bar at all (correct: they need a pickaxe first).

**2. Crop growth persistence across world save/load**
- `CropGrowthService` stored ages in `Ref<HashMap>` (in-memory only). After save/load, all tracked crops
  reset — freshly-planted seedlings appeared ripe (untracked = treated as mature by `harvest()`).
- `WorldMetadataSchema.playerState` gains optional `cropAges: Record<string, number>` (back-compat: old
  saves decode without the field, treated as empty map).
- `CropGrowthService` gains `serialize(): Effect<Record<string,number>>` (HashMap → plain object via
  iterable) and `restore(ages): Effect<void>` (plain object → HashMap via `HashMap.fromIterable`).
- `session-save.ts` saves `cropAges` and restores it; `session.ts` passes `cropGrowthService` to both
  `buildPersistSessionState` and `restoreSavedState`.

**New tests**: 8 crop-growth-service (serialize/restore round-trips), 2 session-save (cropAges saved and
restored correctly). 10 total new.

typecheck 0 errors; **370 test files, 4518 passing** (+10 new; commit `187fe2f0`). _(done 2026-06-10)_

## R. Round 15 (2026-06-10) — melee perf fix + bow hitscan shooting

Two agents audited remaining hot-path allocations and FR gaps. Key findings:
- **Per-frame fiber allocation (confirmed)**: `interaction-block-handler.ts:277-280` explicitly used
  `concurrency: 'unbounded'` for two synchronous `Ref.get` calls (totalTimeSecsRef + lastPlayerAttackTimeRef)
  on every melee click. Fixed to sequential reads.
- **False positive verified**: `camera-stage.ts:39` uses `Effect.all` with DEFAULT concurrency (which is
  sequential in Effect-TS, not unbounded). R5 added this after R1 without `concurrency: 'unbounded'` —
  no issue. The audit agent misread it. No change made.
- **BOW/ARROW FR gap**: BOW item, ARROW item, crafting recipe, enchantment support, and durability
  tracking all existed but the weapon had no shooting mechanic. Implemented hitscan bow:

- [x] R30. `interaction-block-handler.ts:277-280`: sequential Ref.get for melee timing (was
  `concurrency: 'unbounded'`). _(done 2026-06-10, commit edbac5a9)_
- [x] R31. Bow hitscan shooting — hold right-click to charge, release to fire.
  - `entity/domain/bow.ts`: pure domain — `BOW_MAX_DAMAGE=9`, `BOW_FULL_CHARGE_SECS=1.0s`,
    `BOW_MIN_CHARGE_SECS=0.2s`, `BOW_MAX_RANGE=50` blocks, `computeBowCharge/computeBowDamage/canFireBow`.
    Quadratic charge scaling (charge²) makes partial draws weak — vanilla-accurate.
  - `findAttackableEntity`: added optional `maxReach` param (default=`PLAYER_ATTACK_REACH` 3.5m);
    bow passes `BOW_MAX_RANGE=50`. Backward-compatible; 2 new tests.
  - `FrameStageRefs.bowChargeStartRef: MutableRef<number|null>`: tracks charge-start time; null = idle.
    Mirrors `breakProgressRef` pattern (same MutableRef, same frame-handler initialization).
  - `interactionStage`: reads `isMouseDown(2)` each frame; right-hold + BOW → start charge; release
    fires `handleBowFire`; non-BOW item clears stale charge. Right-click placement chain suppressed
    while BOW is drawn (bow charge takes priority over block placement).
  - `handleBowFire`: charge gate → consume 1 ARROW (silent no-op if empty) → damage bow slot →
    hitscan entity in crosshair within 50 blocks → apply damage → drop loot → play `entityHit` sound.
  - 12 new `bow.test.ts` unit tests; typecheck 0 errors; **4532 tests passing** (+14 total).
    _(done 2026-06-10, commit 816af0ab)_

## S. Round 16 (2026-06-10) — bow enchantments + arrow crafting

Arrow recipe and POWER/INFINITY enchantment application for the R31 bow — previously the bow fired but
POWER was absent from `EnchantmentTypeSchema` and had no formula, and INFINITY was not checked during
fire. Both gaps left the bow feature incomplete against the enchantment system that already existed.

- [x] R32. Arrow crafting recipe — `BONE×1 + STICKS×2 → ARROW×4` added to `misc-recipes.ts`. Vanilla
  uses flint+stick+feather, but neither FLINT nor FEATHER exist as item types; BONE (skeleton drop) +
  STICKS (planks) closes the survival loop without adding new item types. +1 craft test. _(done 2026-06-10)_
- [x] R33. POWER + INFINITY enchantment application on bow shots — `POWER` added to `EnchantmentTypeSchema`
  (max L5, BOW-only; `getPowerDamageMultiplier`: vanilla `1.0 + 0.5 × level`); INFINITY (already in schema
  but undetected) now skips ARROW consumption while still damaging the bow. `handleBowFire` reads the bow's
  enchantment list before consuming the arrow and applies both effects. +8 tests (max-level, multiplier
  values, canEnchantItem BOW/sword, INFINITY max-level). _(done 2026-06-10)_

**Round 16 complete.** R32 + R33 — arrow recipe + bow enchantments wired. typecheck 0, lint 0/0,
**4540 tests passing** (+8).

## T. Round 17 (2026-06-10) — enchantment/tool coverage + shield blocking

Audit verified: fishing is already fully wired (FishingService.tick in physics-stage,
cast/cancel in interaction-item-use-handler). Identified three real gaps:

- [x] R34. EFFICIENCY enchantment break speed + tool durability on block break —
  `computeBreakTicks` gains optional `efficiencyLevel?: number` param (vanilla `level² + 1`
  additive speed bonus). `handleBlockBreakProgress` reads the hotbar ItemStack once at the
  top (shared by EFFICIENCY, FORTUNE, and the new check): on block break, `isDurable` tools
  lose 1 durability, with UNBREAKING skip-chance (`Math.random() < 1 - 1/(level+1)`) gate.
  Previously tools only wore down during melee combat, never mining. +5 break-speed tests.
  _(done 2026-06-10, commit 3abf4216)_
- [x] R35. Shield blocking mechanic — `FrameStageRefs.isShieldBlockingRef: MutableRef<boolean>`
  set by interactionStage on every frame (right-mouse-hold + SHIELD equipped). physicsStage
  reads it before applying hostile contact damage: 0.34× multiplier (66% reduction, vanilla
  value); damageSlot(1) wears the shield on each absorbed hit. One-frame lag by design
  (physicsStage runs before interactionStage; imperceptible at 60fps). +2 physics tests.
  _(done 2026-06-10, commit 36390077)_

**Round 17 complete.** R34 + R35 — mining durability/EFFICIENCY + shield blocking.
typecheck 0, lint 0/0, **4546 tests passing** (+2).

## T. Round 18 (2026-06-10) — enchantment completeness: SMITE/BANE/SILK_TOUCH + bow XP

Audit verified remaining enchantment gaps: SHARPNESS was wired; SMITE/BANE needed entity-type
lookup; SILK_TOUCH+FORTUNE mutual exclusion was missing; bow kills never granted XP.

- [x] R36. SMITE/BANE_OF_ARTHROPODS/SHARPNESS mutual exclusion — `handleLeftClick` now
  fetches `entityOpt` BEFORE the damage calculation and applies a priority-ordered `enchantBonus`
  IIFE: SHARPNESS first (any mob), then SMITE only for undead (Zombie/Skeleton), then BANE
  only for arthropods (Spider). Vanilla semantics: only the highest-priority applicable enchant
  fires. +6 enchant-combat tests. _(done 2026-06-10, commit b03507e6)_
- [x] R37. LOOTING on bow kills — `handleBowFire` already tracked `hasLooting`; the bonus-drop
  forEach was added after the kill check, mirroring melee LOOTING logic. _(done 2026-06-10, commit b03507e6)_
- [x] R38. Bow XP on kill — `handleBowFire` services Pick gains `xpService`; on `Option.isSome(drops)`
  (entity removed), `getMobDefinition(entityOpt.value.type).xpReward` is awarded via `xpService.addXP`.
  Guards: xpReward > 0 check. +1 bow-XP unit test (direct `handleBowFire` call at y=63.1/camera y=64
  for correct perpendicular targeting). _(done 2026-06-10)_
- [x] R39. SILK_TOUCH + FORTUNE mutual exclusion — `BlockService.breakBlock(pos, silkTouch=false)`:
  when `silkTouch=true` drops the block itself (count=1) instead of the processed item.
  `handleBlockBreakProgress` detects `e.type === 'SILK_TOUCH'` in toolEnchantments before block break.
  The FORTUNE ore-bonus branch is gated `!hasSilkTouch` (vanilla: mutually exclusive).
  +2 block-service tests (DIAMOND_ORE+SILK_TOUCH → DIAMOND_ORE; without → DIAMOND). _(done 2026-06-10)_

**Round 18 complete.** R36–R39 — enchant priority, bow XP, SILK_TOUCH.
typecheck 0, lint 0/0, **4552 tests passing** (+3 new).

## U. Round 19 (2026-06-10) — KNOCKBACK / FEATHER_FALLING / RESPIRATION / PUNCH enchantments

Audit found four vanilla enchantments in the schema but unimplemented: KNOCKBACK (sword melee extra
push), FEATHER_FALLING (boots fall-damage reduction), RESPIRATION (helmet extended air supply),
PUNCH (bow horizontal knockback). Schema types, config max-levels, and formula fns added first;
all four wired end-to-end.

- [x] R40. KNOCKBACK (sword) — `handleLeftClick` reads `weaponEnchantments.find('KNOCKBACK')`;
  computes `getKnockbackHorizontalMultiplier(level)` = 1 + 0.5×level and scales the horizontal
  components of `computeKnockback` result before `applyKnockback`. Level 1 = 1.5× push. _(done 2026-06-10)_
- [x] R41. FEATHER_FALLING (boots) — `physics-stage` reads `equipmentService.getEquippedItem('BOOTS')`
  only when `rawFallDamage > 0`; multiplies by `(1 − getFeatherFallingReduction(level))` = 1 − 0.12×level.
  Armor/starvation still bypass this (vanilla: FEATHER_FALLING is boots-specific). _(done 2026-06-10)_
- [x] R42. RESPIRATION (helmet) — `nextAirSecs` gains optional `maxAirSecs` param (default MAX_AIR_SECS
  = 15); `physics-stage` reads `equipmentService.getEquippedItem('HELMET')`, derives
  `effectiveMaxAirSecs = 15 + getRespirationBonusSecs(level)` (= 15×level), passes it to `nextAirSecs`
  and uses it for the bubble-count denominator. _(done 2026-06-10)_
- [x] R43. PUNCH (bow) — `handleBowFire` reads `hasPunch`; after arrow hit (only when entity survived,
  `Option.isNone(drops)`), applies `applyKnockback` with horizontal scale `1 + getPunchKnockbackBonus(level)/5`.
  Level 1 = 1.6× horizontal, level 2 = 2.2×. _(done 2026-06-10)_

**Round 19 complete.** R40–R43 — 4 new enchantments wired end-to-end.
typecheck 0, lint 0/0, **4563 tests passing** (+11 new).

## V. Round 20 (2026-06-11) — FIRE_PROTECTION lava + UNBREAKING sword/bow

Audit found FIRE_PROTECTION/PROJECTILE_PROTECTION/BLAST_PROTECTION had no APPLICABLE_TO entries
(so `canEnchantItem` always returned false) and no formula fn. Also UNBREAKING was only wired
for block-breaking tools; sword hits and bow shots were silently ignoring it.

- [x] R44. FIRE_PROTECTION (lava) — `getFireProtectionReduction(level) = 0.08*level`; added
  APPLICABLE_TO for all three speciality protection types (all 12 armor pieces). physics-stage
  lava burn reads `equipmentService.getAll()`, sums FIRE_PROTECTION reduction across 4 slots,
  caps at 64%, multiplies `LAVA_DAMAGE` before damage application. +5 enchantment tests. _(done 2026-06-11)_
- [x] R45. UNBREAKING for sword — `handleLeftClick` weapon durability damage now gate by
  `getUnbreakingSkipChance(level)` (`weaponEnchantments` already in scope). _(done 2026-06-11)_
- [x] R46. UNBREAKING for bow — `handleBowFire` reads `UNBREAKING` from bow enchantments;
  `skipBowDurability = Math.random() < getUnbreakingSkipChance(level)`; skips `damageSlot` when true.
  INFINITY and UNBREAKING stack independently (both vanilla). _(done 2026-06-11)_

**Round 20 complete.** R44–R46 — FIRE_PROTECTION + UNBREAKING wiring completed.
typecheck 0, lint 0/0, **4575 tests passing** (+5 new).

## W. Round 21 (2026-06-11) — jump/attack/damage exhaustion + UNBREAKING cleanup

Audit found three `hunger-service.config.ts` exhaustion constants defined but never wired:
`EXHAUSTION_JUMP`, `EXHAUSTION_ATTACK`, `EXHAUSTION_DAMAGE`. Also UNBREAKING was skipping
the sword hit path (line 387).

- [x] R47. Jump exhaustion — added `wasGroundedRef: MutableRef<boolean>` to `FrameStageRefs` (types.ts)
  initialized `true` in frame-handler.ts. physics-stage alive-branch detects `wasGrounded &&
  !isGrounded` = just left ground → `addExhaustion(EXHAUSTION_JUMP=0.05)`. `inCreative` moved
  up to top of alive-branch to be reusable. _(done 2026-06-11)_
- [x] R48. Attack exhaustion — `handleLeftClick` services Pick gains `hungerService`; after each
  `applyDamage` call, `addExhaustion(EXHAUSTION_ATTACK=0.1)`. _(done 2026-06-11)_
- [x] R49. Damage-received exhaustion — `tryApplyPlayerDamage` in physics-stage now chains
  `addExhaustion(EXHAUSTION_DAMAGE=0.1)` after `applyDamage` success. Covers all sources:
  hostile, lava, drowning, fall, starvation. _(done 2026-06-11)_

**Round 21 complete.** R47–R49 — full exhaustion coverage.
typecheck 0, lint 0/0, **4575 tests passing** (no new tests; pure wiring).

## X. Round 22 (2026-06-11) — block drop correctness (GRASS, REDSTONE_TORCH)

Audit found two incorrect entries in INVENTORY_DROP_OVERRIDES:
- GRASS dropped itself (should drop DIRT in vanilla)
- REDSTONE_TORCH dropped REDSTONE_DUST (should drop itself — it's a placeable item)

- [x] R50. GRASS → DIRT drop — added `['GRASS', 'DIRT']` to INVENTORY_DROP_OVERRIDES.
  _(done 2026-06-11)_
- [x] R51. REDSTONE_TORCH drops itself — removed incorrect `['REDSTONE_TORCH', 'REDSTONE_DUST']`
  override. Comment added clarifying WIRE vs TORCH semantics. _(done 2026-06-11)_

+8 tests in `block-service-drop-overrides.test.ts` anchoring all main block→item drop
correctness expectations.

**Round 22 complete.** R50–R51 — block drop fixes.
typecheck 0, lint 0/0, **4583 tests passing** (+8 new).

## Y. Round 23 (2026-06-11) — armor durability loss on hit

Audit found that armor durability values were defined in `durability.ts` (e.g. IRON_HELMET=165)
but EquipmentService had no way to damage armor, and physics-stage never consumed it.

- [x] R52. Armor durability loss — `EquipmentService.damageArmorSlot(slot, amount=1)` added
  (uses `damageStack` for atomic damage; slot auto-cleared when item breaks). physics-stage
  after hostile hit: all 4 slots damaged concurrently. Test mock updated.
  _(done 2026-06-11)_

**Round 23 complete.** R52 — armor wears on hostile contact.
typecheck 0, lint 0/0, **4583 tests passing** (no new tests; pure wiring).

**Verified as fully wired (no change needed):**
- Fishing rod: cast/cancel in `handleFoodConsumption` + tick in `physics-stage`. ✓
- Tool durability on melee: `handleLeftClick.damageSlot`. ✓

## Z. Round 24 (2026-06-11) — GOLDEN_APPLE instant health regen

`GOLDEN_APPLE` was in the food table (`foodLevel:4, saturation:1.2`) but eating it had no
special effect. In vanilla, it grants Regeneration II → ~4 HP healed over ~5 s.

- [x] R53. GOLDEN_APPLE immediate heal — `handleFoodConsumption` services Pick gains
  `healthService`; after `hungerService.eat(…)` completes, if the item is `'GOLDEN_APPLE'`
  call `healthService.heal(4)`. `interaction-stage.ts` Pick updated to include `healthService`.
  New test: eating GOLDEN_APPLE triggers `heal(4)`. _(done 2026-06-11)_

**Round 24 complete.** R53 — GOLDEN_APPLE restores 4 HP on eat.
typecheck 0, **4584 tests passing** (+1 GOLDEN_APPLE heal test).

## AA. Round 25 (2026-06-11) — enchant APPLICABLE_TO gaps + wheat seed drops

Two data bugs found by audit:

- [x] R54. SILK_TOUCH missing from `APPLICABLE_TO` — it was wired in mining code but could
  never be obtained via enchanting table. Added to picks + axes. UNBREAKING missing from
  all armor except helmets and from hoes — fixed. 4 new `canEnchantItem` tests.
  _(done 2026-06-11)_

- [x] R55. WHEAT_CROP harvest no seed drops — ripe break now gives 1 WHEAT + 1-4 WHEAT_SEEDS;
  unripe break gives 1 WHEAT_SEEDS (matching vanilla). Pure production code change
  (chunk-query path; integration tested via manual play). _(done 2026-06-11)_

**Round 25 complete.** R54-R55.
typecheck 0, **4587 tests passing** (+3 enchant tests).

## AB. Round 26 (2026-06-11) — fishing enchants + furnace multi-fuel + bucket recipe

- [x] R56. LURE + LUCK_OF_THE_SEA enchants — added to schema/config/formulas; `FishingService.cast`
  now accepts `lureLevel`/`luckLevel` captured at cast time; `resolveFishingWaitSecs` reduces
  wait by 5s/level; `resolveFishingCatch` shifts treasure probability up by 2%/level.
  `interaction-item-use-handler` reads rod enchants and passes to cast. +8 tests. _(done 2026-06-11)_

- [x] R57. Furnace accepts STICKS + wooden tools as fuel (not just COAL) — `FURNACE_FUEL_ITEMS`
  priority list; `validateSmeltingPreconditions` finds any available fuel; error message
  generalized to "Missing furnace fuel". +1 test; error message assertions updated. _(done 2026-06-11)_

- [x] R58. BUCKET crafting recipe (3 iron ingots → 1 bucket) — critical for water/lava
  collection in survival. +1 test. _(done 2026-06-11)_

**Round 26 complete.** R56-R58.
typecheck 0, **4601 tests passing** (+14 new tests).

## AC. Round 27 (2026-06-11) — sprint vs walk exhaustion differentiation (R59)

- [x] R59. Walking no longer drains hunger at sprint rate — `EXHAUSTION_WALK_PER_BLOCK=0.01`
  added to `hunger-service.config.ts`; `physicsStage` now reads `inputService.isKeyPressed`
  for `ControlLeft/Right` + `KeyW` + `ShiftLeft` to detect sprint/sneak; walk=0.01/block,
  sprint=0.1/block (10×), sneak=0 (no exhaustion) — matching Minecraft Java Edition.
  `makeInputService.isKeyPressed` fixed to actually check `pressedKeys` set (was always false).
  +2 new tests (sprint rate, sneak=no exhaustion); existing walk-exhaustion test updated.
  _(done 2026-06-11)_

- [x] R60. Sprint-jump exhaustion wired — `EXHAUSTION_SPRINT_JUMP=0.2` (was only defined, never used);
  physicsStage now reads sprint/sneak state once and shares between movement + jump branches;
  sprint-jump uses 0.2/jump (4× vanilla normal jump). +1 test. _(done 2026-06-11)_

- [x] R61. Smelting grants XP on output collection — `SMELTING_XP_PER_ITEM` lookup in
  `furnace-service.config.ts` (vanilla Java Edition: IRON_INGOT 0.7, GOLD_INGOT 1.0,
  STONE/GLASS 0.1, COOKED_BEEF/COD/SALMON 0.35); `collectOutput` return type changed
  from `boolean` to `{ collected, xp }`; XP granted via `xpService.addXP` in
  `InventoryRenderer`; `XPServiceLive` wired in `presentation.ts` layer.
  +2 furnace tests (xp>0 for iron, xp=0 for unlisted item); all presentation mocks updated.
  _(done 2026-06-11)_

- [x] R62. XP bar max denominator updates dynamically — `#xp-bar-max` DOM element was hardcoded "7"
  in HTML and never updated. Wired `xpBarMaxElement` through the full HUD chain (session →
  session-runtime → frame/types → frame-handler → frame-stage-executor → physics-stage);
  `xpRequiredForNext` written alongside `xpIntoLevel` on each level/progress change.
  No new tests (DOM element write follows established `/* c8 ignore */` pattern). _(done 2026-06-11)_

- [x] R63. Bone meal advances crop growth instantly — BONE_MEAL right-clicked on WHEAT_CROP
  advances growth by 2 stages (deterministic; enough to ripen any crop in one use — vanilla Java
  Edition behaviour). `CropGrowthService.advanceByBoneMeal()` added; `BONE_MEAL_ADVANCE=2`
  constant in crop-growth domain. Handler branch in `interaction-farming-handler.ts` consumes 1
  BONE_MEAL and calls advanceByBoneMeal. +5 tests (3 service unit, 2 interaction). _(done 2026-06-11)_

- [x] R64. Food table correctness: raw WHEAT removed (not edible in vanilla — only BREAD made
  from wheat is); SPIDER_EYE added (foodLevel=2, saturationModifier=0.1 — matches vanilla drop
  semantics; Poison effect modelled as low saturation). +2 tests (spider_eye edible,
  wheat non-edible); existing WHEAT case in getFoodProperties test updated. _(done 2026-06-11)_

- [x] R65. FLINT item + gravel drop + FLINT_AND_STEEL recipe — GRAVEL now drops FLINT when broken
  (deterministic; vanilla is 10% random); FLINT_AND_STEEL recipe added (FLINT×1 + IRON_INGOT×1).
  FLINT added to ItemTypeSchema, ITEM_TILE_MAP, NON_PLACEABLE_ITEM_TYPES. No new tests needed
  (block drop covered by existing block-service tests via GRAVEL→FLINT override). _(done 2026-06-11)_

- [x] R66. CHARCOAL item + WOOD→CHARCOAL furnace recipe + PLANKS/WOOD/CHARCOAL as fuel — closes
  the early-game bootstrap gap where a new player couldn't light a furnace without finding coal.
  CHARCOAL added to ItemTypeSchema/ITEM_TILE_MAP/NON_PLACEABLE; SMELTING_XP_PER_ITEM.CHARCOAL=0.15.
  No new tests (recipe + fuel covered by existing furnace tests). _(done 2026-06-11)_

- [x] R67. Vanilla-correct light emission for dimmer sources — emissive blocks without an explicit
  override defaulted to 15 (lava brightness). Added REDSTONE_TORCH=7, NETHER_PORTAL=11,
  END_PORTAL_FRAME=1 to EMISSIVE_LEVEL_OVERRIDES so a redstone torch no longer floods a room like
  lava. +3 tests. _(done 2026-06-11)_

- [x] R68. Charcoal crafts torches — CHARCOAL + STICKS → TORCH×4, mirroring the coal variant
  (recipe matching is exact-itemType so charcoal needs its own recipe). Vanilla parity follow-up
  to R66. +1 test. _(done 2026-06-11)_

- [x] R69. Leaves drop apples + sticks — APPLE was unobtainable in survival (nothing dropped it),
  making GOLDEN_APPLE uncraftable from scratch. Breaking LEAVES now has a 1/200 apple chance + 2%
  stick chance (vanilla oak rates). Drop decision extracted to pure `rollLeafDrops(appleRoll,
  stickRoll)` (deterministically testable); handler supplies Math.random(). +8 tests. _(done 2026-06-11)_

- [x] R70. Bed crafting recipe — the BED block was fully wired (respawn-point + night-skip in the
  placement handler) but had NO recipe, so survival players could only get a bed from village
  generation. Added vanilla recipe: 3 WOOL + 3 PLANKS → 1 BED. Same "orphaned output" class as
  R65 (flint&steel) and R69 (apple). +2 tests. _(done 2026-06-11)_

**Round 27 complete.** R59-R70.
typecheck 0, **4621 tests passing** (+26 new tests, 4 updated assertions).

- [x] R71. Chance-gated mob drops + zombie carrot — systematic "orphaned outputs" sweep
  (cross-referenced all 81 item types against recipe outputs, mob drops, fishing loot, drop
  overrides). Found CARROT unobtainable → silently broke **pig breeding** (carrot is the pig's
  breeding item) and made it inedible. Added optional `chance` field to EntityDrop (absent =
  always drops, back-compat) + pure `dropPasses(drop, roll)` predicate; zombies drop CARROT at
  2.5% (vanilla). Kill handler (melee + bow) rolls each chance-gated drop, gating base + looting.
  +4 tests. Remaining orphans are intentionally-deferred End-game items (CHORUS_FRUIT, DRAGON_*,
  ELYTRA, ENDER_EYE, END_CRYSTAL). _(done 2026-06-11)_

- [x] R72. Full-validation sweep of R59-R71 — ran the complete shippability gate (oxlint +
  production build, not just unit tests). oxlint flagged 2 dead imports (createFrameHandlers,
  DeltaTimeSecs) in interaction-stage.test.ts left from prior refactors; removed. **Result:
  lint 0/0, typecheck 0, `pnpm build` exit 0 (fresh dist/ bundle), 4625 tests passing — the
  entire R59-R72 tree is shippable.** _(done 2026-06-11)_

**Round 27 complete.** R59-R72.
typecheck 0, lint 0/0, build exit 0, **4625 tests passing** (+30 new tests, 4 updated assertions).

**Recurring theme (R65/R69/R70/R71):** "orphaned outputs" — blocks/items fully wired
into handlers, textures, and drops but unreachable because a single crafting recipe or drop
source was missing. Invisible to unit tests (each piece passes in isolation) yet they break the
actual survival progression loop. R71 did the systematic sweep; the FR-acquisition surface is
now closed except for deliberately-deferred End-game content.

## AE. Round 28 (2026-06-11) — typecheck mock drift + fiber spawn cleanup

Fresh audit pass found:
- Two test-utility mocks (`block-cycle-test-utils.ts`, `block-service-test-utils.ts`) had
  `collectOutput: () => Effect.succeed(true)` but the interface now requires `{ collected, xp }`
  (changed in R61). vitest passed (esbuild transpiles without structural checking); `pnpm typecheck`
  caught both as TS2375. Classic GOTCHA documented in MEMORY.md.
- `physics-stage.ts` had two lingering `concurrency: 'unbounded'` fiber-spawn patterns:
  - Armor durability damage on hostile hit (4 fibers per hit event)
  - Sprint/sneak input reads (4 fibers every single frame — worst-case ~240 fiber allocs/sec at 60 fps)

- [x] R73. Fix mock drift — `collectOutput` mock in `block-cycle-test-utils.ts` and
  `block-service-test-utils.ts` updated from `Effect.succeed(true)` to
  `Effect.succeed({ collected: true, xp: 0 })`. _(done 2026-06-11)_
- [x] R74. Remove `concurrency: 'unbounded'` from `physics-stage.ts` armor-damage (4 sync Ref writes
  per hit) and sprint/sneak reads (4 sync Set lookups per frame). Added explanatory comments
  mirroring the pattern established in camera-stage and interaction-stage. _(done 2026-06-11)_

**Round 28 complete.** R73–R74.
typecheck 0, lint 0/0, **4625 tests passing** (no new tests — pure correctness + perf fixes).

## AF. Round 29 (2026-06-11) — GPU resource-disposal audit (Three.js VRAM leak)

Hot-path Effect/fiber allocation is now heavily mined (R22/R23/R74), so this round pivoted to a
fresh NFR angle never audited before: **Three.js GPU resource disposal**. `scene.remove()` only
detaches from the scene graph — it does NOT free the WebGL buffers/textures held by
`BufferGeometry`/`Material`/`Texture`; those survive until `.dispose()` is called, and JS GC cannot
reach into the GPU driver. An Explore agent swept chunk meshes, entity renderer, particles, and
post-processing; chunk/entity/particle disposal was confirmed correct (shared caches deliberately
NOT disposed per-removal — verified ownership before recommending). One genuine leak found and
ground-verified against the code before acting.

- [x] R75. Remote-player renderer GPU leak — `remote-player-renderer.ts` built per-player OWNED
  resources inline (6 `BoxGeometry` + 6 `MeshBasicMaterial` + name-tag `SpriteMaterial` +
  `CanvasTexture`) in `createPlayerParts`, but **both** despawn paths (`removePlayer` AND
  `updateFromSnapshot`'s stale-player sweep) only called `scene.remove(group)` — no disposal. In
  multiplayer this is an unbounded VRAM leak on every player join/leave churn. Added a
  `disposeEntry(entry)` helper (`group.traverse` → dispose each geometry + material, with
  `disposeMaterial` also disposing a `SpriteMaterial.map` texture when present) wired into both
  paths. Resources confirmed OWNED (built inline, never shared/cached) so disposal is safe and
  behavior-preserving. +2 tests (removePlayer disposes all 13 node-env resources; updateFromSnapshot
  disposes departed players'); extended the THREE test mock with `traverse` + `dispose` stubs.
  _(done 2026-06-11)_

**Round 29 complete.** R75 (remote-player GPU disposal leak).
typecheck 0, lint 0/0, **4627 tests passing** (+2). Two other disposal gaps recorded as deferred
low-priority below (particle InstancedMesh teardown, entity-pool InstancedMesh teardown — both
session-once cold paths, not unbounded; `InstancedMesh.dispose()` only, geometry/material already
disposed).

**Verified but deferred (recorded, not churned):**
- `particle-system.ts:112` — `scene.remove(mesh)` finalizer disposes geometry+material but not the
  `InstancedMesh` itself. COLD path (once per session teardown), ~200KB, not unbounded. DEFER.
- `entity-instance-pool.ts:226` (`disposeAll`) — disposes each bucket's geometry+material but not the
  `InstancedMesh`. COLD path (session shutdown), 24 buckets. DEFER.

## AG. Round 30 (2026-06-11) — LIVE PLAYTEST feedback (user ran a real world)

The user actually built a world and reported, in rapid succession: 動作が重すぎる / 解像度が低すぎる
/ ジャンプできない / メモリ不足でかくつく / 描画のたびにカクカク / 画面が暗くて視認性が悪い / 矢印キーで
移動したい / CPU・メモリを食いすぎ. I ran the game headlessly (vite + Playwright + the `__TS_MINECRAFT_QA__`
hooks) and measured ground truth before touching anything, then the user asked to stop using Playwright,
so the remaining work is code-only.

**Empirical findings (measured in a running session):**
- **Resolution** — default `medium` preset rendered at `pixelRatioCap: 0.65` (sub-native → permanent
  blur). Root cause certain. FIXED (R76).
- **Jump** — WORKS mechanically: a synthetic `Space` keydown on `document` produced a clean 1.25-block
  jump arc (23.62→24.87→23.62, exactly the vanilla height the code documents). So "can't jump" is an
  **input-delivery** bug, not game logic: `handleKeyDown` never `preventDefault`s, so Space activates the
  focused menu button (the one clicked to start the world) instead of jumping. FIXED (R77).
- **GC stutter (重い/かくつく/CPU・memory)** — confirmed a violent heap **sawtooth**: ~23 MB idle
  amplitude (72→95→72 with the player standing still, zero input) and ~150 MB swings while walking
  (80→233→83). `chunkMeshCount` (~74) and `sceneChildren` (~98) stay STABLE → **not a leak; pure
  transient-allocation churn → frequent major GC → dropped frames**. Disabling mobs/particles/fluid/
  redstone did NOT reduce the idle churn → the allocator is the **core frame pipeline**, i.e. the
  per-frame `Effect.gen` execution across ~15 stages (generators + Effect nodes + continuations every
  frame). This is the architectural cost the brief warns about. NOT yet fixed — needs a measured refactor
  (see plan below); recorded honestly rather than patched speculatively.
- **Dark / poor visibility** — at NOON the world is dim grey. Player spawned at y≈23.6 (below SEA_LEVEL
  48) facing a shadowed cliff; terrain shader floor is `0.38 + 0.62·lightFactor` so unlit faces sit at
  38% of an already-grey stone texture. Largely a location effect, but the 0.38 min-light floor is low
  for visibility. Candidate fix logged (R78, not yet done).

- [x] R76. Native-resolution default — `settings-service.config.ts` pixelRatioCap raised
  low 0.5→0.75, medium 0.65→1.0 (native), high 0.85→1.25, ultra 1.25→2.0. Monotonic ordering preserved;
  all within schema [0.5,2.0]. Tuning comment rewritten to explain the sub-native blur tradeoff.
  Settings tests assert ordering (not exact values) → green. _(done 2026-06-11)_
- [x] R77. Arrow-key movement + game-key preventDefault — `key-mappings.ts` MOVE_*_ALT (Arrow*),
  `movement-service.getInput` OR-combines WASD|arrow per direction (`isDirPressed`), and
  `input-service.handleKeyDown` `preventDefault`s Space/arrows/PageUp/Down when no text field is focused
  (fixes both the Space-eaten-by-button jump bug and arrow-key page-scroll; world-name typing preserved).
  +5 tests. _(done 2026-06-11)_

**OPEN — CPU/memory churn (the top user complaint; needs a dedicated measured round):**
- [~] R-perf-1. Reduce per-frame allocation in the unconditional hot stages (camera/physics/render/hud/
  lighting + `gameState.update`/`movementService.getInput`). Convert the hottest `Effect.gen` stages to
  pre-built Effects or plain mutable sync where behavior-preserving; reuse scratch objects for the
  per-frame `{x,y,z}` returns (getVelocity/getPosition/resolveBlockCollisions). Measure heap-churn
  amplitude before/after (target: flatten the idle sawtooth). Must be done incrementally with the QA
  heap-sampling harness as the regression gate.
  - [x] Increment 1: `movementService.getInput` (runs every frame in gameState.update) was using
    `Effect.all([...], {concurrency:'unbounded'})` (outer 7 + inner 2) over synchronous HashSet reads —
    ~9 fibers/frame for zero parallelism. Converted to sequential `yield*` (no fibers, no intermediate
    arrays/tuple). 55 movement tests still green. _(done 2026-06-11)_
  - Verified clean (no action): physics-stage `concurrency:'unbounded'` at lines 242/431/436/458 are all
    inside event branches (fish caught / block break-place / portal), NOT per-frame; first-person-camera
    `Effect.all` is one-time construction, its per-frame `update` is already sequential. R74 already
    cleaned physics-stage's per-frame reads. So `getInput` was the last per-frame fiber-spawner.
  - Remaining (needs measured/architectural round): the dominant idle churn is the `Effect.gen`
    execution across ~15 stages per frame (generators + Effect nodes). Reducing it = convert hottest
    stages to pre-built/sync — large, must be gated on in-browser heap measurement (deferred while
    Playwright is off). Per-frame `{x,y,z}` scratch reuse is deferred (shared-mutable-return footgun).
  - [x] Increment 2 (measurement-unblock): the `?debug=perf` HUD (`perf-hud.ts`) tracked FPS/p50/p99/
    Calls/Chunks/Queue but NOT JS heap — the one number that exposes the GC sawtooth. Added a live
    `Mem:` line (`performance.memory.usedJSHeapSize` in MB; '--' where the API is absent) + `heapMb`
    in the snapshot. Read-only, gated behind `?debug=perf` (zero normal-play impact). Lets the user
    self-report heap/FPS so the architectural refactor can be regression-gated WITHOUT interactive
    Playwright. _(done 2026-06-11)_
  - Audit conclusions this round (no change, recorded): shadow map is 2048² (reasonable, not oversized);
    a blind FPS cap is NOT safe to add without measurement — jitter/tolerance mis-tuning can accidentally
    halve a 120 Hz display, and the cap interacts with the FPS-derived chunk budgets — so it needs a
    settings field + measurement, deferred. The hot paths are otherwise already well-budgeted.
- [x] R-perf-3. **FPS cap (the deferred cap above, now made safe).** `requestAnimationFrame` fires at the
  display refresh rate, so on a 120/144/240 Hz monitor the full simulate+render pipeline ran 2-4x more
  often than needed — burning ~one CPU core continuously (the "CPUを食いすぎ" report). `game-loop.ts` now
  throttles emission to `TARGET_FRAME_RATE=60` via a pure carry-over accumulator `advanceFramePacing(acc,
  gap, interval)`: it accumulates the *remainder* each frame so the long-run emit rate converges exactly on
  60 (this is what makes it safe — `now - lastOffered` would undershoot on non-integer-multiple refresh
  rates and could halve a 60 Hz display under jitter, the exact failure the prior round flagged). The
  accumulator is clamped to `interval*2` so a background-tab pause can't unleash a frame burst on resume;
  the setInterval fallback path (already ~60) is untouched; displays at/below 60 Hz are unaffected.
  +6 pure unit tests (`game-loop-pacing.test.ts`); 469 game tests + typecheck green. _(done 2026-06-11)_
- [x] R-perf-2. New-chunk load+mesh upload spike while moving (150 MB swings). **Root cause found by a
  map→adversarial-verify workflow + hand ground-verification: the worker→BufferGeometry→scene path was
  ALREADY budgeted per frame** (time budget `WORLD_RENDERER_TIME_BUDGET_MS` + hard cap
  `MAX_CHUNK_UPDATES_PER_FRAME` + requeue in `world-renderer-chunk-sync.ts:103-125`, mirroring the
  dirty-chunk flush). So "add a budget" was a non-fix (adversarially confirmed). The real bug: both budget
  mirrors derive their caps from `DEFAULT_TARGET_FPS`/`RENDERING_DEFAULT_TARGET_FPS = 120`, but the most
  recent commit R-perf-3 pinned the game loop to `TARGET_FRAME_RATE=60`. Budgeting at 120 while running at
  60 **doubled** the per-frame staging caps (16 new + 8 dirty instead of the intended 8 + 4), amplifying the
  spike. Fix: retarget both defaults 120→60 (the helpers were explicitly designed so 60fps reproduces the
  historical 8/4/4ms values; frame-budget.ts:10-11). Halves per-frame chunk-geometry staging (16→8 new,
  8→4 dirty); time budget 2→4ms is in the forkDaemon maintenance loop (independent of the render frame, so
  frame-safe). **Throughput unaffected** — adversarially verified: chunk LOADING is capped at ~20/sec
  (`MAX_CHUNK_LOADS_PER_CALL=4` + 200ms gap), 24× below even the reduced 480/sec mesh budget, so loading
  stays the bottleneck and pop-in speed is unchanged. NOTE (honest scope): this reduces the per-frame
  allocation/GPU-upload-batch rate but does NOT fully flatten the 150MB walking swing — the residual is
  terrain-gen + worker-meshing transients + the per-frame `Effect.gen` pipeline (R-perf-1, measurement-
  gated). typecheck 0; frame-budget(22)/world-renderer/chunk-sync/frame-maintenance/game-loop — 121 tests
  green. _(done 2026-06-11)_
- [x] R78. Brightness/visibility — raised the terrain min-light floor `0.38 -> 0.45` in BOTH chunk
  materials (`chunk-mesh-materials.ts:124,205` `diffuseColor.rgb *= (0.45 + 0.55*lightFactor)*...`;
  greedy-meshing-accumulator.ts comment synced). Full-bright unchanged (0.45+0.55=1.0); caves/shadows now
  readable without abandoning the light-up-with-torches gradient. _(done 2026-06-11, commit 34533e25)_

## AH. Round 31 (2026-06-11) — texture/graphics rendering-correctness audit (user-requested)

User asked to verify, from the codebase, that textures + graphics render correctly. Ran a 4-inspector
+ adversarial-verify workflow over: (1) atlas load + color space + filtering, (2) UV/tile-index mapping,
(3) materials/shaders/transparency, (4) renderer config + post-processing output. **Verdict: the pipeline
is fundamentally CORRECT.** Verified-clean (file-cited): atlas `colorSpace = SRGBColorSpace`,
`magFilter = NearestFilter` (crisp pixels), per-face textures (grass top/side/bottom), greedy-quad UVs
repeat per-block (not stretched), HALF_TEXEL bleed inset, lighting clamped to [0,1], GLASS/LEAVES
alphaTest/depthWrite/DoubleSide, renderOrder opaque<water<transparent, `renderer.outputColorSpace = sRGB`
+ ACESFilmic tone-mapping + a single final `OutputPass` (linear→sRGB exactly once), pixel-ratio caps (R76),
composer chain always executes. One false positive (dead `createSolidColor`) was dismissed by the verifier.

- [x] R79. Hotbar atlas color-space mismatch — the SAME `/textures/atlas.png` was loaded two ways with
  inconsistent tagging: the world path (`buildAtlasTexture`, chunk-mesh-materials.ts:28) set
  `colorSpace = SRGBColorSpace`, but `TextureService.load()` (texture-loader.ts, used by the hotbar at
  hotbar-three.ts:47) **omitted it** → defaulted to linear. Under `renderer.outputColorSpace = sRGB` the
  untagged texture skips the sRGB→linear decode, so hotbar item icons rendered at a different brightness
  than the identical block in the world. Fix: tag `texture.colorSpace = SRGBColorSpace` in both `load()`
  and `createSolidColor()` (same correctness fix; the latter is currently dead code but kept consistent).
  +1 regression assertion (createSolidColor colorSpace). typecheck 0; texture-loader(10) + hotbar-three(17)
  = 27 tests green. _(done 2026-06-11)_

- [x] R80. Atlas mipmaps cross-tile bleed at distance — **RESOLVED BY DECISION (keep current config):**
  `buildAtlasTexture` uses `generateMipmaps=true` + `NearestMipmapNearestFilter` + `anisotropy=8`
  (chunk-mesh-materials.ts:22-24). The HALF_TEXEL inset guards rasterization edges but not mipmap
  downsampling, so distant blocks can show slight tile bleed (e.g. grass↔dirt). Reviewed the tradeoff and
  chose to **keep mipmaps ON**: for a voxel game, distant-terrain anti-aliasing is worth more than
  eliminating a subtle, unreported edge-bleed; disabling mipmaps would reintroduce far-terrain shimmer.
  The artifact-free *and* AA-preserving fixes (per-tile texture-array, or a padded-gutter atlas + UV-math
  change) are medium-large changes touching atlas generation + the shader — disproportionate risk against a
  verified-correct pipeline with no concrete visual complaint. Revisit only if distant tile-bleed becomes a
  reported issue. _(decided 2026-06-11; no code change)_

**Code-only convergence reached (2026-06-11).** A fresh 3-lens correctness audit (physics/movement,
save-load/lighting/day-night, orphaned-FR/data-correctness), each cross-checked against this 31-round plan
and adversarially verified, returned **ZERO new actionable items**. Combined with 30 prior rounds this
confirms the code-only frontier is mined out. The one remaining high-value item — **R-perf-1** (the
per-frame `Effect.gen` pipeline architectural refactor, the dominant idle-GC-sawtooth source) — is
**blocked on in-browser heap measurement** (Playwright disabled by user request after R30). It cannot be
done safely blind: unlike removing provably-redundant allocations, converting hot stages to mutable/
pre-built changes behavior in ways only heap measurement can regression-gate. **Recommended path to resume
high-value NFR work:** re-enable the QA heap-sampling harness (the `?debug=perf` HUD `Mem:` readout already
exists) so R-perf-1 can proceed increment-by-increment with a measured before/after gate.

## AI. Round 32 (2026-06-11) — deep per-frame allocation census (supersedes the "convergence" note above)

The Round-31 convergence note was **premature**: it relied on a shallow 3-agent audit. A deeper
**14-agent line-by-line allocation census** (6 inventory agents over every hot stage + adversarial
verifiers) found **5 genuine per-frame allocations** the shallow pass missed, and correctly rejected 3
false candidates (one deferred-by-governance, two with factual errors). Filtering the 5 by the plan's OWN
precedent — *local literals hoistable without measurement* (T1-class) are landable; *function-return
scratch reuse* and *game-state `{x,y,z}` work* are the measurement-gated R-perf-1 footgun scope — yields
2 clean wins landed now and 3 deferred.

- [x] R81. Two measurement-free per-frame local-literal eliminations (T1-class):
  - `interaction-stage.ts` — the 8-field `RedstoneFlags` object was built **unconditionally every frame**
    but only consumed inside `if (hasRedstoneInput)` (rare). Moved its construction *into* that branch
    (code motion, not scratch reuse) → **zero allocation on the common path**, no module state added. The
    8 `consumeKeyPress` edge-reads stay every-frame (they drain the input queue).
  - `lighting-stage.ts` — the `{ isNight, playerPosition }` music-context literal (allocated every frame,
    passed to `musicManager.updateFromContext`) → reused a module-scoped scratch (fields overwritten each
    frame; the service reads them synchronously via `environmentFromContext` and never retains the object).
  - typecheck 0; interaction-stage(40) + redstone(9) + lighting(6) + music(7) + redstone suites = 136 tests
    green. _(done 2026-06-11)_

- [ ] R-perf-1 increment candidates (DEFERRED to the measured round — the deep census located them but they
  fall inside the measurement-gated / footgun scope, so they wait for the heap harness):
  - `game-state-service.ts:250-254` `resolvedVel` `{x,y,z}` — local temp, technically safe per one verifier,
    but game-state per-frame `{x,y,z}` work is explicitly measurement-gated under R-perf-1 (a sibling
    candidate at :210 was rejected on this exact governance ground). Defer for consistency.
  - `movement-service.ts:95` `getInput` MovementInput **return** object — exactly the shared-mutable-RETURN
    footgun R-perf-1 defers (a reused return could be retained by a future caller). Defer.
  - `physics-stage.ts:45` per-frame `Ref.make(initialPlayerPos)` → module `MutableRef` — safe in principle
    but a mechanism change (Effect.Ref→MutableRef access pattern) across the largest stage; pair with the
    measured round.

## AJ. Round 33 (2026-06-11) — LIVE Playwright verification (measurement unblocked)

User re-enabled Playwright MCP. Launched the game in a real browser (network IP, since the MCP browser's
`localhost` is a different host) with `?debug=perf` and drove the menu → New World → Survival.
**Verified live:** 0 console errors, WebGL works, stable **60 FPS** (R-perf-3 cap confirmed; p50 16.7ms /
p99 17.6ms — no stutter), 69 chunk meshes all `textureLoaded:true` + `hasUv` + `hasTileIndex` (textures
render correctly — corroborates R79 + the graphics audit), frustum culling 27/69 visible, chunk budget
drains (Queue 0). **Idle JS-heap sawtooth measured = 24.1 MB** (R30's ~23 MB unchanged → R-perf-2/R81
correctly did not move it; the idle churn is the per-frame `Effect.gen` pipeline = R-perf-1), but BENIGN:
3 minor GCs / 8s with FPS holding 57–62, no frame stalls. R30's original complaints
(重い/カクつく/解像度/ジャンプ) are resolved by R76/R77/R-perf-2/R-perf-3. Limitation: synthetic WASD does
not move the player (movement is pointer-lock-gated; Playwright headless can't grant lock).

## AK. Round 34 (2026-06-11) — control/operability fixes (user playtest feedback)

User reported: "ジャンプしてブロックを飛びこえられない / ESCでフォーカスがはずれない / 操作性が全体的におかしい".

- [x] R82. Air control — "can't jump over blocks" root cause. `game-state-service.ts:177,179` only applied
  horizontal input velocity when grounded (`x: isGrounded ? velocity.x : currentVel.x`); airborne it was
  frozen. So walking into a 1-block wall zeroed forward velocity (collision), and jumping could not
  re-apply it mid-air → the player rose straight up against the wall and fell back. Jump height (1.27
  blocks) was never the problem. Fix: while airborne, if a movement key is held apply the full input
  velocity (steer mid-jump → clear the block); with no input, preserve momentum. Grounded + flight keep
  full control via their own branches. Updated the respawn test (was asserting the old no-air-control
  behavior with `forward:true`) + added an air-control regression test. typecheck 0; 150 game tests green.
  _(done 2026-06-11)_
- [x] R83. ESC focus-release + stuck-keys — found by a 14-agent control/operability audit (4 lenses +
  adversarial verify; 8 bugs confirmed, 2 false positives dismissed). Landed the two highest-value:
  - **ESC doesn't release focus (the reported bug):** `browser-runtime.ts` re-requested pointer lock on
    EVERY canvas mousedown, including while the pause menu is open. So ESC freed the cursor (browser-native)
    but the next click (e.g. a pause-menu button) instantly re-captured it → focus felt stuck. Fix: thread
    `gamePausedRef` into the bridge and skip the lock request while paused.
  - **Stuck keys:** no `blur` handler cleared held input. Holding W then switching tab/window left 'KeyW'
    pressed forever (browser sends no keyup while unfocused) → player kept walking on return. Fix: a
    `window 'blur'` handler in `input-service.ts` clears pressedKeys/justPressedKeys/mouseButtons. +1
    regression test (blur clears held key); browser-runtime + input-service test mocks updated (window mock
    gained addEventListener). typecheck 0; 132 tests green. _(done 2026-06-11)_
- [ ] R84. Auto step-up (MEDIUM, confirmed by the audit) — no auto-climb of ~0.6-block heights (vanilla),
  so the player catches on slabs/paths/single steps and must jump everything. Complements the R82 air-control
  fix; deferred to its own round (collision-resolver change + tests).
- Deferred low/medium from the control audit: speculative `pointerLockFallbackRef=true` before request
  resolves (input-service.ts:186 — harmless today due to OR-with-DOM-state); pause-menu explicit
  exitPointerLock (edge-case, browser handles ESC natively); hotbar rapid-multi-press slot selection.

## AL. Round 35 (2026-06-11) — movement stutter: budget chunk disposal (R85)

User: "移動しまくるとカクつく" (stutters when moving a lot). LIVE Playwright measurement (now that movement
works via synthetic input post-R82): the game's *internal* p99 stayed flat at 17.6ms during movement, but
external rAF timing caught frames >25ms — i.e. the spike is on the render/chunk-churn path, not simulate.
An 8-agent diagnostic workflow (3 lenses + adversarial verify) reached strong consensus on the cause.

- [x] R85. Budget chunk removal/disposal — `world-renderer-chunk-sync.ts` disposed ALL stale chunks in one
  frame (the add path was budgeted to 8/frame; removal had NO cap — the code comment even said "removal is
  always immediate"). Crossing a chunk boundary while moving stales a whole row at once → up to ~17-56
  chunks × 1-3 meshes = ~150 synchronous `geometry.dispose()` → WebGL `deleteBuffer` calls in ONE frame =
  a 30-100ms stall. Fix: cap removals at `MAX_CHUNK_REMOVALS_PER_FRAME` (= half the add cap = 4 @60fps) via
  `Arr.take`; unprocessed stale chunks stay in the mesh map and dispose next frame (return
  `allNewChunksMeshed && allStaleRemoved` so the caller re-fires until drained). Safe: steady churn is
  load-throttled to ~20/s (≪ 4/frame×60) so stale chunks never accumulate, and the deferred ones are just
  off-screen edge chunks rendered 1-3 extra frames. Mirrors the budgeted add path exactly. typecheck 0; 77
  world-renderer/frame-budget tests green; live boot 0 errors / 60fps. _(done 2026-06-11)_
- [ ] R86. Chunk EVICTION does synchronous IndexedDB saves (`chunk-manager-service-ops.ts`) — also flagged
  unbudgeted by the diagnosis (up to ~60 evictions/frame with per-chunk `saveChunk`). NEEDS VERIFICATION
  that it's on the per-frame path (vs the throttled load schedule) before fixing; the fix (per-frame unload
  budget + `forkDaemon` the IDB write) carries data-integrity risk, so deferred to its own round.
- [ ] R-leaves. Tree leaves too transparent ("木の葉っぱが透けすぎてる") — the leaves atlas tile is fully
  opaque (no alpha gaps) so the only see-through is the shared material's `opacity:0.6` blend (also used by
  glass). Proper fix = regenerate tile 8 with transparent leaf gaps + render leaves as opaque cutout
  (opacity 1.0 + alphaTest), separate from glass's blend. Diagnosed; queued (texture regen + material split).

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
- [x] R10. Breeding grants the player XP — entity-manager `birthsRef` incremented per baby in the breeding
  pass + `drainBirths()`; entity-update-stage drains it each tick and awards `births * BREED_XP_REWARD` (4).
  Mirrors the drainBlockEdits pattern. +1 e2e assertion; mock + xpService Pick updated. _(done 2026-06-10)_

## H. Round 5 (2026-06-10) — sheep shearing (new FR, decomposed into certain steps)

- [x] R11a. SHEARS item data foundation — `'SHEARS'` added to `ItemTypeSchema`, `ITEM_TILE_MAP` (tile 55,
  iron-tool atlas), and `NON_PLACEABLE_ITEM_TYPES`. tsc's exhaustive `Record<InventoryItem,number>` confirms
  every ItemType consumer handles it; 70 item-type tests green. _(done 2026-06-10, e7133604)_
- [x] R11b. Shearing entity-side — pure `shearing.ts` (canBeSheared / shearWoolCount [deterministic 1-3 from
  id hash, no RNG] / tickWoolRegrowth [clamps at 0, preserves idle early-return]); `ManagedEntity.woolRegrowthTicks`;
  `EntityManager.shearEntity` (Some(count)+regrowth for a woolly sheep, None otherwise, mirrors feedEntity);
  self-contained regrowth countdown pass in the update loop (mirrors creeper-fuse pass; unprojected field → no
  cache invalidation). +9 tests; 74 existing entity tests green; typecheck 0. _(done 2026-06-10, dc09cff0)_
- [x] R11c. Shearing app-side — `handleShearAnimal` (look at sheep + hold SHEARS → shearEntity → add 1-3 WOOL +
  cue; shears not consumed); right-click priority shear > feed > eat > farm > ignite > place; test-kit gains
  shearEntity/feedEntity mocks. +4 tests; interaction suites green; typecheck 0. Sheep shearing end-to-end
  playable: shear → wool → ~5min regrowth → reshearable. _(done 2026-06-10, 914e0091)_
- [ ] R11d. (Optional polish, deferred) Visual bald-sheep render while sheared — would project `sheared` onto
  the public Entity (needs cache invalidation on the regrowth transition) + a sheared-sheep texture/scale swap
  in entity-renderer. The mechanic is complete without it; purely cosmetic.

## I. Round 6 (2026-06-10) — fresh parallel audit: per-edit allocs + FR gap

Three independent agents re-audited the hot path, FR completeness, and architecture quality.
Confirmed new issues (not covered in earlier rounds):

- [x] R12. `greedyMeshChunk` rebuilds two `Uint8Array(256)` transparent-block lookup tables on **every
  call** (`greedy-meshing.ts:52-55`). Fix: `WeakMap<ReadonlySet<number>, Uint8Array>` cache at module
  scope — built once per unique Set instance. _(done 2026-06-10)_
- [x] R13. `frame-maintenance.ts:157-163` double `getVillages()` + temporary `Set+map` array per tick.
  Fix: cache pre-update count; skip Set/filter entirely when village count hasn't grown. _(done 2026-06-10)_
- [x] R14. `entity-update-stage.ts:76-82` fresh 9-element `Array<Chunk|null>` on every chunk-boundary
  crossing. Fix: mutate existing array in-place via `.fill(null)` + slot assignment; remove `nextChunkCache`
  intermediate variable. _(done 2026-06-10)_
- [x] R15. `spawn-selection.ts` — **already wired**. `session.ts:166` calls `buildSpawnSelection` which
  delegates to `selectSurfaceSpawn`. Audit agent misread untracked file status as "no call sites". _(verified 2026-06-10, no change needed)_
- [x] R16. `interaction-placement-handler.ts:42-45` — dead-code TODO stub (`hitBlockType = indexToBlockType(0)`,
  empty `if` block). The actual TNT/block-type lookup already exists at line 53 via async chunk fetch.
  Removed the stub. _(done 2026-06-10)_
- [x] R17. Network package test coverage — **already adequate**. `schemas.test.ts` has `it.each` round-trip
  tests for all 9 message types; infrastructure layer (browser/Node WebSocket) is intentionally in
  `.skip` (requires real WebSocket env). 35 tests / 3 files = well-targeted, not a real gap. _(verified 2026-06-10)_

**Round 6 complete.** All 4 commits: typecheck 0 errors, 4475 tests passing.

## J. Round 7 (2026-06-10, Opus 4.8) — fresh audit of least-examined subsystems

Three breadth agents re-audited rendering frame-stages, inventory/crafting/furnace, and
terrain/light/fluid hot loops. Every finding below was **re-verified by hand against the code
and call sites** before landing (last round had several false positives, so verification is mandatory).

**Verified & actioned:**
- [x] R18. `getChunkLoadOffsets` (`chunk-coord-utils.ts:45-54`) rebuilt the offset list from scratch on
  every call — 5 array allocations + a sort over up to ~441 elements, ≈5×/sec during movement. Memoized by
  `renderDistance` in a module-level `Map` (offsets are a pure function of distance ∈ [2,16]). Callers treat
  the result as immutable, so the shared cached array is safe. _(done 2026-06-10)_
- [x] R19. `refreshChunkCache` (`game-state-service.ts:39`) allocated a fresh 9-element array via
  `Array.from({length:9})` on every chunk-boundary crossing (twin of the R14 entity-update fix). Now mutates
  the existing cache array in-place (`.fill(null)` + slot assignment); dropped the redundant `Ref.set`. _(done 2026-06-10)_
- [x] R20. Dead `null`-based `FurnaceState` type (`furnace-state.ts:18-21`) had zero consumers and
  contradicted the project-wide `Option` idiom (the live type is in `furnace-service-utils.ts`). Removed it
  + the now-unused `HashMap` import; left a pointer comment to the canonical definition. _(done 2026-06-10)_

**Verified but deferred (recorded, not churned):**
- world-renderer / refraction `currentPose` object literal per frame — only saves an allocation when the
  camera is *perfectly still* (rare during play); the surrounding change-detection is carefully tuned.
  Low value, refactor risk. DEFER.
- Light BFS queue allocation (`block-light-bfs.ts`) — per block-edit, not per-frame, and bounded by
  `FULL_RECOMPUTE_THRESHOLD=256`. Fluid per-tick `Ref.make` — only when the frontier is non-empty, bounded
  by `FLUID_TICK_BUDGET=512`. Both are working, bounded code; pooling would add complexity for negligible
  gain. DEFER (matches Round-3's "subsystems are sound" finding, now re-confirmed with line-cited evidence).
- Shift-click stacking / recipe book — intentional Phase-12 scope cuts per the prior phase docs. DEFER.

**FR gap closed:**
- [x] R21. SHEARS had **no crafting recipe** — sheep shearing shipped in Round 5 (R11) but shears were
  obtainable only in creative, breaking the survival loop for that feature. Added a vanilla-accurate recipe
  (2 IRON_INGOT → 1 SHEARS, `crafting_table`) to `misc-recipes.ts` + a focused craft test. _(done 2026-06-10)_

**Round 7 complete.** R18-R20 perf/cleanup + R21 FR gap. typecheck 0 errors, 4476 tests passing (+1 new).

## K. Round 8 (2026-06-10, Opus 4.8) — entity-tick / raycast / particle audit

Three breadth agents audited the entity AI tick, per-frame raycast/targeting, and the
particle + autosave subsystems. Particle pool (pre-allocated 512-slot, in-place swap-free
sweep) and autosave (forkDaemon, dirty-only chunk saves) re-confirmed **exemplary, no action**.
All actioned findings ground-verified against the code first.

**Verified & actioned:**
- [x] R22. The entity `update()` runs **three** sequential `HashMap.map` passes per tick
  (`entity-manager-internal-update.ts`: AI@50, creeper-fuse@176, wool-regrowth@194). Effect's
  `HashMap.map` rebuilds the whole HAMT even when every mapper returns the value unchanged — so the
  creeper and wool passes each cost a full O(N) trie rebuild **every frame even when zero creepers /
  zero sheared sheep exist** (the common case — creepers are dark-only, sheared sheep self-heal in
  ~5min). Fix: detect creeper/sheared-sheep presence *during* the AI pass (already iterating every
  entity), then **guard** passes 2 & 3 on those flags. Skipping a pure-no-op rebuild is behavior-
  preserving. Low risk (guards only; pass logic untouched).
- [x] R23. `findAttackableEntity` (`attack-targeting.ts:12,23`) allocated `1 + N` `THREE.Vector3`
  per call (`cameraDirection` + one `toEntity` per entity). Fires on every attack/feed/shear click
  (frequent in combat). Replaced with a module-scoped scratch for `getWorldDirection` + pure scalar
  dot/lengthSq math — zero per-call vector allocation. 8 attack-targeting tests confirm identical
  targeting behavior. _(done 2026-06-10)_

**Round 8 complete.** R22 (skip no-op entity HashMap passes) + R23 (scalar attack targeting).
typecheck 0 errors, lint 0/0, 4476 tests passing.

## L. Round 9 (2026-06-10, Opus 4.8) — FR rebalance + unexamined-NFR sweep

Hot-path NFR is now heavily mined (8 rounds), so this round rebalanced toward FR completeness
(block-break → drop → pickup loop, tool/mining mechanics) plus an NFR sweep of three never-audited
subsystems (sound, redstone, worker protocol). All findings ground-verified.

**Verified & actioned:**
- [x] R24. Ore drop quantities — `block-service.ts:118` hardcoded the base drop to **1** for every block.
  Vanilla drops **4-5 redstone** and **4-9 lapis** per ore; at a flat 1 those resources were ~4× scarcer
  than vanilla. Added a deterministic (RNG-free) `getBlockDropCount` returning the vanilla *minimum*
  (redstone/lapis + deepslate variants → 4, default → 1), wired into `breakBlock`. Fortune bonus still
  adds on top, unchanged. +1 test (redstone ore → 4 dust). _(done 2026-06-10)_

**Round 9 complete.** R24 (vanilla ore drop counts). One agent finding rejected as a verified false
positive (worker `.slice()` — the "fix" would corrupt chunks). typecheck 0, lint 0/0, 4477 tests passing (+1).

## M. Round 10 (2026-06-10, Opus 4.8) — survival FR gap: light-level mob spawning

A survey ranked the remaining survival-FR gaps by impact ÷ size. Top small win: **light-level hostile
spawning**. Currently hostile mobs spawn anywhere at night regardless of torches — the core
defend-with-light mechanic is absent. Ground-verified the wiring (spawn resolver has the chunk; chunk
carries nibble-packed `blockLight`; `getLightAt` reads it; `isNight` derivable from `timeOfDay` already
in the maintenance scope).

**Verified & actioned:**
- [x] R25. Light-level hostile spawning — added `HOSTILE_SPAWN_MAX_BLOCK_LIGHT = 7` to spawner-config;
  extended `resolveTerrainSpawnPosition(chunk, candidate, isHostileSpawn?)` to reject the spawn voxel when
  `isHostileSpawn && getLightAt(blockLight) > 7`. The maintenance spawn closure derives `isNight` from the
  already-fetched `timeOfDay` and passes it. blockLight-absent reads as 0 (dark) → only *adds* suppression
  where light exists, never blocks dark areas. No spawner signature change. +2 tests (lit→reject, dark→allow).
  Torches now suppress hostile spawns — the "light up your base" mechanic works. _(done 2026-06-10)_

**Round 10 complete.** R25 (light-level hostile spawning). One agent finding rejected as a verified false
positive (`despawnFarEntities` is called). typecheck 0, lint 0/0, 4479 tests passing (+2).

## N. Round 11 (2026-06-10, Opus 4.8) — FR: water/lava buckets

Chose the lowest-risk *complete* feature from the deferred list: water/lava buckets. Self-contained
(no new service, no per-frame tick) — builds on existing fluid primitives (`seedWater`/`seedLava` create
source cells, `removeWater`/`removeLava` clear them). Crop growth (the #1-ranked gap) stays deferred: the
flat block-ID model has no per-block metadata, so it genuinely needs a new side-table service + maintenance
tick + maturity-aware harvest + persistence — a dedicated multi-commit round, not a "small sure step".

- [x] R26a. Foundation — added `BUCKET`/`WATER_BUCKET`/`LAVA_BUCKET` to `ItemTypeSchema`; satisfied the one
  tsc-enforced exhaustive Record (`ITEM_TILE_MAP`: empty→iron-ingot tile, water/lava→fluid tiles); added all
  three to `NON_PLACEABLE_ITEM_TYPES`. typecheck 0. _(done 2026-06-10)_
- [x] R26b. Bucket use-handler — `handleBucket` in interaction-placement-handler: FILL (empty BUCKET aimed
  at a WATER/LAVA source → `removeWater`/`removeLava` + swap to the filled bucket) and EMPTY (filled bucket →
  `forceSetBlock` + `seedWater`/`seedLava` at the air cell adjacent to the targeted face + swap to empty
  BUCKET). Wired into the right-click chain (farm → **bucket** → ignite → place); `fluidService` added to the
  interaction-stage Pick. The fluid service's seed/remove helpers write the block themselves, so the handler
  reuses the existing placeBlock fluid flow. +5 tests (empty water/lava, fill from water, non-fluid no-op,
  non-bucket no-op). _(done 2026-06-10)_

**Round 11 complete.** R26a+R26b — water/lava buckets (fill & place). Crop growth remains the top deferred
gap (warrants a dedicated round: needs a new side-table service for per-block growth state). typecheck 0,
lint 0/0, 4484 tests passing (+5).

**Verified FALSE POSITIVE (recorded):**
- `despawnFarEntities` was flagged "NOT called automatically in frame loop" — **wrong**, it's called at
  `frame-maintenance.ts:122` every maintenance tick. NO CHANGE.

**Verified but deferred (recorded, not churned):**
- Crop growth + harvest (no `age` on WHEAT_CROP, no growth tick, no harvest) — genuine gap but needs a new
  growth service + frame-loop hook + block-state change. Larger; logged for a dedicated future round.
- Buckets, doors, chests — absent; each is a multi-file feature (new item/block types + handlers + UI for
  chests). Logged. Sleep lacks a monsters-nearby check (minor vanilla fidelity). All deferred.

**Verified FALSE POSITIVE (recorded — the "fix" would be a bug):**
- Worker mesh-request `ArrayBuffer.slice()` (`meshing-worker-pool.ts:184-208`) was flagged HIGH ("avoid
  the copy, transfer the original"). **Rejected — acting on it would corrupt every meshed chunk.** The
  sliced buffers are added to `transferList` and *transferred* (neutered) into the worker; the original
  `chunk.blocks` must survive on the main thread (still rendered/edited/saved). Slicing a disposable
  snapshot to transfer is the correct, idiomatic pattern. NO CHANGE.

**Verified but deferred (recorded, not churned):**
- Item-drop entities + pickup radius, and hold-to-break / hardness mining time — both ABSENT (blocks go
  straight to inventory, instant break). These are large features (world item-entities + physics + pickup;
  per-frame break-progress + crack animation), not quick wins. Tool-tier *requirements* ARE fully
  implemented (`block-utils.ts canHarvestBlock`). Logged as known simplifications, deferred.
- Sound `computeSpatial` returns a fresh `{x,y,z}` per effect — event-driven, not per-frame; returning a
  shared mutable scratch from a function is a footgun (caller may retain it). Low value, real risk. DEFER.
- Redstone button-array alloc in `computeNeedsPropagation` — per-tick but throttled to 20/sec and bounded
  by button count. Negligible. DEFER. (Tick cadence 50ms + active-component-only propagation confirmed sound.)

**Verified but deferred (recorded, not churned):**
- Enderman teleport `Array.from({length:32})` (`update.ts:29,123`) — only for an Enderman in Chase
  state passing a ~5%/tick probability gate; rare. Avoiding it needs a signature change to
  `computeEndermanTeleportTarget` (closure instead of array). Low real-world impact. DEFER.
- Per-mob motion `Vector3` allocations (`computeStateVelocity` + `state-machine.ts` normalize/subtract/
  scale) — one per *active* mob per tick. This is the immutable-vector-math design cost; rewriting to
  in-place math touches unit-tested pure functions across the domain. Disproportionate risk. DEFER.
- Per-entity `{...entity}` spreads in the AI loop — the immutable-update pattern, already mitigated by
  the idle early-return (line 103). Acceptable design cost. DEFER.

---

## AM. Round 36 (2026-06-11) — deep cross-subsystem audit (per-frame allocs, LOD, fiber hygiene, gameplay gaps)

A comprehensive multi-lens audit covering: (1) per-frame heap allocation census across all hot stages,
(2) LOD correctness and meshing worker path, (3) Effect-TS fiber/scope hygiene, (4) gameplay feature gaps
(tools, crafting, visuals). Findings verified against source before landing. R-numbers continue from R86.

---

### Critical Issues

1. **Per-frame `Ref.make` allocation in physicsStage** —
   `packages/app/application/frame/stages/physics-stage.ts` line 45 calls `yield* Ref.make(inputs.initialPlayerPos)`
   (`finalPosRef`) on every frame. At 60 fps this is 3,600 new mutable-cell objects/minute feeding the GC minor
   heap. All other per-frame state uses `MutableRef` hoisted into `FrameStageRefs`. This is the last outlier.

2. **Per-frame `Effect.gen` generator spin-up in processFrames** —
   `packages/game/application/game-loop.ts` lines 134–147 rebuild `Effect.gen(function* () {...})` on every
   dequeued frame command, allocating a fresh generator object per frame. The `Effect.gen` body wraps the
   entire frame-dispatch. This is the dominant idle GC-sawtooth source (confirmed by R30 heap measurement).

3. **`captureCameraPose` allocates a 12-field object every frame (called twice)** —
   `packages/app/application/frame/frame-runtime-logic.ts` line 39 returns a fresh `{ version, x, y, z, qx, qy,
   qz, qw, p0, p5, p10, p14 }` object on every call. Called once in `chunk-sync-stage.ts` and once in
   `post-processing-stage.ts` per frame → 2 plain-object heap allocations per frame, even when the camera is
   still.

4. **Auto-save daemon fiber leaks across sessions, risks cross-session data corruption** —
   `packages/app/application/main/session.ts` line 231: `yield* Effect.forkDaemon(Effect.repeat(performAutoSaveTick,
   Schedule.spaced(5s)))` — fiber reference discarded. On quit-to-title the session scope closes but the daemon
   (tied to ROOT scope) keeps firing into the new session, reading shared services now populated with session N+1
   data while writing to the old session-N worldId. Risk: corrupted metadata for both worlds.

5. **LOD band-crossing detected but never triggers a re-mesh** —
   `packages/rendering/infrastructure/renderer/world-renderer-chunk-sync.ts` lines 70–85: `hasLodChanges` detects
   LOD mismatch but no code marks the affected chunks dirty or calls `updateChunkInScene`. A player walking from
   the LOD-0 ring into LOD-2 sees over-meshed high-detail geometry indefinitely. The detection exists; the
   transition never fires.

6. **Water sun intensity hardcoded to 1.0, ignoring time of day** —
   `packages/app/application/frame/stages/post-processing-stage.ts`: `updateWaterUniforms(inputs.totalTimeSecs,
   deps.camera.position, 1.0)` passes a literal `1.0` sunIntensity at all times. The water shader uses
   `uSunIntensity` to modulate brightness and sky-color blending; at night the water surface always appears as
   noon-bright.

---

### High Priority Issues

7. **`readPlayerColumn` allocates new closures every frame** —
   `physics-stage.ts` line 79 defines `readPlayerColumn` as a local `const` inside the per-frame `Effect.gen`
   body, and its inner `(wy: number) =>` lambda closes over `lx`, `lz` — 2 fresh function objects per frame on
   the primary lava/drown block-type checks.

8. **`FrameCommand { _tag: 'Tick', timestamp }` allocated every frame** —
   `game-loop.ts` lines 71 and 87 allocate a new tagged-struct for each rAF callback before any game logic runs.

9. **`[armorSlots.HELMET, ...]` 4-element array literal inside lava damage branch** —
   `physics-stage.ts` line 263 creates a fresh 4-element array on each lava-damage tick for the `.reduce`
   over armor slots.

10. **`getVelocity` / `getPosition` allocate new plain objects per call** —
    `packages/game/application/physics-service.ts` lines 144 and 153: `Effect.map((body) => ({ x: ..., y: ..., z: ... }))` returns a fresh position/velocity object on every call. Called during the physics step per frame.

11. **`triggerAttackSwing` uses object spread `{ ...state }` on every click** —
    `interaction-block-handler.ts` line 262: `triggerAttackSwing({ ...state }, ...)` creates a shallow copy of
    `AttackSwingState` on each left-click. Unnecessary if `triggerAttackSwing` mutates in-place.

12. **Worker path performs full re-mesh even when `dirtyAABB` is supplied** —
    `packages/worker/infrastructure/meshing/meshing-worker.ts` line 50: sub-region splicing only runs in the
    synchronous fallback; the browser worker ignores `dirtyAABB` and always full-re-meshes the 16×256×16 chunk.
    The `dirtyAABB` is dead data on the worker path.

13. **Shovel tool tier entirely absent** —
    No `WOODEN_SHOVEL` through `DIAMOND_SHOVEL` in `ItemTypeSchema`. The `break-speed.ts` shovel speed table is
    dead code. Dirt/sand/gravel have no accelerated break time.

14. **Gold tool tier entirely absent** —
    No `GOLD_SWORD`/`GOLD_PICKAXE`/etc. Gold is smeltable but has no useful tool output.

15. **GTAOPass / BokehPass / UnrealBloomPass always instantiated regardless of preset, wasting VRAM** —
    `session-post-processing.ts` constructs all four heavy passes unconditionally, then disables them with
    `pass.enabled = false`. GTAOPass allocates full-resolution MRT targets even when disabled; on the `low`
    preset this wastes ~30–60 MB GPU memory unnecessarily.

16. **Light propagation has no cross-chunk seeding, causing sharp light seams at chunk boundaries** **DEFERRED** —
     `packages/block/domain/light.ts`: both `computeBlockLight` and `computeSkyLight` stop at chunk edges with no
     seeding from adjacent chunks.

     _Deferral rationale (2026-06-12)_: The incremental propagation path (`propagateLightIncremental` →
     `markChunkDirty` → `dirtyOffsets`) already handles cross-chunk light updates when blocks are
     placed/broken — BFS boundary flags cause adjacent chunks to be re-lit. The issue only manifests on
     INITIAL chunk load (fresh chunks have zero light at boundaries from neighbors). This self-corrects
     after any block interaction near the boundary (which triggers a full recompute with all-boundaries
     dirty). Fixing the initial load requires architectural changes to `computeBlockLight` (currently a
     pure function operating on a single chunk's data) to accept neighbor light seeding — non-trivial
     refactoring with medium ROI compared to other deferred items.

17. **`enchantments` fallback `() => []` allocates a new empty array every call** —
    `interaction-block-handler.ts` lines 149, 315, 452: `onNone: () => []` on every hold-to-break tick, every
    left-click, and every bow release.

18. **`advanceFixedStep` returns a new `{ ticks, remainder }` object every frame** —
    `frame-runtime-logic.ts` lines 78–86: called every frame for both redstone and fluid accumulator updates. Two
    plain-object allocations per frame.

---

### Medium / Low Priority Issues

19. **Per-frame `chunkCoord` object literals for portal block detection** —
    `physics-stage.ts` lines 396–398 and 477 each create `{ x: Math.floor(px/CHUNK_SIZE), z: ... }` unconditionally
    every frame for NETHER_PORTAL and END_PORTAL checks.

20. **`Option.match` object literal `{ onNone, onSome }` at every hot-path call site** —
    ~15 `Option.match` invocations per frame across physics/entity/interaction stages, each allocating a fresh
    2-key object + 1–2 lambdas. The highest-frequency fishing-tick and portal-check sites are the main targets.

21. **`disposeMesh` intentionally skips `material.dispose()` but this is undocumented at call sites** —
    `world-renderer-utils.ts`: correct because materials are shared singletons, but silent — future refactors
    have no guard.

22. **`simplifyMesh` allocates a new `Set<string>` + string keys per invocation** —
    `lod-simplification.ts` line 130: up to thousands of template-literal key allocations per LOD-1/2 chunk mesh.

23. **`MeshAccumulator` buffers freshly allocated per `greedyMeshChunk` call, not pooled** —
    `greedy-meshing.ts` lines 69–76: `createAccumulator()` allocates 6 new TypedArrays per accumulator. A
    render-distance-8 world load creates ~867 large TypedArray allocations.

24. **LOD transition produces visible geometry pop without cross-fade** —
    When LOD re-mesh is eventually triggered (after fixing finding 5), `simplifyMesh` snaps quads outward to 2×/4×
    grid, causing z-fighting and cracks at the LOD seam. No morphing or alpha-blend transition.

25. **Block-break tool speed multiplier not matched to block category** —
    `break-speed.ts`: a pickaxe accelerates dirt, an axe accelerates stone. Vanilla only applies tool speed when
    the tool category matches the block category.

26. **No portable 2×2 crafting; table proximity required for recipes it shouldn't gate** —
    `inventory-renderer.ts` gates `crafting_table` recipes on a placed CRAFTING_TABLE block. Vanilla allows
    2×2 recipes from inventory. Additionally all recipes use shapeless (bag) matching, not spatial patterns.

27. **Sprinting uses `ControlLeft/ControlRight` instead of double-tap W** —
    Conflicts with Ctrl+W browser tab-close. Vanilla default is double-tap-W sprint.

28. **`MAX_STEP_UP = 0.5` blocks, blocking vanilla 1-block auto step-up** —
    `aabb-collision.ts`: full-height blocks require a jump to climb. Vanilla steps up automatically.

29. **No star rendering at night — pitch-black sky** —
    No `THREE.Points` star mesh anywhere in the codebase. The night sky is a uniform dark color.

30. **`transparentSolidMaterial` uses `opacity: 0.6` for both GLASS and LEAVES** —
    `chunk-mesh-materials.ts`: glass should be nearly fully transparent (~0.98 alpha); the shared 0.6 opacity
    makes all glass heavily tinted and dark.

31. **Ambient occlusion samples only 4 cardinal neighbors, missing 4 corner voxels** —
    `greedy-meshing-ao.ts`: vanilla/reference voxel AO uses all 8 neighbors (4 side + 4 corner). Current
    4-neighbor approach underestimates occlusion in concave corners.

32. **Water refraction UV uses main-canvas resolution but RT is 400×300** —
    `water-material.ts`: distortion offset scaled to 1920×1080 canvas UV but the refractionRT is 400×300 — the
    distortion appears ~5× too subtle at 1080p.

33. **Shadow map resolution 2048×2048 active for all presets including medium** —
    `session-lighting.ts`: medium preset could use 1024×1024; adds ~16 MB VRAM on integrated GPUs. Shadow camera
    also never tracks the player position, so shadows disappear far from world origin.

34. **Mob spawning entity cap is global, not split hostile/passive** —
    `spawner.ts`: single 24-entity cap; vanilla uses separate caps per category (70 passive / 70 hostile).

35. **`REGEN_FOOD_THRESHOLD` may be set to 20 (max) instead of vanilla 18** —
    `hunger-service.config.ts`: if threshold is 20, players at food level 19 never regen — stricter than vanilla.

36. **Default render distance is 4 chunks (very limited vs vanilla 12)** —
    `chunk-manager-constants.ts`: cosmetic/experience gap; a one-line change.

---

### Task List (R87 onwards — critical first)

- [x] R87: Hoist `finalPosRef` out of `physicsStage` into `FrameStageRefs`; reset with `Ref.set` on entry — `physics-stage.ts` / `types.ts` (critical)
- [x] R88: Replace inner `Effect.gen` in `processFrames` with pre-built Effect or `pipe`-chain — `game-loop.ts` (critical)
- [x] R89: Change `captureCameraPose` to output-parameter pattern; overwrite existing object in-place — `frame-runtime-logic.ts` (critical)
- [x] R90: Fix auto-save daemon fiber leak: store fiber reference + interrupt via `Effect.addFinalizer` — `session.ts` (critical)
- [x] R91: Fix LOD re-mesh trigger: after `hasLodChanges`, enqueue affected chunks into dirty-chunk path with new LOD — `world-renderer-chunk-sync.ts` (critical)
- [x] R92: Thread computed `sunIntensity` from `lightingStage` into `refractionPrepassStage`; replace hardcoded `1.0` — `post-processing-stage.ts` (critical)
- [x] R93: Hoist `readPlayerColumn` out of `Effect.gen` body; accept `chunkOpt, lx, lz` as explicit parameters — `physics-stage.ts` (high)
- [x] R94: Replace `FrameCommand { _tag: 'Tick', timestamp }` with bare `Queue<number>` — `game-loop.ts` (high)
- [x] R95: Replace 4-element `[armorSlots...]` array literal in lava branch with direct inline sum — `physics-stage.ts` (high) _(done 2026-06-12)_
- [x] R96: Add `copyPositionInto` / `copyVelocityInto` to `PhysicsService` to eliminate per-call plain-object allocation — `physics-service.ts` (high) _(done 2026-06-12)_
- [x] R97: Change `triggerAttackSwing` to mutate state in-place; remove `{ ...state }` spread — `interaction-melee-handler.ts` (high) _(done 2026-06-12)_
- [x] R98: Add `WOODEN_SHOVEL`–`DIAMOND_SHOVEL` to `ItemTypeSchema`, `durability.ts`, `tool-recipes.ts`, `break-speed.ts` (high) _(done 2026-06-12)_
- [x] R99: Add `GOLD_SWORD` / `GOLD_PICKAXE` / `GOLD_AXE` / `GOLD_HOE` / `GOLD_SHOVEL` to schema, durability (32), recipes, `break-speed.ts` (high) _(done 2026-06-12)_
- [x] R100: Gate `GTAOPass` / `BokehPass` construction behind `ssaoEnabled` / `dofEnabled` preset flags — `session-post-processing.ts` (high) _(done 2026-06-12)_
- [x] R101: Declare module-level `EMPTY_ENCHANTMENTS = Object.freeze([])` and use in all `onNone: () => []` sites — `item-stack.ts`, `interaction-melee-handler.ts`, `interaction-bow-handler.ts` (medium) _(done 2026-06-12)_
- [x] R102: Return tuple `[ticks, remainder]` from `advanceFixedStep` instead of plain object — `frame-runtime-logic.ts` (medium) _(done 2026-06-12)_
- [ ] R103: Compute `chunkCoord` once at top of `physicsStage`; remove duplicate allocations — **DEFERRED**
- [ ] R104: Replace `Option.match` at fishing-tick and portal-check sites with `if` branches — **DEFERRED**
- [x] R105: Add explanatory comment to `disposeMesh` why `material.dispose()` is deliberately omitted — `world-renderer-utils.ts` (medium) _(done 2026-06-12)_
- [ ] R106: Replace `Set<string>` + template-literal keys in `simplifyMesh` with numeric hash — **DEFERRED**
- [ ] R107: Reuse `MeshAccumulator` arrays across `greedyMeshChunk` calls — **DEFERRED**
- [ ] R108: Add block→preferred-tool-category mapping to `computeBreakTicks` — **DEFERRED**
- [ ] R109: Fix glass/leaves opacity — **DEFERRED**
- [ ] R110-R113: AO / water refraction / shadow map / star field — **DEFERRED**
- [x] R114: Verify `REGEN_FOOD_THRESHOLD = 18` in `hunger-service.config.ts` — already correct _(verified 2026-06-12)_
- [x] R115: Raise default render distance from 4 to 8 chunks + adjust UNLOAD_DISTANCE 6→10 (low) _(done 2026-06-12)_
- [ ] R116-R120: Gold armor / ChunkCoord refactor / Ref.modify / inline addPlayer / debug-overlay fiber — **DEFERRED** (low priority)

---

## AN. Round 37 (2026-06-12) — remaining R95-R120 execution

Executed the highest-value remaining tasks from the Round 36 audit. R99-R100
were initially deferred but completed in follow-up after Oracle review. R103-R113
(medium rendering cleanups) remain deferred as lower ROI.

**Landed (8 tasks):**
- [x] R95: physics-stage.ts — inline lava FIRE_PROTECTION sum, no per-tick array
- [x] R97: interaction-melee-handler.ts — remove unnecessary `{ ...state }` spread
- [x] R96: physics-service.ts + game-state-service.ts — copyPositionInto/copyVelocityInto output-parameter methods + module-scoped scratch objects (4 per-frame allocation sites eliminated)
- [x] R98: shovels (WOODEN through DIAMOND) — added to ItemTypeSchema, durability, tool-recipes, ITEM_TILE_MAP, enchantment APPLICABLE_TO, NON_PLACEABLE_ITEM_TYPES. Break-speed table already had multipliers.
- [x] R101: item-stack.ts — EMPTY_ENCHANTMENTS frozen constant + NO_DROPS constants in melee/bow handlers
- [x] R102: frame-runtime-logic.ts — advanceFixedStep returns tuple [ticks, remainder]
- [x] R105: world-renderer-utils.ts — strengthened disposeMesh documentation
- [x] R114: verified REGEN_FOOD_THRESHOLD=18 (already correct)
- [x] R115: chunk-manager-constants.ts — RENDER_DISTANCE 4→8, UNLOAD_DISTANCE 6→10

**Quality gate:** typecheck 0 errors, lint 0 errors/2 warnings (pre-existing), 5663 tests passing (1 pre-existing skip). 9 commits on main.

### Round 37 follow-up (2026-06-12) — Oracle-flagged fixes

Oracle flagged R99 (gold tools) as incomplete because schema/durability/recipes
were registered but gameplay behavior was missing. Fixed:

- [x] block-utils.ts: `isPickaxeTool` + `PICKAXE_HARVEST_SETS` now include GOLD_PICKAXE (wooden tier harvest)
- [x] block-service.config.ts: `PICKAXE_BLOCK_TYPES` includes GOLD_PICKAXE; `HOE_ITEM_TYPES` includes GOLD_HOE
- [x] combat.ts: `WEAPON_BASE_DAMAGE` includes GOLD_SWORD (8) and GOLD_AXE (9) — wooden tier
- [x] tool-completeness.test.ts: added SHOVEL to TOOL_TYPES, gold tier durability test

R100 was confirmed correct by Oracle.
