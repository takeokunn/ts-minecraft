import { Effect, HashMap, Ref } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { ChunkDataQueueService, RenderQueueService } from '@/runtime/services'
import * as World from '@/runtime/world-pure'
import { WorldContext } from '@/runtime/context'

export const worldUpdateSystem = Effect.gen(function* (_) {
  const { world } = yield* _(WorldContext)
  const chunkDataQueue = yield* _(ChunkDataQueueService)
  const renderQueue = yield* _(RenderQueueService)

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
  const chunkEntityId = yield* _(World.addArchetype(chunkArchetype))

  yield* _(
    Effect.forEach(
      blocks,
      (block) => {
        const blockArchetype = createArchetype({
          type: 'block',
          pos: block.position,
          blockType: block.blockType,
        })
        return World.addArchetype(blockArchetype)
      },
      { discard: true },
    ),
  )

  if (mesh.indices.length > 0) {
    renderQueue.push({
      type: 'UpsertChunk',
      chunkX,
      chunkZ,
      mesh: mesh,
    })
  }

  yield* _(
    Ref.update(world, (w) => ({
      ...w,
      globalState: {
        ...w.globalState,
        chunkLoading: {
          ...w.globalState.chunkLoading,
          loadedChunks: HashMap.set(w.globalState.chunkLoading.loadedChunks, `${chunkX},${chunkZ}`, chunkEntityId),
        },
      },
    })),
  )
})
