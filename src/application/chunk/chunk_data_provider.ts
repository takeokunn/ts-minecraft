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
import { ChunkCacheServiceTag, type ChunkCacheService } from '@/infrastructure/chunk'

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
  pipe(
    repository.findById(id),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(onMissing()),
        onSome: Effect.succeed,
      })
    )
  )

const resolveChunkContext = (
  repository: ChunkRepositoryService,
  cacheOption: Option.Option<ChunkCacheService>,
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

    const chunkOption = yield* pipe(
      cacheOption,
      Option.match({
        onNone: () => repository.findByPosition(chunkPosition),
        onSome: (cache) =>
          Effect.gen(function* () {
            const cached = yield* cache.get(chunkPosition)
            return yield* Option.match(cached, {
              onSome: (chunk) => Effect.succeed(Option.some(chunk)),
              onNone: () =>
                Effect.gen(function* () {
                  const fetched = yield* repository.findByPosition(chunkPosition)
                  yield* Option.match(fetched, {
                    onNone: () => Effect.void,
                    onSome: (chunk) => cache.set(chunk),
                  })
                  return fetched
                }),
            })
          }),
      })
    )

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

    yield* pipe(
      Match.value(localX >= 0 && localX < CHUNK_SIZE && localZ >= 0 && localZ < CHUNK_SIZE),
      Match.when(false, () =>
        Effect.fail(
          ChunkBoundsError({
            message: `ワールド座標がチャンク範囲外です (${world.x}, ${world.y}, ${world.z})`,
            coordinates: world,
          })
        )
      ),
      Match.exhaustive
    )

    yield* pipe(
      Match.value(localY >= 0 && localY < CHUNK_HEIGHT),
      Match.when(false, () =>
        Effect.fail(
          ChunkBoundsError({
            message: `Y座標がチャンク範囲外です: ${world.y}`,
            coordinates: world,
          })
        )
      ),
      Match.exhaustive
    )

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
        const cacheOption = yield* Effect.serviceOption(ChunkCacheServiceTag)
        const chunkData = yield* findChunkDataById(repository, id, () =>
          ChunkIdError.make({
            message: `チャンクが見つかりません: ${id}`,
            value: id,
          })
        )
        yield* Option.match(cacheOption, {
          onNone: () => Effect.void,
          onSome: (cache) => cache.set(chunkData),
        })

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
        const cacheOption = yield* Effect.serviceOption(ChunkCacheServiceTag)
        return yield* findChunkDataById(repository, id, () =>
          ChunkDataValidationError({
            message: `チャンクが存在しません: ${id}`,
            field: 'chunkId',
            value: id,
          })
        ).pipe(
          Effect.tap((chunk) =>
            Option.match(cacheOption, {
              onNone: () => Effect.void,
              onSome: (cache) => cache.set(chunk),
            })
          )
        )
      }),

    validateChunk: (chunk: ChunkAggregate): Effect.Effect<void, ChunkDataValidationError> =>
      Effect.gen(function* () {
        const validationServiceOption = yield* Effect.serviceOption(ChunkValidationService)

        return yield* Option.match(validationServiceOption, {
          onSome: (service) =>
            service.validateChunkAggregate(chunk).pipe(
              Effect.mapError(() =>
                ChunkDataValidationError({
                  message: 'チャンク検証に失敗しました',
                  field: 'aggregate',
                  value: chunk.id,
                })
              )
            ),
          onNone: () =>
            pipe(
              Match.value(chunk.data.blocks.length === EXPECTED_BLOCK_COUNT),
              Match.when(true, () => Effect.void),
              Match.orElse(() =>
                Effect.fail(
                  ChunkDataValidationError({
                    message: `チャンクデータサイズが不正です: ${chunk.data.blocks.length}`,
                    field: 'blocks',
                    value: chunk.id,
                  })
                )
              ),
              Match.exhaustive
            )
        })
      }),

    getBlock: (position: {
      readonly x: WorldCoordinate
      readonly y: WorldCoordinate
      readonly z: WorldCoordinate
    }): Effect.Effect<BlockData, ChunkBoundsError> =>
      Effect.gen(function* () {
        const repository = yield* ChunkRepository
        const cacheOption = yield* Effect.serviceOption(ChunkCacheServiceTag)
        const world = toWorldNumbers(position)

        yield* pipe(
          Match.value(world.y >= CHUNK_MIN_Y && world.y <= CHUNK_MAX_Y),
          Match.when(false, () =>
            Effect.fail(
              ChunkBoundsError({
                message: `Y座標がチャンク範囲外です: ${world.y}`,
                coordinates: world,
              })
            )
          ),
          Match.exhaustive
        )

        const context = yield* resolveChunkContext(repository, cacheOption, world).pipe(
          Effect.mapError((error) =>
            error._tag === 'ChunkBoundsError' ? error : mapPositionErrorToBounds(error, world)
          )
        )

        const blockIndex = computeBlockIndex(context.localX, context.localY, context.localZ)
        const blockValue = context.chunk.blocks[blockIndex] ?? 0

        yield* pipe(
          Match.value(blockValue >= 0 && blockValue <= 15),
          Match.when(false, () =>
            Effect.fail(
              ChunkBoundsError({
                message: `ブロックデータが範囲外です: ${blockValue}`,
                coordinates: world,
              })
            )
          ),
          Match.exhaustive
        )

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
        const cacheOption = yield* Effect.serviceOption(ChunkCacheServiceTag)
        const world = toWorldNumbers(position)

        yield* pipe(
          Match.value(world.y >= CHUNK_MIN_Y && world.y <= CHUNK_MAX_Y),
          Match.when(false, () =>
            Effect.fail(
              ChunkBoundsError({
                message: `Y座標がチャンク範囲外です: ${world.y}`,
                coordinates: world,
              })
            )
          ),
          Match.exhaustive
        )

        const context = yield* resolveChunkContext(repository, cacheOption, world).pipe(
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
          .pipe(
            Effect.tap((saved) =>
              Option.match(cacheOption, {
                onNone: () => Effect.void,
                onSome: (cache) => cache.set(saved),
              })
            ),
            Effect.mapError((error) => toChunkBoundsErrorFromRepository(error, world))
          )
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
