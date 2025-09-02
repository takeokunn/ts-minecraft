import { Effect, Option, pipe, HashMap, Array as A } from 'effect'
import { EntityId } from '@/domain/entity'
import { playerQuery } from '@/domain/queries'
import { SystemCommand } from '@/domain/types'
import { CHUNK_SIZE, RENDER_DISTANCE } from '@/domain/world-constants'
import { OnCommand } from '@/runtime/services'
import * as World from '@/runtime/world-pure'

type ChunkCoord = { readonly x: number; readonly z: number }

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
      requiredChunks.add(`${x},${z}`)
    }
  }

  const toUnload: EntityId[] = []
  const toLoad: ChunkCoord[] = []

  for (const [key, entityId] of loadedChunks) {
    if (!requiredChunks.has(key)) {
      toUnload.push(entityId)
    }
  }

  for (const key of requiredChunks) {
    if (!HashMap.has(loadedChunks, key)) {
      const [xStr, zStr] = key.split(',')
      if (xStr && zStr) {
        toLoad.push({ x: parseInt(xStr, 10), z: parseInt(zStr, 10) })
      }
    }
  }

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
