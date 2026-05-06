import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect, HashMap, Option } from 'effect'
import * as THREE from 'three'
import { DeltaTimeSecs, RecipeId, SlotIndex, type InventoryItem, type InventorySaveData } from '@ts-minecraft/kernel'
import { EntityId, type Entity } from '@ts-minecraft/entities'
import type { FurnaceBlockState } from '@ts-minecraft/furnace'
import { createStack } from '@ts-minecraft/inventory'
import { installQaApi } from '@ts-minecraft/app/main/qa-api'
import {
  DEBUG_FEATURE_FLAG_CATALOG,
  DEBUG_FEATURE_FLAG_DEFAULTS,
  type DebugFeatureFlagGroup,
  type DebugFeatureFlagId,
  type DebugFeatureFlags,
} from '@ts-minecraft/app/debug-feature-flags'

type QaInstallDeps = Parameters<typeof installQaApi>[0]

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

const getQaApi = (): NonNullable<typeof window.__TS_MINECRAFT_QA__> => {
  const qa = window.__TS_MINECRAFT_QA__
  if (!qa) throw new Error('QA API is not installed on window')
  return qa
}

type QaRecipe = ReturnType<QaInstallDeps['recipeService']['getAllRecipes']>[number]

const makeRecipe = (id: string, station: QaRecipe['station'] = 'inventory'): QaRecipe => ({
  id: RecipeId.make(id),
  station,
  ingredients: [{ itemType: 'WOOD', count: 1 }],
  output: { itemType: 'WOOD', count: 1 },
})

const makeFurnaceState = (overrides: Partial<FurnaceBlockState> = {}): FurnaceBlockState => ({
  position: { x: 1, y: 64, z: 1 },
  input: Option.none(),
  fuel: Option.none(),
  output: Option.none(),
  activeRecipeId: Option.none(),
  progressSecs: 0,
  ...overrides,
})

const makeQaEntity = (): Entity & { readonly id: string } => {
  const entity: Entity & { readonly id: string } = {
    id: 'zombie-1',
    entityId: EntityId.make('zombie-1'),
    type: 'Zombie',
    position: { x: 0, y: 64, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    health: 20,
  }

  ;(['position', 'velocity', 'rotation', 'health'] as const).forEach((key) => {
    Object.defineProperty(entity, key, { enumerable: false })
  })

  return entity
}

const makeDeps = () => {
  const recipes = [makeRecipe('craft-planks'), makeRecipe('craft-sticks')] satisfies ReadonlyArray<QaRecipe>
  const qaEntity = makeQaEntity()
  const recipeOverride = { current: Option.none<QaRecipe>() }
  const nearestFurnaceStateOverride = { current: Option.none<FurnaceBlockState>() }
  const consumeMouseClick = vi.fn((button: number) => Effect.succeed(button === 2))
  const getEntities: QaInstallDeps['entityManager']['getEntities'] = vi.fn(() => Effect.succeed([qaEntity]))
  const toggleInventory = vi.fn(() => Effect.succeed(true))
  const getAllSlots = vi.fn(() => Effect.succeed([
    Option.some(createStack('WOOD', 3)),
    Option.none(),
    Option.some(createStack('STONE', 8)),
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
  const selectedBlockType = { current: Option.none<InventoryItem>() }
  const selectedSlot: { current: SlotIndex } = { current: SlotIndex.make(0) }
  const setSelectedSlot = vi.fn((slot: SlotIndex) => Effect.sync(() => { selectedSlot.current = slot }))
  const addEntity: QaInstallDeps['entityManager']['addEntity'] = vi.fn(() => Effect.succeed(qaEntity.entityId))
  const applyDamage: QaInstallDeps['entityManager']['applyDamage'] = vi.fn(() => Effect.succeed(Option.none()))
  const recipeFindByIdImpl: QaInstallDeps['recipeService']['findById'] = (recipeId: RecipeId) =>
    Option.isSome(recipeOverride.current)
      ? recipeOverride.current
      : Option.fromNullable(recipes.find((recipe) => recipe.id === recipeId))
  const recipeFindById = vi.fn(recipeFindByIdImpl)
  const recipeCraft: QaInstallDeps['recipeService']['craft'] = vi.fn(() => Effect.void)
  const getNearestFurnaceStateImpl: QaInstallDeps['furnaceService']['getNearestFurnaceState'] = () =>
    Effect.succeed(nearestFurnaceStateOverride.current)
  const getNearestFurnaceState = vi.fn(getNearestFurnaceStateImpl)
  const startSmelting: QaInstallDeps['furnaceService']['startSmelting'] = vi.fn(() => Effect.void)
  const collectOutput: QaInstallDeps['furnaceService']['collectOutput'] = vi.fn(() => Effect.succeed(false))
  const debugFlagsState: { current: DebugFeatureFlags } = { current: { ...DEBUG_FEATURE_FLAG_DEFAULTS } }
  const setDebugFeatureEnabled = vi.fn((id: DebugFeatureFlagId, enabled: boolean) =>
    Effect.sync(() => {
      const changed = debugFlagsState.current[id] !== enabled
      debugFlagsState.current = { ...debugFlagsState.current, [id]: enabled }
      return changed
    })
  )
  const resetDebugFeatureGroup = vi.fn((group: DebugFeatureFlagGroup) =>
    Effect.sync(() => {
      const next = { ...debugFlagsState.current }
      for (const entry of DEBUG_FEATURE_FLAG_CATALOG) {
        if (entry.group === group) {
          next[entry.id] = DEBUG_FEATURE_FLAG_DEFAULTS[entry.id]
        }
      }
      debugFlagsState.current = next
    })
  )
  const resetDebugFeatures = vi.fn(() =>
    Effect.sync(() => {
      debugFlagsState.current = { ...DEBUG_FEATURE_FLAG_DEFAULTS }
    })
  )

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
      setDebugFeatureEnabled,
      resetDebugFeatureGroup,
      resetDebugFeatures,
      recipeOverride,
      nearestFurnaceStateOverride,
      selectedBlockType,
      selectedSlot,
    },
    deps: {
      camera: new THREE.PerspectiveCamera(),
      scene: new THREE.Scene(),
      playerCameraState: {
        getRotation: () => Effect.succeed({ yaw: 0, pitch: 0 }),
        getMode: () => Effect.succeed('firstPerson' as const),
        setYaw,
        setPitch,
        addYaw: (_delta: number) => Effect.void,
        addPitch: (_delta: number) => Effect.void,
        setMode: (_mode: 'firstPerson' | 'thirdPerson') => Effect.void,
        toggleMode: () => Effect.void,
        reset: () => Effect.void,
        _tag: '@minecraft/application/PlayerCameraStateService'
      },
      blockHighlight: {
        invalidateCache,
        initialize: (_scene: THREE.Scene) => Effect.void,
        update: updateHighlight,
        setVisible: (_visible: boolean) => Effect.void,
        setTargetForQA,
        clearTargetForQA,
        getTargetBlock,
        getTargetHit: () => Effect.succeed(Option.none()),
        _tag: '@minecraft/presentation/BlockHighlight',
      },
      inputService: {
        isKeyPressed: () => Effect.succeed(false),
        consumeKeyPress: () => Effect.succeed(false),
        getMouseDelta: () => Effect.succeed({ x: 0, y: 0 }),
        isMouseDown: () => Effect.succeed(false),
        requestPointerLock: () => Effect.void,
        exitPointerLock: () => Effect.void,
        isPointerLocked: () => Effect.succeed(false),
        consumeMouseClick,
        consumeWheelDelta: () => Effect.succeed(0),
        _tag: '@minecraft/presentation/InputService',
      },
      inventoryService: {
        getSlot: (_index: SlotIndex) => Effect.succeed(Option.none()),
        setSlot: (_index: SlotIndex, _stack: Option.Option<unknown>) => Effect.void,
        getAllSlots,
        moveStack,
        addBlock: (_itemType: InventoryItem, _count: number) => Effect.void,
        removeBlock: (_itemType: InventoryItem, _count: number, _preferredSlot?: SlotIndex) => Effect.void,
        getHotbarSlots: () => Effect.succeed([]),
        serialize: () => Effect.succeed({ slots: [] }),
        clear: () => Effect.void,
        deserialize: (_data: InventorySaveData) => Effect.void,
        _tag: '@minecraft/application/InventoryService',
      },
      inventoryRenderer: {
        toggle: toggleInventory,
        isOpen: () => Effect.succeed(false),
        update: () => Effect.void,
        cycleRecipes: (_delta: number) => Effect.void,
        craftSelectedRecipe: () => Effect.succeed(false),
        _tag: '@minecraft/presentation/InventoryRenderer',
      },
      gameState: {
        initialize: () => Effect.void,
        update: () => Effect.void,
        respawn: () => Effect.void,
        getTiming: () => Effect.succeed({ lastFrameTime: 0, deltaTime: DeltaTimeSecs.make(0.016), frameCount: 0 }),
        getPlayerPosition: () => Effect.succeed({ x: 0, y: 64, z: 0 }),
        getCameraRotation: () => Effect.succeed({ yaw: 0, pitch: 0 }),
        isPlayerGrounded: () => Effect.succeed(true),
        _tag: '@minecraft/application/GameStateService',
      },
      timeService: {
        getTimeOfDay: () => Effect.succeed(0.5),
        getDayLength: () => Effect.succeed(20 * 60),
        setTimeOfDay: (_fraction: number) => Effect.void,
        isNight: () => Effect.succeed(false),
        advanceTick: (_deltaTime: number) => Effect.succeed(0.5),
        setDayLength: (_seconds: number) => Effect.void,
        _tag: '@minecraft/application/TimeService',
      },
      chunkManagerService: {
        getChunk,
        loadChunksAroundPlayer: () => Effect.succeed(true),
        getLoadedChunks: () => Effect.succeed([]),
        drainRenderDirtyChunks: () => Effect.succeed([]),
        markChunkDirty,
        saveDirtyChunks: () => Effect.void,
        unloadChunk: () => Effect.void,
        _tag: '@minecraft/application/ChunkManagerService',
      },
      blockService: {
        breakBlock,
        placeBlock,
        _tag: '@minecraft/application/BlockService',
      },
      hotbarService: {
        getSelectedBlockType: () => Effect.sync(() => selectedBlockType.current),
        getSelectedSlot: () => Effect.sync(() => selectedSlot.current),
        setSelectedSlot,
        getSlots: () => Effect.succeed([]),
        update: () => Effect.void,
        _tag: '@minecraft/application/HotbarService',
      },
      recipeService: {
        getAllRecipes: () => recipes,
        findById: recipeFindById,
        findCraftable: () => [],
        craft: recipeCraft,
        _tag: '@minecraft/application/RecipeService',
      },
      furnaceService: {
        getState: () => Effect.succeed({ furnaces: HashMap.empty(), selectedFurnacePosition: Option.none() }),
        getNearestFurnaceState,
        hasNearbyFurnace: () => Effect.succeed(false),
        setSelectedFurnace: (_position) => Effect.void,
        startSmelting,
        collectOutput,
        clearFurnace: (_position) => Effect.succeed([]),
        dismantleFurnace: (_position) => Effect.succeed(true),
        serialize: () => Effect.succeed([]),
        deserialize: (_serialized: ReadonlyArray<FurnaceBlockState>) => Effect.void,
        tick: (_deltaTime) => Effect.void,
        _tag: '@minecraft/application/FurnaceService',
      },
      worldRendererService: {
        syncChunksToScene: (_loadedChunks, _scene) => Effect.succeed(true),
        updateChunkInScene,
        applyFrustumCulling: (_camera: THREE.PerspectiveCamera) => Effect.void,
        clearScene: (_scene: THREE.Scene) => Effect.void,
        doRefractionPrePass: (_renderer: THREE.WebGLRenderer, _scene: THREE.Scene, _camera: THREE.Camera) => Effect.void,
        updateWaterUniforms: (_time: number, _cameraPosition: THREE.Vector3) => Effect.void,
        setRefractionValid: (_valid: boolean) => Effect.void,
        updateWaterResolution: (_width: number, _height: number) => Effect.void,
        resizeRefractionRT: (_width: number, _height: number) => Effect.void,
        resizeRefractionCamera: (_aspect: number) => Effect.void,
        getWaterMeshes: () => Effect.succeed([]),
        getSceneVersion: () => Effect.succeed(0),
        _tag: '@minecraft/infrastructure/three/WorldRendererService',
      },
      entityManager: {
        getEntities,
        addEntity,
        removeEntity: (_entityId) => Effect.succeed(false),
        getEntity: (_entityId) => Effect.succeed(Option.none()),
        getEntityAIState: (_entityId) => Effect.succeed(Option.none()),
        getCount: () => Effect.succeed(1),
        getStructureVersion: () => Effect.succeed(0),
        getPlayerContactDamage: (_playerPosition) => Effect.succeed(0),
        update: (_deltaTime, _playerPosition) => Effect.void,
        applyPhysics: (_deltaTime, _resolveCollision) => Effect.void,
        despawnFarEntities: (_playerPosition, _maxDistance) => Effect.succeed(0),
        applyDamage,
        despawnAllEntities: () => Effect.succeed(0),
        _tag: '@minecraft/entity/EntityManager',
      },
      debugFeatureFlags: {
        catalog: DEBUG_FEATURE_FLAG_CATALOG,
        getSnapshot: () => Effect.succeed({ catalog: DEBUG_FEATURE_FLAG_CATALOG, flags: { ...debugFlagsState.current } }),
        getFlags: () => Effect.succeed({ ...debugFlagsState.current }),
        isEnabled: (id: DebugFeatureFlagId) => Effect.succeed(debugFlagsState.current[id]),
        setEnabled: setDebugFeatureEnabled,
        resetAll: resetDebugFeatures,
        resetGroup: resetDebugFeatureGroup,
        _tag: '@minecraft/application/DebugFeatureFlagsService',
      },
    } satisfies QaInstallDeps,
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
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().dispatchMouseClick(2)
    const target = await getQaApi().getCurrentTargetForQA()

    expect(dispatched).toHaveLength(3)
    expect(target).toEqual(Option.some({ x: 1, y: 2, z: 3 }))
    expect(spies.getTargetBlock).toHaveBeenCalledOnce()
  })

  it('crafts through the recipe service when the recipe is resolved through the default path', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().craftRecipeForQA('craft-planks')

    expect(spies.recipeCraft).toHaveBeenCalledOnce()
  })

  it('starts furnace work when the recipe requires a furnace and no output is ready', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    spies.recipeOverride.current = Option.some(makeRecipe('smelt-iron', 'furnace'))
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().craftRecipeForQA('smelt-iron')

    expect(spies.getNearestFurnaceState).toHaveBeenCalledOnce()
    expect(spies.startSmelting).toHaveBeenCalledOnce()
  })

  it('starts furnace work when the furnace exists but has no output yet', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    spies.recipeOverride.current = Option.some(makeRecipe('smelt-iron', 'furnace'))
    spies.nearestFurnaceStateOverride.current = Option.some(makeFurnaceState())
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().craftRecipeForQA('smelt-iron')

    expect(spies.startSmelting).toHaveBeenCalledOnce()
  })

  it('uses the regular crafting path when a resolved recipe is not a furnace recipe', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    spies.recipeOverride.current = Option.some(makeRecipe('craft-planks', 'crafting_table'))
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().craftRecipeForQA('craft-planks')

    expect(spies.recipeCraft).toHaveBeenCalledOnce()
  })

  it('collects furnace output when a furnace recipe already has output ready', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    spies.recipeOverride.current = Option.some(makeRecipe('smelt-iron', 'furnace'))
    spies.nearestFurnaceStateOverride.current = Option.some(
      makeFurnaceState({ output: Option.some(createStack('IRON_INGOT', 1)) })
    )
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().craftRecipeForQA('smelt-iron')

    expect(spies.collectOutput).toHaveBeenCalledOnce()
  })
})
