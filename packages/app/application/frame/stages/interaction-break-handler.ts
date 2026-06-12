import { Effect, HashMap, HashSet, MutableRef, Option, Ref } from 'effect'
import { aabbFromVoxel, FORTUNE_ORE_BLOCKS, PICKAXE_BLOCK_TYPES, getInventoryDropForBlock, canHarvestBlock, isEffectiveTool, rollLeafDrops } from '@ts-minecraft/world'
import type { FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType, SlotIndex } from '@ts-minecraft/core'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import { HOTBAR_START, isDurable, rollFortuneExtraDrops, getUnbreakingSkipChance, enchantmentsOf } from '@ts-minecraft/inventory'
import type { Enchantment } from '@ts-minecraft/inventory'
import { getBlockHardness, computeBreakTicks, getOreXpDrop } from '@ts-minecraft/block'
import { getParticleUvOffset } from '@ts-minecraft/rendering/particles/particle-system'
import type { TargetBlockHit } from '@ts-minecraft/app/frame/stages/interaction-types'

type BreakExecutionServices = Pick<
  FrameHandlerServices,
  | 'blockService'
  | 'chunkManagerService'
  | 'debugFeatureFlags'
  | 'soundManager'
  | 'inventoryService'
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
}

const executeBlockBreak = (
  services: BreakExecutionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  ctx: BreakExecutionContext,
) =>
  Effect.gen(function* () {
    const { pos, blockId, blockType, lx, lz, chunkCoord, hasSilkTouch, toolEnchantments, toolStack, selectedSlotIdx } = ctx
    const coordKey = `${chunkCoord.x},${chunkCoord.z}`
    const debugFlags = yield* services.debugFeatureFlags.getFlags()
    const uv = getParticleUvOffset(blockId)

    yield* services.blockService.breakBlock(pos, hasSilkTouch)
    const mp = Option.getOrNull(services.multiplayer)
    yield* (mp !== null ? mp.sendBlockBreak(pos) : Effect.void)
    yield* services.soundManager.playEffect('blockBreak', { position: pos })
    if (debugFlags['particles.spawn']) {
      yield* services.particleSystem.spawnBurst(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5, uv.u, uv.v, 6)
    }

    const updatedChunk = yield* services.chunkManagerService.getChunk(chunkCoord)
    yield* Ref.update(refs.dirtyChunksRef, (map) =>
      HashMap.set(map, coordKey, {
        chunk: updatedChunk,
        dirtyAABB: Option.some(aabbFromVoxel({ lx, y: pos.y, lz })),
      }),
    )

    const xp = getOreXpDrop(blockType)
    if (xp > 0) yield* services.xpService.addXP(xp)

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

    // R69: LEAVES bonus drops on top of the LEAVES block itself (already removed by breakBlock).
    if (blockType === 'LEAVES') {
      const drops = rollLeafDrops(Math.random(), Math.random())
      if (drops.apple > 0) {
        yield* services.inventoryService.addBlock('APPLE', drops.apple).pipe(Effect.catchAllCause(() => Effect.void))
      }
      if (drops.sticks > 0) {
        yield* services.inventoryService.addBlock('STICKS', drops.sticks).pipe(Effect.catchAllCause(() => Effect.void))
      }
    }

    // SILK_TOUCH and FORTUNE are mutually exclusive (vanilla).
    if (!hasSilkTouch && HashSet.has(FORTUNE_ORE_BLOCKS, blockType)) {
      const fortune = Option.exists(toolStack, (s) => HashSet.has(PICKAXE_BLOCK_TYPES, s.itemType))
        ? toolEnchantments.find((e) => e.type === 'FORTUNE')
        : undefined
      if (fortune) {
        const extra = rollFortuneExtraDrops(fortune.level, Math.random())
        if (extra > 0) {
          yield* services.inventoryService.addBlock(getInventoryDropForBlock(blockType), extra)
            .pipe(Effect.catchAllCause(() => Effect.void))
        }
      }
    }

    // Durable tools lose 1 durability per block broken, respecting UNBREAKING skip chance.
    const heldItem = Option.getOrNull(toolStack)
    if (heldItem !== null && isDurable(heldItem.itemType)) {
      const unbreaking = toolEnchantments.find((e) => e.type === 'UNBREAKING')
      const skip = unbreaking ? Math.random() < getUnbreakingSkipChance(unbreaking.level) : false
      if (!skip) {
        yield* services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + selectedSlotIdx), 1)
          .pipe(Effect.catchAllCause(() => Effect.void))
      }
    }
  })

const updateBreakProgressHud = (
  el: HTMLElement | null,
  progress: { ticks: number; totalTicks: number } | null,
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

export const handleBlockBreakProgress = (
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'debugFeatureFlags'
    | 'soundManager'
    | 'inventoryService'
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
    const preBreakChunk = Option.getOrNull(
      yield* services.chunkManagerService.getChunk(chunkCoord).pipe(Effect.option),
    )
    if (preBreakChunk === null) {
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
      return
    }

    const lx = ((tb.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((tb.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const flatIdx = tb.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
    const blockId = preBreakChunk.blocks[flatIdx] ?? 0
    const blockType = indexToBlockType(blockId)

    // Block requires a pickaxe the player doesn't have → never fill the progress bar.
    // canHarvestBlock returns false only when the block is in DIAMOND_PICKAXE_HARVESTABLE_BLOCKS
    // and the held item is not a qualifying pickaxe tier.
    if (!canHarvestBlock(blockType, context.selectedHotbarItem as Option.Option<InventoryItem>)) {
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
      return
    }

    // Read hotbar slot + enchantments once here — used for EFFICIENCY (affects breakTicks)
    // and for FORTUNE/UNBREAKING/durability on break. Avoids duplicate slot reads.
    const selectedSlotIdx = yield* services.hotbarService.getSelectedSlot()
    const toolStack = yield* services.inventoryService.getSlot(SlotIndex.make(HOTBAR_START + selectedSlotIdx))
    const toolEnchantments = enchantmentsOf(toolStack)
    const efficiencyEnchant = toolEnchantments.find((e) => e.type === 'EFFICIENCY')
    const hasSilkTouch = toolEnchantments.some((e) => e.type === 'SILK_TOUCH')

    const hardness = getBlockHardness(blockType)
    // Wrong-category tools (e.g. a shovel on stone) get no speed bonus → bare-hand break time.
    const correctTool = isEffectiveTool(blockType, context.selectedHotbarItem as Option.Option<InventoryItem>)
    const breakTicks = computeBreakTicks(hardness, context.selectedHotbarItem, efficiencyEnchant?.level, correctTool)

    const current = MutableRef.get(refs.breakProgressRef)
    const currentTicks = current !== null && current.blockKey === blockKey ? current.ticks : 0
    const newTicks = currentTicks + 1

    if (breakTicks === 0 || newTicks >= breakTicks) {
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
      })
    } else {
      MutableRef.set(refs.breakProgressRef, { blockKey, ticks: newTicks, totalTicks: breakTicks })
      updateBreakProgressHud(context.breakProgressElementOrNull, { ticks: newTicks, totalTicks: breakTicks })
    }
  })
