import { Effect, Match, Context, Layer } from 'effect'
import { UnifiedQuerySystemService } from '@application/queries/unified-query-system'
import { WorldDomainService } from '@domain/services/world.domain-service'
import { EntityDomainService } from '@domain/services/entity.domain-service'
import { Position } from '@domain/entities/components/world/index'
import { PerformanceMonitorPort } from '@domain/ports/performance-monitor.port'
import { 
  SystemExecutionError,
  WorldStateError,
  ValidationError
} from '@domain/errors'

/**
 * World Update Workflow Service interface
 */
export interface WorldUpdateWorkflowService {
  readonly processWorldUpdates: () => Effect.Effect<void, SystemExecutionError | WorldStateError>
  readonly handleChunkGeneration: (data: {
    blocks: Array<{ position: [number, number, number]; blockType: string }>
    mesh: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }
    chunkX: number
    chunkZ: number
  }) => Effect.Effect<void, SystemExecutionError | WorldStateError>
}

/**
 * World Update Workflow Service
 */
export const WorldUpdateWorkflow = Context.GenericTag<WorldUpdateWorkflowService>('WorldUpdateWorkflow')

export const WorldUpdateWorkflowLive = Layer.effect(
  WorldUpdateWorkflow,
  Effect.gen(function* () {
    const performanceMonitor = yield* PerformanceMonitorPort

    const processWorldUpdates = () =>
      Effect.gen(function* () {
        yield* performanceMonitor.startSystem('world-update-workflow')

        const worldService = yield* WorldDomainService
        const entityService = yield* EntityDomainService

        try {
          // Process pending world updates
          const pendingUpdates = yield* worldService.getPendingUpdates()

          yield* Effect.forEach(pendingUpdates, (update) => processWorldUpdate(update, worldService, entityService), { concurrency: 4, discard: true })

          yield* performanceMonitor.recordMetric('execution_time', 'world-update-workflow', pendingUpdates.length, 'updates')
          yield* Effect.log(`Processed ${pendingUpdates.length} world updates`)
        } finally {
          yield* performanceMonitor.endSystem('world-update-workflow')
        }
      })

    const handleChunkGeneration = (data: {
      blocks: Array<{ position: [number, number, number]; blockType: string }>
      mesh: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }
      chunkX: number
      chunkZ: number
    }) =>
      Effect.gen(function* () {
        yield* performanceMonitor.startSystem('chunk-generation-workflow')

        const worldService = yield* WorldDomainService
        const entityService = yield* EntityDomainService
        const { blocks, mesh, chunkX, chunkZ } = data

        try {
          // Create entities for each block in the chunk
          yield* Effect.forEach(
            blocks,
            (block) =>
              Effect.gen(function* () {
                const querySystem = yield* UnifiedQuerySystemService

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
                  },
                }

                // Add entity to unified query system for indexing
                yield* querySystem.addEntity(blockEntity)

                // Add entity to domain service
                yield* entityService.addEntity(blockEntity)
              }),
            { concurrency: 8, discard: true },
          )

          // Store chunk mesh data
          if (mesh.indices.length > 0) {
            yield* worldService.storeChunkMesh({
              chunkX,
              chunkZ,
              positions: mesh.positions,
              normals: mesh.normals,
              uvs: mesh.uvs,
              indices: mesh.indices,
            })
          }

          yield* performanceMonitor.recordMetric('execution_time', 'chunk-generation-workflow', blocks.length, 'blocks')
          yield* Effect.log(`Chunk generation completed for chunk ${chunkX}, ${chunkZ} with ${blocks.length} blocks`)
        } finally {
          yield* performanceMonitor.endSystem('chunk-generation-workflow')
        }
      })

    return {
      processWorldUpdates,
      handleChunkGeneration,
    } satisfies WorldUpdateWorkflowService
  }),
)

const processWorldUpdate = (update: { type: string; [key: string]: unknown }, worldService: WorldDomainService, entityService: EntityDomainService) =>
  Effect.gen(function* () {
    // Process different types of world updates
    switch (update.type) {
      case 'BLOCK_PLACED':
        yield* worldService.updateBlock(update.position, update.blockType)
        break
      case 'BLOCK_DESTROYED':
        yield* worldService.removeBlock(update.position)
        break
      case 'CHUNK_MODIFIED':
        yield* worldService.markChunkForUpdate(update.chunkCoordinate)
        break
      default:
        yield* Effect.log(`Unknown update type: ${update.type}`)
    }
  })
