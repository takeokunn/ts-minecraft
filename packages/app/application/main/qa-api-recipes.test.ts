import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { installQaApi } from '@ts-minecraft/app/main/qa-api'

type QaApiShape = {
  getInventorySnapshot(): Promise<ReadonlyArray<null | { readonly slot: number; readonly blockType: string; readonly count: number }>>
  openInventoryForQA(): Promise<boolean>
  stageProgressionScenario(): Promise<void>
  collectStagedResources(): Promise<void>
  spawnLowHealthZombieInFront(): Promise<void>
  aimAtStagedResource(resourceIndex: number): Promise<void>
  aimAtBuildSpot(): Promise<void>
  aimAtStagedZombie(): Promise<void>
  clearBlocksInFront(): Promise<void>
  stageBuildSupportBlock(): Promise<void>
  dispatchMouseClick(button: 0 | 2): Promise<void>
  consumeMouseClickForQA(button: 0 | 2): Promise<boolean>
  getCurrentTargetForQA(): Promise<unknown>
  attackFirstZombie(): Promise<boolean>
  placeSelectedItemInFront(): Promise<void>
  moveItemToHotbar(blockType: string, hotbarIndex: number): Promise<boolean>
  selectHotbarSlot(hotbarIndex: number): Promise<void>
  craftRecipeForQA(recipeId: string): Promise<void>
  getEntitySnapshot(): Promise<ReadonlyArray<{ readonly id: string }>>
  getRecipeButtons(): ReadonlyArray<string>
}

const clearQaWindow = (): void => {
  Reflect.deleteProperty(globalThis as object, 'window')
}

const installWindow = (): void => {
  Reflect.set(globalThis as object, 'window', {})
}

const installDocument = () => {
  const dispatched: unknown[] = []
  class MouseEventStub {
    constructor(
      public readonly type: string,
      public readonly init: { readonly bubbles?: boolean; readonly button?: number } = {},
    ) {}
  }

  Reflect.set(globalThis as object, 'document', {
    dispatchEvent: (event: unknown) => {
      dispatched.push(event)
      return true
    },
  })
  Reflect.set(globalThis as object, 'MouseEvent', MouseEventStub)

  return { dispatched }
}

const getQaApi = (): QaApiShape => Reflect.get(window as object, '__TS_MINECRAFT_QA__') as QaApiShape

const makeDeps = () => {
  const consumeMouseClick = vi.fn((button: 0 | 2) => Effect.succeed(button === 2))
  const getEntities = vi.fn(() => Effect.succeed([{ id: 'zombie-1', type: 'Zombie', entityId: 'zombie-1' }]))
  const toggleInventory = vi.fn(() => Effect.succeed(true))
  const getAllSlots = vi.fn(() => Effect.succeed([
    Option.some({ blockType: 'WOOD', count: 3 }),
    Option.none(),
    Option.some({ blockType: 'STONE', count: 8 }),
  ]))
  const moveStack = vi.fn(() => Effect.void)
  const getChunk = vi.fn(() => Effect.succeed({ coord: { x: 0, z: 0 }, blocks: new Uint8Array(16 * 16 * 256), fluid: Option.none() }))
  const markChunkDirty = vi.fn(() => Effect.void)
  const updateChunkInScene = vi.fn(() => Effect.void)
  const breakBlock = vi.fn(() => Effect.void)
  const placeBlock = vi.fn(() => Effect.void)
  const setYaw = vi.fn(() => Effect.void)
  const setPitch = vi.fn(() => Effect.void)
  const invalidateCache = vi.fn(() => Effect.void)
  const updateHighlight = vi.fn(() => Effect.void)
  const setTargetForQA = vi.fn(() => Effect.void)
  const clearTargetForQA = vi.fn(() => Effect.void)
  const getTargetBlock = vi.fn(() => Effect.succeed(Option.some({ x: 1, y: 2, z: 3 })))
  const selectedBlockType = { current: Option.none<"WOOD" | "WOODEN_SWORD">() }
  const selectedSlot = { current: 0 }
  const setSelectedSlot = vi.fn((slot: number) => Effect.sync(() => { selectedSlot.current = slot }))
  const addEntity = vi.fn(() => Effect.succeed('zombie-1'))
  const applyDamage = vi.fn(() => Effect.void)
  const recipeFindById = vi.fn(() => Option.none())
  const recipeCraft = vi.fn(() => Effect.void)
  const getNearestFurnaceState = vi.fn(() => Effect.succeed(Option.none()))
  const startSmelting = vi.fn(() => Effect.void)
  const collectOutput = vi.fn(() => Effect.void)

  return {
    spies: {
      consumeMouseClick,
      getEntities,
      toggleInventory,
      getAllSlots,
      moveStack,
      getChunk,
      markChunkDirty,
      updateChunkInScene,
      breakBlock,
      placeBlock,
      setYaw,
      setPitch,
      invalidateCache,
      updateHighlight,
      setTargetForQA,
      clearTargetForQA,
      getTargetBlock,
      setSelectedSlot,
      addEntity,
      applyDamage,
      recipeFindById,
      recipeCraft,
      getNearestFurnaceState,
      startSmelting,
      collectOutput,
      selectedBlockType,
      selectedSlot,
    },
    deps: {
      camera: new THREE.PerspectiveCamera(),
      scene: new THREE.Scene(),
      playerCameraState: {
        setYaw,
        setPitch,
      },
      blockHighlight: {
        invalidateCache,
        update: updateHighlight,
        setTargetForQA,
        clearTargetForQA,
        getTargetBlock,
      },
      inputService: {
        consumeMouseClick,
      },
      inventoryService: {
        getAllSlots,
        moveStack,
      },
      inventoryRenderer: {
        toggle: toggleInventory,
        isOpen: () => Effect.succeed(false),
      },
      gameState: {
        getPlayerPosition: () => Effect.succeed({ x: 0, y: 64, z: 0 }),
      },
      chunkManagerService: {
        getChunk,
        markChunkDirty,
      },
      blockService: {
        breakBlock,
        placeBlock,
      },
      hotbarService: {
        getSelectedBlockType: () => Effect.sync(() => selectedBlockType.current),
        getSelectedSlot: () => Effect.sync(() => selectedSlot.current),
        setSelectedSlot,
      },
      recipeService: {
        getAllRecipes: () => [{ id: 'craft-planks' }, { id: 'craft-sticks' }],
        findById: recipeFindById,
        craft: recipeCraft,
      },
      furnaceService: {
        getNearestFurnaceState,
        startSmelting,
        collectOutput,
      },
      worldRendererService: {
        updateChunkInScene,
      },
      entityManager: {
        getEntities,
        addEntity,
        applyDamage,
      },
    },
  }
}

afterEach(() => {
  clearQaWindow()
  Reflect.deleteProperty(globalThis as object, 'document')
  Reflect.deleteProperty(globalThis as object, 'MouseEvent')
})

describe('installQaApi', () => {
  it('dispatches mouse events and exposes the current target', async () => {
    installWindow()
    const { dispatched } = installDocument()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps as never))

    await getQaApi().dispatchMouseClick(2)
    const target = await getQaApi().getCurrentTargetForQA()

    expect(dispatched).toHaveLength(3)
    expect(target).toEqual(Option.some({ x: 1, y: 2, z: 3 }))
    expect(spies.getTargetBlock).toHaveBeenCalledOnce()
  })

  it('crafts through the recipe service when the recipe is resolved through the default path', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps as never))

    await getQaApi().craftRecipeForQA('craft-planks')

    expect(spies.recipeCraft).toHaveBeenCalledOnce()
  })

  it('starts furnace work when the recipe requires a furnace and no output is ready', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    spies.recipeFindById.mockReturnValue(Option.some({ station: 'furnace' }))
    await Effect.runPromise(installQaApi(deps as never))

    await getQaApi().craftRecipeForQA('smelt-iron')

    expect(spies.getNearestFurnaceState).toHaveBeenCalledOnce()
    expect(spies.startSmelting).toHaveBeenCalledOnce()
  })

  it('starts furnace work when the furnace exists but has no output yet', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    spies.recipeFindById.mockReturnValue(Option.some({ station: 'furnace' }))
    spies.getNearestFurnaceState.mockReturnValue(Effect.succeed(Option.some({ output: Option.none() })))
    await Effect.runPromise(installQaApi(deps as never))

    await getQaApi().craftRecipeForQA('smelt-iron')

    expect(spies.startSmelting).toHaveBeenCalledOnce()
  })

  it('uses the regular crafting path when a resolved recipe is not a furnace recipe', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    spies.recipeFindById.mockReturnValue(Option.some({ station: 'crafting' }))
    await Effect.runPromise(installQaApi(deps as never))

    await getQaApi().craftRecipeForQA('craft-planks')

    expect(spies.recipeCraft).toHaveBeenCalledOnce()
  })

  it('collects furnace output when a furnace recipe already has output ready', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    spies.recipeFindById.mockReturnValue(Option.some({ station: 'furnace' }))
    spies.getNearestFurnaceState.mockReturnValue(Effect.succeed(Option.some({ output: Option.some({ blockType: 'IRON_INGOT', count: 1 }) })))
    await Effect.runPromise(installQaApi(deps as never))

    await getQaApi().craftRecipeForQA('smelt-iron')

    expect(spies.collectOutput).toHaveBeenCalledOnce()
  })
})
