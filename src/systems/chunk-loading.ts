import { Effect, Option, pipe } from 'effect'
import * as HashMap from 'effect/HashMap'
import { EntityId } from '@/domain/entity'
import { playerQuery } from '@/domain/queries'
import { SystemCommand } from '@/domain/types'
import { CHUNK_SIZE, RENDER_DISTANCE } from '@/domain/world-constants'
import { OnCommand, System } from '@/runtime/loop'
import { World } from '@/runtime/world'

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
      toLoad.push({ x: parseInt(xStr!, 10), z: parseInt(zStr!, 10) })
    }
  }

  return { toLoad, toUnload }
}

export const chunkLoadingSystem: System = Effect.gen(function* () {
  const world = yield* World
  const onCommand = yield* OnCommand
  const players = yield* world.query(playerQuery)
  const player = players[0]

  if (!player) {
    return
  }

  const { position: playerPosition } = player
  const playerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE)
  const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE)

  const worldState = yield* world.state.get
  const { lastPlayerChunk, loadedChunks } = worldState.globalState.chunkLoading

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

  yield* Effect.forEach(commands, (command) => onCommand(command), { discard: true })
  yield* Effect.forEach(toUnload, (entityId) => world.removeEntity(entityId), { discard: true })

  yield* world.update((w) => ({
    ...w,
    globalState: {
      ...w.globalState,
      chunkLoading: {
        ...w.globalState.chunkLoading,
        lastPlayerChunk: Option.some({ x: playerChunkX, z: playerChunkZ }),
      },
    },
  }))
})