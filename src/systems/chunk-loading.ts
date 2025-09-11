import { Effect, Option, HashMap, Ref, ReadonlyArray } from 'effect'
import { EntityId } from '@/core/entities/entity'
import { queries } from '@/core/queries'
import { CHUNK_SIZE, RENDER_DISTANCE } from '@/domain/world-constants'
import { ComputationWorker, World } from '@/runtime/services'
import { Position } from '@/core/components'

type ChunkCoord = { readonly x: number; readonly z: number }

const ChunkCoord = {
  asString: (coord: ChunkCoord): string => `${coord.x},${coord.z}`,
  fromString: (key: string): Option.Option<ChunkCoord> => {
    const parts = key.split(',')
    if (parts.length !== 2) {
      return Option.none()
    }
    const xStr = parts[0]
    const zStr = parts[1]
    if (xStr === undefined || zStr === undefined) {
      return Option.none()
    }
    const x = parseInt(xStr, 10)
    const z = parseInt(zStr, 10)
    if (isNaN(x) || isNaN(z)) {
      return Option.none()
    }
    return Option.some({ x, z })
  },
  equals: (a: ChunkCoord, b: ChunkCoord): boolean => a.x === b.x && a.z === b.z,
}

export const calculateChunkUpdates = (
  currentPlayerChunk: ChunkCoord,
  loadedChunks: HashMap.HashMap<string, EntityId>,
  renderDistance: number,
): {
  toLoad: ReadonlyArray<ChunkCoord>
  toUnload: ReadonlyArray<EntityId>
} => {
  const requiredChunks = new Set<string>()
  for (let x = currentPlayerChunk.x - renderDistance; x <= currentPlayerChunk.x + renderDistance; x++) {
    for (let z = currentPlayerChunk.z - renderDistance; z <= currentPlayerChunk.z + renderDistance; z++) {
      requiredChunks.add(ChunkCoord.asString({ x, z }))
    }
  }

  const loadedChunkKeys = new Set(HashMap.keys(loadedChunks))

  const toUnload: EntityId[] = []
  for (const [key, entityId] of HashMap.entries(loadedChunks)) {
    if (!requiredChunks.has(key)) {
      toUnload.push(entityId)
    }
  }

  const toLoad: ChunkCoord[] = []
  for (const key of requiredChunks) {
    if (!loadedChunkKeys.has(key)) {
      const coord = ChunkCoord.fromString(key)
      if (Option.isSome(coord)) {
        toLoad.push(coord.value)
      }
    }
  }

  return { toLoad, toUnload }
}

const getPlayerChunk = (position: Position): ChunkCoord => ({
  x: Math.floor(position.x / CHUNK_SIZE),
  z: Math.floor(position.z / CHUNK_SIZE),
})

export const chunkLoadingSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const worker = yield* $(ComputationWorker)
  const { components: playerComponents } = yield* $(world.querySoA(queries.player))
  const playerPosition = Option.fromNullable(playerComponents.position[0])

  yield* $(
    Option.match(playerPosition, {
      onNone: () => Effect.void, // No player, do nothing
      onSome: (position) =>
        Effect.gen(function* ($) {
          const currentPlayerChunk = getPlayerChunk(position)

          const { entities: loadedChunkEntities, components: chunkComponents } = yield* $(
            world.querySoA(queries.chunk),
          )
          const loadedChunks = HashMap.make(
            ...ReadonlyArray.map(loadedChunkEntities, (entityId, i) => {
              const chunk = chunkComponents.chunk[i]
              return [ChunkCoord.asString(chunk), entityId] as const
            }),
          )

          const { toLoad, toUnload } = calculateChunkUpdates(
            currentPlayerChunk,
            loadedChunks,
            RENDER_DISTANCE,
          )

          const loadEffects = ReadonlyArray.map(toLoad, (coord) =>
            worker.postTask({
              type: 'generateChunk',
              chunkX: coord.x,
              chunkZ: coord.z,
            }),
          )

          const unloadEffects = ReadonlyArray.map(toUnload, (entityId) => world.removeEntity(entityId))

          yield* $(
            Effect.all(ReadonlyArray.appendAll(loadEffects, unloadEffects), {
              discard: true,
              concurrency: 'unbounded',
            }),
          )
        }),
    }),
  )
})
