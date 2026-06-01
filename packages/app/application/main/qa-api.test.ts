import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect, HashMap, Option } from 'effect'
import * as THREE from 'three'
import { DeltaTimeSecs, RecipeId, SlotIndex, type InventoryItem, type InventorySaveData } from '@ts-minecraft/core'
import { EntityId, type Entity } from '@ts-minecraft/entity'
import type { FurnaceBlockState } from '@ts-minecraft/inventory'
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

const getQaApi = (): NonNullable<typeof window.__TS_MINECRAFT_QA__> => {
  const qa = window.__TS_MINECRAFT_QA__
if (!qa) expect.fail('QA API is not installed on window')
  return qa
}

type QaRecipe = ReturnType<QaInstallDeps['recipeService']['getAllRecipes']>[number]

const makeRecipe = (id: string, station: QaRecipe['station'] = 'inventory'): QaRecipe => ({
  id: RecipeId.make(id),
  station,
  ingredients: [{ itemType: 'WOOD', count: 1 }],
  output: { itemType: 'WOOD', count: 1 },
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
  const getDebugFeatureSnapshot = vi.fn(() => Effect.succeed({
    catalog: DEBUG_FEATURE_FLAG_CATALOG,
    flags: { ...debugFlagsState.current },
  }))
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
      getDebugFeatureSnapshot,
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
        damageSlot: (_index: SlotIndex, _amount?: number) => Effect.void,
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
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
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
        applyKnockback: (_entityId, _impulse) => Effect.void,
        despawnAllEntities: () => Effect.succeed(0),
        _tag: '@minecraft/entity/EntityManager',
      },
      debugFeatureFlags: {
        catalog: DEBUG_FEATURE_FLAG_CATALOG,
        getSnapshot: getDebugFeatureSnapshot,
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
  it('is a no-op when window is unavailable', async () => {
    const { deps } = makeDeps()

    await Effect.runPromise(installQaApi(deps))

    expect(Reflect.has(globalThis as object, 'window')).toBe(false)
  })

  it('installs the QA API on window', async () => {
    installWindow()
    const { deps } = makeDeps()

    await Effect.runPromise(installQaApi(deps))

    const qa = getQaApi()
    expect(typeof qa.consumeMouseClickForQA).toBe('function')
    expect(typeof qa.getEntitySnapshot).toBe('function')
    expect(typeof qa.getRenderingSnapshot).toBe('function')
    expect(typeof qa.getDebugFeatureSnapshot).toBe('function')
    expect(qa.getRecipeButtons()).toEqual(['craft-planks', 'craft-sticks'])
  })

  it('exposes debug feature flag snapshot and mutation helpers', async () => {
    installWindow()
    const { deps, spies } = makeDeps()

    await Effect.runPromise(installQaApi(deps))

    const initialSnapshot = await getQaApi().getDebugFeatureSnapshot()
    const changed = await getQaApi().setDebugFeatureEnabled('mobs.spawn', false)
    const updatedSnapshot = await getQaApi().getDebugFeatureSnapshot()
    await getQaApi().resetDebugFeatures('mobs')
    const resetSnapshot = await getQaApi().getDebugFeatureSnapshot()

    expect(initialSnapshot.flags['mobs.spawn']).toBe(true)
    expect(changed).toBe(true)
    expect(updatedSnapshot.flags['mobs.spawn']).toBe(false)
    expect(resetSnapshot.flags['mobs.spawn']).toBe(true)
    expect(spies.setDebugFeatureEnabled).toHaveBeenCalledWith('mobs.spawn', false)
    expect(spies.resetDebugFeatureGroup).toHaveBeenCalledWith('mobs')
  })

  it('returns rendering diagnostics for visible chunk meshes', async () => {
    installWindow()
    const { deps } = makeDeps()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2))
    geometry.setAttribute('tileIndex', new THREE.BufferAttribute(new Float32Array([2, 2, 2]), 1))
    geometry.setIndex([0, 1, 2])
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial())
    mesh.userData['chunkCoord'] = { x: 0, z: 0 }
    deps.camera.position.set(1, 2, 3)
    deps.scene.add(mesh)

    await Effect.runPromise(installQaApi(deps))

    const snapshot = getQaApi().getRenderingSnapshot()
    expect(snapshot.sceneChildren).toBe(1)
    expect(snapshot.chunkMeshCount).toBe(1)
    expect(snapshot.visibleChunkMeshCount).toBe(1)
    expect(snapshot.camera).toMatchObject({ x: 1, y: 2, z: 3 })
    expect(snapshot.chunks[0]).toMatchObject({
      chunkCoord: { x: 0, z: 0 },
      type: 'Mesh',
      visible: true,
      vertexCount: 3,
      indexCount: 3,
      hasUv: true,
      hasTileIndex: true,
      tileIndexCount: 3,
      materialType: 'MeshLambertMaterial',
      textureLoaded: false,
    })
  })

  it('returns a human-readable inventory snapshot', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps))

    await expect(getQaApi().getInventorySnapshot()).resolves.toEqual([
      { slot: 0, itemType: 'WOOD', count: 3 },
      null,
      { slot: 2, itemType: 'STONE', count: 8 },
    ])
    expect(spies.getAllSlots).toHaveBeenCalledOnce()
  })

  it('delegates inventory opening to the inventory renderer', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps))

    await expect(getQaApi().openInventoryForQA()).resolves.toBe(true)
    expect(spies.toggleInventory).toHaveBeenCalledOnce()
  })

  it('delegates consumeMouseClickForQA to inputService.consumeMouseClick', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps))

    const result = await getQaApi().consumeMouseClickForQA(2)

    expect(result).toBe(true)
    expect(spies.consumeMouseClick).toHaveBeenCalledWith(2)
  })

  it('delegates getEntitySnapshot to entityManager.getEntities', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps))

    const entities = await getQaApi().getEntitySnapshot()

    expect(entities).toEqual([{ id: 'zombie-1', type: 'Zombie', entityId: 'zombie-1' }])
    expect(spies.getEntities).toHaveBeenCalledOnce()
  })

  it('stages and then collects resource blocks in front of the player', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().stageProgressionScenario()
    expect(spies.getChunk).toHaveBeenCalledTimes(3)
    expect(spies.markChunkDirty).toHaveBeenCalledTimes(3)
    expect(spies.updateChunkInScene).toHaveBeenCalledTimes(3)
    expect(spies.invalidateCache).toHaveBeenCalled()

    await getQaApi().collectStagedResources()
    expect(spies.breakBlock).toHaveBeenCalledTimes(3)
  })

  it('aim helpers update camera intent and highlight target', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().stageProgressionScenario()
    await getQaApi().aimAtStagedResource(1)
    await getQaApi().aimAtBuildSpot()

    expect(spies.setYaw).toHaveBeenCalled()
    expect(spies.setPitch).toHaveBeenCalled()
    expect(spies.setTargetForQA).toHaveBeenCalledTimes(2)
    expect(spies.updateHighlight).toHaveBeenCalled()
  })

  it('spawns, aims at, and attacks a staged zombie', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().spawnLowHealthZombieInFront()
    await getQaApi().aimAtStagedZombie()
    const attacked = await getQaApi().attackFirstZombie()

    expect(attacked).toBe(true)
    expect(spies.addEntity).toHaveBeenCalledOnce()
    expect(spies.applyDamage).toHaveBeenCalledTimes(2)
    expect(spies.clearTargetForQA).toHaveBeenCalledOnce()
  })

  it('uses sword damage when a wooden sword is selected', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    spies.selectedBlockType.current = Option.some('WOODEN_SWORD')
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().attackFirstZombie()

    expect(spies.applyDamage).toHaveBeenLastCalledWith('zombie-1', 8)
  })

  it('places the selected block in front of the player and can move/select hotbar items', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    spies.selectedBlockType.current = Option.some('WOOD')
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().placeSelectedItemInFront()
    const moved = await getQaApi().moveItemToHotbar('STONE', 2)
    await getQaApi().selectHotbarSlot(4)

    expect(spies.placeBlock).toHaveBeenCalledOnce()
    expect(moved).toBe(true)
    expect(spies.moveStack).toHaveBeenCalledOnce()
    expect(spies.setSelectedSlot).toHaveBeenCalledWith(2)
    expect(spies.setSelectedSlot).toHaveBeenCalledWith(4)
  })

  it('returns false when moving a missing block to the hotbar', async () => {
    installWindow()
    const { deps } = makeDeps()
    await Effect.runPromise(installQaApi(deps))

    await expect(getQaApi().moveItemToHotbar('GLASS', 1)).resolves.toBe(false)
  })

  it('stages a support block and clears blocks in front of the player', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps))

    await getQaApi().stageBuildSupportBlock()
    await getQaApi().clearBlocksInFront()

    expect(spies.getChunk).toHaveBeenCalled()
    expect(spies.markChunkDirty).toHaveBeenCalled()
    expect(spies.updateChunkInScene).toHaveBeenCalled()
    expect(spies.breakBlock).toHaveBeenCalledTimes(2)
  })
})
