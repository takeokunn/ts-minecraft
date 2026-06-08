import { Effect, HashMap, MutableRef, Option, Ref, Schema } from 'effect'
import { aabbFromVoxel, detectNetherPortal } from '@ts-minecraft/world'
import type { Chunk } from '@ts-minecraft/world'
import { CHUNK_HEIGHT, CHUNK_SIZE, indexToBlockType, BlockTypeSchema, SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import type { BlockType, Position } from '@ts-minecraft/core'
import { HOTBAR_START, selectEnchantment, enchantXPCost, enchantItem } from '@ts-minecraft/inventory'
import type { FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-block-handler'

const TNT_BREAK_RADIUS = 4     // blocks broken within this radius

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

export const handleFlintAndSteel = (
  services: Pick<FrameHandlerServices, 'blockService' | 'chunkManagerService' | 'netherService' | 'soundManager'>,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
): Effect.Effect<boolean> =>
  Option.match(context.targetHit, {
    onNone: () => Effect.succeed(false),
    onSome: (hit) => {
      const hitBlockType = indexToBlockType(0) // TODO: resolve actual block type at hit position via chunk lookup
      if (hitBlockType !== 'AIR') {
        // FUTURE: TNT ignition logic — check targeted block type via async chunk lookup
      }
      const tntPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      const tntChunkCoord = { x: Math.floor(tntPos.x / CHUNK_SIZE), z: Math.floor(tntPos.z / CHUNK_SIZE) }
      return services.chunkManagerService.getChunk(tntChunkCoord).pipe(
        Effect.flatMap((tntChunk) => {
          const lx = ((tntPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const lz = ((tntPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const idx = tntPos.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
          const targetBlockType = indexToBlockType(tntChunk.blocks[idx] ?? 0)
          if (targetBlockType !== 'TNT') return handlePortalIgnition(services, refs, hit)
          // TNT explosion: remove TNT block + break nearby blocks in radius
          return Effect.gen(function* () {
            yield* services.blockService.forceSetBlock(tntPos, 'AIR').pipe(Effect.catchAll(() => Effect.void))
            yield* services.soundManager.playEffect('blockBreak', { position: tntPos })
            const breakPositions: Position[] = []
            for (let dx = -TNT_BREAK_RADIUS; dx <= TNT_BREAK_RADIUS; dx++) {
              for (let dy = -TNT_BREAK_RADIUS; dy <= TNT_BREAK_RADIUS; dy++) {
                for (let dz = -TNT_BREAK_RADIUS; dz <= TNT_BREAK_RADIUS; dz++) {
                  if (dx * dx + dy * dy + dz * dz <= TNT_BREAK_RADIUS * TNT_BREAK_RADIUS) {
                    breakPositions.push({ x: tntPos.x + dx, y: tntPos.y + dy, z: tntPos.z + dz })
                  }
                }
              }
            }
            yield* Effect.forEach(
              breakPositions,
              (pos) => services.blockService.forceSetBlock(pos, 'AIR').pipe(Effect.catchAll(() => Effect.void)),
              { concurrency: 'unbounded', discard: true },
            )
            return true
          })
        }),
        Effect.catchAll(() => handlePortalIgnition(services, refs, hit)),
      )
    },
  })

// Extracted portal ignition logic (was the original handleFlintAndSteel body).
const handlePortalIgnition = (
  services: Pick<FrameHandlerServices, 'blockService' | 'chunkManagerService' | 'netherService' | 'soundManager'>,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  hit: TargetRayHit,
): Effect.Effect<boolean> => {
      // Flint & steel ignites the air cell adjacent to the face that was right-clicked
      const ignitionPos = {
        x: hit.blockX + Math.round(hit.normal.x),
        y: hit.blockY + Math.round(hit.normal.y),
        z: hit.blockZ + Math.round(hit.normal.z),
      }
      const centerCx = Math.floor(ignitionPos.x / CHUNK_SIZE)
      const centerCz = Math.floor(ignitionPos.z / CHUNK_SIZE)
      const chunkCoords: Array<{ x: number; z: number }> = []
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          chunkCoords.push({ x: centerCx + dx, z: centerCz + dz })
        }
      }
      return Effect.all(
        chunkCoords.map((coord) =>
          services.chunkManagerService.getChunk(coord).pipe(
            Effect.map((chunk) => ({ coord, chunk })),
            Effect.option,
          ),
        ),
        { concurrency: 'unbounded' },
      ).pipe(
        Effect.flatMap((results) => {
          const chunkCache = new Map<string, Chunk>()
          for (const r of results) {
            if (r._tag === 'Some') {
              chunkCache.set(`${r.value.coord.x},${r.value.coord.z}`, r.value.chunk)
            }
          }
          const blockAt = buildBlockAtFromCache(chunkCache)
          const frame = detectNetherPortal(blockAt, ignitionPos)
          return Option.match(frame, {
            onNone: () => Effect.succeed(false),
            onSome: (portalFrame) => {
              // Collect unique affected chunks before mutating so we can update the dirty ref after
              const affectedCoords = new Map<string, { x: number; z: number }>()
              for (const pos of portalFrame.interior) {
                const cx = Math.floor(pos.x / CHUNK_SIZE)
                const cz = Math.floor(pos.z / CHUNK_SIZE)
                affectedCoords.set(`${cx},${cz}`, { x: cx, z: cz })
              }
              return Effect.all(
                portalFrame.interior.map((pos) =>
                  services.blockService.forceSetBlock(pos, 'NETHER_PORTAL').pipe(
                    Effect.catchAll(() => Effect.void),
                  ),
                ),
                { concurrency: 'unbounded' },
              ).pipe(
                // setBlockInChunk mutates blocks in-place so cached chunks reflect portal state
                Effect.andThen(
                  Ref.update(refs.dirtyChunksRef, (map) => {
                    let updated = map
                    for (const [coordKey] of affectedCoords) {
                      const chunk = chunkCache.get(coordKey)
                      if (chunk) {
                        updated = HashMap.set(updated, coordKey, { chunk, dirtyAABB: Option.none() })
                      }
                    }
                    return updated
                  }),
                ),
                Effect.andThen(services.netherService.registerPortal(ignitionPos, 'overworld')),
                Effect.andThen(services.soundManager.playEffect('blockPlace', { position: ignitionPos })),
                Effect.as(true),
              )
            },
          })
        }),
      )
    }
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
    const [selectedSlot, xp] = yield* Effect.all(
      [services.hotbarService.getSelectedSlot(), services.xpService.getXP()],
      { concurrency: 'unbounded' },
    )
    if (xp.level < 1) return
    const slotIndex = SlotIndex.make(HOTBAR_START + selectedSlot)
    const slot = yield* services.inventoryService.getSlot(slotIndex)
    if (Option.isNone(slot)) return
    const stack = slot.value
    if (!Schema.is(ItemTypeSchema)(stack.itemType)) return
    const enchantOpt = selectEnchantment(stack.itemType, xp.level)
    if (Option.isNone(enchantOpt)) return
    const enchantment = enchantOpt.value
    const cost = enchantXPCost(enchantment.level)
    const enchanted = enchantItem(stack, enchantment)
    yield* Effect.all(
      [
        services.inventoryService.setSlot(slotIndex, Option.some(enchanted)),
        services.xpService.spendLevels(cost),
        services.soundManager.playEffect('blockPlace', { position: tablePos }),
      ],
      { concurrency: 'unbounded', discard: true },
    )
  })

export const handleRightClick = (
  services: Pick<
    FrameHandlerServices,
    'blockService' | 'chunkManagerService' | 'soundManager' | 'hotbarService' | 'furnaceService' | 'timeService' | 'netherService' | 'inventoryService' | 'xpService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit>; readonly respawnPositionRef: MutableRef.MutableRef<Position> },
) =>
  Option.match(context.targetHit, {
    onNone: () => Effect.void,
    onSome: (hit) => {
      const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      const targetChunkCoord = {
        x: Math.floor(targetPos.x / CHUNK_SIZE),
        z: Math.floor(targetPos.z / CHUNK_SIZE),
      }
      return services.chunkManagerService.getChunk(targetChunkCoord).pipe(
        Effect.flatMap((targetChunk) => {
          const targetLx = ((targetPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const targetLz = ((targetPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const targetIdx = targetPos.y + targetLz * CHUNK_HEIGHT + targetLx * CHUNK_HEIGHT * CHUNK_SIZE
          const targetBlockType = indexToBlockType(targetChunk.blocks[targetIdx] ?? 0)
          /* c8 ignore next 3 */
          if (targetBlockType === 'FURNACE') return services.furnaceService.setSelectedFurnace(targetPos)
          /* c8 ignore next 2 */
          if (targetBlockType === 'BED') return handleBed(services, context.respawnPositionRef, targetPos)
          /* c8 ignore next 3 */
          if (targetBlockType === 'ENCHANTING_TABLE') return handleEnchantingTable(services, targetPos)

          const adjacentPos = {
            x: hit.blockX + Math.round(hit.normal.x),
            y: hit.blockY + Math.round(hit.normal.y),
            z: hit.blockZ + Math.round(hit.normal.z),
          }
          return Effect.all(
            [services.hotbarService.getSelectedBlockType(), services.hotbarService.getSelectedSlot()],
            { concurrency: 'unbounded' },
          ).pipe(
            Effect.flatMap(([selectedBlock, selectedSlot]) =>
              Option.match(selectedBlock, {
                onNone: () => Effect.void,
                onSome: (item) => {
                  /* c8 ignore next -- non-BlockType item in hotbar during right-click; tools/food handled before reaching here */
                  if (!Schema.is(BlockTypeSchema)(item)) return Effect.void
                  const chunkCoord = {
                    x: Math.floor(adjacentPos.x / CHUNK_SIZE),
                    z: Math.floor(adjacentPos.z / CHUNK_SIZE),
                  }
                  const coordKey = `${chunkCoord.x},${chunkCoord.z}`
                  const adjLx = ((adjacentPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  const adjLz = ((adjacentPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  return services.blockService
                    .placeBlock(adjacentPos, item, SlotIndex.make(HOTBAR_START + selectedSlot))
                    .pipe(
                      Effect.flatMap(() => services.soundManager.playEffect('blockPlace', { position: adjacentPos })),
                      Effect.andThen(services.chunkManagerService.getChunk(chunkCoord)),
                      Effect.flatMap((updatedChunk) =>
                        Ref.update(refs.dirtyChunksRef, (map) =>
                          HashMap.set(map, coordKey, {
                            chunk: updatedChunk,
                            dirtyAABB: Option.some(aabbFromVoxel({ lx: adjLx, y: adjacentPos.y, lz: adjLz })),
                          }),
                        ),
                      ),
                    )
                },
              }),
            ),
          )
        }),
      )
    },
  })
