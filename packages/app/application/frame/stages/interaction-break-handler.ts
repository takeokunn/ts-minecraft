import { Effect, HashMap, HashSet, MutableRef, Option, Schema } from 'effect'
import { aabbFromVoxel, FORTUNE_ORE_BLOCKS, getInventoryDropForBlock, canHarvestBlock, isEffectiveTool, rollGrassSeedDrop, isGrassSeedDropBlock, rollLeafDrops } from '@ts-minecraft/world'
import type { FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { CHUNK_SIZE, indexToBlockType, InventoryItemSchema, SlotIndex } from '@ts-minecraft/core'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import { HOTBAR_START, isDurable, rollFortuneExtraDrops, getUnbreakingSkipChance, enchantmentsOf } from '@ts-minecraft/inventory'
import type { Enchantment } from '@ts-minecraft/inventory'
import { getBlockHardness, computeBreakTicks, getOreXpDropOption } from '@ts-minecraft/block'
import { getParticleUvOffset } from '@ts-minecraft/rendering'
import type { TargetBlockHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import type { DebugFeatureFlags } from '@ts-minecraft/app/debug-feature-flags'
import { addExperienceWithMending } from '@ts-minecraft/app/application/frame/stages/xp-mending'
import { blockIndexForWorldPosition, readChunkBlockId } from '@ts-minecraft/app/frame/stages/interaction-block-access'
import { advanceBreakProgress, type BreakProgressState } from '@ts-minecraft/app/frame/stages/interaction-break-progress'

type BreakExecutionServices = Pick<
  FrameHandlerServices,
  | 'blockService'
  | 'chunkManagerService'
  | 'soundManager'
  | 'inventoryService'
  | 'equipmentService'
  | 'particleSystem'
  | 'xpService'
  | 'multiplayer'
  | 'cropGrowthService'
>

type BreakExecutionContext = {
  readonly pos: { readonly x: number; readonly y: number; readonly z: number }
  readonly blockId: number
  readonly blockType: BlockType
  readonly lx: number
  readonly lz: number
  readonly chunkCoord: { readonly x: number; readonly z: number }
  readonly hasSilkTouch: boolean
  readonly toolEnchantments: ReadonlyArray<Enchantment>
  readonly toolStack: Option.Option<{ readonly itemType: InventoryItem; readonly count: number }>
  readonly selectedSlotIdx: number
  readonly creative: boolean
  readonly debugFlags: DebugFeatureFlags
}

const executeBlockBreak = (
  services: BreakExecutionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  ctx: BreakExecutionContext,
) =>
  Effect.gen(function* () {
    const { pos, blockId, blockType, lx, lz, chunkCoord, hasSilkTouch, toolEnchantments, toolStack, selectedSlotIdx, creative, debugFlags } = ctx
    const coordKey = `${chunkCoord.x},${chunkCoord.z}`
    const uv = getParticleUvOffset(blockId)
    const heldItem = Option.getOrNull(toolStack)
    const shearsHarvestsGrass = isGrassSeedDropBlock(blockType) && heldItem?.itemType === 'SHEARS'

    if (creative) {
      yield* services.blockService.breakBlock(pos, false, { requireHarvest: false, dropItems: false })
    } else {
      yield* services.blockService.breakBlock(pos, hasSilkTouch || shearsHarvestsGrass)
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

    const oreXp = Option.getOrNull(getOreXpDropOption(blockType))
    if (oreXp !== null && oreXp > 0) {
      yield* addExperienceWithMending(oreXp, services)
    }

    if (blockType === 'WHEAT_CROP') {
      const wasRipe = yield* services.cropGrowthService.harvest(pos)
      if (wasRipe) {
        const seedCount = Math.floor(Math.random() * 4) + 1
        yield* services.inventoryService.addBlock('WHEAT', 1).pipe(Effect.catchAllCause(() => Effect.void))
        yield* services.inventoryService.addBlock('WHEAT_SEEDS', seedCount).pipe(Effect.catchAllCause(() => Effect.void))
      } else {
        yield* services.inventoryService.addBlock('WHEAT_SEEDS', 1).pipe(Effect.catchAll(() => Effect.void))
      }
    }

    if (!hasSilkTouch && !shearsHarvestsGrass && isGrassSeedDropBlock(blockType)) {
      const seedCount = rollGrassSeedDrop(Math.random())
      if (seedCount > 0) {
        yield* services.inventoryService.addBlock('WHEAT_SEEDS', seedCount).pipe(Effect.catchAllCause(() => Effect.void))
      }
    }

    // R69: LEAVES bonus drops on top of the LEAVES block itself (already removed by breakBlock).
    if (blockType === 'LEAVES') {
      const drops = rollLeafDrops(Math.random(), Math.random(), Math.random())
      if (drops.apple > 0) {
        yield* services.inventoryService.addBlock('APPLE', drops.apple).pipe(Effect.catchAllCause(() => Effect.void))
      }
      if (drops.sticks > 0) {
        yield* services.inventoryService.addBlock('STICKS', drops.sticks).pipe(Effect.catchAllCause(() => Effect.void))
      }
      if (drops.saplings > 0) {
        yield* services.inventoryService.addBlock('SAPLING', drops.saplings).pipe(Effect.catchAllCause(() => Effect.void))
      }
    }

    // SILK_TOUCH and FORTUNE are mutually exclusive (vanilla).
    let unbreaking: Enchantment | undefined
    if (!hasSilkTouch && HashSet.has(FORTUNE_ORE_BLOCKS, blockType)) {
      let fortune: Enchantment | undefined
      for (const enchantment of toolEnchantments) {
        switch (enchantment.type) {
          case 'FORTUNE':
            fortune = enchantment
            break
          case 'UNBREAKING':
            unbreaking = enchantment
            break
        }
      }
      if (fortune) {
        const extra = rollFortuneExtraDrops(fortune.level, Math.random())
        if (extra > 0) {
          yield* services.inventoryService.addBlock(getInventoryDropForBlock(blockType), extra)
            .pipe(Effect.catchAllCause(() => Effect.void))
        }
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

const updateBreakProgressHud = (
  el: HTMLElement | null,
  progress: BreakProgressState | null,
): void => {
  if (el === null) return
  if (progress === null) {
    el.style.display = 'none'
    return
  }
  el.setAttribute('value', String(progress.ticks))
  el.setAttribute('max', String(progress.totalTicks))
  el.style.display = 'block'
}

const toSelectedInventoryItem = (item: Option.Option<string>): Option.Option<InventoryItem> =>
  Option.isNone(item)
    ? Option.none()
    : Schema.is(InventoryItemSchema)(item.value)
      ? Option.some(item.value as InventoryItem)
      : Option.none()

export const handleBlockBreakProgress = (
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'soundManager'
    | 'inventoryService'
    | 'equipmentService'
    | 'hotbarService'
    | 'particleSystem'
    | 'xpService'
    | 'multiplayer'
    | 'cropGrowthService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef' | 'breakProgressRef'>,
  context: {
    readonly targetBlock: Option.Option<TargetBlockHit>
    readonly selectedHotbarItem: Option.Option<string>
    readonly targetEntityPresent: boolean
    readonly breakProgressElementOrNull: HTMLElement | null
    readonly creative: boolean
    readonly underwater: boolean
    readonly debugFlags: DebugFeatureFlags
  },
) =>
  Effect.gen(function* () {
    // Entity in range → break progress is cancelled (attack takes priority on click).
    if (context.targetEntityPresent || Option.isNone(context.targetBlock)) {
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
      return
    }

    const tb = Option.getOrNull(context.targetBlock)!
    const blockKey = `${tb.x},${tb.y},${tb.z}`
    const chunkCoord = { x: Math.floor(tb.x / CHUNK_SIZE), z: Math.floor(tb.z / CHUNK_SIZE) }
    const preBreakChunk = yield* services.chunkManagerService.getChunk(chunkCoord).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (preBreakChunk === null) {
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
      return
    }

    const lx = ((tb.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((tb.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const blockId = yield* readChunkBlockId(preBreakChunk.blocks, blockIndexForWorldPosition(tb))
    const blockType = indexToBlockType(blockId)

    if (context.creative) {
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
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
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
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
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
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
