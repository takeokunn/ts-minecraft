# Phase 12 (Combat System) — Final Completion Plan

## Context

Phase 12's combat domain and armor subsystem are **already shipped and unit-tested** (verified against the repo, 2026-05-29):

- **Combat domain** (`packages/entities/domain/combat.ts`): `computeAttackDamage` (crit 1.5x then armor reduction), `applyArmorReduction` (4%/pt, cap 80%), `computeKnockback` (H=5/V=4.2/6 ticks), `computeAttackCharge`/`computeChargedDamage` (MC1.9). Crit is **DETERMINISTIC** (`!playerGrounded`), not random.
- **Attack wired** (`interaction-block-handler.ts` handleLeftClick onSome branch, lines 130-195): weapon damage lookup, crit via `!playerGrounded` (line 147/75), knockback + entityHit sound before applyDamage, drops -> inventory, XP, weapon durability via `damageSlot`.
- **Armor subsystem**: `armor.ts` domain, `EquipmentService` (equip/unequipSlot/getAll/getTotalArmorPoints/serialize/deserialize/reset), **right-click equip is LIVE** at `interaction-block-handler.ts:237-244` (suspected gap #1 is FALSE), incoming-damage armor reduction at `physics-stage.ts:64-69`, persistence with back-compat, `equipmentService.reset()` on death at `physics-stage.ts:85`.

**Genuine in-scope gaps** (smallest correct increment): (1) no in-game **unequip** (`unequipSlot` exists + tested, zero non-test callers); (2) no **armor HUD** (no `#armor` element in `index.html`); (3) no **combat-feedback particle** on attack (the onSome branch imports `getParticleUvOffset` and has `particleSystem` in scope but never calls `spawnBurst`); (4) all `phase/12-combat.md` checkboxes unchecked.

**Deliberately out of scope** (flagged, not half-built):
- **Attack hand-swing animation** (line 18, the only unmet *checked* 受け入れ条件) — no first-person viewmodel infra exists; building one is a new rendering subsystem. The phase stays acceptance-**incomplete**.
- **Crit-star / damage-number sprites** (lines 118, 120) — structurally blocked: `getParticleUvOffset` maps only `blockId` -> block-atlas tile; `spawnBurst` takes UV offsets only (no color/sprite param). The generic hit-burst is a minimal substitute for line 119, not an equivalent.

> **Critical UV fact**: `getParticleUvOffset(blockId)` calls `getTileIndex(blockId,'top')`. REDSTONE_BLOCK **storage id 37** maps to **atlas tile 38** (`TILE_MAP[37].top = 38`). Name the constant as a *block id* and assert UVs **by value** via `getParticleUvOffset(37)` — never hardcode a tile number.

> **Repo gotcha**: stale adjacent `.js` shadows `.ts` in vite/vitest. Every file here is an **existing** `.ts`, so purge before each test run and again after typecheck/build.

## Ordered Tasks

### 1. Purge stale adjacent .js (enabling hygiene)
Run the purge, confirm an existing attack test still passes (proves live `.ts` is loaded). `interaction-block-handler.ts` and `physics-stage.ts` are already `M` (uncommitted) — layer edits on the in-flight diff.

```
find packages test src dist -type f \( -name '*.js' -o -name '*.d.ts' -o -name '*.js.map' -o -name '*.d.ts.map' \) | grep -v node_modules | xargs rm -f
```

### 2. Slice A (de-risk first): hit-burst particle on a landed melee attack
**Files**: `packages/app/application/frame/stages/interaction-block-handler.ts`
Add a module const `HIT_PARTICLE_BLOCK_ID = 37` (REDSTONE_BLOCK; red-ish tile) and `HIT_PARTICLE_UV = getParticleUvOffset(HIT_PARTICLE_BLOCK_ID)`. Inside the existing entityOpt `onSome` arm (where `e.position` is in scope, lines 153-166), add `spawnBurst(e.position.x, e.position.y + ENTITY_CENTER_Y_OFFSET, e.position.z, HIT_PARTICLE_UV.u, HIT_PARTICLE_UV.v, playerGrounded ? 6 : 12)` to the existing `Effect.all`, gated on `debugFlags['particles.spawn']` (line 67), **before** `applyDamage`. Denser burst on `!playerGrounded` reuses the deterministic crit signal — never `Math.random`.
**Tests** (`interaction-stage.test.ts`): (a) attack lands -> `spawnBurst` called once, args 4/5 equal `getParticleUvOffset(37).u/.v` (by value, import the fn), count 6; (b) `isPlayerGrounded()=false` -> count 12. Override services via `(services.X as {m:unknown}).m = vi.fn(...)`.
**Acceptance**: phase/12 line 119 (Day-4 polish); reinforces 24.

### 3. Slice B: in-game unequip key (KeyG)
**Files**: `frame-handler.config.ts`, `frame/stages/interaction-stage.ts`, `frame/stages/interaction-block-handler.ts`
Add `export const UNEQUIP_ARMOR_KEY = 'KeyG'` (verified free). In `interaction-stage.ts`, add a **separate** `const unequipArmor = yield* services.inputService.consumeKeyPress(UNEQUIP_ARMOR_KEY)` (do NOT widen the positional 8-element redstone `Effect.all` tuple), and inside the paused-guarded block: `if (unequipArmor) yield* handleUnequipArmor(services)`. Helper in `interaction-block-handler.ts`:

```ts
export const handleUnequipArmor = (
  services: Pick<FrameHandlerServices, 'equipmentService' | 'inventoryService'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const slots = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'] as const
    for (const slot of slots) {
      const removed = yield* services.equipmentService.unequipSlot(slot)
      if (Option.isSome(removed)) {
        yield* services.inventoryService.addBlock(removed.value, 1).pipe(Effect.catchAll(() => Effect.void))
        return
      }
    }
  })
```

Unequips the first occupied slot (symmetric with per-item equip); discharges `addBlock`'s error channel (full inventory drops, no crash). Separate key keeps the fixed right-click FISHING_ROD->armor->food priority untouched.
**Tests** (`interaction-stage.test.ts`, redstone key-injection pattern, `MutableHashSet.fromIterable(['KeyG'])`): (a) HELMET equipped -> `unequipSlot('HELMET')` + `addBlock('IRON_HELMET', 1)`; (b) no armor -> `addBlock` not called. equipmentService is a plain cast object — override by direct field reassignment.
**Acceptance**: phase/12 line 65 (armor-loop correctness).

### 4. Slice C: armor HUD (verified 6-hop bar pattern)
**Files**: `index.html`, `main/session.ts`, `main/session-runtime.ts`, `frame/types.ts`, `frame-handler.ts`, `frame/stages/physics-stage.ts`, `test/frame-handler-test-kit.ts`
1. **index.html**: `#armor-display` div (bottom:140px, shield glyph) with `<span id="armor-value">0</span>`.
2. **session.ts** (335-353): `armorValueElement: document.getElementById('armor-value')` in the getElementById block + buildSessionRuntime params.
3. **session-runtime.ts**: `armorValueElement: HTMLElement | null` on `SessionRuntimeParams` (after line 53) + `Option.fromNullable(p.armorValueElement)` in `assembleFrameHandlerDeps` (after line 89).
4. **frame/types.ts**: `armorValueElement: Option.Option<HTMLElement>` on `FrameHandlerDeps` (after 64); `armorValueElementOrNull: HTMLElement | null` on `ResolvedDeps` (after 161); `lastArmorRef: MutableRef.MutableRef<{ armorPoints: number }>` on `FrameStageRefs` (after 130).
5. **frame-handler.ts**: `const lastArmorRef = MutableRef.make({ armorPoints: -1 })` (~65); `armorValueElementOrNull: Option.getOrNull(deps.armorValueElement)` in resolved (~146); add `lastArmorRef` to refs literal (~165) and `armorValueElementOrNull` to physicsStage inputs (~335).
6. **physics-stage.ts**: add `'lastArmorRef'` to refs Pick (line 15) and `armorValueElementOrNull` to inputs type (after 24). **Hoist** the existing `const armorPoints = yield* services.equipmentService.getTotalArmorPoints()` (line 67) to run unconditionally before the health HUD block (reuse the SAME const for both `applyArmorReduction` and the HUD — no second call). After the XP HUD block (line 174), add a change-gated write of `String(armorPoints)`.
7. **test-kit makeDeps**: add `armorValueElement: Option.none()` (optionally an injectable element param for HUD assertion).
**Tests** (`physics-stage.test.ts`, mirror health/hunger change-gate): (a) inject a fake `{ textContent: '' }`, override `getTotalArmorPoints -> Effect.succeed(11)`, assert `el.textContent === '11'`; (b) two frames same value -> single write.
**Acceptance**: phase/12 line 65 (player feedback).

### 5. Bookkeeping: phase/12-combat.md
Tick now-true boxes: 17, 19, 22, 23, 24, 27, 28, 29, 65, 119, 134-138 (except animation), 139. Leave UNCHECKED with deferral notes: 18, 46 (no viewmodel), 118, 120 (block-atlas-only particles). Add an honest header: phase is acceptance-**incomplete** while line 18 is unmet. Do NOT touch `combat-system.md`.

### 6. Validate gates
Purge -> `pnpm typecheck` -> purge -> `pnpm lint` -> `pnpm vitest run` -> `pnpm build` -> purge. (`pnpm verify` runs all.)

## Risks
- **Deferred**: attack hand-swing animation (18/46) — no viewmodel infra; phase stays acceptance-incomplete.
- **Deferred**: crit-star/damage-number sprites (118/120) — block-atlas-only particle path; generic burst is a minimal substitute.
- **Particle UV trap**: `getParticleUvOffset` takes a *block id*; 37 -> tile 38. Assert by value, not a literal.
- **Test-kit shape**: `equipmentService` is a plain cast object, `particleSystem.spawnBurst` a plain arrow — override by direct field reassignment, not vi.fn mock APIs.
- **Stale .js**: purge before each test and after typecheck/build.
- **6-hop brittleness**: every new field at all call sites incl. test-kit `makeDeps` or tsc fails.
- **Armor hoist**: reuse the single `getTotalArmorPoints` const; do not double-apply player armor into the attack path.
- **Crit determinism**: denser burst keys off `!playerGrounded`, never `Math.random`.
- **Unequip item-loss**: discharge `addBlock` error channel.
- **Uncommitted baseline**: re-read the two `M` files before editing.

## Definition of Done
1. Slice A: one `spawnBurst` per landed hit, before applyDamage, UV by value, 6/12 count; 2 tests.
2. Slice B: KeyG unequips first occupied slot back to inventory, error-discharged; 2 tests.
3. Slice C: armor HUD threaded all 6 hops + test-kit, change-gated, reuses existing read; 2 tests.
4. No new ItemType/service/texture/save-schema; crit deterministic; no double-applied armor.
5. phase/12 ticked truthfully; 18/46/118/120 unchecked with notes; combat-system.md untouched.
6. Gates green after purge: typecheck 0, lint 0/0, vitest ~3552, build exit 0.

## Validation Commands
```
find packages test src dist -type f \( -name '*.js' -o -name '*.d.ts' -o -name '*.js.map' -o -name '*.d.ts.map' \) | grep -v node_modules | xargs rm -f
pnpm typecheck
find packages test src dist -type f \( -name '*.js' -o -name '*.d.ts' -o -name '*.js.map' -o -name '*.d.ts.map' \) | grep -v node_modules | xargs rm -f
pnpm lint
pnpm vitest run
pnpm build
find packages test src dist -type f \( -name '*.js' -o -name '*.d.ts' -o -name '*.js.map' -o -name '*.d.ts.map' \) | grep -v node_modules | xargs rm -f
```
