/**
 * Spatial Grid Adapter
 * 
 * Infrastructure adapter that implements spatial indexing using concrete data structures.
 * This adapter provides the technical implementation while delegating business logic
 * to the domain layer via appropriate ports.
 * 
 * NOTE: This is a simplified technical implementation - complex spatial algorithms
 * should be implemented in domain services and injected via dependency injection.
 */

import { Effect, Layer, Context } from 'effect'
import { ISpatialGrid, SpatialGridPort } from '@domain/ports/spatial-grid.port'
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
 * Simple hash-based spatial grid implementation
 * 
 * This is a basic infrastructure adapter that handles:
 * - Data storage using JavaScript Map/Set
 * - Memory management 
 * - Basic CRUD operations
 * 
 * Complex spatial algorithms are delegated to domain services.
 */
export class SpatialGridAdapter implements ISpatialGrid {
  private cells = new Map<string, SpatialCell>()
  private entityToCell = new Map<EntityId, Set<string>>()
  
  /**
   * Generate cell key from coordinates
   */
  private getCellKey = (x: number, y: number, z: number): string => {
    const ix = Math.floor(x / CONFIG.CELL_SIZE)
    const iy = Math.floor(y / CONFIG.CELL_SIZE)  
    const iz = Math.floor(z / CONFIG.CELL_SIZE)
    return `${ix}:${iy}:${iz}`
  }

  /**
   * Get all cell keys that intersect with an AABB
   */
  private getCellKeysForAABB = (aabb: AABB): string[] => {
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
          keys.push(this.getCellKey(x * CONFIG.CELL_SIZE, y * CONFIG.CELL_SIZE, z * CONFIG.CELL_SIZE))
        }
      }
    }
    return keys
  }

  addEntity = (entityId: EntityId, bounds: AABB): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      // Remove entity from previous cells if exists
      yield* this.removeEntity(entityId)
      
      // Add to new cells
      const cellKeys = this.getCellKeysForAABB(bounds)
      const affectedCells = new Set<string>()
      
      for (const key of cellKeys) {
        affectedCells.add(key)
        
        let cell = this.cells.get(key)
        if (!cell) {
          cell = { entities: new Set() }
          this.cells.set(key, cell)
        }
        
        cell.entities.add(entityId)
      }
      
      this.entityToCell.set(entityId, affectedCells)
    })

  removeEntity = (entityId: EntityId): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      const cellKeys = this.entityToCell.get(entityId)
      if (!cellKeys) return
      
      for (const key of cellKeys) {
        const cell = this.cells.get(key)
        if (cell) {
          cell.entities.delete(entityId)
          if (cell.entities.size === 0) {
            this.cells.delete(key)
          }
        }
      }
      
      this.entityToCell.delete(entityId)
    })

  queryRegion = (bounds: AABB): Effect.Effect<ReadonlyArray<EntityId>, never, never> =>
    Effect.gen(function* () {
      const result = new Set<EntityId>()
      const cellKeys = this.getCellKeysForAABB(bounds)
      
      for (const key of cellKeys) {
        const cell = this.cells.get(key)
        if (cell) {
          for (const entityId of cell.entities) {
            result.add(entityId)
          }
        }
      }
      
      return Array.from(result)
    })

  clear = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      this.cells.clear()
      this.entityToCell.clear()
    })

  getCellCount = (): Effect.Effect<number, never, never> =>
    Effect.succeed(this.cells.size)

  getEntityCount = (): Effect.Effect<number, never, never> =>
    Effect.succeed(this.entityToCell.size)

  isAvailable = (): Effect.Effect<boolean, never, never> =>
    Effect.succeed(true)
}

/**
 * Live layer for Spatial Grid Adapter
 */
export const SpatialGridAdapterLive = Layer.succeed(
  SpatialGridPort,
  new SpatialGridAdapter(),
)

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
