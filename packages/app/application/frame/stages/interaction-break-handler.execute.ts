import { Effect, HashMap, HashSet, MutableRef, Option } from 'effect'
import {
  aabbFromVoxel,
  blockDropsBaseItem,
  FORTUNE_ORE_BLOCKS,
  getBlockDropCount,
  getInventoryDropForBlock,
  rollGrassSeedDrop,
  rollLeafDrops,
} from '@ts-minecraft/world'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { SlotIndex } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { isDurable } from '@ts-minecraft/inventory/domain/durability'
import { rollFortuneExtraDrops, getUnbreakingSkipChance } from '@ts-minecraft/inventory/domain/enchantment'
import { getOreXpDropOption } from '@ts-minecraft/block/domain/blocks.config.ores'
import { getParticleUvOffset } from '@ts-minecraft/rendering'
import type { BreakExecutionContext, BreakExecutionServices } from './interaction-break-handler.shared'
import {
  isNeverDroppedBlock,
  REDSTONE_CLEANUP_BLOCK_TYPES,
  resolveBreakExecutionEnchantments,
  spawnBlockDrop,
  spawnBlockXpOrb,
} from './interaction-break-handler.shared'
import { isGrassSeedDropBlock as isGrassSeedDropBlockWorld } from '@ts-minecraft/world'
import { CROP_DROP_RULES } from './interaction-break-handler.crop-drops.config'

// Bed-respawn invalidation hook, installed by interaction-stage (which owns
// deps.respawnPositionRef). Breaking a BED whose head/foot cell backs the
// current respawn point falls back to the world spawn (vanilla "bed missing").
let bedRespawnInvalidator: ((pos: { x: number; y: number; z: number }) => void) | null = null
export const setBedRespawnInvalidator = (cb: ((pos: { x: number; y: number; z: number }) => void) | null): void => {
  bedRespawnInvalidator = cb
}

export const executeBlockBreak = (
  services: BreakExecutionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  ctx: BreakExecutionContext,
) =>
  Effect.gen(function* () {
    const { pos, blockId, blockType, lx, lz, chunkCoord, hasSilkTouch, toolEnchantments, toolStack, selectedSlotIdx, creative, debugFlags } = ctx
    const coordKey = `${chunkCoord.x},${chunkCoord.z}`
    const uv = getParticleUvOffset(blockId)
    const heldItem = Option.getOrNull(toolStack)
    const shearsHarvestsGrass = isGrassSeedDropBlockWorld(blockType) && heldItem?.itemType === 'SHEARS'
    const cropDropRule = CROP_DROP_RULES.get(blockType)

    if (blockType === 'BED' && bedRespawnInvalidator !== null) {
      yield* Effect.sync(() => bedRespawnInvalidator?.(pos))
    }

    if (creative) {
      yield* services.blockService.breakBlock(pos, false, { requireHarvest: false, dropItems: false })
    } else {
      yield* services.blockService.breakBlock(pos, hasSilkTouch || shearsHarvestsGrass, { dropItems: false })
    }
    if (REDSTONE_CLEANUP_BLOCK_TYPES.has(blockType)) {
      yield* services.redstoneService.removeComponent(pos)
    }
    const mp = Option.getOrNull(services.multiplayer)
    yield* (mp !== null ? mp.sendBlockBreak(pos) : Effect.void)
    yield* services.soundManager.playEffect('blockBreak', { position: pos })
    if (debugFlags['particles.spawn']) {
      yield* services.particleSystem.spawnBurst(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5, uv.u, uv.v, 6)
    }

    const updatedChunk = yield* services.chunkManagerService.getChunk(chunkCoord)
    MutableRef.set(
      refs.dirtyChunksRef,
      HashMap.set(MutableRef.get(refs.dirtyChunksRef), coordKey, {
        chunk: updatedChunk,
        dirtyAABB: Option.some(aabbFromVoxel({ lx, y: pos.y, lz })),
      }),
    )

    if (creative) return

    // Statistics feed the achievement system; creative breaks don't count (vanilla).
    yield* services.statisticsService.recordBlockMined(blockType)

    const shouldSpawnBaseDrop =
      !isNeverDroppedBlock(blockType) &&
      cropDropRule === undefined &&
      (hasSilkTouch || shearsHarvestsGrass || blockDropsBaseItem(blockType)) &&
      (!isGrassSeedDropBlockWorld(blockType) || hasSilkTouch || shearsHarvestsGrass)
    if (shouldSpawnBaseDrop) {
      const dropItem = hasSilkTouch || shearsHarvestsGrass ? blockType : getInventoryDropForBlock(blockType)
      const dropCount = hasSilkTouch || shearsHarvestsGrass ? 1 : getBlockDropCount(blockType)
      yield* spawnBlockDrop(services, pos, dropItem, dropCount)
    }

    const oreXp = Option.getOrNull(getOreXpDropOption(blockType))
    if (oreXp !== null && oreXp > 0) {
      yield* spawnBlockXpOrb(services, pos, oreXp)
    }

    if (cropDropRule !== undefined) {
      const wasRipe = yield* services.cropGrowthService.harvest(pos)
      const drops = wasRipe ? cropDropRule.ripeDrops(Math.random()) : cropDropRule.unripeDrops
      for (const [itemType, count] of drops) {
        yield* spawnBlockDrop(services, pos, itemType, count)
      }
    }

    if (!hasSilkTouch && !shearsHarvestsGrass && isGrassSeedDropBlockWorld(blockType)) {
      const seedCount = rollGrassSeedDrop(Math.random())
      if (seedCount > 0) {
        yield* spawnBlockDrop(services, pos, 'WHEAT_SEEDS', seedCount)
      }
    }

    // R69: LEAVES bonus drops on top of the LEAVES block itself.
    if (blockType === 'LEAVES') {
      const drops = rollLeafDrops(Math.random(), Math.random(), Math.random())
      if (drops.apple > 0) {
        yield* spawnBlockDrop(services, pos, 'APPLE', drops.apple)
      }
      if (drops.sticks > 0) {
        yield* spawnBlockDrop(services, pos, 'STICKS', drops.sticks)
      }
      if (drops.saplings > 0) {
        yield* spawnBlockDrop(services, pos, 'SAPLING', drops.saplings)
      }
    }

    // SILK_TOUCH and FORTUNE are mutually exclusive (vanilla).
    // Resolve both FORTUNE and UNBREAKING upfront — UNBREAKING applies to all blocks, not just ores.
    const { fortune, unbreaking } = resolveBreakExecutionEnchantments(toolEnchantments)
    if (!hasSilkTouch && fortune && HashSet.has(FORTUNE_ORE_BLOCKS, blockType)) {
      const extra = rollFortuneExtraDrops(fortune.level, Math.random())
      if (extra > 0) {
        yield* spawnBlockDrop(services, pos, getInventoryDropForBlock(blockType), extra)
      }
    }

    // Durable tools lose 1 durability per block broken, respecting UNBREAKING skip chance.
    if (heldItem !== null && isDurable(heldItem.itemType)) {
      const skip = unbreaking ? Math.random() < getUnbreakingSkipChance(unbreaking.level) : false
      if (!skip) {
        yield* services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + selectedSlotIdx), 1)
          .pipe(Effect.catchAllCause(() => Effect.void))
      }
    }
  })
