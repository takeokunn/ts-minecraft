import { Effect } from 'effect'
import * as HashMap from 'effect/HashMap'
import { createArchetype } from '@/domain/archetypes'
import { ChunkDataQueueService, RenderQueueService, System } from '@/runtime/loop'
import { World } from '@/runtime/world'

export const worldUpdateSystem: System = Effect.gen(function* () {
  const world = yield* World
  const chunkDataQueue = yield* ChunkDataQueueService
  const renderQueue = yield* RenderQueueService

  const chunkResult = chunkDataQueue.shift()
  if (!chunkResult) {
    return
  }

  const { blocks, mesh, chunkX, chunkZ } = chunkResult

  const chunkArchetype = createArchetype({
    type: 'chunk',
    chunkX,
    chunkZ,
  })
  const chunkEntityId = yield* world.addArchetype(chunkArchetype)

  yield* Effect.forEach(
    blocks,
    (block) => {
      const blockArchetype = createArchetype({
        type: 'block',
        pos: block.position,
        blockType: block.blockType,
      })
      return world.addArchetype(blockArchetype)
    },
    { discard: true },
  )

  if (mesh.indices.length > 0) {
    renderQueue.push({
      type: 'UpsertChunk',
      chunkX,
      chunkZ,
      mesh: mesh,
    })
  }

  yield* world.update((w) => ({
    ...w,
    globalState: {
      ...w.globalState,
      chunkLoading: {
        ...w.globalState.chunkLoading,
        loadedChunks: HashMap.set(w.globalState.chunkLoading.loadedChunks, `${chunkX},${chunkZ}`, chunkEntityId),
      },
    },
  }))
})