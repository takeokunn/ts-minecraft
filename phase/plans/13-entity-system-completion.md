# Phase 13 (Entity System) Completion — Plan

## Title
Phase 13 (Entity System) Completion — Bookkeeping + Regression Guards

## Context
Phase 13 (Entity System) is **functionally COMPLETE and LIVE** on the current uncommitted working tree. Every functional acceptance criterion in `phase/13-entity-system.md` is satisfied with file-cited evidence:

- **Spawning**: `MobSpawner.trySpawn` wired in `frame-maintenance.ts` (gated `mobsSpawnEnabled`); 8 mob defs (cow/pig/sheep/zombie/creeper/skeleton/spider/enderman); `selectMobType` round-robins PASSIVE/HOSTILE; HOSTILE chosen when `timeService.isNight()`.
- **Movement + animation**: `EntityManager.update` (AI velocity via `resolveAIState`/`computeStateVelocity`) + `applyPhysics` (gravity + AABB + auto-hop); limb swing via `walk-cycle.ts computeLimbAngle` consumed in `entity-renderer.ts`.
- **AI**: Wander (deterministic per-entity hash), Chase (hostile within `detectionRange`, distance-based `canSeePlayer`), Flee (passive within detection).
- **Combat**: mob→player `getPlayerContactDamage` wired in `physics-stage.ts` with armor mitigation + hurt sound; player→mob `applyDamage` (knockback + hit sound + particle + crit) with drops→inventory + xpReward in `interaction-block-handler.ts`; zombie daylight burn.
- **Caps**: `MAX_ENTITY_COUNT=24`, `SPAWN_INTERVAL_FRAMES=6`, MIN/MAX/DESPAWN distance; rendering ≤24 InstancedMesh draw-call buckets with pre-allocated scratch (no per-frame GC).

**The only real open item is bookkeeping**: `phase/13-entity-system.md` has 62 checkboxes, all unchecked (`[x]` count = 0). The smallest correct increment is to tick the boxes to reflect shipped reality, annotate the legacy `src/`-path task boxes (code moved to the monorepo layout), and harden the now-checked AC with a small regression-guard test so they cannot silently drift. **No production code change is required.**

All spec-only extras (line-of-sight raycast, A*/pathfinding, creeper detonation, skeleton bow, floating damage numbers, crit-star sprite) are **flag-don't-build** — referenced by no AC, each would be a large new subsystem.

## Ordered Tasks

### 1. Step 0 (risk gate): purge stale adjacent .js
Run the purge so vite resolves the `@ts-minecraft` alias to `.ts`, not stale emitted `.js`:
```
find packages test src dist -type f \( -name '*.js' -o -name '*.d.ts' -o -name '*.js.map' -o -name '*.d.ts.map' \) | grep -v node_modules | xargs rm -f
```
Then run `pnpm vitest run` once to confirm the ~3546-test baseline is green before any edit. No file edits.

### 2. Verify each AC against shipped code BEFORE ticking
Read `state-machine.ts`, `entity-manager.ts`, `spawner.ts`, `physics-stage.ts`, `interaction-block-handler.ts`, `entity-update-stage.ts`, `entity-renderer.ts`, `walk-cycle.ts`, and `phase/13-entity-system.md`. Confirm each of the 9 functional AC + 7 最終検証 claims is actually **wired** (not pure-but-unwired). Confirm exact `applyDamage` return shape (`Option<ReadonlyArray<EntityDrop>>`), `getPlayerContactDamage` cooldown time-source, `computeLimbAngle` export/signature/THREE-freeness, and the daylight-burn cadence. Derive exact checkbox line ranges + surrounding label text. **GATE: if any AC is unwired/unsatisfied, STOP and do not tick — reopen and report.**

### 3. AC regression-guard test (chase/flee, contact damage, drops)
New file `packages/entity/test/mob/phase-13-acceptance.test.ts`, plain `it` + `Effect.runPromise(Effect.provide(EntityManagerLive)(program))` (deadlock-safe; compose the real Layer), deterministic, no Math.random/THREE:
- hostile Zombie → Chase, velocity toward player; `getPlayerContactDamage` first call = attackDamage (3), second immediate call = 0 (cooldown, deterministic time source);
- passive Cow → Flee, velocity away;
- lethal `applyDamage` → `Option.some(drops)` incl. ROTTEN_FLESH (unwrap via `Option.getOrThrow`/`Option.match`).
Do NOT add the HOSTILE/PASSIVE membership tautology.

### 4. Night-burn-through-update() regression
Extend the same file: (a) `update(..., isNight=true)` over a span exceeding one burn period → count/health unchanged; (b) `update(..., isNight=false)` → health strictly **monotonic decrease**, removed at 0. Burn is ~1hp/20 ticks, so reaching 0hp needs ~`maxHealth×20` ticks — assert monotonic change across a span crossing several multiples of 20 with margin, **not** an exact tick boundary.

### 5. Walk-animation guard test
New file `packages/rendering/test/entity/walk-cycle.test.ts` (pure fn): zero speed → ~0 swing; moving → oscillating non-zero; arms anti-phase to legs. If `computeLimbAngle` is not separately testable (per Task 2), assert via an entity-renderer pure helper or downgrade to annotation — do not force a refactor. Confirm the dir is collected by vitest include globs.

### 6. Run guard tests; tick the functional AC block
Re-purge, run the new files explicitly, confirm they are **collected** and green. Then flip the 9 受け入れ条件 boxes `[x]`→`[x]` in `phase/13-entity-system.md` (unique old_string with Japanese label text; never `replace_all`). Append an italic evidence line citing the real files.

### 7. Annotate (don't relocate) legacy Day-1..5 task boxes
Tick mapped boxes and append `→ <real monorepo home>` (e.g. `src/ai/stateMachine.ts → packages/entity/domain/mob/state-machine.ts`; rendering → `packages/rendering/infrastructure/entity/{mob-geometry,walk-cycle,entity-renderer}.ts`). Any task box describing a flag-don't-build behavior is labeled 将来作業/未実装 and **not** ticked. Add a `## 将来作業 (本Phaseの受け入れ条件外)` footer. Do **not** create files at literal `src/` paths.

### 8. Full gate, then tick 最終検証 (+ 30 FPS annotation)
Run the full gate (below). Only after the suite is green, flip the 7 最終検証 boxes; annotate 30 FPS as design-cap + manual-QA (not automated). `grep` to confirm checked-count rose from 0 and no flag-don't-build box was ticked.

## Risks
- **Flag-don't-build (no AC backing)**: LOS raycast, A*/pathfinding, creeper detonation, skeleton bow, floating damage numbers, crit-star sprite. Do not half-build.
- **30 FPS** is satisfied-by-design (caps) + manual QA, not a unit test — annotate the tick accordingly.
- **Stale-.js gotcha** must precede every vitest run and be re-run after typecheck/build (they re-emit `.js`).
- **Out of scope**: armor/equipment/durability is shipped but absent from phase/13 — never a blocker; known minor debts (armor durability not decremented; duplicate `MAX_ARMOR_POINTS`) out of scope.
- **Edit fragility**: 62 identical `[x]` strings — anchor each Edit by unique surrounding text; line numbers shift; read the doc first.
- **Guard-test feasibility**: confirm `computeLimbAngle` signature and cooldown time-source in Task 2; use ~`maxHealth×20`/monotonic for burn; use plain `it` + `Effect.runPromise` to avoid the effect-vitest deadlock.
- **Truthfulness gate**: if any AC is pure-but-unwired, STOP and do not tick.

## Definition of Done
- Purge run before/after every gate command; no stray `.js` shadowing `.ts`.
- All 16 ticked claims (9 AC + 7 最終検証) verified against wired code or escalated.
- New guard tests collected + green; deterministic; no Math.random/THREE-in-entities; plain `it` + `Effect.runPromise` with real Layers.
- `phase/13-entity-system.md`: 受け入れ条件 + 最終検証 ticked with evidence; 30 FPS annotated as design-cap + manual QA.
- Day-1..5 legacy boxes ticked + annotated to real homes (no files at `src/`); flag-don't-build boxes labeled 将来作業, not ticked; 将来作業 footer added.
- Functional AC ticked after guard tests green; 'すべてのテストが成功' after full gate green.
- `pnpm typecheck` 0 errors, `pnpm lint` 0/0, `pnpm vitest run` baseline+new 0 skipped, `pnpm build` exit 0.
- ZERO production code changes; spec extras deferred, not half-built.

## Validation Commands
```
# Purge BEFORE any vitest/tsc (and re-run after typecheck/build):
find packages test src dist -type f \( -name '*.js' -o -name '*.d.ts' -o -name '*.js.map' -o -name '*.d.ts.map' \) | grep -v node_modules | xargs rm -f

# Confirm new guard tests collected & green:
pnpm vitest run packages/entity/test/mob/phase-13-acceptance.test.ts packages/rendering/test/entity/walk-cycle.test.ts

# Full gate:
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm build

# typecheck/build EMIT adjacent .js — purge again:
find packages test src dist -type f \( -name '*.js' -o -name '*.d.ts' -o -name '*.js.map' -o -name '*.d.ts.map' \) | grep -v node_modules | xargs rm -f

# Verify bookkeeping (was 0):
grep -cE '^\s*-\s*\[x\]' phase/13-entity-system.md
```
