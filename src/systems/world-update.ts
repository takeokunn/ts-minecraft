import { Effect, Option } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { ChunkDataQueue, RenderQueue } from '@/runtime/services'
import * as World from '@/domain/world'

export const worldUpdateSystem = Effect.gen(function* (_) {
  const chunkDataQueue = yield* _(ChunkDataQueue)
  const renderQueue = yield* _(RenderQueue)

  const chunkResultOption = Option.fromNullable(chunkDataQueue.shift())

  return yield* _(
    Option.match(chunkResultOption, {
      onNone: () => Effect.void,
      onSome: ({ blocks, mesh, chunkX, chunkZ }) =>
        Effect.gen(function* (_) {
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
        }),
    }),
  )
}).pipe(Effect.catchAllCause((cause) => Effect.logError('An error occurred in worldUpdateSystem', cause)))
