import { Effect, Option, HashMap, Ref } from 'effect'
import * as ReadonlyArray from 'effect/ReadonlyArray'
import { EntityId } from '@/domain/entity'
import { playerQuery, chunkQuery } from '@/domain/queries'
import { CHUNK_SIZE, RENDER_DISTANCE } from '@/domain/world-constants'
import { ComputationWorker, World } from '@/runtime/services'
import { Position } from '@/domain/components'

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

  const toUnload = ReadonlyArray.fromIterable(HashMap.entries(loadedChunks)).pipe(
    ReadonlyArray.filterMap(([key, entityId]) =>
      !requiredChunks.has(key) ? Option.some(entityId) : Option.none(),
    ),
  )

  const toLoad = ReadonlyArray.fromIterable(requiredChunks).pipe(
    ReadonlyArray.filterMap((key) =>
      !loadedChunkKeys.has(key) ? ChunkCoord.fromString(key) : Option.none(),
    ),
  )

  return { toLoad, toUnload }
}

const getPlayerChunk = (position: Position): ChunkCoord => ({
  x: Math.floor(position.x / CHUNK_SIZE),
  z: Math.floor(position.z / CHUNK_SIZE),
})

const makeChunkLoadingSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const worker = yield* $(ComputationWorker)
  const lastPlayerChunkRef = yield* $(Ref.make(Option.none<ChunkCoord>()))

  return Effect.gen(function* ($) {
    const { components: playerComponents } = yield* $(world.querySoA(playerQuery))
    const playerPosition = Option.fromNullable(playerComponents.position[0])

    yield* $(
      Option.match(playerPosition, {
        onNone: () => Effect.void, // No player, do nothing
        onSome: (position) =>
          Effect.gen(function* ($) {
            const currentPlayerChunk = getPlayerChunk(position)
            const lastPlayerChunk = yield* $(Ref.get(lastPlayerChunkRef))

            const shouldUpdate = Option.match(lastPlayerChunk, {
              onNone: () => true,
              onSome: (last) => !ChunkCoord.equals(last, currentPlayerChunk),
            })

            yield* $(
              Effect.when(
                () => shouldUpdate,
                () => Effect.gen(function* ($) {
                  yield* $(Ref.set(lastPlayerChunkRef, Option.some(currentPlayerChunk)))

                  const { entities: loadedChunkEntities, components: chunkComponents } = yield* $(
                    world.querySoA(chunkQuery),
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
              ),
            )
          }),
      }),
    )
  })
})

export const chunkLoadingSystem = Effect.runSync(makeChunkLoadingSystem)
