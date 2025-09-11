import { Effect, Layer, Context } from 'effect'
import { WorldDomainService } from '@domain/services/world-domain.service'
import { TerrainGeneratorPort } from '@domain/services/terrain-generation-domain.service'
import { MeshGeneratorPort, MeshGeneratorHelpers } from '@domain/services/mesh-generation-domain.service'
import { WorldManagementDomainServicePort } from '@domain/services/world-management-domain.service'

export interface ChunkLoadCommand {
  readonly chunkX: number
  readonly chunkZ: number
  readonly priority: 'high' | 'medium' | 'low'
  readonly requesterId?: string
}

export class ChunkLoadUseCase extends Context.Tag('ChunkLoadUseCase')<
  ChunkLoadUseCase,
  {
    readonly execute: (command: ChunkLoadCommand) => Effect.Effect<void, Error>
    readonly preloadChunksAroundPosition: (position: { x: number; z: number }, radius: number) => Effect.Effect<void, Error>
  }
>() {}

export const ChunkLoadUseCaseLive = Layer.succeed(ChunkLoadUseCase, {
  execute: (command) =>
    Effect.gen(function* () {
      const worldService = yield* WorldDomainService
      const worldManagement = yield* WorldManagementDomainServicePort
      const terrainGenerator = yield* TerrainGeneratorPort
      const meshGenerator = yield* MeshGeneratorPort

      // Use the new WorldManagementDomainService for chunk loading
      const coordinates = { x: command.chunkX, z: command.chunkZ }
      const priority = command.priority === 'high' ? 3 : command.priority === 'medium' ? 2 : 1

      // Check if chunk is already loaded using world management service
      const metadata = yield* worldManagement.getChunkMetadata(coordinates)
      
      if (metadata && metadata.status === 'loaded') {
        yield* Effect.log(`Chunk ${command.chunkX}, ${command.chunkZ} already loaded`)
        return
      }

      if (metadata && (metadata.status === 'loading' || metadata.status === 'generating' || metadata.status === 'meshing')) {
        yield* Effect.log(`Chunk ${command.chunkX}, ${command.chunkZ} already in progress`)
        return
      }

      // Load chunk using world management domain service
      const result = yield* worldManagement.loadChunk(coordinates, priority)
      
      if (result.success) {
        yield* Effect.log(`Chunk ${command.chunkX}, ${command.chunkZ} loaded successfully in ${result.loadTime}ms`)
      } else {
        yield* Effect.log(`Failed to load chunk ${command.chunkX}, ${command.chunkZ}: ${result.error}`)
      }
    }),

  preloadChunksAroundPosition: (position, radius) =>
    Effect.gen(function* () {
      const worldService = yield* WorldDomainService

      // Calculate chunk coordinates
      const centerChunkX = Math.floor(position.x / 16)
      const centerChunkZ = Math.floor(position.z / 16)

      // Generate list of chunks to preload
      const chunksToLoad: ChunkLoadCommand[] = []

      for (let x = centerChunkX - radius; x <= centerChunkX + radius; x++) {
        for (let z = centerChunkZ - radius; z <= centerChunkZ + radius; z++) {
          const distance = Math.sqrt(Math.pow(x - centerChunkX, 2) + Math.pow(z - centerChunkZ, 2))

          if (distance <= radius) {
            // Determine priority based on distance
            const priority = distance <= 1 ? 'high' : distance <= 2 ? 'medium' : 'low'

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
      yield* Effect.forEach(
        chunksToLoad,
        (command) => ChunkLoadUseCase.execute(command),
        { concurrency: 4 }, // Limit concurrent chunk loads
      )
    }),
})

// This function is now handled by WorldManagementDomainService.loadChunk()
// The complex chunk loading orchestration has been moved to the domain layer

// Layer dependencies will be provided by the main Application layer
