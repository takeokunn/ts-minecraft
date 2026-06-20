import { Effect, MutableRef, Option } from 'effect'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { CHUNK_SIZE, indexToBlockType, SlotIndex } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { enchantmentsOf } from '@ts-minecraft/inventory/domain/item-stack'
import type { Enchantment } from '@ts-minecraft/inventory/domain/enchantment.types'
import { getBlockHardness, computeBreakTicks } from '@ts-minecraft/block/domain/break-speed'
import { canHarvestBlock, isEffectiveTool } from '@ts-minecraft/world'
import type { TargetBlockHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import { blockIndexForWorldPosition, readChunkBlockId } from '@ts-minecraft/app/frame/stages/interaction-block-access'
import { advanceBreakProgress } from '@ts-minecraft/app/frame/stages/interaction-break-progress'
import { executeBlockBreak } from './interaction-break-handler.execute'
import type { BreakExecutionServices } from './interaction-break-handler.shared'
import { toSelectedInventoryItem, updateBreakProgressHud } from './interaction-break-handler.shared'

export type BreakProgressServices = BreakExecutionServices & Pick<FrameHandlerServices, 'hotbarService'>

export type BreakProgressRefs = Pick<FrameStageRefs, 'dirtyChunksRef' | 'breakProgressRef'>

export type BreakProgressContext = {
  readonly targetBlock: Option.Option<TargetBlockHit>
  readonly selectedHotbarItem: Option.Option<string>
  readonly targetEntityPresent: boolean
  readonly breakProgressElementOrNull: HTMLElement | null
  readonly creative: boolean
  readonly underwater: boolean
  readonly debugFlags: DebugFeatureFlags
}

const clearBreakProgress = (refs: BreakProgressRefs, breakProgressElementOrNull: HTMLElement | null) => {
  MutableRef.set(refs.breakProgressRef, null)
  updateBreakProgressHud(breakProgressElementOrNull, null)
}

export const handleBlockBreakProgress = (
  services: BreakProgressServices,
  refs: BreakProgressRefs,
  context: BreakProgressContext,
) =>
  Effect.gen(function* () {
    // Entity in range → break progress is cancelled (attack takes priority on click).
    if (context.targetEntityPresent || Option.isNone(context.targetBlock)) {
      clearBreakProgress(refs, context.breakProgressElementOrNull)
      return
    }

    const tb = Option.getOrNull(context.targetBlock)!
    const blockKey = `${tb.x},${tb.y},${tb.z}`
    const chunkCoord = { x: Math.floor(tb.x / CHUNK_SIZE), z: Math.floor(tb.z / CHUNK_SIZE) }
    const preBreakChunk = yield* services.chunkManagerService.getChunk(chunkCoord).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (preBreakChunk === null) {
      clearBreakProgress(refs, context.breakProgressElementOrNull)
      return
    }

    const lx = ((tb.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((tb.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const blockId = yield* readChunkBlockId(preBreakChunk.blocks, blockIndexForWorldPosition(tb))
    const blockType = indexToBlockType(blockId)

    if (context.creative) {
      clearBreakProgress(refs, context.breakProgressElementOrNull)
      yield* executeBlockBreak(services, refs, {
        pos: { x: tb.x, y: tb.y, z: tb.z },
        blockId,
        blockType,
        lx,
        lz,
        chunkCoord,
        hasSilkTouch: false,
        toolEnchantments: [],
        toolStack: Option.none(),
        selectedSlotIdx: 0,
        creative: true,
        debugFlags: context.debugFlags,
      })
      return
    }

    // Block requires a pickaxe the player doesn't have → never fill the progress bar.
    // canHarvestBlock returns false only when the block is in DIAMOND_PICKAXE_HARVESTABLE_BLOCKS
    // and the held item is not a qualifying pickaxe tier.
    const selectedInventoryItem = toSelectedInventoryItem(context.selectedHotbarItem)

    if (!canHarvestBlock(blockType, selectedInventoryItem)) {
      clearBreakProgress(refs, context.breakProgressElementOrNull)
      return
    }

    // Read hotbar slot + enchantments once here — used for EFFICIENCY (affects breakTicks)
    // and for FORTUNE/UNBREAKING/durability on break. Avoids duplicate slot reads.
    const selectedSlotIdx = yield* services.hotbarService.getSelectedSlot()
    const toolStack = yield* services.inventoryService.getSlot(SlotIndex.make(HOTBAR_START + selectedSlotIdx))
    const toolEnchantments = enchantmentsOf(toolStack)
    let efficiencyEnchant: Enchantment | undefined
    let hasSilkTouch = false
    for (const enchantment of toolEnchantments) {
      switch (enchantment.type) {
        case 'EFFICIENCY':
          efficiencyEnchant = enchantment
          break
        case 'SILK_TOUCH':
          hasSilkTouch = true
          break
      }
    }
    const helmetStack = yield* services.equipmentService.getEquippedItem('HELMET')
    let hasAquaAffinity = false
    for (const enchantment of enchantmentsOf(helmetStack)) {
      if (enchantment.type === 'AQUA_AFFINITY') {
        hasAquaAffinity = true
        break
      }
    }

    const hardness = getBlockHardness(blockType)
    // Wrong-category tools (e.g. a shovel on stone) get no speed bonus → bare-hand break time.
    const correctTool = isEffectiveTool(blockType, selectedInventoryItem)
    const baseBreakTicks = computeBreakTicks({
      hardness,
      tool: selectedInventoryItem,
      efficiencyLevel: efficiencyEnchant?.level,
      correctTool,
    })
    const breakTicks = context.underwater && !hasAquaAffinity ? baseBreakTicks * 5 : baseBreakTicks

    const current = MutableRef.get(refs.breakProgressRef)
    const progress = advanceBreakProgress({
      current,
      blockKey,
      breakTicks,
    })

    if (progress.shouldBreak) {
      clearBreakProgress(refs, context.breakProgressElementOrNull)
      yield* executeBlockBreak(services, refs, {
        pos: { x: tb.x, y: tb.y, z: tb.z },
        blockId,
        blockType,
        lx,
        lz,
        chunkCoord,
        hasSilkTouch,
        toolEnchantments,
        toolStack,
        selectedSlotIdx,
        creative: false,
        debugFlags: context.debugFlags,
      })
    } else {
      MutableRef.set(refs.breakProgressRef, progress.nextProgress)
      updateBreakProgressHud(context.breakProgressElementOrNull, progress.nextProgress)
    }
  })
