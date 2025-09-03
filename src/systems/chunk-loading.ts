import { Effect, Option, HashMap, Ref } from 'effect'
import { EntityId } from '@/domain/entity'
import { playerQuery, chunkQuery } from '@/domain/queries'
import { CHUNK_SIZE, RENDER_DISTANCE } from '@/domain/world-constants'
import { ComputationWorker, World } from '@/runtime/services'
import { Chunk, Position } from '@/domain/components'

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

  const toUnload: EntityId[] = []
  const toLoad: ChunkCoord[] = []

  HashMap.forEach(loadedChunks, (entityId, key) => {
    if (!requiredChunks.has(key)) {
      toUnload.push(entityId)
    }
  })

  requiredChunks.forEach((key) => {
    if (!HashMap.has(loadedChunks, key)) {
      ChunkCoord.fromString(key).pipe(Option.map((coord) => toLoad.push(coord)))
    }
  })

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
    const { entities: playerEntities, components: playerComponents } = yield* $(world.querySoA(playerQuery))
    if (playerEntities.length === 0) {
      return
    }
    const position = playerComponents.position[0]
    const currentPlayerChunk = getPlayerChunk(position)
    const lastPlayerChunk = yield* $(Ref.get(lastPlayerChunkRef))

    if (Option.isSome(lastPlayerChunk) && ChunkCoord.equals(lastPlayerChunk.value, currentPlayerChunk)) {
      return
    }

    yield* $(Ref.set(lastPlayerChunkRef, Option.some(currentPlayerChunk)))

    const { entities: loadedChunkEntities, components: chunkComponents } = yield* $(world.querySoA(chunkQuery))
    const loadedChunks = HashMap.make(
      ...loadedChunkEntities.map((entityId, i) => {
        const chunk = chunkComponents.chunk[i]
        return [ChunkCoord.asString(chunk), entityId] as const
      }),
    )

    const { toLoad, toUnload } = calculateChunkUpdates(currentPlayerChunk, loadedChunks, RENDER_DISTANCE)

    const loadEffects = toLoad.map((coord) =>
      worker.postTask({
        type: 'generateChunk',
        chunkX: coord.x,
        chunkZ: coord.z,
      }),
    )

    const unloadEffects = toUnload.map((entityId) => world.removeEntity(entityId))

    yield* $(Effect.all([...loadEffects, ...unloadEffects], { discard: true, concurrency: 'unbounded' }))
  })
})

export const chunkLoadingSystem = Effect.runSync(makeChunkLoadingSystem)
