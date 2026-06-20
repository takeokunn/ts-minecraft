import { describe, it } from '@effect/vitest'
import { Effect, Either, HashMap, MutableRef, Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, SlotIndex, blockTypeToIndex } from '@ts-minecraft/core'
import type { BlockType, InventoryItem, Position } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { expect, vi } from 'vitest'
import { handleBlockBreakProgress } from '@ts-minecraft/app/frame/stages/interaction-break-handler'
import type {
  BreakProgressContext,
  BreakProgressRefs,
  BreakProgressServices,
} from '@ts-minecraft/app/application/frame/stages/interaction-break-handler.progress'

type TestEnchantment =
  | { readonly type: 'AQUA_AFFINITY'; readonly level: number }
  | { readonly type: 'EFFICIENCY'; readonly level: number }
  | { readonly type: 'FORTUNE'; readonly level: number }
  | { readonly type: 'SILK_TOUCH'; readonly level: number }
  | { readonly type: 'UNBREAKING'; readonly level: number }

type TestStack = {
  readonly itemType: InventoryItem
  readonly count: number
  readonly enchantments?: ReadonlyArray<TestEnchantment>
}

type TestServicesOptions = {
  readonly blockType?: BlockType
  readonly position?: Position
  readonly selectedItem?: InventoryItem
  readonly toolStack?: Option.Option<TestStack>
  readonly helmet?: Option.Option<TestStack>
  readonly harvestRipeCrop?: boolean
  readonly failChunkLoad?: boolean
  readonly chunkStorageLength?: number
  readonly failAddBlockItems?: ReadonlySet<InventoryItem>
  readonly failDroppedItems?: ReadonlySet<InventoryItem>
  readonly multiplayer?: { readonly sendBlockBreak: ReturnType<typeof vi.fn> }
}

describe('handleBlockBreakProgress', () => {
  const defaultPosition: Position = { x: 1, y: 64, z: 0 }

  const blockIndex = (x: number, y: number, z: number) => {
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    return y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
  }

  const makeChunkWithBlock = ({ x, y, z }: Position, blockType: BlockType, storageLength?: number) => {
    const blocks = new Uint16Array(storageLength ?? CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE)
    const idx = blockIndex(x, y, z)
    if (idx < blocks.length) {
      blocks[idx] = blockTypeToIndex(blockType)
    }
    return { blocks }
  }

  const makeRefs = () =>
    Effect.sync(() => {
      const dirtyChunksRef = MutableRef.make(HashMap.empty<string, unknown>())
      return {
        dirtyChunksRef,
        breakProgressRef: MutableRef.make<{ blockKey: string; ticks: number; totalTicks: number } | null>(null),
      }
    })

  const makeBreakProgressElement = () => {
    const attrs = new Map<string, string>()
    return {
      attrs,
      style: { display: 'initial' },
      setAttribute: vi.fn((name: string, value: string) => {
        attrs.set(name, value)
      }),
    } as unknown as HTMLElement & { readonly attrs: Map<string, string> }
  }

  const makeToolStack = (
    itemType: InventoryItem,
    enchantments: ReadonlyArray<TestEnchantment> = [],
  ): Option.Option<TestStack> => Option.some({ itemType, count: 1, enchantments })

  const makeServices = (options: TestServicesOptions = {}) => {
    const position = options.position ?? defaultPosition
    const chunk = makeChunkWithBlock(position, options.blockType ?? 'STONE', options.chunkStorageLength)
    const selectedItem = options.selectedItem ?? 'DIAMOND_PICKAXE'
    const toolStack = options.toolStack ?? makeToolStack(selectedItem)
    const breakSpy = vi.fn(() => Effect.void)
    const addBlockSpy = vi.fn((itemType: InventoryItem) =>
      options.failAddBlockItems?.has(itemType) === true ? Effect.fail(new Error('inventory full')) : Effect.void
    )
    const spawnDroppedItemSpy = vi.fn((
      input: { readonly itemType: InventoryItem; readonly count: number; readonly position: Position },
    ) =>
      options.failDroppedItems?.has(input.itemType) === true
        ? Effect.fail(new Error('drop failed'))
        : Effect.succeed({
          id: `drop-${input.itemType}`,
          itemType: input.itemType,
          count: input.count,
          position: input.position,
          velocity: { x: 0, y: 0, z: 0 },
          ageTicks: 0,
          pickupDelayTicks: 0,
        })
    )
    const spawnXpOrbSpy = vi.fn((input: { readonly amount: number; readonly position: Position }) =>
      Effect.succeed({
        id: `xp-orb-${input.amount}`,
        amount: input.amount,
        position: input.position,
        velocity: { x: 0, y: 0, z: 0 },
        ageTicks: 0,
        pickupDelayTicks: 0,
      })
    )
    const damageSlotSpy = vi.fn(() => Effect.void)
    const spawnBurstSpy = vi.fn(() => Effect.void)
    const sendBlockBreakSpy = options.multiplayer?.sendBlockBreak ?? vi.fn(() => Effect.void)

    const services = {
      blockService: { breakBlock: breakSpy },
      chunkManagerService: {
        getChunk: vi.fn(() => options.failChunkLoad === true ? Effect.fail(new Error('chunk missing')) : Effect.succeed(chunk)),
      },
      soundManager: { playEffect: vi.fn(() => Effect.void) },
      inventoryService: {
        getSlot: vi.fn(() => Effect.succeed(toolStack)),
        addBlock: addBlockSpy,
        damageSlot: damageSlotSpy,
        repairMendingItemsWithXP: vi.fn((amount: number) => Effect.succeed(amount)),
      },
      equipmentService: {
        getEquippedItem: vi.fn(() => Effect.succeed(options.helmet ?? Option.none())),
        repairMendingItemsWithXP: vi.fn((amount: number) => Effect.succeed(amount)),
      },
      droppedItemService: { spawn: spawnDroppedItemSpy },
      droppedXpOrbService: { spawn: spawnXpOrbSpy },
      hotbarService: { getSelectedSlot: vi.fn(() => Effect.succeed(SlotIndex.make(0))) },
      particleSystem: { spawnBurst: spawnBurstSpy },
      xpService: {
        getXP: vi.fn(() => Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 })),
        addXP: vi.fn(() => Effect.succeed({ totalXP: 0, level: 0, xpIntoLevel: 0, xpRequiredForNext: 7 })),
      },
      multiplayer: options.multiplayer === undefined ? Option.none() : Option.some({ sendBlockBreak: sendBlockBreakSpy }),
      cropGrowthService: { harvest: vi.fn(() => Effect.succeed(options.harvestRipeCrop ?? false)) },
    }

    return { services, breakSpy, addBlockSpy, spawnDroppedItemSpy, spawnXpOrbSpy, damageSlotSpy, spawnBurstSpy, sendBlockBreakSpy }
  }

  const makeContext = (
    overrides: Partial<BreakProgressContext> = {},
  ): BreakProgressContext => ({
    targetBlock: Option.some(defaultPosition),
    selectedHotbarItem: Option.some('DIAMOND_PICKAXE'),
    targetEntityPresent: false,
    breakProgressElementOrNull: null,
    creative: false,
    underwater: true,
    debugFlags: { 'particles.spawn': false },
    ...overrides,
  })

  const runBreakTicks = (
    services: BreakProgressServices,
    refs: BreakProgressRefs,
    context: BreakProgressContext,
    ticks: number,
  ) => Effect.gen(function* () {
    for (let i = 0; i < ticks; i++) {
      yield* handleBlockBreakProgress(services, refs, context)
    }
  })

  it.effect('keeps the underwater mining slowdown without AQUA_AFFINITY', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const { services, breakSpy } = makeServices()

    yield* runBreakTicks(services, refs, makeContext(), 10)

    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('removes the underwater mining slowdown with AQUA_AFFINITY on the helmet', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const { services, breakSpy } = makeServices({
      helmet: makeToolStack('DIAMOND_HELMET', [{ type: 'AQUA_AFFINITY', level: 1 }]),
    })

    yield* runBreakTicks(services, refs, makeContext(), 10)

    expect(breakSpy).toHaveBeenCalledOnce()
    expect(breakSpy).toHaveBeenCalledWith(defaultPosition, false, { dropItems: false })
  }))

  it.effect('updates the break progress HUD while a block is still being mined', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const progressElement = makeBreakProgressElement()
    const { services, breakSpy } = makeServices()

    yield* handleBlockBreakProgress(services, refs, makeContext({ underwater: false, breakProgressElementOrNull: progressElement }))

    expect(breakSpy).not.toHaveBeenCalled()
    expect(progressElement.attrs.get('value')).toBe('1')
    expect(progressElement.attrs.get('max')).toBe('10')
    expect(progressElement.style.display).toBe('block')
  }))

  it.effect('clears break progress when the player is targeting an entity', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const progressElement = makeBreakProgressElement()
    MutableRef.set(refs.breakProgressRef, { blockKey: '1,64,0', ticks: 3, totalTicks: 10 })
    const { services, breakSpy } = makeServices()

    yield* handleBlockBreakProgress(services, refs, makeContext({ targetEntityPresent: true, breakProgressElementOrNull: progressElement }))

    expect(MutableRef.get(refs.breakProgressRef)).toBeNull()
    expect(progressElement.style.display).toBe('none')
    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('clears break progress when there is no target block', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const progressElement = makeBreakProgressElement()
    const { services, breakSpy } = makeServices()

    yield* handleBlockBreakProgress(services, refs, makeContext({ targetBlock: Option.none(), breakProgressElementOrNull: progressElement }))

    expect(MutableRef.get(refs.breakProgressRef)).toBeNull()
    expect(progressElement.style.display).toBe('none')
    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('clears break progress when the pre-break chunk cannot be loaded', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const progressElement = makeBreakProgressElement()
    const { services, breakSpy } = makeServices({ failChunkLoad: true })

    yield* handleBlockBreakProgress(services, refs, makeContext({ breakProgressElementOrNull: progressElement }))

    expect(progressElement.style.display).toBe('none')
    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('does not break blocks that the selected tool cannot harvest', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const progressElement = makeBreakProgressElement()
    const { services, breakSpy } = makeServices({
      blockType: 'DIAMOND_ORE',
      selectedItem: 'WOODEN_PICKAXE',
      toolStack: makeToolStack('WOODEN_PICKAXE'),
    })

    yield* handleBlockBreakProgress(services, refs, makeContext({ selectedHotbarItem: Option.some('WOODEN_PICKAXE'), breakProgressElementOrNull: progressElement }))

    expect(MutableRef.get(refs.breakProgressRef)).toBeNull()
    expect(progressElement.style.display).toBe('none')
    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('breaks creative blocks without survival drops and publishes visual effects', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const sendBlockBreak = vi.fn(() => Effect.void)
    const { services, breakSpy, addBlockSpy, spawnDroppedItemSpy, damageSlotSpy, spawnBurstSpy, sendBlockBreakSpy } = makeServices({
      multiplayer: { sendBlockBreak },
    })

    yield* handleBlockBreakProgress(services, refs, makeContext({ creative: true, debugFlags: { 'particles.spawn': true } }))

    expect(breakSpy).toHaveBeenCalledWith(defaultPosition, false, { requireHarvest: false, dropItems: false })
    expect(sendBlockBreakSpy).toHaveBeenCalledWith(defaultPosition)
    expect(spawnBurstSpy).toHaveBeenCalledOnce()
    expect(addBlockSpy).not.toHaveBeenCalled()
    expect(spawnDroppedItemSpy).not.toHaveBeenCalled()
    expect(damageSlotSpy).not.toHaveBeenCalled()
  }))

  it.effect('spawns ripe wheat crop drops and damages the held tool', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.75)
    const { services, addBlockSpy, spawnDroppedItemSpy, damageSlotSpy } = makeServices({
      blockType: 'WHEAT_CROP',
      selectedItem: 'SHEARS',
      toolStack: makeToolStack('SHEARS'),
      harvestRipeCrop: true,
    })

    yield* handleBlockBreakProgress(services, refs, makeContext({ selectedHotbarItem: Option.some('SHEARS') }))

    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({
      itemType: 'WHEAT',
      count: 1,
      position: { x: 1.5, y: 64.5, z: 0.5 },
    }))
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({
      itemType: 'WHEAT_SEEDS',
      count: 4,
      position: { x: 1.5, y: 64.5, z: 0.5 },
    }))
    expect(addBlockSpy).not.toHaveBeenCalled()
    expect(damageSlotSpy).toHaveBeenCalledWith(SlotIndex.make(HOTBAR_START), 1)
    randomSpy.mockRestore()
  }))

  it.effect('spawns a seed when an unripe wheat crop breaks', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const { services, addBlockSpy, spawnDroppedItemSpy } = makeServices({
      blockType: 'WHEAT_CROP',
      selectedItem: 'WHEAT',
      toolStack: makeToolStack('WHEAT'),
      harvestRipeCrop: false,
    })

    yield* handleBlockBreakProgress(services, refs, makeContext({ selectedHotbarItem: Option.some('WHEAT') }))

    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'WHEAT_SEEDS', count: 1 }))
    expect(addBlockSpy).not.toHaveBeenCalled()
  }))

  it.effect('lets shears harvest tall grass itself without seed drops', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const { services, breakSpy, addBlockSpy, spawnDroppedItemSpy } = makeServices({
      blockType: 'TALL_GRASS',
      selectedItem: 'SHEARS',
      toolStack: makeToolStack('SHEARS'),
    })

    yield* handleBlockBreakProgress(services, refs, makeContext({ selectedHotbarItem: Option.some('SHEARS') }))

    expect(breakSpy).toHaveBeenCalledWith(defaultPosition, true, { dropItems: false })
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'TALL_GRASS', count: 1 }))
    expect(spawnDroppedItemSpy).not.toHaveBeenCalledWith(expect.objectContaining({ itemType: 'WHEAT_SEEDS' }))
    expect(addBlockSpy).not.toHaveBeenCalledWith('WHEAT_SEEDS', 1)
  }))

  it.effect('spawns a random seed from tall grass when it is not silk touched or sheared', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const { services, addBlockSpy, spawnDroppedItemSpy } = makeServices({
      blockType: 'TALL_GRASS',
      selectedItem: 'WHEAT',
      toolStack: makeToolStack('WHEAT'),
    })

    yield* handleBlockBreakProgress(services, refs, makeContext({ selectedHotbarItem: Option.some('WHEAT') }))

    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'WHEAT_SEEDS', count: 1 }))
    expect(addBlockSpy).not.toHaveBeenCalled()
    randomSpy.mockRestore()
  }))

  it.effect('rolls leaf bonus drops and continues when one dropped item spawn fails', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
    const { services, addBlockSpy, spawnDroppedItemSpy } = makeServices({
      blockType: 'LEAVES',
      selectedItem: 'WHEAT',
      toolStack: makeToolStack('WHEAT'),
      failDroppedItems: new Set<InventoryItem>(['APPLE']),
    })

    yield* runBreakTicks(
      services,
      refs,
      makeContext({ selectedHotbarItem: Option.some('WHEAT'), underwater: false }),
      9,
    )

    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'LEAVES', count: 1 }))
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'APPLE', count: 1 }))
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'STICKS', count: 1 }))
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'SAPLING', count: 1 }))
    expect(addBlockSpy).not.toHaveBeenCalled()
    randomSpy.mockRestore()
  }))

  it.effect('skips leaf bonus drops when all drop rolls miss', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1)
    const { services, addBlockSpy, spawnDroppedItemSpy } = makeServices({
      blockType: 'LEAVES',
      selectedItem: 'WHEAT',
      toolStack: makeToolStack('WHEAT'),
    })

    yield* runBreakTicks(
      services,
      refs,
      makeContext({ selectedHotbarItem: Option.some('WHEAT'), underwater: false }),
      9,
    )

    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'LEAVES', count: 1 }))
    expect(spawnDroppedItemSpy).not.toHaveBeenCalledWith(expect.objectContaining({ itemType: 'APPLE' }))
    expect(spawnDroppedItemSpy).not.toHaveBeenCalledWith(expect.objectContaining({ itemType: 'STICKS' }))
    expect(spawnDroppedItemSpy).not.toHaveBeenCalledWith(expect.objectContaining({ itemType: 'SAPLING' }))
    expect(addBlockSpy).not.toHaveBeenCalled()
    randomSpy.mockRestore()
  }))

  it.effect('adds ore XP, applies Fortune, and lets Unbreaking skip durability loss', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const randomSpy = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
    const { services, addBlockSpy, spawnDroppedItemSpy, spawnXpOrbSpy, damageSlotSpy } = makeServices({
      blockType: 'DIAMOND_ORE',
      selectedItem: 'DIAMOND_PICKAXE',
      toolStack: makeToolStack('DIAMOND_PICKAXE', [
        { type: 'FORTUNE', level: 3 },
        { type: 'UNBREAKING', level: 3 },
      ]),
    })

    yield* runBreakTicks(
      services,
      refs,
      makeContext({ selectedHotbarItem: Option.some('DIAMOND_PICKAXE'), underwater: false }),
      19,
    )

    expect(spawnXpOrbSpy).toHaveBeenCalledWith(expect.objectContaining({
      amount: expect.any(Number),
      position: { x: defaultPosition.x + 0.5, y: defaultPosition.y + 0.5, z: defaultPosition.z + 0.5 },
    }))
    expect(services.xpService.addXP).not.toHaveBeenCalled()
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'DIAMOND', count: 1 }))
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'DIAMOND', count: 2 }))
    expect(addBlockSpy).not.toHaveBeenCalled()
    expect(damageSlotSpy).not.toHaveBeenCalled()
    randomSpy.mockRestore()
  }))

  it.effect('spawns silk touched ore drops and does not apply Fortune', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const { services, breakSpy, addBlockSpy, spawnDroppedItemSpy } = makeServices({
      blockType: 'DIAMOND_ORE',
      selectedItem: 'DIAMOND_PICKAXE',
      toolStack: makeToolStack('DIAMOND_PICKAXE', [
        { type: 'SILK_TOUCH', level: 1 },
        { type: 'FORTUNE', level: 3 },
      ]),
    })

    yield* runBreakTicks(
      services,
      refs,
      makeContext({ selectedHotbarItem: Option.some('DIAMOND_PICKAXE'), underwater: false }),
      19,
    )

    expect(breakSpy).toHaveBeenCalledWith(defaultPosition, true, { dropItems: false })
    expect(spawnDroppedItemSpy).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'DIAMOND_ORE', count: 1 }))
    expect(spawnDroppedItemSpy).not.toHaveBeenCalledWith(expect.objectContaining({ itemType: 'DIAMOND', count: 2 }))
    expect(addBlockSpy).not.toHaveBeenCalled()
    randomSpy.mockRestore()
  }))

  it.effect('resets previous progress when the player moves to another block', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const position: Position = { x: 2, y: 64, z: 0 }
    MutableRef.set(refs.breakProgressRef, { blockKey: '1,64,0', ticks: 8, totalTicks: 10 })
    const { services } = makeServices({ position })

    yield* handleBlockBreakProgress(services, refs, makeContext({ targetBlock: Option.some(position), underwater: false }))

    expect(MutableRef.get(refs.breakProgressRef)).toEqual({ blockKey: '2,64,0', ticks: 1, totalTicks: 10 })
  }))

  it.effect('tracks progress for the flat block index resolved from the target position', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const position: Position = { x: 1, y: CHUNK_HEIGHT, z: 0 }
    const { services, breakSpy } = makeServices({ position, blockType: 'STONE' })

    yield* handleBlockBreakProgress(services, refs, makeContext({ targetBlock: Option.some(position), underwater: false }))

    expect(MutableRef.get(refs.breakProgressRef)).toEqual({ blockKey: '1,256,0', ticks: 1, totalTicks: 10 })
    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('fails instead of treating an out-of-range target index as air', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const position: Position = { x: 0, y: CHUNK_HEIGHT * CHUNK_SIZE * CHUNK_SIZE, z: 0 }
    const { services, breakSpy } = makeServices({ position, toolStack: Option.none() })

    const result = yield* handleBlockBreakProgress(
      services,
      refs,
      makeContext({ targetBlock: Option.some(position), selectedHotbarItem: Option.none(), underwater: false }),
    ).pipe(Effect.either)

    expect(Either.isLeft(result)).toBe(true)
    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('fails instead of treating incomplete chunk storage as air', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const { services, breakSpy } = makeServices({ chunkStorageLength: 0, toolStack: Option.none() })

    const result = yield* handleBlockBreakProgress(
      services,
      refs,
      makeContext({ selectedHotbarItem: Option.none(), underwater: false }),
    ).pipe(Effect.either)

    expect(Either.isLeft(result)).toBe(true)
    expect(breakSpy).not.toHaveBeenCalled()
  }))

  it.effect('breaks zero-hardness air after reading an in-bounds zero block id', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const { services, breakSpy } = makeServices({ blockType: 'AIR', toolStack: Option.none() })

    yield* handleBlockBreakProgress(services, refs, makeContext({ selectedHotbarItem: Option.none(), underwater: false }))

    expect(breakSpy).toHaveBeenCalledWith(defaultPosition, false, { dropItems: false })
  }))

  it.effect('uses Efficiency when calculating break progress', () => Effect.gen(function* () {
    const refs = yield* makeRefs()
    const { services, breakSpy } = makeServices({
      selectedItem: 'DIAMOND_PICKAXE',
      toolStack: makeToolStack('DIAMOND_PICKAXE', [{ type: 'EFFICIENCY', level: 4 }]),
    })

    yield* runBreakTicks(
      services,
      refs,
      makeContext({ selectedHotbarItem: Option.some('DIAMOND_PICKAXE'), underwater: false }),
      3,
    )

    expect(breakSpy).toHaveBeenCalledWith(defaultPosition, false, { dropItems: false })
  }))
})
