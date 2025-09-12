/**
 * Spatial Grid Adapter
 *
 * Infrastructure adapter that implements spatial indexing using concrete data structures
 * with functional programming patterns using Effect-TS and Context.GenericTag.
 * This adapter provides the technical implementation while delegating business logic
 * to the domain layer via appropriate ports.
 *
 * NOTE: This is a simplified technical implementation - complex spatial algorithms
 * should be implemented in domain services and injected via dependency injection.
 */

import { Effect, Layer, Context, Ref } from 'effect'
import type { EntityId } from '@domain/entities'
import type { AABB } from '@domain/value-objects/physics/aabb.vo'

/**
 * Simple spatial grid cell for entity storage
 */
interface SpatialCell {
  readonly entities: Set<EntityId>
}

/**
 * Infrastructure-specific spatial grid configuration
 */
const CONFIG = {
  CELL_SIZE: 16,
  CLEANUP_INTERVAL: 60000, // 1 minute
} as const

/**
 * Internal state for spatial grid
 */
interface SpatialGridState {
  readonly cells: Map<string, SpatialCell>
  readonly entityToCell: Map<EntityId, Set<string>>
}

/**
 * Spatial Grid Adapter Service Interface
 * Defines the contract for spatial indexing with proper error handling
 */
export interface SpatialGridAdapter {
  readonly addEntity: (entityId: EntityId, bounds: AABB) => Effect.Effect<void, never>
  readonly removeEntity: (entityId: EntityId) => Effect.Effect<void, never>
  readonly queryRegion: (bounds: AABB) => Effect.Effect<ReadonlyArray<EntityId>, never>
  readonly clear: () => Effect.Effect<void, never>
  readonly getCellCount: () => Effect.Effect<number, never>
  readonly getEntityCount: () => Effect.Effect<number, never>
  readonly isAvailable: () => Effect.Effect<boolean, never>
}

/**
 * Context tag for Spatial Grid Adapter dependency injection
 */
export const SpatialGridAdapter = Context.GenericTag<SpatialGridAdapter>('@app/SpatialGridAdapter')

/**
 * Simple hash-based spatial grid implementation
 *
 * This is a basic infrastructure adapter that handles:
 * - Data storage using JavaScript Map/Set
 * - Memory management
 * - Basic CRUD operations
 *
 * Complex spatial algorithms are delegated to domain services.
 */
const createSpatialGridAdapter = () =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<SpatialGridState>({
      cells: new Map(),
      entityToCell: new Map(),
    })

    /**
     * Generate cell key from coordinates
     */
    const getCellKey = (x: number, y: number, z: number): string => {
      const ix = Math.floor(x / CONFIG.CELL_SIZE)
      const iy = Math.floor(y / CONFIG.CELL_SIZE)
      const iz = Math.floor(z / CONFIG.CELL_SIZE)
      return `${ix}:${iy}:${iz}`
    }

    /**
     * Get all cell keys that intersect with an AABB
     */
    const getCellKeysForAABB = (aabb: AABB): string[] => {
      const keys: string[] = []
      const minCellX = Math.floor(aabb.minX / CONFIG.CELL_SIZE)
      const maxCellX = Math.floor(aabb.maxX / CONFIG.CELL_SIZE)
      const minCellY = Math.floor(aabb.minY / CONFIG.CELL_SIZE)
      const maxCellY = Math.floor(aabb.maxY / CONFIG.CELL_SIZE)
      const minCellZ = Math.floor(aabb.minZ / CONFIG.CELL_SIZE)
      const maxCellZ = Math.floor(aabb.maxZ / CONFIG.CELL_SIZE)

      for (let x = minCellX; x <= maxCellX; x++) {
        for (let y = minCellY; y <= maxCellY; y++) {
          for (let z = minCellZ; z <= maxCellZ; z++) {
            keys.push(getCellKey(x * CONFIG.CELL_SIZE, y * CONFIG.CELL_SIZE, z * CONFIG.CELL_SIZE))
          }
        }
      }
      return keys
    }

    return {
      addEntity: (entityId: EntityId, bounds: AABB): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)

          // Remove entity from previous cells if exists
          const existingCellKeys = state.entityToCell.get(entityId)
          if (existingCellKeys) {
            for (const key of existingCellKeys) {
              const cell = state.cells.get(key)
              if (cell) {
                cell.entities.delete(entityId)
                if (cell.entities.size === 0) {
                  state.cells.delete(key)
                }
              }
            }
            state.entityToCell.delete(entityId)
          }

          // Add to new cells
          const cellKeys = getCellKeysForAABB(bounds)
          const affectedCells = new Set<string>()

          for (const key of cellKeys) {
            affectedCells.add(key)

            let cell = state.cells.get(key)
            if (!cell) {
              cell = { entities: new Set() }
              state.cells.set(key, cell)
            }

            cell.entities.add(entityId)
          }

          state.entityToCell.set(entityId, affectedCells)
        }),

      removeEntity: (entityId: EntityId): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const cellKeys = state.entityToCell.get(entityId)
          if (!cellKeys) return

          for (const key of cellKeys) {
            const cell = state.cells.get(key)
            if (cell) {
              cell.entities.delete(entityId)
              if (cell.entities.size === 0) {
                state.cells.delete(key)
              }
            }
          }

          state.entityToCell.delete(entityId)
        }),

      queryRegion: (bounds: AABB): Effect.Effect<ReadonlyArray<EntityId>, never> =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const result = new Set<EntityId>()
          const cellKeys = getCellKeysForAABB(bounds)

          for (const key of cellKeys) {
            const cell = state.cells.get(key)
            if (cell) {
              for (const entityId of cell.entities) {
                result.add(entityId)
              }
            }
          }

          return Array.from(result)
        }),

      clear: (): Effect.Effect<void, never> =>
        Ref.update(stateRef, () => ({
          cells: new Map(),
          entityToCell: new Map(),
        })),

      getCellCount: (): Effect.Effect<number, never> => Ref.get(stateRef).pipe(Effect.map((state) => state.cells.size)),

      getEntityCount: (): Effect.Effect<number, never> => Ref.get(stateRef).pipe(Effect.map((state) => state.entityToCell.size)),

      isAvailable: (): Effect.Effect<boolean, never> => Effect.succeed(true),
    } satisfies SpatialGridAdapter
  })

/**
 * Live layer for Spatial Grid Adapter
 */
export const SpatialGridAdapterLive = Layer.effect(SpatialGridAdapter, createSpatialGridAdapter())

/**
 * Infrastructure utilities for spatial grid operations
 */
export const SpatialGridAdapterUtils = {
  /**
   * Calculate memory usage estimate
   */
  estimateMemoryUsage: (entityCount: number): number => {
    // Rough estimate: each entity might occupy multiple cells
    const avgCellsPerEntity = 2
    const bytesPerCell = 64 // Rough estimate for Map overhead + Set
    return entityCount * avgCellsPerEntity * bytesPerCell
  },

  /**
   * Get configuration
   */
  getConfig: () => CONFIG,
}
