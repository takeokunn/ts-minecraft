import { Clock, Effect, Match, Schema, pipe } from 'effect'
import { CHUNK_MAX_Y, CHUNK_MIN_Y, CHUNK_SIZE, CHUNK_VOLUME } from '../../types'
import type { ChunkMetadata } from '../../value_object/chunk_metadata'
import {
  type BlockId,
  type ChunkAggregate,
  type ChunkData,
  type ChunkId,
  type ChunkPosition,
  type WorldCoordinate,
  ChunkBoundsError,
  ChunkDataSchema,
  ChunkSerializationError,
  BlockId as MakeBlockId,
  ChunkId as MakeChunkId,
} from './index'

const inclusiveRange = (start: number, end: number): ReadonlyArray<number> =>
  start > end ? [] : Array.from({ length: end - start + 1 }, (_, index) => start + index)

const buildChunkId = (position: ChunkPosition): ChunkId => MakeChunkId(`${position.x}_${position.z}`)

const getBlockIndex = (x: number, y: number, z: number): number => {
  const normalizedY = y - CHUNK_MIN_Y
  return normalizedY * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x
}

const isValidCoordinate = (x: number, y: number, z: number): boolean =>
  x >= 0 && x < CHUNK_SIZE && y >= CHUNK_MIN_Y && y < CHUNK_MAX_Y && z >= 0 && z < CHUNK_SIZE

const ensureCoordinateBounds = (
  x: WorldCoordinate,
  y: WorldCoordinate,
  z: WorldCoordinate
): Effect.Effect<
  {
    readonly x: WorldCoordinate
    readonly y: WorldCoordinate
    readonly z: WorldCoordinate
    readonly index: number
  },
  ChunkBoundsError
> =>
  pipe(
    Effect.succeed({ x, y, z }),
    Effect.filterOrFail(
      (coords) => isValidCoordinate(coords.x, coords.y, coords.z),
      (coords) =>
        ChunkBoundsError({
          message: `座標がチャンク範囲外です: (${coords.x}, ${coords.y}, ${coords.z})`,
          coordinates: {
            x: coords.x,
            y: coords.y,
            z: coords.z,
          },
        })
    ),
    Effect.map((coords) => ({ ...coords, index: getBlockIndex(coords.x, coords.y, coords.z) }))
  )

const computeNormalizedBounds = (start: WorldCoordinate, end: WorldCoordinate, min: number, max: number) => {
  const low = Math.max(min, Math.min(start, end))
  const high = Math.min(max, Math.max(start, end))
  return { low, high }
}

const regionRanges = (
  startX: WorldCoordinate,
  startY: WorldCoordinate,
  startZ: WorldCoordinate,
  endX: WorldCoordinate,
  endY: WorldCoordinate,
  endZ: WorldCoordinate
): Effect.Effect<
  {
    readonly xRange: ReadonlyArray<number>
    readonly yRange: ReadonlyArray<number>
    readonly zRange: ReadonlyArray<number>
  },
  ChunkBoundsError
> => {
  const { low: minX, high: maxX } = computeNormalizedBounds(startX, endX, 0, CHUNK_SIZE - 1)
  const { low: minZ, high: maxZ } = computeNormalizedBounds(startZ, endZ, 0, CHUNK_SIZE - 1)
  const { low: minY, high: maxY } = computeNormalizedBounds(startY, endY, CHUNK_MIN_Y, CHUNK_MAX_Y - 1)

  return pipe(
    Effect.succeed({ minX, maxX, minY, maxY, minZ, maxZ }),
    Effect.filterOrFail(
      ({ minX: x0, maxX: x1, minY: y0, maxY: y1, minZ: z0, maxZ: z1 }) => x0 <= x1 && y0 <= y1 && z0 <= z1,
      () =>
        ChunkBoundsError({
          message: `領域が無効です: (${startX},${startY},${startZ}) -> (${endX},${endY},${endZ})`,
        })
    ),
    Effect.map(({ minX: x0, maxX: x1, minY: y0, maxY: y1, minZ: z0, maxZ: z1 }) => ({
      xRange: inclusiveRange(x0, x1),
      yRange: inclusiveRange(y0, y1),
      zRange: inclusiveRange(z0, z1),
    }))
  )
}

const updateTimestamp = (metadata: ChunkMetadata, timestamp: number): ChunkMetadata => ({
  ...metadata,
  isModified: true,
  lastUpdate: timestamp,
})

const buildAggregate = (state: ChunkData): ChunkAggregate => {
  const getBlock = (
    x: WorldCoordinate,
    y: WorldCoordinate,
    z: WorldCoordinate
  ): Effect.Effect<BlockId, ChunkBoundsError> =>
    pipe(
      ensureCoordinateBounds(x, y, z),
      Effect.map(({ index }) => MakeBlockId(state.blocks[index] ?? 0))
    )

  const setBlock: ChunkAggregate['setBlock'] = (x, y, z, blockId) =>
    pipe(
      ensureCoordinateBounds(x, y, z),
      Effect.flatMap(({ index }) =>
        Effect.gen(function* () {
          const newBlocks = new Uint16Array(state.blocks)
          newBlocks[index] = blockId
          const timestamp = yield* Clock.currentTimeMillis
          const newData: ChunkData = {
            ...state,
            blocks: newBlocks,
            metadata: updateTimestamp(state.metadata, timestamp),
            isDirty: true,
          }
          return yield* createChunkAggregate(newData)
        })
      )
    )

  const fillRegionOperation: ChunkAggregate['fillRegion'] = (startX, startY, startZ, endX, endY, endZ, blockId) =>
    pipe(
      regionRanges(startX, startY, startZ, endX, endY, endZ),
      Effect.flatMap(({ xRange, yRange, zRange }) =>
        Effect.gen(function* () {
          const newBlocks = new Uint16Array(state.blocks)
          const timestamp = yield* Clock.currentTimeMillis

          yield* Effect.forEach(
            xRange,
            (x) =>
              Effect.forEach(
                yRange,
                (y) =>
                  Effect.forEach(
                    zRange,
                    (z) =>
                      Effect.sync(() => {
                        const index = getBlockIndex(x, y, z)
                        newBlocks[index] = blockId
                      }),
                    { concurrency: 'unbounded' }
                  ),
                { concurrency: 'unbounded' }
              ),
            { concurrency: 'unbounded' }
          )

          const newData: ChunkData = {
            ...state,
            blocks: newBlocks,
            metadata: updateTimestamp(state.metadata, timestamp),
            isDirty: true,
          }

          return yield* createChunkAggregate(newData)
        })
      )
    )

  const markDirty: ChunkAggregate['markDirty'] = () =>
    pipe(
      state.isDirty,
      Match.value,
      Match.when(true, () => Effect.succeed(buildAggregate(state))),
      Match.orElse(() =>
        Effect.gen(function* () {
          const timestamp = yield* Clock.currentTimeMillis
          const newData: ChunkData = {
            ...state,
            isDirty: true,
            metadata: updateTimestamp(state.metadata, timestamp),
          }
          return yield* createChunkAggregate(newData)
        })
      )
    )

  const markClean: ChunkAggregate['markClean'] = () =>
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

  const updateMetadata: ChunkAggregate['updateMetadata'] = (metadata) =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      const newData: ChunkData = {
        ...state,
        metadata: updateTimestamp(
          {
            ...state.metadata,
            ...metadata,
          },
          timestamp
        ),
        isDirty: true,
      }
      return yield* createChunkAggregate(newData)
    })

  const clone: ChunkAggregate['clone'] = () =>
    Effect.succeed(
      buildAggregate({
        ...state,
        blocks: new Uint16Array(state.blocks),
        metadata: {
          ...state.metadata,
          heightMap: [...state.metadata.heightMap],
        },
      })
    )

  const isEmpty = () => state.blocks.every((block) => block === 0)

  const getMemoryUsage = () => state.blocks.byteLength + state.metadata.heightMap.length * 8

  return {
    id: buildChunkId(state.position),
    position: state.position,
    data: state,
    getBlock,
    setBlock,
    fillRegion: fillRegionOperation,
    markDirty,
    markClean,
    updateMetadata,
    isEmpty,
    getMemoryUsage,
    clone,
  }
}

/**
 * チャンク集約ファクトリ
 */
export const createChunkAggregate = (
  data: ChunkData
): Effect.Effect<ChunkAggregate, ChunkBoundsError | ChunkSerializationError> =>
  pipe(
    Schema.decodeEffect(ChunkDataSchema)(data),
    Effect.mapError((error) =>
      ChunkSerializationError({
        message: 'チャンクデータの検証に失敗しました',
        originalError: error,
      })
    ),
    Effect.map((validated) => ({
      ...validated,
      blocks: validated.blocks instanceof Uint16Array ? validated.blocks : new Uint16Array(validated.blocks),
      metadata: {
        ...validated.metadata,
        heightMap: [...validated.metadata.heightMap],
      },
    })),
    Effect.map(buildAggregate)
  )

/**
 * 空のチャンクを作成
 */
export const createEmptyChunkAggregate = (
  position: ChunkPosition
): Effect.Effect<ChunkAggregate, ChunkSerializationError | ChunkBoundsError> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    const emptyData: ChunkData = {
      position,
      blocks: new Uint16Array(CHUNK_VOLUME),
      metadata: {
        biome: 'plains',
        lightLevel: 15,
        isModified: false,
        lastUpdate: timestamp,
        heightMap: Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => 0),
      },
      isDirty: false,
    }

    return yield* createChunkAggregate(emptyData)
  })
