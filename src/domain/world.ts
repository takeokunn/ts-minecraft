import { Effect, Context, Layer, Option, Ref, Schema } from 'effect'
import { WorldId, WorldIdSchema, Position } from '@/shared/kernel'
import { WorldError } from './errors'
import { BlockType, BlockTypeSchema } from './block'

/**
 * Helper function to convert a Position to a string key for Map storage
 */
const positionToKey = (pos: Position): string => `${pos.x},${pos.y},${pos.z}`

/**
 * Helper function to convert a string key back to a Position
 */
const keyToPosition = (key: string): Position => {
  const [x, y, z] = key.split(',').map(Number)
  return { x, y, z }
}

/**
 * Schema for WorldState representing the state of a single world
 */
export const WorldStateSchema = Schema.Struct({
  id: WorldIdSchema,
  blocks: Schema.Record({ key: Schema.String, value: BlockTypeSchema }),
})
export type WorldState = Schema.Schema.Type<typeof WorldStateSchema>

/**
 * Service interface for World operations
 */
export interface WorldService {
  readonly create: (id: WorldId) => Effect.Effect<void, WorldError>
  readonly addBlock: (worldId: WorldId, position: Position, blockType: BlockType) => Effect.Effect<void, WorldError>
  readonly removeBlock: (worldId: WorldId, position: Position) => Effect.Effect<void, WorldError>
  readonly getBlock: (worldId: WorldId, position: Position) => Effect.Effect<Option<BlockType>, WorldError>
  readonly getBlocksInArea: (worldId: WorldId, min: Position, max: Position) => Effect.Effect<ReadonlyArray<[Position, BlockType]>, WorldError>
  readonly dispose: (worldId: WorldId) => Effect.Effect<void, WorldError>
}

/**
 * Context tag for WorldService
 */
export const WorldService = Context.GenericTag<WorldService>('@minecraft/WorldService')

/**
 * Live implementation of WorldService using Ref-based state management
 */
export const WorldServiceLive = Layer.effect(
  WorldService,
  Effect.gen(function* () {
    const worldsRef = yield* Ref.make<Map<WorldId, Map<string, BlockType>>>(new Map())

    return WorldService.of({
      create: (id) =>
        Effect.gen(function* () {
          yield* Ref.update(worldsRef, (worlds) => {
            if (worlds.has(id)) {
              return worlds
            }
            const newWorlds = new Map(worlds)
            newWorlds.set(id, new Map())
            return newWorlds
          })
        }),

      addBlock: (worldId, position, blockType) =>
        Effect.gen(function* () {
          const worlds = yield* Ref.get(worldsRef)
          const world = worlds.get(worldId)

          if (!world) {
            yield* Effect.fail(new WorldError(worldId, 'World not found', [position.x, position.y, position.z]))
            return
          }

          const key = positionToKey(position)
          yield* Ref.update(worldsRef, (w) => {
            const worldMap = w.get(worldId)
            if (!worldMap) return w
            const newWorldMap = new Map(worldMap)
            newWorldMap.set(key, blockType)
            const newWorlds = new Map(w)
            newWorlds.set(worldId, newWorldMap)
            return newWorlds
          })
        }),

      removeBlock: (worldId, position) =>
        Effect.gen(function* () {
          const worlds = yield* Ref.get(worldsRef)
          const world = worlds.get(worldId)

          if (!world) {
            yield* Effect.fail(new WorldError(worldId, 'World not found', [position.x, position.y, position.z]))
            return
          }

          const key = positionToKey(position)
          yield* Ref.update(worldsRef, (w) => {
            const worldMap = w.get(worldId)
            if (!worldMap) return w
            const newWorldMap = new Map(worldMap)
            newWorldMap.delete(key)
            const newWorlds = new Map(w)
            newWorlds.set(worldId, newWorldMap)
            return newWorlds
          })
        }),

      getBlock: (worldId, position) =>
        Effect.gen(function* () {
          const worlds = yield* Ref.get(worldsRef)
          const world = worlds.get(worldId)

          if (!world) {
            return yield* Effect.fail(new WorldError(worldId, 'World not found', [position.x, position.y, position.z]))
          }

          const key = positionToKey(position)
          const blockType = world.get(key)
          return blockType !== undefined ? Option.some(blockType) : Option.none()
        }),

      getBlocksInArea: (worldId, min, max) =>
        Effect.gen(function* () {
          const worlds = yield* Ref.get(worldsRef)
          const world = worlds.get(worldId)

          if (!world) {
            return yield* Effect.fail(new WorldError(worldId, 'World not found'))
          }

          const result: Array<[Position, BlockType]> = []

          for (let x = min.x; x <= max.x; x++) {
            for (let y = min.y; y <= max.y; y++) {
              for (let z = min.z; z <= max.z; z++) {
                const pos: Position = { x, y, z }
                const key = positionToKey(pos)
                const blockType = world.get(key)
                if (blockType !== undefined) {
                  result.push([pos, blockType])
                }
              }
            }
          }

          return result
        }),

      dispose: (worldId) =>
        Effect.gen(function* () {
          yield* Ref.update(worldsRef, (worlds) => {
            if (!worlds.has(worldId)) {
              return worlds
            }
            const newWorlds = new Map(worlds)
            newWorlds.delete(worldId)
            return newWorlds
          })
        }),
    })
  })
)

export { positionToKey, keyToPosition }
