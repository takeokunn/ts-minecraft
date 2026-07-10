import { Effect, HashMap, MutableRef, Option, Schema } from 'effect'
import { aabbFromVoxel } from '@ts-minecraft/world'
import { CHUNK_SIZE, BlockTypeSchema, ItemTypeSchema, type SlotIndex } from '@ts-minecraft/core'
import type { BlockType, Position } from '@ts-minecraft/core'
import { RedstoneComponentType } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import { selectEnchantment } from '@ts-minecraft/inventory/domain/enchantment-applicability'
import { enchantXPCost } from '@ts-minecraft/inventory/domain/enchantment'
import { enchantItem, ItemStack, renameStack } from '@ts-minecraft/inventory/domain/item-stack'
import { getMaxDurability } from '@ts-minecraft/inventory/domain/durability'
import { anvilRepairCostLevels } from '@ts-minecraft/inventory/domain/anvil'
import { TNT_EXPLOSION_POWER } from '@ts-minecraft/entity/domain/explosion'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import type { FrameBedInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/bed'
import type { FrameDoorInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/door'
import type { FrameEnchantingTableInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/enchanting-table'
import type { FrameRightClickInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/right-click'
import { markChunkDirtyAt, readBlockTypeAt } from './interaction-block-access'
import { adjacentToHit, buildExplosionBreakPositions } from './placement-geometry'
import { resolveRightClickTargetRoute } from './interaction-right-click-target-routing'
import { selectedHotbarSlotIndex } from './selected-hotbar-slot'
import { applyExplosionPlayerDamage } from '@ts-minecraft/entity/application/explosion-service'

// Sleep-blocking hostiles (vanilla checks any monster in range).
const HOSTILE_MOB_TYPES_FOR_SLEEP: ReadonlySet<string> = new Set([
  'Zombie', 'Skeleton', 'Spider', 'Creeper', 'Enderman', 'Witch', 'Drowned', 'ZombieVillager', 'Endermite',
])

const BED_EXPLOSION_BREAK_RADIUS = 4

// Right-clicking a BED block at night skips to dawn and sets the player's spawn point.
// In the nether, sleeping detonates the bed instead of setting a spawn point.
export const handleBed = (
  services: FrameBedInteractionServices,
  respawnPositionRef: MutableRef.MutableRef<Position>,
  bedPos: { readonly x: number; readonly y: number; readonly z: number },
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const dimension = yield* services.netherService.getDimension()
    if (dimension === 'nether') {
      yield* services.soundManager.playEffect('blockBreak', { position: bedPos })
      const multiplayerOrNull = Option.getOrNull(services.multiplayer)
      for (const pos of buildExplosionBreakPositions(bedPos, BED_EXPLOSION_BREAK_RADIUS)) {
        yield* services.blockService.forceSetBlock(pos, 'AIR').pipe(Effect.catchAll(() => Effect.void))
        // Crater must reach co-op peers (and the server edit log for late joiners).
        yield* multiplayerOrNull?.sendBlockBreak(pos) ?? Effect.void
      }
      yield* applyExplosionPlayerDamage(services, bedPos, TNT_EXPLOSION_POWER)
      return true
    }
    // Vanilla: monsters nearby prevent sleep (8 blocks horizontal, 5 vertical).
    const entities = yield* services.entityManager.getEntities()
    const monsterNearby = entities.some((entity) =>
      HOSTILE_MOB_TYPES_FOR_SLEEP.has(entity.type)
      && Math.abs(entity.position.x - bedPos.x) <= 8
      && Math.abs(entity.position.z - bedPos.z) <= 8
      && Math.abs(entity.position.y - bedPos.y) <= 5)
    if (monsterNearby) {
      yield* services.sleepOverlay.showMessage('You may not rest now; there are monsters nearby')
      return true
    }

    const isNight = yield* services.timeService.isNight()
    if (!isNight) {
      // Vanilla refusal message; handled=true so the click doesn't fall
      // through to block placement against the bed.
      yield* services.sleepOverlay.showMessage('You can only sleep at night')
      return true
    }
    // Fade to black while the clock jumps — the dawn skip happens under the
    // overlay instead of the sky visibly snapping.
    yield* services.sleepOverlay.playSleepFade()
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
// Consumes the selected enchantment cost in XP levels and lapis lazuli.
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
    const paidLapis = yield* services.inventoryService.removeBlock('LAPIS_LAZULI', cost).pipe(
      Effect.as(true),
      Effect.catchAll(() => Effect.succeed(false)),
    )
    if (!paidLapis) return
    const enchanted = enchantItem(stack, enchantment)
    yield* services.inventoryService.setSlot(slotIndex, Option.some(enchanted))
    yield* services.xpService.spendLevels(cost)
    // Distinct enchant chime (R3) so the deterministic enchant gives clear
    // audible feedback instead of the generic block-place tick.
    yield* services.soundManager.playEffect('enchant', { position: tablePos })
  })

// Vanilla anvil rename costs a flat 1 XP level.
const ANVIL_RENAME_COST_LEVELS = 1

// Asks the player for an item name via the native prompt — synchronous, exits
// pointer lock automatically, and needs no modal/keyboard-shield infra. In
// non-browser environments (unit tests) there is no prompt → rename is a no-op.
/* c8 ignore start */
const promptForItemName = (currentName: string): string | null =>
  typeof window !== 'undefined' && typeof window.prompt === 'function'
    ? window.prompt('Name this item:', currentName)
    : null
/* c8 ignore stop */

// Renames the held item for 1 XP level (vanilla). A blank name clears the
// custom name; cancelling the prompt (null) or an unchanged name is free.
const handleAnvilRename = (
  services: FrameEnchantingTableInteractionServices,
  anvilPos: { readonly x: number; readonly y: number; readonly z: number },
  slotIndex: SlotIndex,
  stack: ItemStack,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const entered = promptForItemName(stack.customName ?? '')
    if (entered === null) return
    const renamed = renameStack(stack, entered)
    if (renamed.customName === stack.customName) return
    const xp = yield* services.xpService.getXP()
    if (xp.level < ANVIL_RENAME_COST_LEVELS) return
    yield* services.inventoryService.setSlot(slotIndex, Option.some(renamed))
    yield* services.xpService.spendLevels(ANVIL_RENAME_COST_LEVELS)
    yield* services.soundManager.playEffect('entityHit', { position: anvilPos })
  })

// Right-clicking an ANVIL repairs the held damaged tool/armor piece to full
// durability for an XP-level cost proportional to the missing durability
// (see anvilRepairCostLevels). Enchantments are preserved. An undamaged (or
// non-durable) held item routes to RENAME instead.
const handleAnvilRepair = (
  services: FrameEnchantingTableInteractionServices,
  anvilPos: { readonly x: number; readonly y: number; readonly z: number },
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const slotIndex = selectedHotbarSlotIndex(selectedSlot)
    const slot = yield* services.inventoryService.getSlot(slotIndex)
    const stack = Option.getOrNull(slot)
    if (stack === null) return
    const maxDurability = Option.getOrNull(getMaxDurability(stack.itemType))
    const cost = stack.durability !== null && maxDurability !== null
      ? anvilRepairCostLevels(stack.durability, maxDurability)
      : 0
    if (cost === 0 || maxDurability === null) {
      return yield* handleAnvilRename(services, anvilPos, slotIndex, stack)
    }
    const xp = yield* services.xpService.getXP()
    if (xp.level < cost) return
    yield* services.inventoryService.setSlot(
      slotIndex,
      Option.some(new ItemStack({
        itemType: stack.itemType,
        count: stack.count,
        durability: maxDurability,
        enchantments: stack.enchantments,
        customName: stack.customName,
      })),
    )
    yield* services.xpService.spendLevels(cost)
    // Metallic clank — the closest existing cue to a vanilla anvil hit.
    yield* services.soundManager.playEffect('entityHit', { position: anvilPos })
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
        case 'craftingTable': {
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
        case 'anvil':
          yield* handleAnvilRepair(services, route.targetPos)
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
    if (item === 'PRESSURE_PLATE') {
      yield* services.redstoneService.setComponent(adjacentPos, RedstoneComponentType.PressurePlate)
    }
    if (item === 'REDSTONE_LAMP') {
      yield* services.redstoneService.setComponent(adjacentPos, RedstoneComponentType.Lamp)
    }
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
