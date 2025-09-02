import { Effect, HashMap, Ref } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { ChunkDataQueueService, RenderQueueService } from '@/runtime/services'
import { World, WorldState } from '@/runtime/world'

export const worldUpdateSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
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
  const chunkEntityId = yield* _(world.addArchetype(chunkArchetype))

  yield* _(
    Effect.forEach(
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
    world.state.pipe(
      Ref.update((w: WorldState) => ({
        ...w,
        globalState: {
          ...w.globalState,
          chunkLoading: {
            ...w.globalState.chunkLoading,
            loadedChunks: HashMap.set(w.globalState.chunkLoading.loadedChunks, `${chunkX},${chunkZ}`, chunkEntityId),
          },
        },
      })),
    ),
  )
})
