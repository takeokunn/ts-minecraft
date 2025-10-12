import { Effect, Match, Option, pipe } from 'effect'
import type { ChangeSet, ChunkDataBytes, ChunkState, ChunkTimestamp, LoadProgress } from '../../types'
import {
  CHUNK_HEIGHT,
  CHUNK_MIN_Y,
  CHUNK_SIZE,
  ChunkStateGuards,
  ChunkStateOptics,
  ChunkStateOpticsHelpers,
  ChunkStates,
} from '../../types'
import type { ChunkMetadata } from '../../value_object/chunk_metadata'
import { makeUnsafeHeightValue } from '../../value_object/chunk_metadata'
import type { ChunkPosition } from '../../value_object/chunk_position'
import type { ChunkData } from '../chunk_data'
import { ChunkBoundsError, ChunkDataOptics, ChunkDataOpticsHelpers } from './index'

const localBlockIndex = (x: number, y: number, z: number): number =>
  (y - CHUNK_MIN_Y) * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x

const inclusiveRange = (start: number, end: number): ReadonlyArray<number> =>
  start > end ? [] : Array.from({ length: end - start + 1 }, (_, index) => start + index)

/**
 * ChunkData複合操作
 */
export const ChunkOperations = {
  setBlockWithMetadata: (
    chunk: ChunkData,
    blockIndex: number,
    blockId: number,
    updateTime: ChunkTimestamp
  ): ChunkData =>
    pipe(
      chunk,
      ChunkDataOpticsHelpers.setBlock(blockIndex, blockId),
      ChunkDataOptics.metadataTimestamp.replace(updateTime),
      ChunkDataOpticsHelpers.markDirty
    ),

  setBlockAt3D: (
    chunk: ChunkData,
    x: number,
    y: number,
    z: number,
    blockId: number,
    updateTime: ChunkTimestamp
  ): ChunkData => {
    const blockIndex = localBlockIndex(x, y, z)
    const heightMapIndex = z * CHUNK_SIZE + x

    return pipe(
      chunk,
      ChunkDataOpticsHelpers.setBlock(blockIndex, blockId),
      ChunkDataOpticsHelpers.modifyHeight(heightMapIndex, (currentHeight) =>
        pipe(
          { blockId, y, currentHeight },
          Match.value,
          Match.when(
            ({ blockId, y, currentHeight }) => blockId !== 0 && y > currentHeight,
            ({ y }) => makeUnsafeHeightValue(y)
          ),
          Match.when(
            ({ blockId, y, currentHeight }) => blockId === 0 && y === currentHeight,
            () => makeUnsafeHeightValue(recalculateHeight(chunk, x, z, y))
          ),
          Match.orElse(({ currentHeight }) => currentHeight)
        )
      ),
      ChunkDataOptics.metadataTimestamp.replace(updateTime),
      ChunkDataOpticsHelpers.markDirty
    )
  },

  fillRegion: (
    chunk: ChunkData,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    blockId: number,
    updateTime: ChunkTimestamp
  ): ChunkData =>
    inclusiveRange(x1, x2).reduce(
      (chunkAcc, x) =>
        inclusiveRange(y1, y2).reduce(
          (yAcc, y) =>
            inclusiveRange(z1, z2).reduce(
              (zAcc, z) => ChunkOperations.setBlockAt3D(zAcc, x, y, z, blockId, updateTime),
              yAcc
            ),
          chunkAcc
        ),
      chunk
    ),

  relocateChunk: (chunk: ChunkData, newPosition: ChunkPosition, updateTime: ChunkTimestamp): ChunkData =>
    pipe(
      chunk,
      ChunkDataOpticsHelpers.setPosition(newPosition),
      ChunkDataOptics.metadataTimestamp.replace(updateTime),
      ChunkDataOpticsHelpers.markDirty
    ),

  replaceMetadata: (chunk: ChunkData, newMetadata: ChunkMetadata): ChunkData =>
    pipe(chunk, ChunkDataOptics.metadata.replace(newMetadata), ChunkDataOpticsHelpers.markDirty),

  initializeChunk: (chunk: ChunkData, position: ChunkPosition, metadata: ChunkMetadata): ChunkData =>
    pipe(
      chunk,
      ChunkDataOpticsHelpers.setPosition(position),
      ChunkDataOptics.metadata.replace(metadata),
      ChunkDataOpticsHelpers.markClean
    ),
} as const

/**
 * ChunkState複合操作
 */
export const ChunkStateOperations = {
  updateLoadingProgress: (
    state: ChunkState,
    newProgress: LoadProgress,
    onComplete?: { data: ChunkDataBytes; metadata: ChunkMetadata }
  ): ChunkState =>
    pipe(
      Match.value(state),
      Match.when(ChunkStateGuards.isLoading, (loadingState) => {
        const progressed = ChunkStateOpticsHelpers.updateLoadingProgress(loadingState, newProgress)
        return pipe(
          Option.fromNullable(onComplete),
          Option.filter(() => newProgress >= 100),
          Option.flatMap((complete) => Option.some(ChunkStates.loaded(complete.data, complete.metadata))),
          Option.getOrElse(() => progressed)
        )
      }),
      Match.orElse(() => state)
    ),

  updateFailureInfo: (state: ChunkState, newError: string, newTimestamp: ChunkTimestamp): ChunkState =>
    pipe(
      Match.value(state),
      Match.when(ChunkStateGuards.isFailed, (failedState) =>
        pipe(
          failedState,
          ChunkStateOpticsHelpers.updateFailedError(newError),
          ChunkStateOpticsHelpers.incrementRetryCount,
          ChunkStateOptics.failedLastAttempt.replace(newTimestamp)
        )
      ),
      Match.orElse(() => state)
    ),

  updateDirtyState: (
    state: ChunkState,
    newData: ChunkDataBytes,
    newChanges: ChangeSet,
    newMetadata: ChunkMetadata
  ): ChunkState =>
    pipe(
      Match.value(state),
      Match.when(ChunkStateGuards.isDirty, (dirtyState) =>
        pipe(
          dirtyState,
          ChunkStateOpticsHelpers.updateData(newData),
          ChunkStateOpticsHelpers.updateDirtyChanges(newChanges),
          ChunkStateOpticsHelpers.updateMetadata(newMetadata)
        )
      ),
      Match.orElse(() => state)
    ),

  updateSavingProgress: (state: ChunkState, newProgress: LoadProgress, newData?: ChunkDataBytes): ChunkState =>
    pipe(
      Match.value(state),
      Match.when(ChunkStateGuards.isSaving, (savingState) => {
        const progressed = ChunkStateOptics.savingProgress.replace(newProgress)(savingState)
        const withData = pipe(
          Option.fromNullable(newData),
          Option.map((data) => ChunkStateOpticsHelpers.updateData(data)(progressed)),
          Option.getOrElse(() => progressed)
        )

        return pipe(
          Option.fromNullable(newData),
          Option.filter(() => newProgress >= 100),
          Option.flatMap(() =>
            pipe(
              Option.fromNullable(ChunkStateOptics.savingData.get(withData)),
              Option.zipWith(Option.fromNullable(ChunkStateOptics.savingMetadata.get(withData)), (data, metadata) =>
                ChunkStates.loaded(data, metadata)
              )
            )
          ),
          Option.getOrElse(() => withData)
        )
      }),
      Match.orElse(() => state)
    ),
} as const

/**
 * Effect-TSを活用した安全な操作
 */
export const ChunkEffectOperations = {
  safeSetBlockAt3D: (
    chunk: ChunkData,
    x: number,
    y: number,
    z: number,
    blockId: number,
    updateTime: ChunkTimestamp
  ): Effect.Effect<ChunkData, ChunkBoundsError> =>
    Effect.gen(function* () {
      yield* pipe(
        Effect.succeed({ x, y, z }),
        Effect.filterOrFail(
          ({ x, y, z }) =>
            x >= 0 && x < CHUNK_SIZE && y >= CHUNK_MIN_Y && y < CHUNK_MIN_Y + CHUNK_HEIGHT && z >= 0 && z < CHUNK_SIZE,
          ({ x, y, z }) =>
            ChunkBoundsError({
              message: `座標がチャンク範囲外です: (${x}, ${y}, ${z})`,
              coordinates: { x, y, z },
            })
        )
      )

      yield* pipe(
        Effect.succeed(blockId),
        Effect.filterOrFail(
          (candidate) => Number.isInteger(candidate) && candidate >= 0 && candidate <= 65_535,
          (candidate) =>
            ChunkBoundsError({
              message: `ブロックIDが範囲外です: ${candidate}`,
              coordinates: { x, y, z },
            })
        )
      )

      return ChunkOperations.setBlockAt3D(chunk, x, y, z, blockId, updateTime)
    }),

  initializeChunkAsync: (position: ChunkPosition, metadata: ChunkMetadata): Effect.Effect<ChunkData> =>
    Effect.sync(() => {
      const blocks = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      const chunkData: ChunkData = {
        id: `chunk_${position.x}_${position.z}`,
        position,
        blocks,
        metadata,
        isDirty: false,
      }
      return ChunkOperations.initializeChunk(chunkData, position, metadata)
    }),

  batchBlockUpdate: (
    chunk: ChunkData,
    updates: ReadonlyArray<{ x: number; y: number; z: number; blockId: number }>,
    updateTime: ChunkTimestamp
  ): Effect.Effect<ChunkData, ChunkBoundsError> =>
    Effect.reduce(updates, chunk, (acc, update) =>
      ChunkEffectOperations.safeSetBlockAt3D(acc, update.x, update.y, update.z, update.blockId, updateTime)
    ),
} as const

export const ChunkOptimizedOperations = {
  lazyBlockUpdate: (
    chunk: ChunkData,
    updates: Iterable<{ index: number; blockId: number }>,
    updateTime: ChunkTimestamp
  ): ChunkData =>
    pipe(
      Array.from(updates).reduce(
        (acc, { index, blockId }) => ChunkDataOpticsHelpers.setBlock(acc, index, blockId),
        chunk
      ),
      ChunkDataOptics.metadataTimestamp.replace(updateTime),
      ChunkDataOpticsHelpers.markDirty
    ),

  batchBlockUpdateOptimized: (
    chunk: ChunkData,
    blockUpdates: ReadonlyMap<number, number>,
    updateTime: ChunkTimestamp
  ): ChunkData =>
    pipe(
      Array.from(blockUpdates.entries()).reduce(
        (blocks, [index, blockId]) =>
          pipe(
            index >= 0 && index < blocks.length,
            Match.value,
            Match.when(true, () => {
              blocks[index] = blockId
              return blocks
            }),
            Match.orElse(() => blocks)
          ),
        new Uint16Array(chunk.blocks)
      ),
      (blocks) =>
        pipe(
          chunk,
          ChunkDataOptics.blocks.replace(blocks),
          ChunkDataOptics.metadataTimestamp.replace(updateTime),
          ChunkDataOpticsHelpers.markDirty
        )
    ),
} as const

const recalculateHeight = (chunk: ChunkData, x: number, z: number, startY: number): number =>
  pipe(
    inclusiveRange(CHUNK_MIN_Y, startY - 1)
      .slice()
      .reverse()
      .find((currentY) => chunk.blocks[localBlockIndex(x, currentY, z)] !== 0),
    Option.fromNullable,
    Option.getOrElse(() => CHUNK_MIN_Y)
  )
