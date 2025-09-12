import { Effect, Layer, Context, Option, Either, pipe } from 'effect'
import { Schema } from '@effect/schema'
import { CHUNK_SIZE } from '@shared/constants/world'
import { WorldDomainService } from '@domain/services/world.domain-service'
import { TerrainGeneratorPort } from '@domain/services/terrain-generation.domain-service'
import { MeshGeneratorPort, MeshGeneratorHelpers } from '@domain/services/mesh-generation.domain-service'
import { WorldManagementDomainServicePort } from '@domain/services/world-management.domain-service'
import { 
  ValidationError,
  ChunkNotLoadedError,
  ChunkGenerationError,
  TerrainGenerationError,
  MeshGenerationError,
  WorldStateError
} from '@domain/errors'

// Schema-based validation for ChunkLoadCommand
const ChunkLoadCommandSchema = Schema.Struct({
  chunkX: Schema.Number.pipe(Schema.int()),
  chunkZ: Schema.Number.pipe(Schema.int()),
  priority: Schema.Literal('high', 'medium', 'low'),
  requesterId: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
})

export interface ChunkLoadCommand extends Schema.Schema.Type<typeof ChunkLoadCommandSchema> {}

// Validation helper
const validateChunkLoadCommand = (input: unknown): Effect.Effect<ChunkLoadCommand, ValidationError, never> =>
  pipe(
    Schema.decodeUnknown(ChunkLoadCommandSchema)(input),
    Effect.mapError((error) => new ValidationError({ 
      field: 'ChunkLoadCommand',
      message: `Invalid ChunkLoadCommand: ${error}` 
    })),
  )

/**
 * Chunk Load Use Case Service interface
 */
export interface ChunkLoadUseCaseService {
  readonly execute: (command: ChunkLoadCommand) => Effect.Effect<void, ValidationError | ChunkNotLoadedError | ChunkGenerationError | TerrainGenerationError | MeshGenerationError | WorldStateError>
  readonly preloadChunksAroundPosition: (position: { x: number; z: number }, radius: number) => Effect.Effect<void, ValidationError | ChunkNotLoadedError | ChunkGenerationError | TerrainGenerationError | MeshGenerationError | WorldStateError>
}

/**
 * Chunk Load Use Case Service
 */
export const ChunkLoadUseCase = Context.GenericTag<ChunkLoadUseCaseService>('ChunkLoadUseCase')

export const ChunkLoadUseCaseLive = Layer.effect(
  ChunkLoadUseCase,
  Effect.gen(function* () {
    const executeChunk = (command: ChunkLoadCommand) =>
      pipe(
        Effect.all({
          worldService: WorldDomainService,
          worldManagement: WorldManagementDomainServicePort,
          terrainGenerator: TerrainGeneratorPort,
          meshGenerator: MeshGeneratorPort,
        }),
        Effect.flatMap(({ worldManagement }) => {
          const coordinates = { x: command.chunkX, z: command.chunkZ }
          const priority = command.priority === 'high' ? 3 : command.priority === 'medium' ? 2 : 1

          return pipe(
            worldManagement.getChunkMetadata(coordinates),
            Effect.flatMap((metadata) =>
              pipe(
                Option.fromNullable(metadata),
                Option.match({
                  onNone: () => worldManagement.loadChunk(coordinates, priority),
                  onSome: (meta) => {
                    if (meta.status === 'loaded') {
                      return pipe(
                        Effect.log(`Chunk ${command.chunkX}, ${command.chunkZ} already loaded`),
                        Effect.map(() => ({ success: true, loadTime: 0 })),
                      )
                    }

                    if (meta.status === 'loading' || meta.status === 'generating' || meta.status === 'meshing') {
                      return pipe(
                        Effect.log(`Chunk ${command.chunkX}, ${command.chunkZ} already in progress`),
                        Effect.map(() => ({ success: true, loadTime: 0 })),
                      )
                    }

                    return worldManagement.loadChunk(coordinates, priority)
                  },
                }),
              ),
            ),
            Effect.flatMap((result) =>
              result.success
                ? Effect.log(`Chunk ${command.chunkX}, ${command.chunkZ} loaded successfully in ${result.loadTime}ms`)
                : Effect.log(`Failed to load chunk ${command.chunkX}, ${command.chunkZ}: ${result.error}`),
            ),
          )
        }),
      )

    const preloadChunksAroundPosition = (position: { x: number; z: number }, radius: number) =>
      pipe(
        WorldDomainService,
        Effect.flatMap(() => {
          // Calculate chunk coordinates
          const centerChunkX = Math.floor(position.x / CHUNK_SIZE)
          const centerChunkZ = Math.floor(position.z / CHUNK_SIZE)

          // Generate list of chunks to preload using functional approach
          const chunksToLoad: ChunkLoadCommand[] = []

          for (let x = centerChunkX - radius; x <= centerChunkX + radius; x++) {
            for (let z = centerChunkZ - radius; z <= centerChunkZ + radius; z++) {
              const distance = Math.sqrt(Math.pow(x - centerChunkX, 2) + Math.pow(z - centerChunkZ, 2))

              if (distance <= radius) {
                // Determine priority based on distance using pipe
                const priority = pipe(distance, (d) => (d <= 1 ? 'high' : d <= 2 ? 'medium' : ('low' as const)))

                chunksToLoad.push({
                  chunkX: x,
                  chunkZ: z,
                  priority,
                  requesterId: 'preloader',
                })
              }
            }
          }

          // Execute chunk loading commands in parallel with concurrency control
          return Effect.forEach(
            chunksToLoad,
            executeChunk,
            { concurrency: 4 }, // Limit concurrent chunk loads
          )
        }),
      )

    return {
      execute: executeChunk,
      preloadChunksAroundPosition,
    } satisfies ChunkLoadUseCaseService
  }),
)

// This function is now handled by WorldManagementDomainService.loadChunk()
// The complex chunk loading orchestration has been moved to the domain layer

// Layer dependencies will be provided by the main Application layer
