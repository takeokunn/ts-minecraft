import { Clock, Context, Effect, Layer, Match, Option, Schema, pipe } from 'effect'
import {
  type ChunkAggregate,
  ChunkBoundsError,
  ChunkSerializationError,
  type ChunkData,
  createChunkAggregate,
} from '../../aggregate/chunk'
import { ChunkDataValidationError } from '../../aggregate/chunk_data'
import { ChunkMetadataSchema } from '../../value_object/chunk_metadata/types'
import { ChunkPositionSchema } from '../../value_object/chunk_position/types'
import {
  ChunkOptimizationService,
  ChunkSerializationService,
  ChunkValidationService,
  type SerializationFormat,
} from '../../domain_service'

export interface ChunkFactoryService {
  readonly createValidatedChunk: (
    position: Schema.Schema.Input<typeof ChunkPositionSchema>,
    blocks: Uint16Array,
    metadata: Schema.Schema.Input<typeof ChunkMetadataSchema>
  ) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly createOptimizedChunk: (
    position: Schema.Schema.Input<typeof ChunkPositionSchema>,
    blocks: Uint16Array,
    metadata: Schema.Schema.Input<typeof ChunkMetadataSchema>
  ) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly createEmptyChunk: (
    position: Schema.Schema.Input<typeof ChunkPositionSchema>,
    fillBlockId?: number
  ) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly createChunkFromSerialized: (
    serializedData: Uint8Array,
    format: SerializationFormat
  ) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly cloneChunk: (
    original: ChunkData,
    options?: { readonly validate?: boolean; readonly optimize?: boolean }
  ) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly createChunkAggregate: (chunkData: ChunkData) => Effect.Effect<ChunkAggregate, ChunkBoundsError | ChunkDataValidationError | ChunkSerializationError>
  readonly createBatchChunks: (
    specifications: ReadonlyArray<{
      readonly position: Schema.Schema.Input<typeof ChunkPositionSchema>
      readonly blocks?: Uint16Array
      readonly metadata?: Schema.Schema.Input<typeof ChunkMetadataSchema>
      readonly fillBlockId?: number
    }>
  ) => Effect.Effect<ReadonlyArray<ChunkData>, ChunkDataValidationError>
}

export const ChunkFactoryService = Context.GenericTag<ChunkFactoryService>('ChunkFactoryService')

const CHUNK_SIZE = 16
const CHUNK_HEIGHT = 384
const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
const DEFAULT_HEIGHT = 0

const decodePosition = (input: Schema.Schema.Input<typeof ChunkPositionSchema>) =>
  Schema.decodeEffect(ChunkPositionSchema)(input)

const decodeMetadata = (input: Schema.Schema.Input<typeof ChunkMetadataSchema>) =>
  Schema.decodeEffect(ChunkMetadataSchema)(input)

const ensureIntegrity = (validation: ChunkValidationService, chunk: ChunkData) =>
  pipe(
    validation.validateIntegrity(chunk),
    Effect.filterOrFail(
      (isValid) => isValid,
      () =>
        ChunkDataValidationError({
          message: 'チャンクの整合性検証に失敗しました',
          value: chunk,
        })
    )
  )

const newBlocks = (fill: number) => Effect.sync(() => {
  const blocks = new Uint16Array(CHUNK_VOLUME)
  blocks.fill(fill)
  return blocks
})

const withTimestamp = (
  metadata: Schema.Schema.Input<typeof ChunkMetadataSchema>,
  timestamp: number
) => ({
  ...metadata,
  lastUpdate: timestamp,
})

export const ChunkFactoryServiceLive = Layer.effect(
  ChunkFactoryService,
  Effect.gen(function* () {
    const validation = yield* ChunkValidationService
    const optimization = yield* ChunkOptimizationService
    const serialization = yield* ChunkSerializationService

    const service: ChunkFactoryService = {
      createValidatedChunk: (position, blocks, metadata) =>
        Effect.gen(function* () {
          const decodedPosition = yield* decodePosition(position)
          const decodedBlocks = yield* validation.validateData(blocks)
          const timestamp = yield* Clock.currentTimeMillis
          const decodedMetadata = yield* decodeMetadata(withTimestamp(metadata, timestamp))

          const chunkData: ChunkData = {
            position: decodedPosition,
            blocks: decodedBlocks,
            metadata: decodedMetadata,
            isDirty: true,
          }

          yield* ensureIntegrity(validation, chunkData)
          return chunkData
        }),

      createOptimizedChunk: (position, blocks, metadata) =>
        pipe(
          service.createValidatedChunk(position, blocks, metadata),
          Effect.flatMap((validated) => optimization.optimizeMemory(validated)),
          Effect.flatMap((optimized) => optimization.eliminateRedundancy(optimized, 0.7))
        ),

      createEmptyChunk: (position, fillBlockId = 0) =>
        Effect.gen(function* () {
          const decodedPosition = yield* decodePosition(position)
          const timestamp = yield* Clock.currentTimeMillis
          const blocks = yield* newBlocks(fillBlockId)
          const metadata = yield* decodeMetadata({
            biome: 'plains',
            lightLevel: 15,
            isModified: false,
            lastUpdate: timestamp,
            heightMap: Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => DEFAULT_HEIGHT),
          })

          const chunkData: ChunkData = {
            position: decodedPosition,
            blocks,
            metadata,
            isDirty: false,
          }

          yield* ensureIntegrity(validation, chunkData)
          return chunkData
        }),

      createChunkFromSerialized: (serializedData, format) =>
        pipe(
          serialization.deserialize(serializedData, format),
          Effect.mapError((error) =>
            ChunkDataValidationError({
              message: 'シリアライズデータの復元に失敗しました',
              value: error,
            })
          ),
          Effect.tap((chunk) => ensureIntegrity(validation, chunk))
        ),

      cloneChunk: (original, options = {}) =>
        Effect.gen(function* () {
          const timestamp = yield* Clock.currentTimeMillis
          const cloned: ChunkData = {
            position: { ...original.position },
            blocks: new Uint16Array(original.blocks),
            metadata: {
              ...original.metadata,
              isModified: true,
              lastUpdate: timestamp,
            },
            isDirty: true,
          }

          const shouldValidate = Option.fromNullable(options.validate).pipe(
            Option.map(Boolean),
            Option.getOrElse(() => true)
          )

          const shouldOptimize = Option.fromNullable(options.optimize).pipe(
            Option.map(Boolean),
            Option.getOrElse(() => false)
          )

          yield* pipe(
            shouldValidate,
            Match.value,
            Match.when(true, () => ensureIntegrity(validation, cloned)),
            Match.orElse(() => Effect.unit)
          )

          return yield* pipe(
            shouldOptimize,
            Match.value,
            Match.when(true, () => optimization.optimizeMemory(cloned)),
            Match.orElse(() => Effect.succeed(cloned))
          )
        }),

      createChunkAggregate: (chunkData) =>
        pipe(
          ensureIntegrity(validation, chunkData),
          Effect.flatMap(() => createChunkAggregate(chunkData))
        ),

      createBatchChunks: (specifications) =>
        Effect.forEach(specifications, (spec) =>
          Effect.gen(function* () {
            const blocks = yield* pipe(
              Option.fromNullable(spec.blocks),
              Option.match({
                onSome: Effect.succeed,
                onNone: () =>
                  Effect.sync(() => {
                    const filled = new Uint16Array(CHUNK_VOLUME)
                    filled.fill(spec.fillBlockId ?? 0)
                    return filled
                  }),
              })
            )

            const metadataInput = Option.fromNullable(spec.metadata).pipe(
              Option.getOrElse(() => ({
                biome: 'plains',
                lightLevel: 15,
                isModified: false,
                lastUpdate: 0,
                heightMap: Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => DEFAULT_HEIGHT),
              }))
            )

            return yield* service.createValidatedChunk(spec.position, blocks, metadataInput)
          })
        ),
    }

    return service
  })
)
