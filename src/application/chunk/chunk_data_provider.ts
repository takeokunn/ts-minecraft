import {
  makeUnsafeWorldX,
  makeUnsafeWorldY,
  makeUnsafeWorldZ,
} from '@/domain/biome/value_object/coordinates/world_coordinate'
import {
  CHUNK_HEIGHT,
  CHUNK_MAX_Y,
  CHUNK_MIN_Y,
  CHUNK_SIZE,
  chunkToWorldPosition,
  createChunkAggregate,
  createChunkPosition,
} from '@/domain/chunk'
import { ChunkValidationService } from '@/domain/chunk/domain_service'
import type { ChunkRepository as ChunkRepositoryService, RepositoryError } from '@/domain/chunk/repository'
import { ChunkRepository } from '@/domain/chunk/repository'
import type {
  BlockData,
  ChunkAggregate,
  ChunkData,
  ChunkDataProvider,
  ChunkId,
  ChunkPosition,
  ChunkPositionError,
  WorldCoordinate,
} from '@/domain/chunk/types'
import {
  ChunkBoundsError,
  ChunkDataProvider as ChunkDataProviderTag,
  ChunkDataValidationError,
  ChunkIdError,
  ChunkSerializationError,
} from '@/domain/chunk/types'
import { Clock, Effect, Layer } from 'effect'
import { pipe } from 'effect/Function'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'

const BLOCKS_PER_LAYER = CHUNK_SIZE * CHUNK_SIZE
const EXPECTED_BLOCK_COUNT = CHUNK_HEIGHT * BLOCKS_PER_LAYER

type WorldNumbers = {
  readonly x: number
  readonly y: number
  readonly z: number
}

const toWorldNumbers = (position: {
  readonly x: WorldCoordinate
  readonly y: WorldCoordinate
  readonly z: WorldCoordinate
}): WorldNumbers => ({
  x: Math.trunc(Number(position.x)),
  y: Math.trunc(Number(position.y)),
  z: Math.trunc(Number(position.z)),
})

const computeBlockIndex = (x: number, y: number, z: number): number => y * BLOCKS_PER_LAYER + z * CHUNK_SIZE + x

const formatAggregateError = (error: ChunkBoundsError | ChunkSerializationError): string => error.message

const toChunkBoundsErrorFromRepository = (error: RepositoryError, coordinates: WorldNumbers): ChunkBoundsError =>
  ChunkBoundsError({
    message: Match.value(error._tag).pipe(
      Match.when('ChunkNotFound', () => error.message),
      Match.when('StorageError', () => `${error.operation}: ${error.reason}`),
      Match.when('ValidationError', () => `${error.field}: ${error.constraint}`),
      Match.orElse(() => `Repository error: ${error._tag}`)
    ),
    coordinates,
  })

const mapPositionErrorToBounds = (error: ChunkPositionError, coordinates: WorldNumbers): ChunkBoundsError =>
  ChunkBoundsError({
    message: error.message,
    coordinates,
  })

const findChunkDataById = <E>(
  repository: ChunkRepositoryService,
  id: ChunkId,
  onMissing: () => E
): Effect.Effect<ChunkData, E> =>
  Effect.gen(function* () {
    const option = yield* repository.findById(id)
    return yield* pipe(
      option,
      Option.match({
        onNone: () => Effect.fail(onMissing()),
        onSome: Effect.succeed,
      })
    )
  })

const resolveChunkContext = (
  repository: ChunkRepositoryService,
  world: WorldNumbers
): Effect.Effect<
  {
    readonly chunk: ChunkData
    readonly chunkPosition: ChunkPosition
    readonly localX: number
    readonly localY: number
    readonly localZ: number
  },
  ChunkBoundsError | ChunkPositionError
> =>
  Effect.gen(function* () {
    const chunkPosition = yield* createChunkPosition(Math.floor(world.x / CHUNK_SIZE), Math.floor(world.z / CHUNK_SIZE))

    const chunkOption = yield* repository.findByPosition(chunkPosition)
    const chunk = yield* pipe(
      chunkOption,
      Option.match({
        onNone: () =>
          Effect.fail(
            ChunkBoundsError({
              message: `チャンクが読み込まれていません (${chunkPosition.x}, ${chunkPosition.z})`,
              coordinates: world,
            })
          ),
        onSome: Effect.succeed,
      })
    )

    const localX = world.x - chunkPosition.x * CHUNK_SIZE
    const localZ = world.z - chunkPosition.z * CHUNK_SIZE
    const localY = world.y - CHUNK_MIN_Y

    if (localX < 0 || localX >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE) {
      return yield* Effect.fail(
        ChunkBoundsError({
          message: `ワールド座標がチャンク範囲外です (${world.x}, ${world.y}, ${world.z})`,
          coordinates: world,
        })
      )
    }

    if (localY < 0 || localY >= CHUNK_HEIGHT) {
      return yield* Effect.fail(
        ChunkBoundsError({
          message: `Y座標がチャンク範囲外です: ${world.y}`,
          coordinates: world,
        })
      )
    }

    return {
      chunk,
      chunkPosition,
      localX,
      localY,
      localZ,
    }
  })

export const ChunkDataProviderLive = Layer.succeed(
  ChunkDataProviderTag,
  ChunkDataProviderTag.of({
    getChunk: (id: ChunkId): Effect.Effect<ChunkAggregate, ChunkIdError> =>
      Effect.gen(function* () {
        const repository = yield* ChunkRepository
        const chunkData = yield* findChunkDataById(repository, id, () =>
          ChunkIdError.make({
            message: `チャンクが見つかりません: ${id}`,
            value: id,
          })
        )

        return yield* createChunkAggregate(chunkData).pipe(
          Effect.mapError((error) =>
            ChunkIdError.make({
              message: `チャンクデータの生成に失敗しました (${formatAggregateError(error)})`,
              value: id,
              cause: error,
            })
          )
        )
      }),

    getChunkData: (id: ChunkId): Effect.Effect<ChunkData, ChunkDataValidationError> =>
      Effect.gen(function* () {
        const repository = yield* ChunkRepository
        return yield* findChunkDataById(repository, id, () =>
          ChunkDataValidationError({
            message: `チャンクが存在しません: ${id}`,
            field: 'chunkId',
            value: id,
          })
        )
      }),

    validateChunk: (chunk: ChunkAggregate): Effect.Effect<void, ChunkDataValidationError> =>
      Effect.gen(function* () {
        const validationServiceOption = yield* Effect.serviceOption(ChunkValidationService)

        if (Option.isSome(validationServiceOption)) {
          yield* validationServiceOption.value.validateChunkAggregate(chunk).pipe(
            Effect.mapError(() =>
              ChunkDataValidationError({
                message: 'チャンク検証に失敗しました',
                field: 'aggregate',
                value: chunk.id,
              })
            )
          )
          return
        }

        if (chunk.data.blocks.length !== EXPECTED_BLOCK_COUNT) {
          return yield* Effect.fail(
            ChunkDataValidationError({
              message: `チャンクデータサイズが不正です: ${chunk.data.blocks.length}`,
              field: 'blocks',
              value: chunk.id,
            })
          )
        }
      }),

    getBlock: (position: {
      readonly x: WorldCoordinate
      readonly y: WorldCoordinate
      readonly z: WorldCoordinate
    }): Effect.Effect<BlockData, ChunkBoundsError> =>
      Effect.gen(function* () {
        const repository = yield* ChunkRepository
        const world = toWorldNumbers(position)

        if (world.y < CHUNK_MIN_Y || world.y > CHUNK_MAX_Y) {
          return yield* Effect.fail(
            ChunkBoundsError({
              message: `Y座標がチャンク範囲外です: ${world.y}`,
              coordinates: world,
            })
          )
        }

        const context = yield* resolveChunkContext(repository, world).pipe(
          Effect.mapError((error) =>
            error._tag === 'ChunkBoundsError' ? error : mapPositionErrorToBounds(error, world)
          )
        )

        const blockIndex = computeBlockIndex(context.localX, context.localY, context.localZ)
        const blockValue = context.chunk.blocks[blockIndex] ?? 0

        if (blockValue < 0 || blockValue > 15) {
          return yield* Effect.fail(
            ChunkBoundsError({
              message: `ブロックデータが範囲外です: ${blockValue}`,
              coordinates: world,
            })
          )
        }

        return blockValue as BlockData
      }),

    setBlock: (
      position: {
        readonly x: WorldCoordinate
        readonly y: WorldCoordinate
        readonly z: WorldCoordinate
      },
      blockData: BlockData
    ): Effect.Effect<void, ChunkBoundsError> =>
      Effect.gen(function* () {
        const repository = yield* ChunkRepository
        const world = toWorldNumbers(position)

        if (world.y < CHUNK_MIN_Y || world.y > CHUNK_MAX_Y) {
          return yield* Effect.fail(
            ChunkBoundsError({
              message: `Y座標がチャンク範囲外です: ${world.y}`,
              coordinates: world,
            })
          )
        }

        const context = yield* resolveChunkContext(repository, world).pipe(
          Effect.mapError((error) =>
            error._tag === 'ChunkBoundsError' ? error : mapPositionErrorToBounds(error, world)
          )
        )

        const blockIndex = computeBlockIndex(context.localX, context.localY, context.localZ)
        const updatedBlocks = new Uint16Array(context.chunk.blocks)
        updatedBlocks[blockIndex] = Number(blockData)

        const timestamp = yield* Clock.currentTimeMillis
        const updatedChunk: ChunkData = {
          ...context.chunk,
          blocks: updatedBlocks,
          metadata: {
            ...context.chunk.metadata,
            isModified: true,
            lastUpdate: timestamp,
          },
          isDirty: true,
        }

        yield* repository
          .save(updatedChunk)
          .pipe(Effect.mapError((error) => toChunkBoundsErrorFromRepository(error, world)))
      }),

    chunkToWorldCoordinates: (
      chunkPos: ChunkPosition
    ): Effect.Effect<
      {
        readonly x: WorldCoordinate
        readonly y: WorldCoordinate
        readonly z: WorldCoordinate
      },
      ChunkPositionError
    > =>
      Effect.gen(function* () {
        const origin = chunkToWorldPosition(chunkPos)
        return {
          x: makeUnsafeWorldX(origin.x),
          y: makeUnsafeWorldY(CHUNK_MIN_Y),
          z: makeUnsafeWorldZ(origin.z),
        }
      }),

    worldToChunkCoordinates: (worldPos: {
      readonly x: WorldCoordinate
      readonly y: WorldCoordinate
      readonly z: WorldCoordinate
    }): Effect.Effect<ChunkPosition, ChunkPositionError> =>
      Effect.gen(function* () {
        const world = toWorldNumbers(worldPos)
        return yield* createChunkPosition(Math.floor(world.x / CHUNK_SIZE), Math.floor(world.z / CHUNK_SIZE))
      }),
  }) satisfies ChunkDataProvider
)
