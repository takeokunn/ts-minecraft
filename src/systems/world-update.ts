import { Effect } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { ComputationWorker, Renderer, World } from '@/runtime/services'
import { Float } from '@/domain/common'
import { Position } from '@/domain/components'

export const worldUpdateSystem = Effect.gen(function* ($) {
  const world = yield* $(World)
  const renderer = yield* $(Renderer)
  const worker = yield* $(ComputationWorker)

  yield* $(
    worker.onMessage((message) =>
      Effect.gen(function* ($) {
        if (message.type === 'chunkGenerated') {
          const { blocks, mesh, chunkX, chunkZ } = message

          // Create entities for each block in the chunk
          const blockArchetypes = yield* $(
            Effect.all(
              blocks.map((block: any) =>
                createArchetype({
                  type: 'block',
                  pos: new Position({
                    x: block.position[0] as Float,
                    y: block.position[1] as Float,
                    z: block.position[2] as Float,
                  }),
                  blockType: block.blockType,
                }),
              ),
            ),
          )
          yield* $(Effect.forEach(blockArchetypes, (archetype) => world.addArchetype(archetype), { discard: true }))

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
        }
      }),
    ),
  )
})
