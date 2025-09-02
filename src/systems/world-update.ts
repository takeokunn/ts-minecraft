import { Effect } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { ChunkDataQueueService, RenderQueueService } from '@/runtime/services'
import * as World from '@/runtime/world-pure'

export const worldUpdateSystem = Effect.gen(function* (_) {
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

  yield* _(World.recordLoadedChunk(chunkX, chunkZ, chunkEntityId))
}).pipe(Effect.catchAllCause((cause) => Effect.logError('An error occurred in worldUpdateSystem', cause)))