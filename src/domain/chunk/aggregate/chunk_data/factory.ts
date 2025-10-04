import { Clock, Effect, Match, Schema, pipe } from 'effect'
import {
  type ChunkData,
  type ChunkDataAggregate,
  type ChunkDataId,
  ChunkDataId as MakeChunkDataId,
  ChunkDataSchema,
  ChunkDataValidationError,
} from './types'
import { type ChunkPosition } from '../../value_object/chunk-position'
import {
  type ChunkMetadata,
  type HeightValue,
  HeightValue as MakeHeightValue,
} from '../../value_object/chunk-metadata'
import { CHUNK_SIZE, CHUNK_VOLUME } from '../../types/core'

const heightMapSize = CHUNK_SIZE * CHUNK_SIZE

const createId = (position: ChunkPosition): ChunkDataId =>
  MakeChunkDataId(`chunk_data_${position.x}_${position.z}`)

const cloneMetadata = (metadata: ChunkMetadata): ChunkMetadata => ({
  ...metadata,
  heightMap: [...metadata.heightMap],
})

const withTimestamp = (
  metadata: ChunkMetadata,
  timestamp: number
): ChunkMetadata => ({
  ...metadata,
  isModified: true,
  lastUpdate: timestamp,
})

const invalidIndex = (index: number): ChunkDataValidationError =>
  ChunkDataValidationError({
    message: `インデックスが範囲外です: ${index}`,
    value: index,
  })

const ensureBlockIndex = (index: number) =>
  pipe(
    Effect.succeed(index),
    Effect.filterOrFail(
      (value) => Number.isInteger(value) && value >= 0 && value < CHUNK_VOLUME,
      invalidIndex
    )
  )

const ensureHeightIndex = (index: number) =>
  pipe(
    Effect.succeed(index),
    Effect.filterOrFail(
      (value) => Number.isInteger(value) && value >= 0 && value < heightMapSize,
      invalidIndex
    )
  )

const buildAggregate = (
  state: ChunkData
): ChunkDataAggregate => {
  const getBlock: ChunkDataAggregate['getBlock'] = (index) => state.blocks[index] ?? 0

  const setBlock: ChunkDataAggregate['setBlock'] = (index, blockId) =>
    pipe(
      ensureBlockIndex(index),
      Effect.flatMap(() =>
        Effect.gen(function* () {
          const timestamp = yield* Clock.currentTimeMillis
          const blocks = new Uint16Array(state.blocks)
          blocks[index] = blockId

          const next: ChunkData = {
            ...state,
            blocks,
            metadata: withTimestamp(state.metadata, timestamp),
            isDirty: true,
          }

          return yield* createChunkDataAggregate(next)
        })
      )
    )

  const fillBlocks: ChunkDataAggregate['fillBlocks'] = (blockId) =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      const blocks = new Uint16Array(CHUNK_VOLUME)
      blocks.fill(blockId)

      const next: ChunkData = {
        ...state,
        blocks,
        metadata: withTimestamp(state.metadata, timestamp),
        isDirty: true,
      }

      return yield* createChunkDataAggregate(next)
    })

  const updateMetadata: ChunkDataAggregate['updateMetadata'] = (metadata) =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      const next: ChunkData = {
        ...state,
        metadata: withTimestamp(
          {
            ...state.metadata,
            ...metadata,
          },
          timestamp
        ),
        isDirty: true,
      }
      return yield* createChunkDataAggregate(next)
    })

  const updateHeightMap: ChunkDataAggregate['updateHeightMap'] = (index, height) =>
    pipe(
      ensureHeightIndex(index),
      Effect.flatMap(() =>
        Effect.gen(function* () {
          const timestamp = yield* Clock.currentTimeMillis
          const heightMap = [...state.metadata.heightMap]
          heightMap[index] = height

          const next: ChunkData = {
            ...state,
            metadata: withTimestamp(
              {
                ...state.metadata,
                heightMap,
              },
              timestamp
            ),
            isDirty: true,
          }

          return yield* createChunkDataAggregate(next)
        })
      )
    )

  const getHeightAt: ChunkDataAggregate['getHeightAt'] = (index) =>
    MakeHeightValue(state.metadata.heightMap[index] ?? 0)

  const markDirty: ChunkDataAggregate['markDirty'] = () =>
    pipe(
      state.isDirty,
      Match.value,
      Match.when(true, () => Effect.succeed(buildAggregate(state))),
      Match.orElse(() =>
        Effect.gen(function* () {
          const timestamp = yield* Clock.currentTimeMillis
          const next: ChunkData = {
            ...state,
            isDirty: true,
            metadata: withTimestamp(state.metadata, timestamp),
          }
          return yield* createChunkDataAggregate(next)
        })
      )
    )

  const markClean: ChunkDataAggregate['markClean'] = () =>
    pipe(
      state.isDirty,
      Match.value,
      Match.when(false, () => Effect.succeed(buildAggregate(state))),
      Match.orElse(() =>
        Effect.succeed(
          buildAggregate({
            ...state,
            isDirty: false,
          })
        )
      )
    )

  const updateTimestamp: ChunkDataAggregate['updateTimestamp'] = () =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      const next: ChunkData = {
        ...state,
        metadata: withTimestamp(state.metadata, timestamp),
      }
      return yield* createChunkDataAggregate(next)
    })

  const isEmpty = () => state.blocks.every((block) => block === 0)

  const getMemoryUsage = () => state.blocks.byteLength + state.metadata.heightMap.length * 8

  const clone: ChunkDataAggregate['clone'] = () =>
    Effect.succeed(
      buildAggregate({
        ...state,
        blocks: new Uint16Array(state.blocks),
        metadata: cloneMetadata(state.metadata),
      })
    )

  const reset: ChunkDataAggregate['reset'] = (newPosition) =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      const next: ChunkData = {
        id: createId(newPosition),
        position: newPosition,
        blocks: new Uint16Array(CHUNK_VOLUME),
        metadata: {
          biome: 'plains',
          lightLevel: 15,
          isModified: false,
          lastUpdate: timestamp,
          heightMap: Array.from({ length: heightMapSize }, () => 0),
        },
        isDirty: false,
      }
      return yield* createChunkDataAggregate(next)
    })

  return {
    id: state.id ?? createId(state.position),
    position: state.position,
    blocks: state.blocks,
    metadata: state.metadata,
    isDirty: state.isDirty,
    getBlock,
    setBlock,
    fillBlocks,
    updateMetadata,
    updateHeightMap,
    getHeightAt,
    markDirty,
    markClean,
    updateTimestamp,
    isEmpty,
    getMemoryUsage,
    clone,
    reset,
  }
}

/**
 * チャンクデータ集約ファクトリ
 */
export const createChunkDataAggregate = (
  data: ChunkData
): Effect.Effect<ChunkDataAggregate, ChunkDataValidationError> =>
  pipe(
    Schema.decodeEffect(ChunkDataSchema)(data),
    Effect.mapError((error) =>
      ChunkDataValidationError({
        message: 'チャンクデータの検証に失敗しました',
        value: data,
      })
    ),
    Effect.map((validated) =>
      buildAggregate({
        ...validated,
        id: validated.id ?? createId(validated.position),
        blocks:
          validated.blocks instanceof Uint16Array
            ? validated.blocks
            : new Uint16Array(validated.blocks),
        metadata: cloneMetadata(validated.metadata),
      })
    )
  )

/**
 * 空のチャンクデータを作成
 */
export const createEmptyChunkDataAggregate = (
  position: ChunkPosition,
  metadata?: Partial<ChunkMetadata>
): Effect.Effect<ChunkDataAggregate, ChunkDataValidationError> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    const defaultMetadata: ChunkMetadata = {
      biome: 'plains',
      lightLevel: 15,
      isModified: false,
      lastUpdate: timestamp,
      heightMap: Array.from({ length: heightMapSize }, () => 0),
      ...metadata,
    }

    const emptyData: ChunkData = {
      id: createId(position),
      position,
      blocks: new Uint16Array(CHUNK_VOLUME),
      metadata: defaultMetadata,
      isDirty: false,
    }

    return yield* createChunkDataAggregate(emptyData)
  })

/**
 * チャンクデータの検証ユーティリティ
 */
export const validateChunkData = (
  data: unknown
): Effect.Effect<ChunkData, ChunkDataValidationError> =>
  pipe(
    Schema.decodeEffect(ChunkDataSchema)(data),
    Effect.mapError((error) =>
      ChunkDataValidationError({
        message: `チャンクデータの検証に失敗しました: ${String(error)}`,
        value: data,
      })
    )
  )
