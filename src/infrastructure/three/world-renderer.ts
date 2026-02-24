import { Effect, Context, Layer, Ref } from 'effect'
import * as THREE from 'three'
import { WorldService, WorldError } from '@/domain'
import { BlockType } from '@/domain/block'
import { Position, WorldId } from '@/shared/kernel'
import { BlockMeshService } from './meshing/block-mesh'
import { SceneService } from './scene/scene-service'

/**
 * Helper function to convert a Position to a string key for Map storage
 */
const positionToKey = (pos: Position): string => `${pos.x},${pos.y},${pos.z}`

/**
 * Service interface for synchronizing World state with Three.js scene
 */
export interface WorldRendererService {
  /**
   * Synchronize all blocks in a world with the scene
   * Clears existing meshes and recreates them from world state
   */
  readonly syncWorld: (
    worldId: WorldId,
    scene: THREE.Scene
  ) => Effect.Effect<void, WorldError>

  /**
   * Update a single block's mesh in the scene
   */
  readonly updateBlock: (
    position: Position,
    blockType: BlockType,
    scene: THREE.Scene
  ) => Effect.Effect<void, never>

  /**
   * Remove a block's mesh from the scene
   */
  readonly removeBlock: (
    position: Position,
    scene: THREE.Scene
  ) => Effect.Effect<void, never>

  /**
   * Clear all meshes from the scene
   */
  readonly clearScene: (scene: THREE.Scene) => Effect.Effect<void, never>
}

/**
 * Context tag for WorldRendererService
 */
export const WorldRendererService = Context.GenericTag<WorldRendererService>(
  '@minecraft/infrastructure/WorldRendererService'
)

/**
 * Live implementation of WorldRendererService
 * Manages mesh lifecycle and synchronizes with World state
 */
export const WorldRendererServiceLive = Layer.effect(
  WorldRendererService,
  Effect.gen(function* () {
    const worldService = yield* WorldService
    const blockMeshService = yield* BlockMeshService
    const sceneService = yield* SceneService
    const meshesRef = yield* Ref.make<Map<string, THREE.Mesh>>(new Map())

    return WorldRendererService.of({
      syncWorld: (worldId, scene) =>
        Effect.gen(function* () {
          // Get all blocks in visible area (hardcoded for Phase 3: 20x20 at y=0)
          const blocks = yield* worldService.getBlocksInArea(
            worldId,
            { x: -10, y: 0, z: -10 },
            { x: 10, y: 1, z: 10 }
          )

          // Clear existing meshes
          const existingMeshes = yield* Ref.get(meshesRef)
          for (const mesh of existingMeshes.values()) {
            yield* sceneService.remove(scene, mesh)
          }
          yield* Ref.set(meshesRef, new Map())

          // Create new meshes for each block
          for (const [position, _blockType] of blocks) {
            const mesh = yield* blockMeshService.createSolidBlockMesh(
              '#228B22', // Default color for Phase 3
              new THREE.Vector3(position.x, position.y, position.z)
            )

            const key = positionToKey(position)
            yield* Ref.update(meshesRef, (map) => new Map(map).set(key, mesh))
            yield* sceneService.add(scene, mesh)
          }
        }),

      updateBlock: (position, _blockType, scene) =>
        Effect.gen(function* () {
          const key = positionToKey(position)
          const meshes = yield* Ref.get(meshesRef)

          // Remove old mesh if exists
          const existingMesh = meshes.get(key)
          if (existingMesh) {
            yield* sceneService.remove(scene, existingMesh)
          }

          // Create new mesh
          const mesh = yield* blockMeshService.createSolidBlockMesh(
            '#228B22',
            new THREE.Vector3(position.x, position.y, position.z)
          )

          yield* Ref.update(meshesRef, (map) => new Map(map).set(key, mesh))
          yield* sceneService.add(scene, mesh)
        }),

      removeBlock: (position, scene) =>
        Effect.gen(function* () {
          const key = positionToKey(position)
          const meshes = yield* Ref.get(meshesRef)
          const mesh = meshes.get(key)

          if (mesh) {
            yield* sceneService.remove(scene, mesh)
            yield* Ref.update(meshesRef, (map) => {
              const newMap = new Map(map)
              newMap.delete(key)
              return newMap
            })
          }
        }),

      clearScene: (scene) =>
        Effect.gen(function* () {
          const meshes = yield* Ref.get(meshesRef)
          for (const mesh of meshes.values()) {
            yield* sceneService.remove(scene, mesh)
          }
          yield* Ref.set(meshesRef, new Map())
        }),
    })
  })
)
