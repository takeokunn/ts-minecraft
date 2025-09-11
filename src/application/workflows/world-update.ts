import { Effect, Match, Context, Layer } from 'effect'
import { UnifiedQuerySystemService } from '@application/queries/unified-query-system'
import { WorldDomainService } from '@domain/services/world-domain.service'
import { EntityDomainService } from '@domain/services/entity-domain.service'
import { Position } from '@domain/entities/components/world/index'
import { PerformanceMonitorPort } from '@domain/ports/performance-monitor.port'

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

export const WorldUpdateWorkflowLive = Layer.effect(
  WorldUpdateWorkflow,
  Effect.gen(function* (_) {
    const performanceMonitor = yield* _(PerformanceMonitorPort)

    return {
      processWorldUpdates: () =>
        Effect.gen(function* (_) {
          yield* _(performanceMonitor.startSystem('world-update-workflow'))

          const worldService = yield* _(WorldDomainService)
          const entityService = yield* _(EntityDomainService)

          try {
            // Process pending world updates
            const pendingUpdates = yield* _(worldService.getPendingUpdates())

            yield* _(Effect.forEach(pendingUpdates, (update) => processWorldUpdate(update, worldService, entityService), { concurrency: 4, discard: true }))

            yield* _(performanceMonitor.recordMetric('execution_time', 'world-update-workflow', pendingUpdates.length, 'updates'))
            yield* _(Effect.log(`Processed ${pendingUpdates.length} world updates`))
          } finally {
            yield* _(performanceMonitor.endSystem('world-update-workflow'))
          }
        }),

      handleChunkGeneration: (data) =>
        Effect.gen(function* (_) {
          yield* _(performanceMonitor.startSystem('chunk-generation-workflow'))

          const worldService = yield* _(WorldDomainService)
          const entityService = yield* _(EntityDomainService)
          const { blocks, mesh, chunkX, chunkZ } = data

          try {
            // Create entities for each block in the chunk
            yield* _(
              Effect.forEach(
                blocks,
                (block) =>
                  Effect.gen(function* (_) {
                    const querySystem = yield* _(UnifiedQuerySystemService)
                    
                    // Create block entity with components
                    const blockEntity = {
                      id: `block_${chunkX}_${chunkZ}_${block.position[0]}_${block.position[1]}_${block.position[2]}`,
                      components: {
                        Position: new Position({
                          x: block.position[0],
                          y: block.position[1],
                          z: block.position[2],
                        }),
                        BlockType: block.blockType,
                        ChunkCoordinate: { x: chunkX, z: chunkZ },
                      }
                    }

                    // Add entity to unified query system for indexing
                    yield* _(querySystem.addEntity(blockEntity))
                    
                    // Add entity to domain service
                    yield* _(entityService.addEntity(blockEntity))
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

            yield* _(performanceMonitor.recordMetric('execution_time', 'chunk-generation-workflow', blocks.length, 'blocks'))
            yield* _(Effect.log(`Chunk generation completed for chunk ${chunkX}, ${chunkZ} with ${blocks.length} blocks`))
          } finally {
            yield* _(performanceMonitor.endSystem('chunk-generation-workflow'))
          }
        }),
    }
  }),
)

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
