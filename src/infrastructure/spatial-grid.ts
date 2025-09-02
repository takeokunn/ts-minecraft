import { Context, Effect, HashMap, HashSet, Layer, Option, Ref } from 'effect'
import { pipe } from 'effect/Function'
import type { EntityId } from '@/domain/entity'
import type { AABB } from '@/domain/geometry'

const CELL_SIZE = 4

// --- Pure Implementation ---

type SpatialGridState = HashMap.HashMap<string, HashSet.HashSet<EntityId>>

const forEachCellInAABB = (aabb: AABB, callback: (key: string) => void): void => {
  const minCellX = Math.floor(aabb.minX / CELL_SIZE)
  const maxCellX = Math.floor(aabb.maxX / CELL_SIZE)
  const minCellY = Math.floor(aabb.minY / CELL_SIZE)
  const maxCellY = Math.floor(aabb.maxY / CELL_SIZE)
  const minCellZ = Math.floor(aabb.minZ / CELL_SIZE)
  const maxCellZ = Math.floor(aabb.maxZ / CELL_SIZE)

  for (let x = minCellX; x <= maxCellX; x++) {
    for (let y = minCellY; y <= maxCellY; y++) {
      for (let z = minCellZ; z <= maxCellZ; z++) {
        callback(`${x},${y},${z}`)
      }
    }
  }
}

const registerPure = (grid: SpatialGridState, entityId: EntityId, aabb: AABB): SpatialGridState => {
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

const queryPure = (grid: SpatialGridState, aabb: AABB): ReadonlyArray<EntityId> => {
  let potentialCollisions = HashSet.empty<EntityId>()
  forEachCellInAABB(aabb, (key) => {
    const cell = HashMap.get(grid, key)
    if (Option.isSome(cell)) {
      potentialCollisions = HashSet.union(potentialCollisions, cell.value)
    }
  })
  return Array.from(HashSet.values(potentialCollisions))
}

// --- Effect Service ---

export interface SpatialGrid {
  readonly state: Ref.Ref<SpatialGridState>
  readonly clear: Effect.Effect<void>
  readonly register: (entityId: EntityId, aabb: AABB) => Effect.Effect<void>
  readonly query: (aabb: AABB) => Effect.Effect<ReadonlyArray<EntityId>>
}

export const SpatialGrid = Context.GenericTag<SpatialGrid>('app/SpatialGrid')

export const SpatialGridLive = Layer.effect(
  SpatialGrid,
  Effect.gen(function* (_) {
    const gridRef = yield* _(Ref.make(HashMap.empty<string, HashSet.HashSet<EntityId>>()))

    return {
      state: gridRef,
      clear: Ref.set(gridRef, HashMap.empty()),
      register: (entityId: EntityId, aabb: AABB) => Ref.update(gridRef, (grid) => registerPure(grid, entityId, aabb)),
      query: (aabb: AABB) => Effect.map(Ref.get(gridRef), (grid) => queryPure(grid, aabb)),
    }
  }),
)
