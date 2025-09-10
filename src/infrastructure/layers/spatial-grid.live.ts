import { Layer, Effect, Ref } from 'effect'
import { SpatialGrid } from '@/services/core/spatial-grid'
import { EntityId } from '@/domain/entity'
import { AABB } from '@/domain/geometry'

/**
 * Production implementation of SpatialGrid service
 * Provides efficient spatial queries for collision detection
 */

interface GridCell {
  entities: Set<EntityId>
}

export const SpatialGridLive = Layer.effect(
  SpatialGrid,
  Effect.gen(function* () {
    const cellSize = 16 // Size of each grid cell
    const grid = yield* Ref.make(new Map<string, GridCell>())
    const entityBounds = yield* Ref.make(new Map<EntityId, AABB>())
    const entityCells = yield* Ref.make(new Map<EntityId, Set<string>>())
    
    const _getCellKey = (x: number, z: number): string => {
      const cellX = Math.floor(x / cellSize)
      const cellZ = Math.floor(z / cellSize)
      return `${cellX},${cellZ}`
    }
    
    const getCellsForAABB = (aabb: AABB): Set<string> => {
      const cells = new Set<string>()
      
      const minCellX = Math.floor(aabb.minX / cellSize)
      const maxCellX = Math.floor(aabb.maxX / cellSize)
      const minCellZ = Math.floor(aabb.minZ / cellSize)
      const maxCellZ = Math.floor(aabb.maxZ / cellSize)
      
      for (let x = minCellX; x <= maxCellX; x++) {
        for (let z = minCellZ; z <= maxCellZ; z++) {
          cells.add(`${x},${z}`)
        }
      }
      
      return cells
    }
    
    return SpatialGrid.of({
      add: (entityId: EntityId, aabb: AABB) =>
        Effect.gen(function* () {
          // Remove from old cells if exists
          const oldCells = yield* Ref.get(entityCells).pipe(
            Effect.map(m => m.get(entityId))
          )
          
          if (oldCells) {
            yield* Ref.modify(grid, g => {
              const newGrid = new Map(g)
              oldCells.forEach(cellKey => {
                const cell = newGrid.get(cellKey)
                if (cell) {
                  cell.entities.delete(entityId)
                  if (cell.entities.size === 0) {
                    newGrid.delete(cellKey)
                  }
                }
              })
              return [undefined, newGrid] as const
            })
          }
          
          // Add to new cells
          const newCells = getCellsForAABB(aabb)
          
          yield* Ref.modify(grid, g => {
            const newGrid = new Map(g)
            newCells.forEach(cellKey => {
              let cell = newGrid.get(cellKey)
              if (!cell) {
                cell = { entities: new Set() }
                newGrid.set(cellKey, cell)
              }
              cell.entities.add(entityId)
            })
            return [undefined, newGrid] as const
          })
          
          // Update entity tracking
          yield* Ref.modify(entityBounds, m => {
            const newMap = new Map(m)
            newMap.set(entityId, aabb)
            return [undefined, newMap] as const
          })
          
          yield* Ref.modify(entityCells, m => {
            const newMap = new Map(m)
            newMap.set(entityId, newCells)
            return [undefined, newMap] as const
          })
        }),
      
      remove: (entityId: EntityId) =>
        Effect.gen(function* () {
          const cells = yield* Ref.get(entityCells).pipe(
            Effect.map(m => m.get(entityId))
          )
          
          if (cells) {
            yield* Ref.modify(grid, g => {
              const newGrid = new Map(g)
              cells.forEach(cellKey => {
                const cell = newGrid.get(cellKey)
                if (cell) {
                  cell.entities.delete(entityId)
                  if (cell.entities.size === 0) {
                    newGrid.delete(cellKey)
                  }
                }
              })
              return [undefined, newGrid] as const
            })
          }
          
          yield* Ref.modify(entityBounds, m => {
            const newMap = new Map(m)
            newMap.delete(entityId)
            return [undefined, newMap] as const
          })
          
          yield* Ref.modify(entityCells, m => {
            const newMap = new Map(m)
            newMap.delete(entityId)
            return [undefined, newMap] as const
          })
        }),
      
      update: (entityId: EntityId, aabb: AABB) =>
        Effect.gen(function* () {
          const oldCells = yield* Ref.get(entityCells).pipe(
            Effect.map(m => m.get(entityId))
          )
          const newCells = getCellsForAABB(aabb)
          
          // Only update if cells changed
          if (oldCells) {
            const oldCellsArray = Array.from(oldCells)
            const newCellsArray = Array.from(newCells)
            
            if (oldCellsArray.length === newCellsArray.length &&
                oldCellsArray.every(c => newCells.has(c))) {
              // Just update bounds, no cell change
              yield* Ref.modify(entityBounds, m => {
                const newMap = new Map(m)
                newMap.set(entityId, aabb)
                return [undefined, newMap] as const
              })
              return
            }
          }
          
          // Cells changed, do full update
          const spatialGrid = yield* SpatialGrid
          yield* spatialGrid.remove(entityId)
          yield* spatialGrid.add(entityId, aabb)
        }),
      
      query: (queryAABB: AABB) =>
        Effect.gen(function* () {
          const cells = getCellsForAABB(queryAABB)
          const candidates = new Set<EntityId>()
          
          const currentGrid = yield* Ref.get(grid)
          const bounds = yield* Ref.get(entityBounds)
          
          // Get all entities in relevant cells
          cells.forEach(cellKey => {
            const cell = currentGrid.get(cellKey)
            if (cell) {
              cell.entities.forEach(entityId => {
                candidates.add(entityId)
              })
            }
          })
          
          // Filter by actual AABB intersection
          const results = new Set<EntityId>()
          candidates.forEach(entityId => {
            const entityAABB = bounds.get(entityId)
            if (entityAABB) {
              // Check AABB intersection
              if (entityAABB.maxX >= queryAABB.minX &&
                  entityAABB.minX <= queryAABB.maxX &&
                  entityAABB.maxY >= queryAABB.minY &&
                  entityAABB.minY <= queryAABB.maxY &&
                  entityAABB.maxZ >= queryAABB.minZ &&
                  entityAABB.minZ <= queryAABB.maxZ) {
                results.add(entityId)
              }
            }
          })
          
          return results
        }),
      
      clear: () =>
        Effect.gen(function* () {
          yield* Ref.set(grid, new Map())
          yield* Ref.set(entityBounds, new Map())
          yield* Ref.set(entityCells, new Map())
        })
    })
  })
)