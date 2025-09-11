import { Effect, Layer, Context } from 'effect'
import { WorldDomainService } from '../../domain/services/world-domain.service'

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
    Effect.gen(function* (_) {
      const worldService = yield* _(WorldDomainService)

      // Check if chunk is already loaded
      const isLoaded = yield* _(worldService.isChunkLoaded(command.chunkX, command.chunkZ))

      if (isLoaded) {
        yield* _(Effect.log(`Chunk ${command.chunkX}, ${command.chunkZ} already loaded`))
        return
      }

      // Check if chunk is in loading queue
      const isInQueue = yield* _(worldService.isChunkInLoadingQueue(command.chunkX, command.chunkZ))

      if (isInQueue) {
        yield* _(Effect.log(`Chunk ${command.chunkX}, ${command.chunkZ} already in queue`))
        return
      }

      // Add chunk to loading queue with priority
      yield* _(
        worldService.queueChunkForLoading({
          chunkX: command.chunkX,
          chunkZ: command.chunkZ,
          priority: command.priority,
          requesterId: command.requesterId,
        }),
      )

      // Process chunk loading
      yield* _(processChunkLoading(command, worldService))
    }),

  preloadChunksAroundPosition: (position, radius) =>
    Effect.gen(function* (_) {
      const worldService = yield* _(WorldDomainService)

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
      yield* _(
        Effect.forEach(
          chunksToLoad,
          (command) => ChunkLoadUseCase.execute(command),
          { concurrency: 4 }, // Limit concurrent chunk loads
        ),
      )
    }),
})

const processChunkLoading = (command: ChunkLoadCommand, worldService: WorldDomainService) =>
  Effect.gen(function* (_) {
    // Generate terrain data
    const terrainData = yield* _(worldService.generateChunkTerrain(command.chunkX, command.chunkZ))

    // Generate structures (trees, ores, etc.)
    const structureData = yield* _(worldService.generateChunkStructures(command.chunkX, command.chunkZ, terrainData))

    // Create chunk mesh for rendering
    const meshData = yield* _(
      worldService.generateChunkMesh(command.chunkX, command.chunkZ, {
        terrain: terrainData,
        structures: structureData,
      }),
    )

    // Store chunk data
    yield* _(
      worldService.storeChunk({
        chunkX: command.chunkX,
        chunkZ: command.chunkZ,
        terrain: terrainData,
        structures: structureData,
        mesh: meshData,
        loadedAt: Date.now(),
      }),
    )

    // Mark chunk as loaded
    yield* _(worldService.markChunkAsLoaded(command.chunkX, command.chunkZ))

    yield* _(Effect.log(`Chunk ${command.chunkX}, ${command.chunkZ} loaded successfully`))
  })

// Layer dependencies will be provided by the main Application layer
