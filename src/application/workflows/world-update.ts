import { Effect, Match, Context, Layer } from 'effect'
import { createArchetype } from '/archetypes'
import { WorldDomainService } from '/services/world-domain.service'
import { EntityDomainService } from '/services/entity-domain.service'
import { Position } from '/entities/components'

// World Update Workflow Service
export class WorldUpdateWorkflow extends Context.Tag('WorldUpdateWorkflow')<
  WorldUpdateWorkflow,
  {
    readonly processWorldUpdates: () => Effect.Effect<void, Error>
    readonly handleChunkGeneration: (data: {
      blocks: Array<{ position: [number, number, number]; blockType: string }>
      mesh: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }
      chunkX: number
      chunkZ: number
    }) => Effect.Effect<void, Error>
  }
>() {}

export const WorldUpdateWorkflowLive = Layer.succeed(WorldUpdateWorkflow, {
  processWorldUpdates: () =>
    Effect.gen(function* (_) {
      const worldService = yield* _(WorldDomainService)
      const entityService = yield* _(EntityDomainService)

      // Process pending world updates
      const pendingUpdates = yield* _(worldService.getPendingUpdates())

      yield* _(Effect.forEach(pendingUpdates, (update) => processWorldUpdate(update, worldService, entityService), { concurrency: 4, discard: true }))

      yield* _(Effect.log(`Processed ${pendingUpdates.length} world updates`))
    }),

  handleChunkGeneration: (data) =>
    Effect.gen(function* (_) {
      const worldService = yield* _(WorldDomainService)
      const entityService = yield* _(EntityDomainService)
      const { blocks, mesh, chunkX, chunkZ } = data

      // Create entities for each block in the chunk
      yield* _(
        Effect.forEach(
          blocks,
          (block) =>
            Effect.gen(function* (_) {
              const archetype = yield* _(
                createArchetype({
                  type: 'block' as const,
                  pos: new Position({
                    x: block.position[0],
                    y: block.position[1],
                    z: block.position[2],
                  }),
                  blockType: block.blockType,
                }),
              )

              yield* _(entityService.addEntity(archetype))
            }),
          { concurrency: 8, discard: true },
        ),
      )

      // Store chunk mesh data
      if (mesh.indices.length > 0) {
        yield* _(
          worldService.storeChunkMesh({
            chunkX,
            chunkZ,
            positions: mesh.positions,
            normals: mesh.normals,
            uvs: mesh.uvs,
            indices: mesh.indices,
          }),
        )
      }

      yield* _(Effect.log(`Chunk generation completed for chunk ${chunkX}, ${chunkZ} with ${blocks.length} blocks`))
    }),
})

const processWorldUpdate = (update: any, worldService: WorldDomainService, entityService: EntityDomainService) =>
  Effect.gen(function* (_) {
    // Process different types of world updates
    switch (update.type) {
      case 'BLOCK_PLACED':
        yield* _(worldService.updateBlock(update.position, update.blockType))
        break
      case 'BLOCK_DESTROYED':
        yield* _(worldService.removeBlock(update.position))
        break
      case 'CHUNK_MODIFIED':
        yield* _(worldService.markChunkForUpdate(update.chunkCoordinate))
        break
      default:
        yield* _(Effect.log(`Unknown update type: ${update.type}`))
    }
  })
