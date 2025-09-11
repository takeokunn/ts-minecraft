import { Effect, Option, HashMap, Context, Layer } from 'effect'
import { ReadonlyArray } from 'effect/ReadonlyArray'
import { EntityId } from '@domain/entities'
import { CHUNK_SIZE, RENDER_DISTANCE } from '@domain/constants/world-constants'
import { WorldDomainService } from '@domain/services/world-domain.service'
import { ChunkLoadUseCase } from '@application/use-cases/chunk-load.use-case'
import { Position } from '@domain/entities/components'

type ChunkCoord = { readonly x: number; readonly z: number }

const ChunkCoord = {
  asString: (coord: ChunkCoord): string => `${coord.x},${coord.z}`,
  fromString: (key: string): Option.Option<ChunkCoord> => {
    const parts = key.split(',')
    if (parts.length !== 2) {
      return Option.none()
    }
    const xStr = parts[0]
    const zStr = parts[1]
    if (xStr === undefined || zStr === undefined) {
      return Option.none()
    }
    const x = parseInt(xStr, 10)
    const z = parseInt(zStr, 10)
    if (isNaN(x) || isNaN(z)) {
      return Option.none()
    }
    return Option.some({ x, z })
  },
  equals: (a: ChunkCoord, b: ChunkCoord): boolean => a.x === b.x && a.z === b.z,
}

export const calculateChunkUpdates = (
  currentPlayerChunk: ChunkCoord,
  loadedChunks: HashMap.HashMap<string, EntityId>,
  renderDistance: number,
): {
  toLoad: ReadonlyArray<ChunkCoord>
  toUnload: ReadonlyArray<EntityId>
} => {
  const requiredChunks = new Set<string>()
  for (let x = currentPlayerChunk.x - renderDistance; x <= currentPlayerChunk.x + renderDistance; x++) {
    for (let z = currentPlayerChunk.z - renderDistance; z <= currentPlayerChunk.z + renderDistance; z++) {
      requiredChunks.add(ChunkCoord.asString({ x, z }))
    }
  }

  const loadedChunkKeys = new Set(HashMap.keys(loadedChunks))

  const toUnload: EntityId[] = []
  for (const [key, entityId] of HashMap.entries(loadedChunks)) {
    if (!requiredChunks.has(key)) {
      toUnload.push(entityId)
    }
  }

  const toLoad: ChunkCoord[] = []
  for (const key of requiredChunks) {
    if (!loadedChunkKeys.has(key)) {
      const coord = ChunkCoord.fromString(key)
      if (Option.isSome(coord)) {
        toLoad.push(coord.value)
      }
    }
  }

  return { toLoad, toUnload }
}

const getPlayerChunk = (position: Position): ChunkCoord => ({
  x: Math.floor(position.x / CHUNK_SIZE),
  z: Math.floor(position.z / CHUNK_SIZE),
})

/**
 * Chunk Loading Workflow Service interface
 */
export interface ChunkLoadingWorkflowService {
  readonly executeChunkLoading: () => Effect.Effect<void, Error>
  readonly calculateUpdates: (currentPlayerChunk: ChunkCoord, loadedChunks: HashMap.HashMap<string, EntityId>, renderDistance: number) => {
    toLoad: ReadonlyArray<ChunkCoord>
    toUnload: ReadonlyArray<EntityId>
  }
}

/**
 * Chunk Loading Workflow Service
 */
export const ChunkLoadingWorkflow = Context.GenericTag<ChunkLoadingWorkflowService>('ChunkLoadingWorkflow')

export const ChunkLoadingWorkflowLive = Layer.effect(
  ChunkLoadingWorkflow,
  Effect.gen(function* () {
    const executeChunkLoading = () =>
      Effect.gen(function* (_) {
        const worldService = yield* _(WorldDomainService)
        const chunkLoadUseCase = yield* _(ChunkLoadUseCase)

        // Get current player position
        const playerPosition = yield* _(worldService.getPlayerPosition())

        if (!playerPosition) {
          yield* _(Effect.log('No player position found, skipping chunk loading'))
          return
        }

        const currentPlayerChunk = getPlayerChunk(playerPosition)

        // Get currently loaded chunks
        const loadedChunks = yield* _(worldService.getLoadedChunks())
        const loadedChunkMap = HashMap.fromIterable(loadedChunks.map((chunk) => [ChunkCoord.asString({ x: chunk.chunkX, z: chunk.chunkZ }), chunk]))

        const { toLoad, toUnload } = calculateChunkUpdates(
          currentPlayerChunk,
          HashMap.map(loadedChunkMap, (chunk) => chunk.chunkX.toString()), // Convert to simple mapping for compatibility
          RENDER_DISTANCE,
        )

        // Load new chunks
        yield* _(
          Effect.forEach(
            toLoad,
            (coord) =>
              chunkLoadUseCase.execute({
                chunkX: coord.x,
                chunkZ: coord.z,
                priority: 'medium',
                requesterId: 'chunk-loading-workflow',
              }),
            { concurrency: 4, discard: true },
          ),
        )

        // Unload distant chunks
        yield* _(Effect.forEach(toUnload, (entityId) => worldService.unloadChunk(entityId), { concurrency: 4, discard: true }))

        yield* _(Effect.log(`Chunk loading workflow completed: ${toLoad.length} loaded, ${toUnload.length} unloaded`))
      })

    return {
      executeChunkLoading,
      calculateUpdates: calculateChunkUpdates
    } satisfies ChunkLoadingWorkflowService
  })
)

/**
 * Legacy function to maintain compatibility
 */
export const chunkLoadingWorkflow = Effect.gen(function* (_) {
  const workflow = yield* _(ChunkLoadingWorkflow)
  yield* _(workflow.executeChunkLoading())
})
