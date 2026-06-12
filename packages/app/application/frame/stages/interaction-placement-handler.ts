import { Effect, HashMap, MutableRef, Option, Ref, Schema } from 'effect'
import { aabbFromVoxel, detectNetherPortal } from '@ts-minecraft/world'
import type { Chunk } from '@ts-minecraft/world'
import { CHUNK_HEIGHT, CHUNK_SIZE, indexToBlockType, BlockTypeSchema, SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import type { BlockType, Position } from '@ts-minecraft/core'
import { HOTBAR_START, selectEnchantment, enchantXPCost, enchantItem } from '@ts-minecraft/inventory'
import type { DirtyChunkEntry } from '@ts-minecraft/app/frame/frame-maintenance'
import type { FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import type { ChunkManagerService } from '@ts-minecraft/world/application/chunk-manager-service'
import { adjacentToHit, buildTntBreakPositions } from './placement-geometry'

export { adjacentToHit, buildTntBreakPositions }

const TNT_BREAK_RADIUS = 4

// Flattens chunk-load results into a coord-keyed Map for synchronous access.
// Used when detectNetherPortal needs to scan block data across chunk boundaries.
const buildChunkCache = (
  results: ReadonlyArray<Option.Option<{ readonly coord: { x: number; z: number }; readonly chunk: Chunk }>>,
): Map<string, Chunk> => {
  const cache = new Map<string, Chunk>()
  for (const r of results) {
    const val = Option.getOrNull(r)
    if (val !== null) cache.set(`${val.coord.x},${val.coord.z}`, val.chunk)
  }
  return cache
}

// ─── Shared Effect helpers ────────────────────────────────────────────────────

// Reads and decodes the block type at a world position. Returns 'AIR' when the
// chunk is not loaded — callers can use 'AIR' as a safe fallback that will
// propagate correctly through block-dispatch chains.
const readBlockTypeAt = (
  chunkManagerService: ChunkManagerService,
  pos: { readonly x: number; readonly y: number; readonly z: number },
): Effect.Effect<BlockType, never> => {
  const cx = Math.floor(pos.x / CHUNK_SIZE)
  const cz = Math.floor(pos.z / CHUNK_SIZE)
  const lx = ((pos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((pos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const idx = pos.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
  return Effect.gen(function* () {
    const chunk = yield* chunkManagerService.getChunk({ x: cx, z: cz })
    return indexToBlockType(chunk.blocks[idx] ?? 0)
  /* c8 ignore next -- chunk unavailable treated as AIR; only happens on load failure */
  }).pipe(Effect.catchAll(() => Effect.succeed('AIR' as BlockType)))
}

// Queues the chunk containing `pos` for re-meshing by marking it render-dirty.
// No-ops if the chunk fails to load (the visual state is already inconsistent).
const markChunkDirtyAt = (
  chunkManagerService: ChunkManagerService,
  dirtyChunksRef: Ref.Ref<HashMap.HashMap<string, DirtyChunkEntry>>,
  pos: { readonly x: number; readonly y: number; readonly z: number },
): Effect.Effect<void, never> => {
  const cx = Math.floor(pos.x / CHUNK_SIZE)
  const cz = Math.floor(pos.z / CHUNK_SIZE)
  return Effect.gen(function* () {
    const updated = yield* chunkManagerService.getChunk({ x: cx, z: cz })
    yield* Ref.update(dirtyChunksRef, (map) =>
      HashMap.set(map, `${cx},${cz}`, { chunk: updated, dirtyAABB: Option.none() }),
    )
  }).pipe(Effect.catchAll(() => Effect.void))
}

// Pre-fetches a 3×3 chunk grid around the ignition point and creates a synchronous
// blockAt closure for detectNetherPortal (which needs to scan up to 21-block frames
// crossing chunk boundaries in the worst case). setBlockInChunk mutates blocks in
// place, so the cached Chunk objects reflect the post-ignition state automatically.
const buildBlockAtFromCache = (
  chunkCache: Map<string, Chunk>,
): ((x: number, y: number, z: number) => BlockType) =>
  (x, y, z) => {
    /* c8 ignore next -- guard: detectNetherPortal stays in-bounds; y<0/>=CHUNK_HEIGHT are defensive */
    if (y < 0 || y >= CHUNK_HEIGHT) return 'AIR'
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    const chunk = chunkCache.get(`${cx},${cz}`)
    /* c8 ignore next -- guard: all 3×3 surrounding chunks are pre-fetched; missing = chunk load failure */
    if (!chunk) return 'AIR'
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const idx = y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
    /* c8 ignore next -- TypedArray never returns undefined for in-bounds idx */
    return indexToBlockType(chunk.blocks[idx] ?? 0)
  }

// ─── Handlers ────────────────────────────────────────────────────────────────

export const handleFlintAndSteel = (
  services: Pick<FrameHandlerServices, 'blockService' | 'chunkManagerService' | 'netherService' | 'soundManager'>,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const hit = Option.getOrNull(context.targetHit)
    if (hit === null) return false
    const tntPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
    const blockTypeOpt = yield* readBlockTypeAt(services.chunkManagerService, tntPos).pipe(Effect.option)
    if (Option.getOrNull(blockTypeOpt) !== 'TNT') {
      return yield* handlePortalIgnition(services, refs, hit)
    }
    // TNT explosion: remove the TNT block then break all blocks within the sphere
    yield* services.blockService.forceSetBlock(tntPos, 'AIR').pipe(Effect.catchAll(() => Effect.void))
    yield* services.soundManager.playEffect('blockBreak', { position: tntPos })
    for (const pos of buildTntBreakPositions(tntPos, TNT_BREAK_RADIUS)) {
      yield* services.blockService.forceSetBlock(pos, 'AIR').pipe(Effect.catchAll(() => Effect.void))
    }
    return true
  })

// Extracted portal ignition logic (was the original handleFlintAndSteel body).
const handlePortalIgnition = (
  services: Pick<FrameHandlerServices, 'blockService' | 'chunkManagerService' | 'netherService' | 'soundManager'>,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  hit: TargetRayHit,
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    // Flint & steel ignites the air cell adjacent to the face that was right-clicked
    const ignitionPos = adjacentToHit(hit)
    const centerCx = Math.floor(ignitionPos.x / CHUNK_SIZE)
    const centerCz = Math.floor(ignitionPos.z / CHUNK_SIZE)
    const chunkCoords: Array<{ x: number; z: number }> = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        chunkCoords.push({ x: centerCx + dx, z: centerCz + dz })
      }
    }
    const results: Array<Option.Option<{ readonly coord: { x: number; z: number }; readonly chunk: Chunk }>> = []
    for (const coord of chunkCoords) {
      results.push(
        yield* Effect.gen(function* () {
          const chunk = yield* services.chunkManagerService.getChunk(coord)
          return { coord, chunk }
        }).pipe(Effect.option),
      )
    }
    const chunkCache = buildChunkCache(results)
    const blockAt = buildBlockAtFromCache(chunkCache)
    const portalFrame = Option.getOrNull(detectNetherPortal(blockAt, ignitionPos))
    if (portalFrame === null) return false

    // Collect unique affected chunks before mutating so we can update the dirty ref after.
    // setBlockInChunk mutates blocks in-place so cached chunks reflect portal state.
    const affectedCoords = new Map<string, { x: number; z: number }>()
    for (const pos of portalFrame.interior) {
      const cx = Math.floor(pos.x / CHUNK_SIZE)
      const cz = Math.floor(pos.z / CHUNK_SIZE)
      affectedCoords.set(`${cx},${cz}`, { x: cx, z: cz })
    }
    for (const pos of portalFrame.interior) {
      yield* services.blockService.forceSetBlock(pos, 'NETHER_PORTAL').pipe(Effect.catchAll(() => Effect.void))
    }
    yield* Ref.update(refs.dirtyChunksRef, (map) => {
      let updated = map
      for (const [coordKey] of affectedCoords) {
        const chunk = chunkCache.get(coordKey)
        if (chunk) updated = HashMap.set(updated, coordKey, { chunk, dirtyAABB: Option.none() })
      }
      return updated
    })
    yield* services.netherService.registerPortal(ignitionPos, 'overworld')
    yield* services.soundManager.playEffect('blockPlace', { position: ignitionPos })
    return true
  })

// R26: water/lava buckets. An empty BUCKET fills from a fluid SOURCE block the
// player is looking at; a filled bucket empties the fluid onto the air cell
// adjacent to the targeted face. Returns true when the bucket consumed the
// interaction (so the caller skips default placement). The fluid service's
// seed*/remove* helpers write the block themselves (writeFluid/writeAir), so we
// only forceSetBlock on placement to mirror the existing placeBlock flow.
export const handleBucket = (
  services: Pick<FrameHandlerServices, 'hotbarService' | 'inventoryService' | 'blockService' | 'chunkManagerService' | 'fluidService' | 'soundManager'>,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const hit = Option.getOrNull(context.targetHit)
    if (hit === null) return false
    const selected = yield* services.hotbarService.getSelectedBlockType()
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const item = Option.getOrNull(selected)
    if (item === null || (item !== 'BUCKET' && item !== 'WATER_BUCKET' && item !== 'LAVA_BUCKET')) return false
    const slot = SlotIndex.make(HOTBAR_START + selectedSlot)

    if (item === 'BUCKET') {
      // FILL — the looked-at block must be a fluid source.
      const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      const blockType = yield* readBlockTypeAt(services.chunkManagerService, targetPos)
      if (blockType !== 'WATER' && blockType !== 'LAVA') return false
      const filled = blockType === 'WATER' ? 'WATER_BUCKET' : 'LAVA_BUCKET'
      yield* (blockType === 'WATER'
        ? services.fluidService.removeWater(targetPos)
        : services.fluidService.removeLava(targetPos))
      yield* services.fluidService.notifyBlockChanged(targetPos)
      yield* services.inventoryService.removeBlock('BUCKET', 1, slot).pipe(Effect.catchAll(() => Effect.void))
      yield* services.inventoryService.addBlock(filled, 1).pipe(Effect.catchAll(() => Effect.void))
      yield* markChunkDirtyAt(services.chunkManagerService, refs.dirtyChunksRef, targetPos)
      yield* services.soundManager.playEffect('blockBreak', { position: targetPos })
      return true
    }

    // EMPTY — place the fluid at the air cell adjacent to the targeted face.
    const fluidBlock: BlockType = item === 'WATER_BUCKET' ? 'WATER' : 'LAVA'
    const placePos = adjacentToHit(hit)
    yield* services.blockService.forceSetBlock(placePos, fluidBlock).pipe(Effect.catchAll(() => Effect.void))
    yield* (fluidBlock === 'WATER'
      ? services.fluidService.seedWater(placePos)
      : services.fluidService.seedLava(placePos))
    yield* services.fluidService.notifyBlockChanged(placePos)
    yield* services.inventoryService.removeBlock(item, 1, slot).pipe(Effect.catchAll(() => Effect.void))
    yield* services.inventoryService.addBlock('BUCKET', 1).pipe(Effect.catchAll(() => Effect.void))
    yield* markChunkDirtyAt(services.chunkManagerService, refs.dirtyChunksRef, placePos)
    yield* services.soundManager.playEffect('blockPlace', { position: placePos })
    return true
  })

// Right-clicking a BED block at night skips to dawn and sets the player's spawn point.
// In the nether, sleeping causes an explosion in vanilla; here we just do nothing (safe mode).
export const handleBed = (
  services: Pick<FrameHandlerServices, 'timeService' | 'netherService' | 'soundManager'>,
  respawnPositionRef: MutableRef.MutableRef<Position>,
  bedPos: { readonly x: number; readonly y: number; readonly z: number },
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const dimension = yield* services.netherService.getDimension()
    if (dimension === 'nether') return false    // beds explode in nether; skip safely
    const isNight = yield* services.timeService.isNight()
    if (!isNight) return false
    yield* services.timeService.setTimeOfDay(0.25)            // skip to dawn
    MutableRef.set(respawnPositionRef, { x: bedPos.x, y: bedPos.y + 1, z: bedPos.z })
    yield* services.soundManager.playEffect('blockPlace', { position: bedPos })
    return true
  })

// Right-clicking an ENCHANTING_TABLE enchants the held item using the player's XP.
// Deterministic: same item + same XP level → same enchantment every time.
// Consumes enchLevel XP levels. No lapis cost (simplified vs vanilla).
const handleEnchantingTable = (
  services: Pick<FrameHandlerServices, 'hotbarService' | 'inventoryService' | 'xpService' | 'soundManager'>,
  tablePos: { readonly x: number; readonly y: number; readonly z: number },
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const xp = yield* services.xpService.getXP()
    if (xp.level < 1) return
    const slotIndex = SlotIndex.make(HOTBAR_START + selectedSlot)
    const slot = yield* services.inventoryService.getSlot(slotIndex)
    const stack = Option.getOrNull(slot)
    if (stack === null || !Schema.is(ItemTypeSchema)(stack.itemType)) return
    const enchantment = Option.getOrNull(selectEnchantment(stack.itemType, xp.level))
    if (enchantment === null) return
    const cost = enchantXPCost(enchantment.level)
    const enchanted = enchantItem(stack, enchantment)
    yield* services.inventoryService.setSlot(slotIndex, Option.some(enchanted))
    yield* services.xpService.spendLevels(cost)
    // Distinct enchant chime (R3) so the deterministic enchant gives clear
    // audible feedback instead of the generic block-place tick.
    yield* services.soundManager.playEffect('enchant', { position: tablePos })
  })

export const handleRightClick = (
  services: Pick<
    FrameHandlerServices,
    'blockService' | 'chunkManagerService' | 'soundManager' | 'hotbarService' | 'furnaceService' | 'timeService' | 'netherService' | 'inventoryService' | 'xpService' | 'multiplayer'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit>; readonly respawnPositionRef: MutableRef.MutableRef<Position> },
) =>
  Effect.gen(function* () {
    const hit = Option.getOrNull(context.targetHit)
    if (hit === null) return
    const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
    const targetBlockType = yield* readBlockTypeAt(services.chunkManagerService, targetPos)
    /* c8 ignore next 3 */
    if (targetBlockType === 'FURNACE') { yield* services.furnaceService.setSelectedFurnace(targetPos); return }
    /* c8 ignore next 2 */
    if (targetBlockType === 'BED') { yield* handleBed(services, context.respawnPositionRef, targetPos); return }
    /* c8 ignore next 3 */
    if (targetBlockType === 'ENCHANTING_TABLE') { yield* handleEnchantingTable(services, targetPos); return }

    const adjacentPos = adjacentToHit(hit)
    const chunkCoord = {
      x: Math.floor(adjacentPos.x / CHUNK_SIZE),
      z: Math.floor(adjacentPos.z / CHUNK_SIZE),
    }
    const coordKey = `${chunkCoord.x},${chunkCoord.z}`
    const adjLx = ((adjacentPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const adjLz = ((adjacentPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const selectedBlock = yield* services.hotbarService.getSelectedBlockType()
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const item = Option.getOrNull(selectedBlock)
    if (item === null) return
    /* c8 ignore next -- non-BlockType item in hotbar during right-click; tools/food handled before reaching here */
    if (!Schema.is(BlockTypeSchema)(item)) return
    yield* services.blockService.placeBlock(adjacentPos, item, SlotIndex.make(HOTBAR_START + selectedSlot))
    yield* services.soundManager.playEffect('blockPlace', { position: adjacentPos })
    // FR-3: broadcast the placement to other players (no-op offline).
    yield* (Option.getOrNull(services.multiplayer)?.sendBlockPlace(adjacentPos, item)) ?? Effect.void
    const updatedChunk = yield* services.chunkManagerService.getChunk(chunkCoord)
    yield* Ref.update(refs.dirtyChunksRef, (map) =>
      HashMap.set(map, coordKey, {
        chunk: updatedChunk,
        dirtyAABB: Option.some(aabbFromVoxel({ lx: adjLx, y: adjacentPos.y, lz: adjLz })),
      }),
    )
  })
