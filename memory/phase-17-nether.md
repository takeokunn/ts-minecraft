---
name: phase-17-nether
description: Nether phase implementation status — portal ignition, block types, and NetherService
metadata:
  type: project
---

Phase 17 Nether — implemented 2026-06-06.

**What's done:**
- `NETHER_PORTAL` and `NETHERRACK` block types added to `block-type.ts` + `block-codec.ts` (indices 44/45)
- `FLINT_AND_STEEL` item type added to `item-type.ts`
- Both registered as NON_PLACEABLE in `block-service.config.ts`
- `NETHER_PORTAL`/`NETHERRACK` block entries added to `blocks.config.crafted.ts` (transparent+non-solid portal, hardness-5 netherrack)
- `NetherService` created at `packages/world/application/nether-service.ts` — tracks dimension state + portal registry per dimension
- Portal ignition via `handleFlintAndSteel` in `interaction-placement-handler.ts`:
  - Pre-fetches 3×3 chunk grid, builds synchronous `blockAt` closure
  - Calls `detectNetherPortal` from domain layer
  - Fills interior with `NETHER_PORTAL` blocks via `blockService.forceSetBlock`
  - Marks affected chunks dirty for immediate re-render
  - Registers portal position in NetherService
- `BlockService.forceSetBlock` added for direct block type writing without inventory
- `NetherService` wired into game-logic layers and session
- Trading currency changed from GRAVEL → EMERALD
- Test kit updated: `makeNetherService()` mock, `forceSetBlock` in `makeBlockService()`
- 8 new NetherService tests in `packages/world/test/nether-service.test.ts`

**What's NOT done yet (deferred):**
- Actual dimension travel (teleporting player to nether coordinates on walking into portal)
- Nether terrain generation (netherrack biome, lava lakes, nether sky)
- Portal cooldown / travel animation
- Dimension-aware chunk loading (nether/overworld use same chunk data currently)

**Why:** travel requires dimension-aware chunk state which needs major ChunkManagerService changes.

**How to apply:** next nether iteration should focus on travel — detect NETHER_PORTAL block under player in physics-stage, call `netherService.getDimension()` + `resolveNetherTravel()` from domain, teleport player position.
