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
  getRenderingSnapshot(): {
    readonly sceneChildren: number
    readonly chunkMeshCount: number
    readonly visibleChunkMeshCount: number
    readonly camera: { readonly x: number; readonly y: number; readonly z: number; readonly near: number; readonly far: number }
    readonly chunks: ReadonlyArray<{
      readonly chunkCoord: unknown
      readonly type: string
      readonly visible: boolean
      readonly vertexCount: number
      readonly indexCount: number
      readonly hasUv: boolean
      readonly hasTileIndex: boolean
      readonly tileIndexCount: number
      readonly materialType: string
      readonly textureLoaded: boolean
    }>
  }
  getRecipeButtons(): ReadonlyArray<string>
}

const clearQaWindow = (): void => {
  Reflect.deleteProperty(globalThis as object, 'window')
}

const installWindow = (): void => {
  Reflect.set(globalThis as object, 'window', {})
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
  it('is a no-op when window is unavailable', async () => {
    const { deps } = makeDeps()

    await Effect.runPromise(installQaApi(deps as never))

    expect(Reflect.has(globalThis as object, 'window')).toBe(false)
  })

  it('installs the QA API on window', async () => {
    installWindow()
    const { deps } = makeDeps()

    await Effect.runPromise(installQaApi(deps as never))

    const qa = getQaApi()
    expect(typeof qa.consumeMouseClickForQA).toBe('function')
    expect(typeof qa.getEntitySnapshot).toBe('function')
    expect(typeof qa.getRenderingSnapshot).toBe('function')
    expect(qa.getRecipeButtons()).toEqual(['craft-planks', 'craft-sticks'])
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

    await Effect.runPromise(installQaApi(deps as never))

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
    await Effect.runPromise(installQaApi(deps as never))

    await expect(getQaApi().getInventorySnapshot()).resolves.toEqual([
      { slot: 0, blockType: 'WOOD', count: 3 },
      null,
      { slot: 2, blockType: 'STONE', count: 8 },
    ])
    expect(spies.getAllSlots).toHaveBeenCalledOnce()
  })

  it('delegates inventory opening to the inventory renderer', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps as never))

    await expect(getQaApi().openInventoryForQA()).resolves.toBe(true)
    expect(spies.toggleInventory).toHaveBeenCalledOnce()
  })

  it('delegates consumeMouseClickForQA to inputService.consumeMouseClick', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps as never))

    const result = await getQaApi().consumeMouseClickForQA(2)

    expect(result).toBe(true)
    expect(spies.consumeMouseClick).toHaveBeenCalledWith(2)
  })

  it('delegates getEntitySnapshot to entityManager.getEntities', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps as never))

    const entities = await getQaApi().getEntitySnapshot()

    expect(entities).toEqual([{ id: 'zombie-1', type: 'Zombie', entityId: 'zombie-1' }])
    expect(spies.getEntities).toHaveBeenCalledOnce()
  })

  it('stages and then collects resource blocks in front of the player', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps as never))

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
    await Effect.runPromise(installQaApi(deps as never))

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
    await Effect.runPromise(installQaApi(deps as never))

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
    await Effect.runPromise(installQaApi(deps as never))

    await getQaApi().attackFirstZombie()

    expect(spies.applyDamage).toHaveBeenLastCalledWith('zombie-1', 8)
  })

  it('places the selected block in front of the player and can move/select hotbar items', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    spies.selectedBlockType.current = Option.some('WOOD')
    await Effect.runPromise(installQaApi(deps as never))

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
    await Effect.runPromise(installQaApi(deps as never))

    await expect(getQaApi().moveItemToHotbar('GLASS', 1)).resolves.toBe(false)
  })

  it('stages a support block and clears blocks in front of the player', async () => {
    installWindow()
    const { deps, spies } = makeDeps()
    await Effect.runPromise(installQaApi(deps as never))

    await getQaApi().stageBuildSupportBlock()
    await getQaApi().clearBlocksInFront()

    expect(spies.getChunk).toHaveBeenCalled()
    expect(spies.markChunkDirty).toHaveBeenCalled()
    expect(spies.updateChunkInScene).toHaveBeenCalled()
    expect(spies.breakBlock).toHaveBeenCalledTimes(2)
  })
})
