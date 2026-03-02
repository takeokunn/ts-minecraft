import { Effect, Data } from 'effect'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { ChunkService, CHUNK_SIZE, blockTypeToIndex, toBlockIndex, BlockIndexError } from '@/domain/chunk'
import { PlayerService } from '@/domain/player'
import { BlockType } from '@/domain/block'
import { Position, PlayerId, WorldId } from '@/shared/kernel'

/**
 * Default world ID - single-world game assumption (matches main.ts)
 */
export const DEFAULT_WORLD_ID = 'world-1' as WorldId

/**
 * Default player ID (matches game-state.ts DEFAULT_PLAYER_ID)
 */
export const DEFAULT_PLAYER_ID_FOR_BLOCK = 'player-1' as PlayerId

/**
 * Player bounding box dimensions (matches Cannon-ES body in physics-service.ts)
 */
const PLAYER_HALF_WIDTH = 0.3   // x and z half-extents
const PLAYER_HALF_HEIGHT = 0.9  // y half-extent

/**
 * Error type for block service operations
 */
export class BlockServiceError extends Data.TaggedError('BlockServiceError')<{
  readonly operation: string
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    return `BlockService error during ${this.operation}: ${this.reason}${causeMessage ? `: ${causeMessage}` : ''}`
  }
}

/**
 * Type guard for BlockServiceError
 */
export const isBlockServiceError = (error: unknown): error is BlockServiceError =>
  typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'BlockServiceError'

/**
 * Convert a world position to chunk coordinate and local block offsets.
 * Handles negative coordinates correctly via double-modulo pattern.
 */
const worldToChunkCoord = (
  pos: Position
): { chunkCoord: { x: number; z: number }; lx: number; lz: number } => {
  const cx = Math.floor(pos.x / CHUNK_SIZE)
  const cz = Math.floor(pos.z / CHUNK_SIZE)
  const lx = ((Math.floor(pos.x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((Math.floor(pos.z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return { chunkCoord: { x: cx, z: cz }, lx, lz }
}

/**
 * BlockService class for block operations in the game world
 */
export class BlockService extends Effect.Service<BlockService>()(
  '@minecraft/application/BlockService',
  {
    effect: Effect.gen(function* () {
      const chunkManagerService = yield* ChunkManagerService
      const chunkService = yield* ChunkService
      const playerService = yield* PlayerService

      return {
        /**
         * Remove a block at the given position from the world.
         * Validates: block exists at the given position.
         */
        breakBlock: (position: Position): Effect.Effect<void, BlockServiceError> =>
          Effect.gen(function* () {
            const { chunkCoord, lx, lz } = worldToChunkCoord(position)
            const y = Math.floor(position.y)

            const chunk = yield* chunkManagerService.getChunk(chunkCoord).pipe(
              Effect.mapError(
                (e) => new BlockServiceError({ operation: 'breakBlock', reason: `Failed to load chunk at (${chunkCoord.x}, ${chunkCoord.z}): ${e.message}`, cause: e })
              )
            )

            const blockType = yield* chunkService.getBlock(chunk, lx, y, lz).pipe(
              Effect.mapError(
                (e) => new BlockServiceError({ operation: 'breakBlock', reason: `Failed to read block at local (${lx}, ${y}, ${lz}): ${e.message}`, cause: e })
              )
            )

            if (blockType === 'AIR') {
              return yield* Effect.fail(
                new BlockServiceError({
                  operation: 'breakBlock',
                  reason: `No block at position (${position.x}, ${position.y}, ${position.z})`,
                })
              )
            }

            // Intentional in-place mutation: ChunkManagerService cache holds the same Uint8Array reference.
            // toBlockIndex validates all bounds and returns the flat index; avoids O(n) copy.
            const idx = yield* toBlockIndex(lx, y, lz).pipe(
              Effect.mapError(
                (e: BlockIndexError) => new BlockServiceError({ operation: 'breakBlock', reason: `Block coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`, cause: e })
              )
            )
            chunk.blocks[idx] = blockTypeToIndex('AIR')

            yield* chunkManagerService.markChunkDirty(chunkCoord)
          }),

        /**
         * Place a block of the given type at the given position.
         * Validates: position is empty (not already a solid block), does not intersect player AABB.
         */
        placeBlock: (position: Position, blockType: BlockType): Effect.Effect<void, BlockServiceError> =>
          Effect.gen(function* () {
            const { chunkCoord, lx, lz } = worldToChunkCoord(position)
            const y = Math.floor(position.y)

            const chunk = yield* chunkManagerService.getChunk(chunkCoord).pipe(
              Effect.mapError(
                (e) => new BlockServiceError({ operation: 'placeBlock', reason: `Failed to load chunk at (${chunkCoord.x}, ${chunkCoord.z}): ${e.message}`, cause: e })
              )
            )

            const existing = yield* chunkService.getBlock(chunk, lx, y, lz).pipe(
              Effect.mapError(
                (e) => new BlockServiceError({ operation: 'placeBlock', reason: `Failed to read block at local (${lx}, ${y}, ${lz}): ${e.message}`, cause: e })
              )
            )

            if (existing !== 'AIR') {
              return yield* Effect.fail(
                new BlockServiceError({
                  operation: 'placeBlock',
                  reason: `Block already exists at position (${position.x}, ${position.y}, ${position.z})`,
                })
              )
            }

            const playerPos = yield* playerService.getPosition(DEFAULT_PLAYER_ID_FOR_BLOCK).pipe(
              Effect.mapError((e) => new BlockServiceError({ operation: 'placeBlock', reason: `Player position error: ${e.message}`, cause: e }))
            )

            // Block occupies [position.x, position.x+1] x [position.y, position.y+1] x [position.z, position.z+1]
            // Player AABB is centered at playerPos (feet) with half-extents (PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT, PLAYER_HALF_WIDTH)
            const playerCenterY = playerPos.y + PLAYER_HALF_HEIGHT
            const blockCenterX = position.x + 0.5
            const blockCenterY = position.y + 0.5
            const blockCenterZ = position.z + 0.5
            const blockHalf = 0.5

            const overlapX = Math.abs(blockCenterX - playerPos.x) < (blockHalf + PLAYER_HALF_WIDTH)
            const overlapY = Math.abs(blockCenterY - playerCenterY) < (blockHalf + PLAYER_HALF_HEIGHT)
            const overlapZ = Math.abs(blockCenterZ - playerPos.z) < (blockHalf + PLAYER_HALF_WIDTH)

            if (overlapX && overlapY && overlapZ) {
              return yield* Effect.fail(
                new BlockServiceError({ operation: 'placeBlock', reason: 'Cannot place block inside player' })
              )
            }

            // Intentional in-place mutation: ChunkManagerService cache holds the same Uint8Array reference.
            // toBlockIndex validates all bounds and returns the flat index; avoids O(n) copy.
            const idx = yield* toBlockIndex(lx, y, lz).pipe(
              Effect.mapError(
                (e: BlockIndexError) => new BlockServiceError({ operation: 'placeBlock', reason: `Block coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`, cause: e })
              )
            )
            chunk.blocks[idx] = blockTypeToIndex(blockType)

            yield* chunkManagerService.markChunkDirty(chunkCoord)
          }),
      }
    }),
  }
) {}
export const BlockServiceLive = BlockService.Default
