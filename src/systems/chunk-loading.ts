import { Effect, Option, pipe, HashMap, Array as A } from 'effect'
import { EntityId } from '@/domain/entity'
import { playerQuery } from '@/domain/queries'
import { SystemCommand } from '@/domain/types'
import { CHUNK_SIZE, RENDER_DISTANCE } from '@/domain/world-constants'
import { OnCommand } from '@/runtime/services'
import * as World from '@/domain/world'

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
      pipe(
        ChunkCoord.fromString(key),
        Option.map((coord) => toLoad.push(coord)),
      )
    }
  })

  return { toLoad, toUnload }
}

export const chunkLoadingSystem = Effect.gen(function* ($) {
  const onCommand = yield* $(OnCommand)
  const players = yield* $(World.query(playerQuery))

  const playerOption = A.get(players, 0)
  if (Option.isNone(playerOption)) {
    return
  }
  const player = playerOption.value

  const { position } = player
  const playerChunkX = Math.floor(position.x / CHUNK_SIZE)
  const playerChunkZ = Math.floor(position.z / CHUNK_SIZE)

  const { lastPlayerChunk, loadedChunks } = yield* $(World.getChunkLoadingState())

  const isSameChunk = pipe(
    lastPlayerChunk,
    Option.map((last) => last.x === playerChunkX && last.z === playerChunkZ),
    Option.getOrElse(() => false),
  )

  if (isSameChunk) {
    return
  }

  const { toLoad, toUnload } = calculateChunkUpdates({ x: playerChunkX, z: playerChunkZ }, loadedChunks, RENDER_DISTANCE)

  const commands: SystemCommand[] = toLoad.map(({ x, z }) => ({
    type: 'GenerateChunk',
    chunkX: x,
    chunkZ: z,
  }))

  yield* $(
    Effect.all(
      [
        Effect.forEach(commands, (command) => Effect.forkDaemon(onCommand(command)), { discard: true }),
        Effect.forEach(toUnload, (entityId) => World.removeEntity(entityId), { discard: true, concurrency: 'unbounded' }),
        World.updateLastPlayerChunk({ x: playerChunkX, z: playerChunkZ }),
      ],
      { discard: true },
    ),
    Effect.catchAllCause((cause) => Effect.logError('An error occurred in chunkLoadingSystem', cause)),
  )
})
