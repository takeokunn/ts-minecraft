import { Effect, Option, pipe, HashMap, Ref } from 'effect'
import { EntityId } from '@/domain/entity'
import { playerQuery } from '@/domain/queries'
import { SystemCommand } from '@/domain/types'
import { CHUNK_SIZE, RENDER_DISTANCE } from '@/domain/world-constants'
import { OnCommand } from '@/runtime/services'
import { World as WorldState, removeEntity } from '@/runtime/world-pure'
import * as World from '@/runtime/world-pure'
import { WorldContext } from '@/runtime/context'

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
  const { world } = yield* $(WorldContext)
  const players = yield* $(World.query(playerQuery))

  const player = players[0]
  if (!player) {
    return
  }

  const { position } = player
  const playerChunkX = Math.floor(position.x / CHUNK_SIZE)
  const playerChunkZ = Math.floor(position.z / CHUNK_SIZE)

  const worldState = yield* $(Ref.get(world))
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

  yield* $(Effect.forEach(commands, (command) => onCommand(command), { discard: true }))
  yield* $(Effect.forEach(toUnload, (entityId) => removeEntity(entityId), { discard: true, concurrency: 'unbounded' }))

  yield* $(
    Ref.update(world, (w: WorldState) => ({
      ...w,
      globalState: {
        ...w.globalState,
        chunkLoading: {
          ...w.globalState.chunkLoading,
          lastPlayerChunk: Option.some({ x: playerChunkX, z: playerChunkZ }),
        },
      },
    })),
  )
})