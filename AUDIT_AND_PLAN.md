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

**Verified as fully wired (no change needed):**
- Fishing rod: cast/cancel in `handleFoodConsumption` + tick in `physics-stage`. ✓
- Tool durability on melee: `handleLeftClick.damageSlot`. ✓

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
