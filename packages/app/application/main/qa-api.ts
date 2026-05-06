import { Array as Arr, Cause, Effect, MutableRef, Option } from 'effect'
import * as THREE from 'three'
import { BlockService } from '@ts-minecraft/terrain'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { PlayerCameraStateService } from '@ts-minecraft/player'
import { GameStateService } from '@ts-minecraft/game'
import { HOTBAR_START } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/furnace'
import { HotbarService } from '@ts-minecraft/inventory'
import { DEFAULT_PLAYER_ID, Position, SlotIndex, RecipeId, BlockTypeSchema } from '@ts-minecraft/kernel'
import { WorldRendererService } from '@ts-minecraft/rendering'
import { blockTypeToIndex } from '@ts-minecraft/kernel'
import { setBlockInChunk } from '@ts-minecraft/terrain'
import type { BlockType, InventoryItem } from '@ts-minecraft/kernel'
import { Schema } from 'effect'
import { EntityType, EntityManager } from '@ts-minecraft/entities'
import { BlockHighlightService } from '@ts-minecraft/app/presentation/highlight/block-highlight'
import { InputService } from '@ts-minecraft/app/presentation/input/input-service'
import { InventoryRendererService } from '@ts-minecraft/app/presentation/inventory/inventory-renderer'
import {
  getChunkAccessForWorldPosition,
  getNormalizedLookDirection,
  projectBlockAhead,
  scanNearbyBlock,
} from '@ts-minecraft/app/main/qa-spatial'
import {
  PLAYER_ATTACK_DAMAGE,
  WOODEN_SWORD_ATTACK_DAMAGE,
} from '@ts-minecraft/app/frame-handler.config'

type QaApiDeps = {
  readonly camera: THREE.PerspectiveCamera
  readonly scene: THREE.Scene
  readonly playerCameraState: PlayerCameraStateService
  readonly blockHighlight: BlockHighlightService
  readonly inputService: InputService
  readonly inventoryService: InventoryService
  readonly inventoryRenderer: InventoryRendererService
  readonly gameState: GameStateService
  readonly chunkManagerService: ChunkManagerService
  readonly blockService: BlockService
  readonly hotbarService: HotbarService
  readonly recipeService: RecipeService
  readonly furnaceService: FurnaceService
  readonly worldRendererService: WorldRendererService
  readonly entityManager: EntityManager
}

export type QaApi = {
  readonly getInventorySnapshot: () => Promise<ReadonlyArray<null | { readonly slot: number; readonly itemType: InventoryItem; readonly count: number }>>
  readonly openInventoryForQA: () => Promise<boolean>
  readonly craftRecipeForQA: (recipeId: string) => Promise<void>
  readonly stageProgressionScenario: () => Promise<void>
  readonly collectStagedResources: () => Promise<void>
  readonly spawnLowHealthZombieInFront: () => Promise<void>
  readonly aimAtStagedResource: (resourceIndex: number) => Promise<void>
  readonly aimAtBuildSpot: () => Promise<void>
  readonly aimAtStagedZombie: () => Promise<void>
  readonly clearBlocksInFront: () => Promise<void>
  readonly stageBuildSupportBlock: () => Promise<void>
  readonly dispatchMouseClick: (button: 0 | 2) => Promise<void>
  readonly consumeMouseClickForQA: (button: 0 | 2) => Promise<boolean>
  readonly getCurrentTargetForQA: () => Promise<unknown>
  readonly attackFirstZombie: () => Promise<boolean>
  readonly placeSelectedItemInFront: () => Promise<void>
  readonly moveItemToHotbar: (itemType: InventoryItem, hotbarIndex: number) => Promise<boolean>
  readonly selectHotbarSlot: (hotbarIndex: number) => Promise<void>
  readonly getRecipeButtons: () => ReadonlyArray<string>
  readonly getEntitySnapshot: () => Promise<ReadonlyArray<{ entityId: string; type: string }>>
  readonly getRenderingSnapshot: () => {
    sceneChildren: number
    chunkMeshCount: number
    visibleChunkMeshCount: number
    camera: { x: number; y: number; z: number; near: number; far: number }
    chunks: ReadonlyArray<{
      readonly chunkCoord: { readonly x: number; readonly z: number }
      type: string
      visible: boolean
      vertexCount: number
      indexCount: number
      hasUv: boolean
      hasTileIndex: boolean
      tileIndexCount: number
      materialType: string
      textureLoaded: boolean
    }>
  }
}

type QaChunkCoord = {
  readonly x: number
  readonly z: number
}

type QaChunkMeshSnapshot = {
  readonly chunkCoord: QaChunkCoord
  readonly type: string
  readonly visible: boolean
  readonly vertexCount: number
  readonly indexCount: number
  readonly hasUv: boolean
  readonly hasTileIndex: boolean
  readonly tileIndexCount: number
  readonly materialType: string
  readonly textureLoaded: boolean
}

type ChunkMeshWithCoord = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> & {
  readonly userData: { readonly chunkCoord: QaChunkCoord }
}

type EnvLike = {
  readonly DEV?: boolean
}

type ProcessLike = {
  readonly env?: { readonly NODE_ENV?: string }
}

const getUnknownProperty = (value: object, key: PropertyKey): unknown => Reflect.get(value, key)

const isQaChunkCoord = (value: unknown): value is QaChunkCoord =>
  typeof value === 'object' &&
  value !== null &&
  typeof getUnknownProperty(value, 'x') === 'number' &&
  typeof getUnknownProperty(value, 'z') === 'number'

const isChunkMeshWithCoord = (child: THREE.Object3D): child is ChunkMeshWithCoord =>
  child instanceof THREE.Mesh && isQaChunkCoord(getUnknownProperty(child.userData, 'chunkCoord'))

const isEnvLike = (value: unknown): value is EnvLike =>
  typeof value === 'object' &&
  value !== null &&
  (getUnknownProperty(value, 'DEV') === undefined || typeof getUnknownProperty(value, 'DEV') === 'boolean')

const isProcessLike = (value: unknown): value is ProcessLike => {
  if (typeof value !== 'object' || value === null) return false
  const env = getUnknownProperty(value, 'env')
  if (env === undefined) return true
  return (
    typeof env === 'object' &&
    env !== null &&
    (getUnknownProperty(env, 'NODE_ENV') === undefined || typeof getUnknownProperty(env, 'NODE_ENV') === 'string')
  )
}

const getMaterialType = (material: THREE.Material | readonly THREE.Material[]): string => {
  const firstMaterial = Array.isArray(material) ? material[0] : material
  return firstMaterial?.type ?? 'UnknownMaterial'
}

const isAtlasTextureLoaded = (material: THREE.Material | readonly THREE.Material[]): boolean => {
  const firstMaterial = Array.isArray(material) ? material[0] : material
  return firstMaterial instanceof THREE.MeshLambertMaterial && Boolean(firstMaterial.map?.image)
}

const getChunkMeshSnapshots = (scene: THREE.Scene): ReadonlyArray<QaChunkMeshSnapshot> =>
  scene.children
    .filter(isChunkMeshWithCoord)
    .map((mesh) => {
      const position = mesh.geometry.getAttribute('position')
      const uv = mesh.geometry.getAttribute('uv')
      const tileIndex = mesh.geometry.getAttribute('tileIndex')
      return {
        chunkCoord: mesh.userData.chunkCoord,
        type: mesh.type,
        visible: mesh.visible,
        vertexCount: position?.count ?? 0,
        indexCount: mesh.geometry.index?.count ?? 0,
        hasUv: uv !== undefined,
        hasTileIndex: tileIndex !== undefined,
        tileIndexCount: tileIndex?.count ?? 0,
        materialType: getMaterialType(mesh.material),
        textureLoaded: isAtlasTextureLoaded(mesh.material),
      }
    })

// ---------------------------------------------------------------------------
// Inventory operations
// ---------------------------------------------------------------------------

const getInventorySnapshot = (inventoryService: InventoryService) =>
  Effect.runPromise(
    inventoryService.getAllSlots().pipe(
      Effect.map((slots) => Arr.map(slots, (slot, index) =>
        Option.match(slot, {
          onNone: () => null,
          onSome: (stack) => ({ slot: index, itemType: stack.itemType, count: stack.count }),
        })
      )),
    ),
  )

const openInventoryForQA = (inventoryRenderer: InventoryRendererService) =>
  Effect.runPromise(inventoryRenderer.toggle())

const moveItemToHotbar = (
  inventoryService: InventoryService,
  hotbarService: HotbarService,
  itemType: InventoryItem,
  hotbarIndex: number,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const slots = yield* inventoryService.getAllSlots()
    const fromIndexOpt = Arr.findFirstIndex(slots, (slot) => Option.match(slot, { onNone: () => false, onSome: (stack) => stack.itemType === itemType }))
    const fromIndex = Option.getOrElse(fromIndexOpt, () => -1)
    if (fromIndex < 0) return false
    yield* inventoryService.moveStack(SlotIndex.make(fromIndex), SlotIndex.make(HOTBAR_START + hotbarIndex))
    yield* hotbarService.setSelectedSlot(SlotIndex.make(hotbarIndex))
    return true
  }))

const selectHotbarSlot = (hotbarService: HotbarService, hotbarIndex: number) =>
  Effect.runPromise(hotbarService.setSelectedSlot(SlotIndex.make(hotbarIndex)))

const getRecipeButtons = (recipeService: RecipeService) =>
  Arr.map(recipeService.getAllRecipes(), (recipe) => recipe.id)

const craftRecipeForQA = (
  inventoryService: InventoryService,
  inventoryRenderer: InventoryRendererService,
  recipeService: RecipeService,
  furnaceService: FurnaceService,
  gameState: GameStateService,
  chunkManagerService: ChunkManagerService,
  recipeId: string,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const getChunkOrNone = (coord: { readonly x: number; readonly z: number }) =>
      chunkManagerService.getChunk(coord).pipe(Effect.option)
    const getPlayerPositionForQa = () =>
      gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
        Effect.catchAllCause((_cause: Cause.Cause<unknown>) => Effect.succeed({ x: 0, y: 0, z: 0 })),
      )
    const scanNearbyCraftingStation = (targetBlockIndex: number) =>
      inventoryRenderer.isOpen().pipe(
        Effect.flatMap(() =>
          getPlayerPositionForQa().pipe(
            Effect.flatMap((playerPos) => scanNearbyBlock(playerPos, 5, targetBlockIndex, getChunkOrNone)),
          )
        ),
      )
    const hasTableAccess = yield* scanNearbyCraftingStation(blockTypeToIndex('CRAFTING_TABLE'))
    const hasFurnaceAccess = yield* scanNearbyCraftingStation(blockTypeToIndex('FURNACE'))
    const recipe = recipeService.findById(RecipeId.make(recipeId))
    yield* Option.match(recipe, {
      onNone: () => recipeService.craft(RecipeId.make(recipeId), inventoryService, hasTableAccess, hasFurnaceAccess),
      onSome: (resolvedRecipe) => resolvedRecipe.station === 'furnace'
        ? furnaceService.getNearestFurnaceState().pipe(
            Effect.flatMap((furnaceOpt) => Option.match(furnaceOpt, {
              onNone: () => furnaceService.startSmelting(RecipeId.make(recipeId)),
              onSome: (furnace) => Option.match(furnace.output, {
                onSome: () => furnaceService.collectOutput().pipe(Effect.asVoid),
                onNone: () => furnaceService.startSmelting(RecipeId.make(recipeId)),
              }),
            })),
          )
        : recipeService.craft(RecipeId.make(recipeId), inventoryService, hasTableAccess, hasFurnaceAccess),
    })
  }))

// ---------------------------------------------------------------------------
// Building operations
// ---------------------------------------------------------------------------

const stageProgressionScenario = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  chunkManagerService: ChunkManagerService,
  worldRendererService: WorldRendererService,
  blockHighlight: BlockHighlightService,
  stagedResourceBlocksRef: MutableRef.MutableRef<Array<{ pos: { x: number; y: number; z: number }; blockType: BlockType }>>,
  stagedZombiePositionRef: MutableRef.MutableRef<Position | null>,
) =>
  Effect.runPromise(Effect.gen(function* () {
    MutableRef.set(stagedResourceBlocksRef, [])
    MutableRef.set(stagedZombiePositionRef, null)

    const placeBlockAhead = (distance: number, blockType: BlockType) =>
      Effect.gen(function* () {
        const worldPos = projectBlockAhead(camera, distance)
        const { chunkCoord, lx, lz } = getChunkAccessForWorldPosition(worldPos)
        const chunk = yield* chunkManagerService.getChunk(chunkCoord)
        yield* setBlockInChunk(chunk, lx, worldPos.y, lz, blockType)
        yield* chunkManagerService.markChunkDirty(chunkCoord)
        yield* worldRendererService.updateChunkInScene(chunk, scene).pipe(Effect.catchAllCause(() => Effect.void))
        MutableRef.set(stagedResourceBlocksRef, [...MutableRef.get(stagedResourceBlocksRef), { pos: worldPos, blockType }])
      })

    yield* placeBlockAhead(4, 'WOOD')
    yield* placeBlockAhead(5, 'WOOD')
    yield* placeBlockAhead(6, 'WOOD')
    yield* blockHighlight.invalidateCache()
  }))

const collectStagedResources = (
  blockService: BlockService,
  stagedResourceBlocksRef: MutableRef.MutableRef<Array<{ pos: { x: number; y: number; z: number }; blockType: BlockType }>>,
) =>
  Effect.runPromise(Effect.gen(function* () {
    yield* Effect.forEach(MutableRef.get(stagedResourceBlocksRef), ({ pos }) => blockService.breakBlock(pos), { concurrency: 1, discard: true })
    MutableRef.set(stagedResourceBlocksRef, [])
  }))

const stageBuildSupportBlock = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  chunkManagerService: ChunkManagerService,
  worldRendererService: WorldRendererService,
  blockHighlight: BlockHighlightService,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const worldPos = projectBlockAhead(camera, 3)
    const { chunkCoord, lx, lz } = getChunkAccessForWorldPosition(worldPos)
    const chunk = yield* chunkManagerService.getChunk(chunkCoord)
    yield* setBlockInChunk(chunk, lx, worldPos.y, lz, 'STONE')
    yield* chunkManagerService.markChunkDirty(chunkCoord)
    yield* worldRendererService.updateChunkInScene(chunk, scene).pipe(Effect.catchAllCause(() => Effect.void))
    yield* blockHighlight.invalidateCache()
  }))

const placeSelectedItemInFront = (
  camera: THREE.PerspectiveCamera,
  hotbarService: HotbarService,
  blockService: BlockService,
  blockHighlight: BlockHighlightService,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const selectedItem = yield* hotbarService.getSelectedBlockType()
    const selectedSlot = yield* hotbarService.getSelectedSlot()
    yield* Option.match(selectedItem, {
      onNone: () => Effect.void,
      onSome: (item) => {
        if (!Schema.is(BlockTypeSchema)(item)) return Effect.void
        return blockService.placeBlock(
          projectBlockAhead(camera, 4),
          item,
          SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(selectedSlot)),
        ).pipe(Effect.catchAllCause(() => Effect.void))
      },
    })
    yield* blockHighlight.invalidateCache()
  }))

const clearBlocksInFront = (
  camera: THREE.PerspectiveCamera,
  blockService: BlockService,
  blockHighlight: BlockHighlightService,
) =>
  Effect.runPromise(Effect.gen(function* () {
    yield* Effect.forEach([3, 4] as const, (distance) => {
      const pos = projectBlockAhead(camera, distance)
      return blockService.breakBlock(pos).pipe(Effect.catchAllCause(() => Effect.void))
    }, { concurrency: 1, discard: true })
    yield* blockHighlight.invalidateCache()
  }))

// ---------------------------------------------------------------------------
// Combat operations
// ---------------------------------------------------------------------------

const spawnLowHealthZombieInFront = (
  camera: THREE.PerspectiveCamera,
  entityManager: EntityManager,
  stagedZombiePositionRef: MutableRef.MutableRef<Position | null>,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const direction = getNormalizedLookDirection(camera)
    const zombiePos = {
      x: camera.position.x + direction.x * 6,
      y: camera.position.y,
      z: camera.position.z + direction.z * 6,
    }
    MutableRef.set(stagedZombiePositionRef, zombiePos)
    const zombieId = yield* entityManager.addEntity(EntityType.Zombie, zombiePos)
    yield* entityManager.applyDamage(zombieId, 12)
  }))

const attackFirstZombie = (
  hotbarService: HotbarService,
  entityManager: EntityManager,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const entities = yield* entityManager.getEntities()
    const zombieOpt = Arr.findFirst(entities, (entity) => entity.type === 'Zombie')
    return yield* Option.match(zombieOpt, {
      onNone: () => Effect.succeed(false),
      onSome: (zombie) => Effect.gen(function* () {
        const selectedItem = yield* hotbarService.getSelectedBlockType()
        const damage = Option.match(selectedItem, {
          onNone: () => PLAYER_ATTACK_DAMAGE,
          onSome: (item) => item === 'WOODEN_SWORD' ? WOODEN_SWORD_ATTACK_DAMAGE : PLAYER_ATTACK_DAMAGE,
        })
        yield* entityManager.applyDamage(zombie.entityId, damage)
        return true
      }),
    })
  }))

// ---------------------------------------------------------------------------
// Visual / aim / debug operations
// ---------------------------------------------------------------------------

const makeSetAimForQA = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  playerCameraState: PlayerCameraStateService,
  blockHighlight: BlockHighlightService,
) => (target: Position): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const dx = target.x - camera.position.x
    const dy = target.y - camera.position.y
    const dz = target.z - camera.position.z
    const yaw = Math.atan2(dx, -dz)
    const pitch = Math.atan2(dy, Math.hypot(dx, dz))
    yield* playerCameraState.setYaw(yaw)
    yield* playerCameraState.setPitch(pitch)
    yield* Effect.sync(() => {
      camera.rotation.set(pitch, yaw, 0, 'YXZ')
      camera.updateMatrixWorld(true)
      scene.updateMatrixWorld(true)
    })
  }).pipe(
    Effect.zipRight(blockHighlight.invalidateCache()),
    Effect.zipRight(blockHighlight.update(camera, scene)),
  )

const aimAtStagedResource = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  playerCameraState: PlayerCameraStateService,
  blockHighlight: BlockHighlightService,
  stagedResourceBlocksRef: MutableRef.MutableRef<Array<{ pos: { x: number; y: number; z: number }; blockType: BlockType }>>,
  resourceIndex: number,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const target = MutableRef.get(stagedResourceBlocksRef)[resourceIndex]
    if (!target) return
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight)
    yield* setAimForQA({ x: target.pos.x + 0.5, y: target.pos.y + 0.5, z: target.pos.z + 0.5 })
    yield* blockHighlight.setTargetForQA(
      { x: target.pos.x, y: target.pos.y, z: target.pos.z },
      {
        point: { x: target.pos.x + 0.5, y: target.pos.y + 0.5, z: target.pos.z + 0.5 },
        normal: { x: 0, y: 0, z: 1 },
        distance: 4,
        blockX: target.pos.x,
        blockY: target.pos.y,
        blockZ: target.pos.z,
      },
    )
  }))

const aimAtBuildSpot = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  playerCameraState: PlayerCameraStateService,
  blockHighlight: BlockHighlightService,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    direction.normalize()
    const wx = Math.floor(camera.position.x + direction.x * 4)
    const wy = Math.floor(camera.position.y)
    const wz = Math.floor(camera.position.z + direction.z * 4)
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight)
    yield* setAimForQA({ x: wx + 0.5, y: wy + 0.5, z: wz + 0.5 })
    yield* blockHighlight.setTargetForQA(
      { x: wx, y: wy, z: wz },
      {
        point: { x: wx + 0.5, y: wy + 0.5, z: wz + 0.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 4,
        blockX: wx,
        blockY: wy,
        blockZ: wz,
      },
    )
  }))

const aimAtStagedZombie = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  playerCameraState: PlayerCameraStateService,
  blockHighlight: BlockHighlightService,
  stagedZombiePositionRef: MutableRef.MutableRef<Position | null>,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const stagedZombiePosition = MutableRef.get(stagedZombiePositionRef)
    if (!stagedZombiePosition) return
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight)
    yield* setAimForQA({ x: stagedZombiePosition.x, y: stagedZombiePosition.y + 0.9, z: stagedZombiePosition.z })
    yield* blockHighlight.clearTargetForQA()
  }))

const dispatchMouseClick = (button: 0 | 2) =>
  Effect.runPromise(Effect.sync(() => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button }))
    if (button === 2) {
      document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button }))
    }
  }))

const getRenderingSnapshot = (camera: THREE.PerspectiveCamera, scene: THREE.Scene) => {
  const chunkMeshes = getChunkMeshSnapshots(scene)
  return {
    sceneChildren: scene.children.length,
    chunkMeshCount: chunkMeshes.length,
    visibleChunkMeshCount: chunkMeshes.filter((mesh) => mesh.visible).length,
    camera: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      near: camera.near,
      far: camera.far,
    },
    chunks: chunkMeshes,
  }
}

// ---------------------------------------------------------------------------
// installQaApi — wires everything together and sets window.__TS_MINECRAFT_QA__
// ---------------------------------------------------------------------------

export const installQaApi = ({
  camera,
  scene,
  playerCameraState,
  blockHighlight,
  inputService,
  inventoryService,
  inventoryRenderer,
  gameState,
  chunkManagerService,
  blockService,
  hotbarService,
  recipeService,
  furnaceService,
  worldRendererService,
  entityManager,
}: QaApiDeps): Effect.Effect<void, never> =>
  Effect.sync(() => {
    // Only expose QA API in development builds.
    // Uses the same two-signal check as terrain-worker-pool.ts: Vite's
    // import.meta.env.DEV (false in production builds) and the Node.js
    // NODE_ENV fallback for test environments.
    const qaApiEnv = getUnknownProperty(import.meta, 'env')
    const qaApiProcess = getUnknownProperty(globalThis, 'process')
    const isViteDev = isEnvLike(qaApiEnv) && qaApiEnv.DEV === true;
    const isNodeDev = isProcessLike(qaApiProcess) && qaApiProcess.env?.NODE_ENV === 'development';
    const isDevBuild = isViteDev || isNodeDev
    if (!isDevBuild) return

    if (typeof window === 'undefined') {
      return
    }

    const stagedResourceBlocksRef = MutableRef.make<Array<{ pos: { x: number; y: number; z: number }; blockType: BlockType }>>([])
    const stagedZombiePositionRef = MutableRef.make<Position | null>(null)

    const qa: QaApi = {
      getInventorySnapshot: () =>
        getInventorySnapshot(inventoryService),
      openInventoryForQA: () =>
        openInventoryForQA(inventoryRenderer),
      craftRecipeForQA: (recipeId: string) =>
        craftRecipeForQA(inventoryService, inventoryRenderer, recipeService, furnaceService, gameState, chunkManagerService, recipeId),
      stageProgressionScenario: () =>
        stageProgressionScenario(camera, scene, chunkManagerService, worldRendererService, blockHighlight, stagedResourceBlocksRef, stagedZombiePositionRef),
      collectStagedResources: () =>
        collectStagedResources(blockService, stagedResourceBlocksRef),
      spawnLowHealthZombieInFront: () =>
        spawnLowHealthZombieInFront(camera, entityManager, stagedZombiePositionRef),
      aimAtStagedResource: (resourceIndex: number) =>
        aimAtStagedResource(camera, scene, playerCameraState, blockHighlight, stagedResourceBlocksRef, resourceIndex),
      aimAtBuildSpot: () =>
        aimAtBuildSpot(camera, scene, playerCameraState, blockHighlight),
      aimAtStagedZombie: () =>
        aimAtStagedZombie(camera, scene, playerCameraState, blockHighlight, stagedZombiePositionRef),
      clearBlocksInFront: () =>
        clearBlocksInFront(camera, blockService, blockHighlight),
      stageBuildSupportBlock: () =>
        stageBuildSupportBlock(camera, scene, chunkManagerService, worldRendererService, blockHighlight),
      dispatchMouseClick: (button: 0 | 2) =>
        dispatchMouseClick(button),
      consumeMouseClickForQA: (button: 0 | 2) => Effect.runPromise(inputService.consumeMouseClick(button)),
      getCurrentTargetForQA: () => Effect.runPromise(blockHighlight.getTargetBlock()),
      attackFirstZombie: () =>
        attackFirstZombie(hotbarService, entityManager),
      placeSelectedItemInFront: () =>
        placeSelectedItemInFront(camera, hotbarService, blockService, blockHighlight),
      moveItemToHotbar: (itemType: InventoryItem, hotbarIndex: number) =>
        moveItemToHotbar(inventoryService, hotbarService, itemType, hotbarIndex),
      selectHotbarSlot: (hotbarIndex: number) =>
        selectHotbarSlot(hotbarService, hotbarIndex),
      getRecipeButtons: () =>
        getRecipeButtons(recipeService),
      getEntitySnapshot: () => Effect.runPromise(entityManager.getEntities()),
      getRenderingSnapshot: () =>
        getRenderingSnapshot(camera, scene),
    }

    Reflect.set(window, '__TS_MINECRAFT_QA__', qa)
  })
