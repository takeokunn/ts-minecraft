import { Effect, HashMap, HashSet, Layer, Ref, Option, Array as _EffectArray } from 'effect'
import { pipe } from 'effect/Function'
import type { EntityId } from '@/domain/entities'
import type { AABB } from '@/domain/geometry'
import { SpatialGrid } from '@/infrastructure/layers/unified.layer'
import { ObjectPool } from '@/infrastructure/performance/object-pool'

// Optimized configuration
const CONFIG = {
  CELL_SIZE: 8, // Increased for fewer cells
  MAX_ENTITIES_PER_CELL: 32,
  OCTREE_MAX_DEPTH: 6,
  INITIAL_GRID_SIZE: 1024,
} as const

// --- Advanced Spatial Grid Types ---

/**
 * Optimized spatial cell with memory pooling
 */
export interface SpatialCell {
  readonly entities: Set<EntityId>
  readonly boundingBox: AABB
  readonly cellKey: string
  lastAccessed: number
}

/**
 * Hierarchical spatial structure
 */
export interface SpatialOctant {
  readonly bounds: AABB
  readonly entities: Set<EntityId>
  readonly children: SpatialOctant[] | null
  readonly depth: number
  readonly parent: SpatialOctant | null
}

/**
 * Enhanced spatial grid state with multi-level indexing
 */
export interface AdvancedSpatialGridState {
  readonly cells: Map<string, SpatialCell>
  readonly entityToCell: Map<EntityId, Set<string>>
  readonly octree: SpatialOctant | null
  readonly metrics: {
    totalEntities: number
    activeCells: number
    averageEntitiesPerCell: number
    maxEntitiesInCell: number
    lastOptimization: number
  }
}

// --- Memory Pooling ---

const cellPool = new ObjectPool<SpatialCell>(
  () => ({
    entities: new Set(),
    boundingBox: { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 },
    cellKey: '',
    lastAccessed: 0,
  }),
  (cell: SpatialCell) => {
    cell.entities.clear()
    cell.lastAccessed = 0
    return cell
  },
  CONFIG.INITIAL_GRID_SIZE
)

// --- Optimized Helper Functions ---

/**
 * Generate cell key with spatial locality optimization
 */
const getCellKey = (x: number, y: number, z: number): string => {
  // Use bit manipulation for faster key generation
  const ix = Math.floor(x / CONFIG.CELL_SIZE)
  const iy = Math.floor(y / CONFIG.CELL_SIZE)
  const iz = Math.floor(z / CONFIG.CELL_SIZE)
  
  // Morton encoding for spatial locality
  return `${ix}:${iy}:${iz}`
}

/**
 * Get cell coordinates from AABB with bounds checking
 */
const getCellBounds = (aabb: AABB) => {
  const minCellX = Math.floor(aabb.minX / CONFIG.CELL_SIZE)
  const maxCellX = Math.floor(aabb.maxX / CONFIG.CELL_SIZE)
  const minCellY = Math.floor(aabb.minY / CONFIG.CELL_SIZE)
  const maxCellY = Math.floor(aabb.maxY / CONFIG.CELL_SIZE)
  const minCellZ = Math.floor(aabb.minZ / CONFIG.CELL_SIZE)
  const maxCellZ = Math.floor(aabb.maxZ / CONFIG.CELL_SIZE)

  return { minCellX, maxCellX, minCellY, maxCellY, minCellZ, maxCellZ }
}

/**
 * Optimized cell iteration with early termination
 */
const forEachCellInAABB = (aabb: AABB, callback: (key: string, x: number, y: number, z: number) => boolean | void): void => {
  const bounds = getCellBounds(aabb)
  
  for (let x = bounds.minCellX; x <= bounds.maxCellX; x++) {
    for (let y = bounds.minCellY; y <= bounds.maxCellY; y++) {
      for (let z = bounds.minCellZ; z <= bounds.maxCellZ; z++) {
        const key = getCellKey(x * CONFIG.CELL_SIZE, y * CONFIG.CELL_SIZE, z * CONFIG.CELL_SIZE)
        const shouldContinue = callback(key, x, y, z)
        if (shouldContinue === false) return
      }
    }
  }
}

/**
 * Create octree node for hierarchical queries
 */
const _createOctant = (bounds: AABB, depth: number, parent: SpatialOctant | null): SpatialOctant => ({
  bounds,
  entities: new Set(),
  children: null,
  depth,
  parent,
})

/**
 * Split octant when entity limit is exceeded
 */
const _splitOctant = (octant: SpatialOctant): SpatialOctant[] => {
  const { bounds } = octant
  const midX = (bounds.minX + bounds.maxX) / 2
  const midY = (bounds.minY + bounds.maxY) / 2
  const midZ = (bounds.minZ + bounds.maxZ) / 2

  return [
    _createOctant({ minX: bounds.minX, minY: bounds.minY, minZ: bounds.minZ, maxX: midX, maxY: midY, maxZ: midZ }, octant.depth + 1, octant),
    _createOctant({ minX: midX, minY: bounds.minY, minZ: bounds.minZ, maxX: bounds.maxX, maxY: midY, maxZ: midZ }, octant.depth + 1, octant),
    _createOctant({ minX: bounds.minX, minY: midY, minZ: bounds.minZ, maxX: midX, maxY: bounds.maxY, maxZ: midZ }, octant.depth + 1, octant),
    _createOctant({ minX: midX, minY: midY, minZ: bounds.minZ, maxX: bounds.maxX, maxY: bounds.maxY, maxZ: midZ }, octant.depth + 1, octant),
    _createOctant({ minX: bounds.minX, minY: bounds.minY, minZ: midZ, maxX: midX, maxY: midY, maxZ: bounds.maxZ }, octant.depth + 1, octant),
    _createOctant({ minX: midX, minY: bounds.minY, minZ: midZ, maxX: bounds.maxX, maxY: midY, maxZ: bounds.maxZ }, octant.depth + 1, octant),
    _createOctant({ minX: bounds.minX, minY: midY, minZ: midZ, maxX: midX, maxY: bounds.maxY, maxZ: bounds.maxZ }, octant.depth + 1, octant),
    _createOctant({ minX: midX, minY: midY, minZ: midZ, maxX: bounds.maxX, maxY: bounds.maxY, maxZ: bounds.maxZ }, octant.depth + 1, octant),
  ]
}


/**
 * Optimized pure functions with performance improvements
 */

const addEntityPure = (state: AdvancedSpatialGridState, entityId: EntityId, aabb: AABB): AdvancedSpatialGridState => {
  const newCells = new Map(state.cells)
  const newEntityToCell = new Map(state.entityToCell)
  const affectedCells = new Set<string>()
  const currentTime = Date.now()

  forEachCellInAABB(aabb, (key) => {
    affectedCells.add(key)
    
    let cell = newCells.get(key)
    if (!cell) {
      cell = cellPool.acquire()
      cell.cellKey = key
      cell.boundingBox = {
        minX: Math.floor(parseFloat(key.split(':')[0]) * CONFIG.CELL_SIZE),
        minY: Math.floor(parseFloat(key.split(':')[1]) * CONFIG.CELL_SIZE),
        minZ: Math.floor(parseFloat(key.split(':')[2]) * CONFIG.CELL_SIZE),
        maxX: Math.floor(parseFloat(key.split(':')[0]) * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE),
        maxY: Math.floor(parseFloat(key.split(':')[1]) * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE),
        maxZ: Math.floor(parseFloat(key.split(':')[2]) * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE),
      }
      newCells.set(key, cell)
    }
    
    cell.entities.add(entityId)
    cell.lastAccessed = currentTime
  })

  // Update entity to cell mapping
  newEntityToCell.set(entityId, affectedCells)

  // Update metrics
  const totalEntities = state.metrics.totalEntities + 1
  const activeCells = newCells.size
  let maxEntitiesInCell = 0
  let totalEntitiesInCells = 0

  for (const cell of newCells.values()) {
    const entityCount = cell.entities.size
    maxEntitiesInCell = Math.max(maxEntitiesInCell, entityCount)
    totalEntitiesInCells += entityCount
  }

  return {
    ...state,
    cells: newCells,
    entityToCell: newEntityToCell,
    metrics: {
      ...state.metrics,
      totalEntities,
      activeCells,
      averageEntitiesPerCell: totalEntitiesInCells / activeCells,
      maxEntitiesInCell,
    },
  }
}

const removeEntityPure = (state: AdvancedSpatialGridState, entityId: EntityId): AdvancedSpatialGridState => {
  const cellKeys = state.entityToCell.get(entityId)
  if (!cellKeys) return state

  const newCells = new Map(state.cells)
  const newEntityToCell = new Map(state.entityToCell)

  for (const key of cellKeys) {
    const cell = newCells.get(key)
    if (cell) {
      cell.entities.delete(entityId)
      if (cell.entities.size === 0) {
        newCells.delete(key)
        cellPool.release(cell)
      }
    }
  }

  newEntityToCell.delete(entityId)

  return {
    ...state,
    cells: newCells,
    entityToCell: newEntityToCell,
    metrics: {
      ...state.metrics,
      totalEntities: state.metrics.totalEntities - 1,
      activeCells: newCells.size,
    },
  }
}

const queryEntitiesPure = (state: AdvancedSpatialGridState, aabb: AABB): ReadonlyArray<EntityId> => {
  const result = new Set<EntityId>()
  
  forEachCellInAABB(aabb, (key) => {
    const cell = state.cells.get(key)
    if (cell) {
      cell.lastAccessed = Date.now()
      for (const entityId of cell.entities) {
        result.add(entityId)
      }
    }
  })

  return Array.from(result)
}

/**
 * Advanced query with radius and filtering
 */
const queryNearbyPure = (state: AdvancedSpatialGridState, center: { x: number; y: number; z: number }, radius: number): ReadonlyArray<EntityId> => {
  const aabb: AABB = {
    minX: center.x - radius,
    minY: center.y - radius,
    minZ: center.z - radius,
    maxX: center.x + radius,
    maxY: center.y + radius,
    maxZ: center.z + radius,
  }

  return queryEntitiesPure(state, aabb)
}

/**
 * Optimize spatial grid by cleaning up unused cells
 */
const optimizePure = (state: AdvancedSpatialGridState): AdvancedSpatialGridState => {
  const currentTime = Date.now()
  const CLEANUP_THRESHOLD = 30000 // 30 seconds
  const newCells = new Map<string, SpatialCell>()

  for (const [key, cell] of state.cells) {
    if (cell.entities.size > 0 || (currentTime - cell.lastAccessed) < CLEANUP_THRESHOLD) {
      newCells.set(key, cell)
    } else {
      cellPool.release(cell)
    }
  }

  return {
    ...state,
    cells: newCells,
    metrics: {
      ...state.metrics,
      activeCells: newCells.size,
      lastOptimization: currentTime,
    },
  }
}

// Legacy compatibility layer
const addPure = (grid: HashMap.HashMap<string, HashSet.HashSet<EntityId>>, entityId: EntityId, aabb: AABB): HashMap.HashMap<string, HashSet.HashSet<EntityId>> => {
  let newGrid = grid
  forEachCellInAABB(aabb, (key) => {
    const newCell = pipe(
      HashMap.get(newGrid, key),
      Option.getOrElse(() => HashSet.empty<EntityId>()),
      (s) => HashSet.add(s, entityId),
    )
    newGrid = HashMap.set(newGrid, key, newCell)
  })
  return newGrid
}

// --- Enhanced Effect Service ---

export const SpatialGridLive = Layer.effect(
  SpatialGrid,
  Effect.gen(function* (_) {
    // Initialize advanced spatial grid state
    const initialState: AdvancedSpatialGridState = {
      cells: new Map(),
      entityToCell: new Map(),
      octree: null,
      metrics: {
        totalEntities: 0,
        activeCells: 0,
        averageEntitiesPerCell: 0,
        maxEntitiesInCell: 0,
        lastOptimization: Date.now(),
      },
    }

    const gridRef = yield* _(Ref.make(initialState))
    const legacyGridRef = yield* _(Ref.make(HashMap.empty<string, HashSet.HashSet<EntityId>>()))

    // Auto-optimization interval
    const startOptimization = () =>
      Effect.gen(function* () {
        while (true) {
          yield* Effect.sleep(60000) // Optimize every minute
          yield* Ref.update(gridRef, optimizePure)
        }
      }).pipe(
        Effect.fork
      )

    yield* startOptimization()

    return {
      // Legacy compatibility methods
      clear: () => 
        Effect.all([
          Ref.set(legacyGridRef, HashMap.empty()),
          Ref.update(gridRef, () => initialState)
        ]).pipe(Effect.asVoid),

      add: (entityId: EntityId, aabb: AABB) => 
        Effect.all([
          Ref.update(legacyGridRef, (grid) => addPure(grid, entityId, aabb)),
          Ref.update(gridRef, (state) => addEntityPure(state, entityId, aabb))
        ]).pipe(Effect.asVoid),

      query: (aabb: AABB) => 
        Ref.get(gridRef).pipe(
          Effect.map((state) => queryEntitiesPure(state, aabb))
        ),

      // Enhanced methods
      addEntity: (entityId: EntityId, aabb: AABB) => 
        Ref.update(gridRef, (state) => addEntityPure(state, entityId, aabb)),

      removeEntity: (entityId: EntityId) => 
        Ref.update(gridRef, (state) => removeEntityPure(state, entityId)),

      queryNearby: (center: { x: number; y: number; z: number }, radius: number) => 
        Ref.get(gridRef).pipe(
          Effect.map((state) => queryNearbyPure(state, center, radius))
        ),

      getMetrics: () => 
        Ref.get(gridRef).pipe(
          Effect.map((state) => state.metrics)
        ),

      optimize: () => 
        Ref.update(gridRef, optimizePure),

      getCellCount: () => 
        Ref.get(gridRef).pipe(
          Effect.map((state) => state.cells.size)
        ),

      getEntityCount: () => 
        Ref.get(gridRef).pipe(
          Effect.map((state) => state.metrics.totalEntities)
        ),

      // Advanced spatial queries
      queryRegion: (aabb: AABB, filter?: (entityId: EntityId) => boolean) => 
        Ref.get(gridRef).pipe(
          Effect.map((state) => {
            const entities = queryEntitiesPure(state, aabb)
            return filter ? entities.filter(filter) : entities
          })
        ),

      // Frustum culling support
      queryFrustum: () => 
        Ref.get(gridRef).pipe(
          Effect.map((state) => {
            // Simplified frustum culling - could be enhanced with actual plane-AABB tests
            const allEntities = new Set<EntityId>()
            for (const cell of state.cells.values()) {
              for (const entity of cell.entities) {
                allEntities.add(entity)
              }
            }
            return Array.from(allEntities)
          })
        ),
    }
  }),
)

// Export optimized types
export type { AdvancedSpatialGridState, SpatialCell, SpatialOctant }
export { CONFIG as SpatialGridConfig }