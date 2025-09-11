import { Effect, Match } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { WorldService as World } from '@/application/services/world.service'
import { ComputationWorker } from '@/infrastructure/services/computation-worker.service'
import { Renderer } from '@/infrastructure/services/renderer.service'
import { Position } from '@/domain/entities/components'

export const worldUpdateSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const renderer = yield* $(Renderer)
  const worker = yield* $(ComputationWorker)

  yield* $(
    worker.onMessage((message) =>
      Match.value(message).pipe(
        Match.when({ type: 'chunkGenerated' }, (message) =>
          Effect.gen(function* ($) {
            const { blocks, mesh, chunkX, chunkZ } = message

            // Create entities for each block in the chunk
            const blockArchetypes = yield* $(
              Effect.all(
                blocks.map((block) =>
                  createArchetype({
                    type: 'block',
                    pos: new Position({
                      x: block.position[0],
                      y: block.position[1],
                      z: block.position[2],
                    }),
                    blockType: block.blockType,
                  }),
                ),
              ),
            )
            yield* $(
              Effect.forEach(blockArchetypes, (archetype) => world.addArchetype(archetype), { discard: true }),
            )

            // Add the chunk mesh to the renderer
            if (mesh.indices.length > 0) {
              yield* $(
                renderer.renderQueue.offer({
                  type: 'ADD_CHUNK',
                  chunkX,
                  chunkZ,
                  positions: mesh.positions,
                  normals: mesh.normals,
                  uvs: mesh.uvs,
                  indices: mesh.indices,
                }),
              )
            }
          }),
        ),
        Match.orElse(() => Effect.void),
      ),
    ),
  )
})
