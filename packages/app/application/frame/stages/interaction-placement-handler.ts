import { Effect, HashMap, MutableRef, Option, Schema } from 'effect'
import { aabbFromVoxel } from '@ts-minecraft/world'
import { CHUNK_SIZE, BlockTypeSchema, ItemTypeSchema } from '@ts-minecraft/core'
import type { BlockType, Position } from '@ts-minecraft/core'
import { selectEnchantment, enchantXPCost, enchantItem } from '@ts-minecraft/inventory'
import type { FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import type {
  FrameBedInteractionServices,
  FrameDoorInteractionServices,
  FrameEnchantingTableInteractionServices,
  FrameRightClickInteractionServices,
} from '@ts-minecraft/app/frame/frame-interaction-service-types'
import { markChunkDirtyAt, readBlockTypeAt } from './interaction-block-access'
import { adjacentToHit, buildTntBreakPositions } from './placement-geometry'
import { resolveRightClickTargetRoute } from './interaction-right-click-target-routing'
import { selectedHotbarSlotIndex } from './selected-hotbar-slot'

export { adjacentToHit, buildTntBreakPositions }
export { handleBucket } from './interaction-bucket-handler/bucket-handler'
export { handleFlintAndSteel } from './interaction-flint-steel-handler'

// Right-clicking a BED block at night skips to dawn and sets the player's spawn point.
// In the nether, sleeping causes an explosion in vanilla; here we just do nothing (safe mode).
export const handleBed = (
  services: FrameBedInteractionServices,
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

export const handleDoor = (
  services: FrameDoorInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  doorPos: { readonly x: number; readonly y: number; readonly z: number },
  current: BlockType,
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const next = current === 'DOOR' ? 'DOOR_OPEN' : current === 'DOOR_OPEN' ? 'DOOR' : null
    if (next === null) return false

    const abovePos = { x: doorPos.x, y: doorPos.y + 1, z: doorPos.z }
    const belowPos = { x: doorPos.x, y: doorPos.y - 1, z: doorPos.z }
    const above = yield* readBlockTypeAt(services.chunkManagerService, abovePos)
    const below = yield* readBlockTypeAt(services.chunkManagerService, belowPos)
    const partnerPos = above === current ? abovePos : below === current ? belowPos : null

    yield* services.blockService.forceSetBlock(doorPos, next)
    yield* markChunkDirtyAt(services.chunkManagerService, refs.dirtyChunksRef, doorPos)
    if (partnerPos !== null) {
      yield* services.blockService.forceSetBlock(partnerPos, next)
      yield* markChunkDirtyAt(services.chunkManagerService, refs.dirtyChunksRef, partnerPos)
    }
    yield* services.soundManager.playEffect('blockPlace', { position: doorPos })
    return true
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))

// Right-clicking an ENCHANTING_TABLE enchants the held item using the player's XP.
// Deterministic: same item + same XP level → same enchantment every time.
// Consumes enchLevel XP levels. No lapis cost (simplified vs vanilla).
const handleEnchantingTable = (
  services: FrameEnchantingTableInteractionServices,
  tablePos: { readonly x: number; readonly y: number; readonly z: number },
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const xp = yield* services.xpService.getXP()
    if (xp.level < 1) return
    const slotIndex = selectedHotbarSlotIndex(selectedSlot)
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
  services: FrameRightClickInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit>; readonly respawnPositionRef: MutableRef.MutableRef<Position> },
) =>
  Effect.gen(function* () {
    const hit = Option.getOrNull(context.targetHit)
    if (hit === null) return
    const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
    const targetBlockType = yield* readBlockTypeAt(services.chunkManagerService, targetPos).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (targetBlockType === null) return
    const route = resolveRightClickTargetRoute(targetPos, targetBlockType)
    if (route !== null) {
      switch (route.kind) {
        case 'chest': {
          yield* services.chestService.setSelectedChest(route.targetPos)
          const inventoryOpen = yield* services.inventoryRenderer.isOpen()
          if (!inventoryOpen) yield* services.inventoryRenderer.toggle()
          return
        }
        case 'furnace':
          yield* services.furnaceService.setSelectedFurnace(route.targetPos)
          return
        case 'bed':
          yield* handleBed(services, context.respawnPositionRef, route.targetPos)
          return
        case 'enchantingTable':
          yield* handleEnchantingTable(services, route.targetPos)
          return
        case 'door':
          yield* handleDoor(services, refs, route.targetPos, route.blockType)
          return
      }
    }

    const adjacentPos = adjacentToHit(hit)
    const chunkCoord = {
      x: Math.floor(adjacentPos.x / CHUNK_SIZE),
      z: Math.floor(adjacentPos.z / CHUNK_SIZE),
    }
    const coordKey = `${chunkCoord.x},${chunkCoord.z}`
    const adjLx = ((adjacentPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const adjLz = ((adjacentPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const selectedBlock = yield* services.hotbarService.getSelectedBlockType()
    const item = Option.getOrNull(selectedBlock)
    if (item === null) return
    if (!Schema.is(BlockTypeSchema)(item)) return
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    yield* services.blockService.placeBlock(
      adjacentPos,
      item,
      selectedHotbarSlotIndex(selectedSlot),
    )
    yield* services.soundManager.playEffect('blockPlace', { position: adjacentPos })
    // FR-3: broadcast the placement to other players (no-op offline).
    yield* (Option.getOrNull(services.multiplayer)?.sendBlockPlace(adjacentPos, item)) ?? Effect.void
    const updatedChunk = yield* services.chunkManagerService.getChunk(chunkCoord)
    MutableRef.set(
      refs.dirtyChunksRef,
      HashMap.set(MutableRef.get(refs.dirtyChunksRef), coordKey, {
        chunk: updatedChunk,
        dirtyAABB: Option.some(aabbFromVoxel({ lx: adjLx, y: adjacentPos.y, lz: adjLz })),
      }),
    )
  })
