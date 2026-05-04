import { Array as Arr, Effect, Option } from 'effect'
import * as THREE from 'three'
import { BlockService } from '@ts-minecraft/terrain'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { PlayerCameraStateService } from '@ts-minecraft/player'
import { GameStateService } from '@ts-minecraft/game'
import { HOTBAR_START } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { DEFAULT_PLAYER_ID, Position, SlotIndex, RecipeId } from '@ts-minecraft/kernel'
import { WorldRendererService } from '@ts-minecraft/rendering'
import { blockTypeToIndex } from '@ts-minecraft/kernel'
import { setBlockInChunk } from '@ts-minecraft/terrain'
import type { BlockType } from '@ts-minecraft/kernel'
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

type QaChunkMeshSnapshot = {
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
    .filter((child): child is THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> =>
      child instanceof THREE.Mesh && child.userData['chunkCoord'] !== undefined)
    .map((mesh) => {
      const position = mesh.geometry.getAttribute('position')
      const uv = mesh.geometry.getAttribute('uv')
      const tileIndex = mesh.geometry.getAttribute('tileIndex')
      return {
        chunkCoord: mesh.userData['chunkCoord'],
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
    if (typeof window === 'undefined') {
      return
    }

    let stagedResourceBlocks: Array<{ pos: { x: number; y: number; z: number }; blockType: BlockType }> = []
    let stagedZombiePosition: Position | null = null

    const getPlayerPositionForQa = () =>
      gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
        Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 })),
      )

    const getChunkOrNone = (coord: { readonly x: number; readonly z: number }) =>
      chunkManagerService.getChunk(coord).pipe(Effect.option)

    const scanNearbyCraftingStation = (targetBlockIndex: number) =>
      getPlayerPositionForQa().pipe(
        Effect.flatMap((playerPos) => scanNearbyBlock(playerPos, 5, targetBlockIndex, getChunkOrNone)),
      )

    const setAimForQA = (target: Position): Effect.Effect<void, never> =>
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

    const qa = {
      getInventorySnapshot: () =>
        Effect.runPromise(
          inventoryService.getAllSlots().pipe(
            Effect.map((slots) => Arr.map(slots, (slot, index) =>
              Option.match(slot, {
                onNone: () => null,
                onSome: (stack) => ({ slot: index, blockType: stack.blockType, count: stack.count }),
              })
            )),
          ),
        ),
      openInventoryForQA: () => Effect.runPromise(inventoryRenderer.toggle()),
      craftRecipeForQA: (recipeId: string) =>
        Effect.runPromise(Effect.gen(function* () {
          const hasTableAccess = yield* inventoryRenderer.isOpen().pipe(
            Effect.flatMap(() => scanNearbyCraftingStation(blockTypeToIndex('CRAFTING_TABLE'))),
          )
          const hasFurnaceAccess = yield* inventoryRenderer.isOpen().pipe(
            Effect.flatMap(() => scanNearbyCraftingStation(blockTypeToIndex('FURNACE'))),
          )
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
        })),
      stageProgressionScenario: () =>
        Effect.runPromise(Effect.gen(function* () {
          stagedResourceBlocks = []
          stagedZombiePosition = null

          const placeBlockAhead = (distance: number, blockType: BlockType) =>
            Effect.gen(function* () {
              const worldPos = projectBlockAhead(camera, distance)
              const { chunkCoord, lx, lz } = getChunkAccessForWorldPosition(worldPos)
              const chunk = yield* chunkManagerService.getChunk(chunkCoord)
              yield* setBlockInChunk(chunk, lx, worldPos.y, lz, blockType)
              yield* chunkManagerService.markChunkDirty(chunkCoord)
              yield* worldRendererService.updateChunkInScene(chunk, scene).pipe(Effect.catchAll(() => Effect.void))
              stagedResourceBlocks.push({ pos: worldPos, blockType })
            })

          yield* placeBlockAhead(4, 'WOOD')
          yield* placeBlockAhead(5, 'WOOD')
          yield* placeBlockAhead(6, 'WOOD')
          yield* blockHighlight.invalidateCache()
        })),
      collectStagedResources: () =>
        Effect.runPromise(Effect.gen(function* () {
          yield* Effect.forEach(stagedResourceBlocks, ({ pos }) => blockService.breakBlock(pos), { concurrency: 1, discard: true })
          stagedResourceBlocks = []
        })),
      spawnLowHealthZombieInFront: () =>
        Effect.runPromise(Effect.gen(function* () {
          const direction = getNormalizedLookDirection(camera)
          const zombiePos = {
            x: camera.position.x + direction.x * 6,
            y: camera.position.y,
            z: camera.position.z + direction.z * 6,
          }
          stagedZombiePosition = zombiePos
          const zombieId = yield* entityManager.addEntity(EntityType.Zombie, zombiePos)
          yield* entityManager.applyDamage(zombieId, 12)
        })),
      aimAtStagedResource: (resourceIndex: number) =>
        Effect.runPromise(Effect.gen(function* () {
          const target = stagedResourceBlocks[resourceIndex]
          if (!target) return
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
        })),
      aimAtBuildSpot: () =>
        Effect.runPromise(Effect.gen(function* () {
          const direction = new THREE.Vector3()
          camera.getWorldDirection(direction)
          direction.normalize()
          const wx = Math.floor(camera.position.x + direction.x * 4)
          const wy = Math.floor(camera.position.y)
          const wz = Math.floor(camera.position.z + direction.z * 4)
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
        })),
      aimAtStagedZombie: () =>
        Effect.runPromise(Effect.gen(function* () {
          if (!stagedZombiePosition) return
          yield* setAimForQA({ x: stagedZombiePosition.x, y: stagedZombiePosition.y + 0.9, z: stagedZombiePosition.z })
          yield* blockHighlight.clearTargetForQA()
        })),
      clearBlocksInFront: () =>
        Effect.runPromise(Effect.gen(function* () {
          yield* Effect.forEach([3, 4] as const, (distance) => {
            const pos = projectBlockAhead(camera, distance)
            return blockService.breakBlock(pos).pipe(Effect.catchAll(() => Effect.void))
          }, { concurrency: 1, discard: true })
          yield* blockHighlight.invalidateCache()
        })),
      stageBuildSupportBlock: () =>
        Effect.runPromise(Effect.gen(function* () {
          const worldPos = projectBlockAhead(camera, 3)
          const { chunkCoord, lx, lz } = getChunkAccessForWorldPosition(worldPos)
          const chunk = yield* chunkManagerService.getChunk(chunkCoord)
          yield* setBlockInChunk(chunk, lx, worldPos.y, lz, 'STONE')
          yield* chunkManagerService.markChunkDirty(chunkCoord)
          yield* worldRendererService.updateChunkInScene(chunk, scene).pipe(Effect.catchAll(() => Effect.void))
          yield* blockHighlight.invalidateCache()
        })),
      dispatchMouseClick: (button: 0 | 2) =>
        Effect.runPromise(Effect.sync(() => {
          document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button }))
          document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button }))
          if (button === 2) {
            document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button }))
          }
        })),
      consumeMouseClickForQA: (button: 0 | 2) => Effect.runPromise(inputService.consumeMouseClick(button)),
      getCurrentTargetForQA: () => Effect.runPromise(blockHighlight.getTargetBlock()),
      attackFirstZombie: () =>
        Effect.runPromise(Effect.gen(function* () {
          const qaSwordDamage = 8
          const qaHandDamage = 4
          const entities = yield* entityManager.getEntities()
          const zombieOpt = Arr.findFirst(entities, (entity) => entity.type === 'Zombie')
          return yield* Option.match(zombieOpt, {
            onNone: () => Effect.succeed(false),
            onSome: (zombie) => Effect.gen(function* () {
              const selectedItem = yield* hotbarService.getSelectedBlockType()
              const damage = Option.match(selectedItem, {
                onNone: () => qaHandDamage,
                onSome: (item) => item === 'WOODEN_SWORD' ? qaSwordDamage : qaHandDamage,
              })
              yield* entityManager.applyDamage(zombie.entityId, damage)
              return true
            }),
          })
        })),
      placeSelectedItemInFront: () =>
        Effect.runPromise(Effect.gen(function* () {
          const selectedItem = yield* hotbarService.getSelectedBlockType()
          const selectedSlot = yield* hotbarService.getSelectedSlot()
          yield* Option.match(selectedItem, {
            onNone: () => Effect.void,
            onSome: (blockType) =>
              blockService.placeBlock(
                projectBlockAhead(camera, 4),
                blockType,
                SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(selectedSlot)),
              ).pipe(Effect.catchAll(() => Effect.void)),
          })
          yield* blockHighlight.invalidateCache()
        })),
      moveItemToHotbar: (blockType: BlockType, hotbarIndex: number) =>
        Effect.runPromise(Effect.gen(function* () {
          const slots = yield* inventoryService.getAllSlots()
          const fromIndexOpt = Arr.findFirstIndex(slots, (slot) => Option.match(slot, { onNone: () => false, onSome: (stack) => stack.blockType === blockType }))
          const fromIndex = Option.getOrElse(fromIndexOpt, () => -1)
          if (fromIndex < 0) return false
          yield* inventoryService.moveStack(SlotIndex.make(fromIndex), SlotIndex.make(HOTBAR_START + hotbarIndex))
          yield* hotbarService.setSelectedSlot(SlotIndex.make(hotbarIndex))
          return true
        })),
      selectHotbarSlot: (hotbarIndex: number) => Effect.runPromise(hotbarService.setSelectedSlot(SlotIndex.make(hotbarIndex))),
      getRecipeButtons: () => Arr.map(recipeService.getAllRecipes(), (recipe) => recipe.id),
      getEntitySnapshot: () => Effect.runPromise(entityManager.getEntities()),
      getRenderingSnapshot: () => {
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
      },
    }

    Reflect.set(window as object, '__TS_MINECRAFT_QA__', qa)
  })
