import { Context, Effect, Layer, Match, Schema, pipe } from 'effect'
import {
  type ChunkAggregate,
  ChunkBoundsError,
  type ChunkData,
  ChunkDataSchema,
} from '../../aggregate/chunk'
import { ChunkDataValidationError } from '../../aggregate/chunk_data'
import type { ChunkPosition } from '../../value_object/chunk_position/types'
import {
  type ChunkMetadata,
  ChunkMetadataSchema,
} from '../../value_object/chunk_metadata/types'

export interface ChunkValidationService {
  readonly validatePosition: (position: ChunkPosition) => Effect.Effect<ChunkPosition, ChunkBoundsError>
  readonly validateData: (data: Uint16Array) => Effect.Effect<Uint16Array, ChunkDataValidationError>
  readonly validateMetadata: (metadata: ChunkMetadata) => Effect.Effect<ChunkMetadata, ChunkDataValidationError>
  readonly validateIntegrity: (chunk: ChunkData) => Effect.Effect<boolean, ChunkDataValidationError | ChunkBoundsError>
  readonly validateChecksum: (data: Uint16Array, expectedChecksum: string) => Effect.Effect<boolean, ChunkDataValidationError>
  readonly validateChunkBounds: (x: number, y: number, z: number) => Effect.Effect<boolean, ChunkBoundsError>
  readonly validateChunkAggregate: (aggregate: ChunkAggregate) => Effect.Effect<boolean, ChunkBoundsError | ChunkDataValidationError>
}

export const ChunkValidationService = Context.GenericTag<ChunkValidationService>('ChunkValidationService')

const CHUNK_SIZE = 16
const CHUNK_HEIGHT = 384
const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
const MIN_CHUNK_COORDINATE = -2147483648
const MAX_CHUNK_COORDINATE = 2147483647

const ensureCoordinateInRange = (
  axis: 'x' | 'z',
  value: number,
  position: ChunkPosition,
): Effect.Effect<number, ChunkBoundsError> =>
  pipe(
    Effect.succeed(value),
    Effect.filterOrFail(
      (candidate) => candidate >= MIN_CHUNK_COORDINATE && candidate <= MAX_CHUNK_COORDINATE,
      (candidate) =>
        ChunkBoundsError({
          message: `チャンク${axis.toUpperCase()}座標が範囲外です: ${candidate}`,
          coordinates: {
            x: axis === 'x' ? candidate : position.x,
            y: 0,
            z: axis === 'z' ? candidate : position.z,
          },
        })
    )
  )

const ensureArrayLength = (
  data: Uint16Array,
  expected: number,
): Effect.Effect<Uint16Array, ChunkDataValidationError> =>
  pipe(
    Effect.succeed(data),
    Effect.filterOrFail(
      (candidate) => candidate.length === expected,
      (candidate) =>
        ChunkDataValidationError({
          message: `チャンクデータサイズが不正です。期待値: ${expected}, 実際: ${candidate.length}`,
          field: 'blocks',
          value: candidate,
        })
    )
  )

const ensureChunkCoordinate = (
  coordinate: number,
  min: number,
  max: number,
  axis: 'x' | 'y' | 'z',
  coordinates: { x: number; y: number; z: number },
): Effect.Effect<number, ChunkBoundsError> =>
  pipe(
    Effect.succeed(coordinate),
    Effect.filterOrFail(
      (value) => value >= min && value < max,
      (value) =>
        ChunkBoundsError({
          message: `${axis.toUpperCase()}座標が範囲外です: ${value} (${min}-${max - 1})`,
          coordinates,
        })
    )
  )

const decodeChunkData = Schema.decodeEffect(ChunkDataSchema)
const decodeMetadata = Schema.decodeEffect(ChunkMetadataSchema)

export const ChunkValidationServiceLive = Layer.effect(
  ChunkValidationService,
  Effect.gen(function* () {
    const service: ChunkValidationService = {
      validatePosition: (position) =>
        pipe(
          Effect.Do,
          Effect.tap(() => ensureCoordinateInRange('x', position.x, position)),
          Effect.tap(() => ensureCoordinateInRange('z', position.z, position)),
          Effect.as(position)
        ),

      validateData: (data) =>
        pipe(
          Effect.succeed(data),
          Effect.filterOrFail(
            (candidate): candidate is Uint16Array => candidate instanceof Uint16Array,
            (candidate) =>
              ChunkDataValidationError({
                message: 'チャンクデータはUint16Array型である必要があります',
                field: 'blocks',
                value: candidate,
              })
          ),
          Effect.flatMap((typed) => ensureArrayLength(typed, CHUNK_VOLUME))
        ),

      validateMetadata: (metadata) =>
        pipe(
          decodeMetadata(metadata),
          Effect.mapError((error) =>
            ChunkDataValidationError({
              message: `チャンクメタデータの検証に失敗しました: ${String(error)}`,
              field: 'metadata',
              value: metadata,
            })
          )
        ),

      validateIntegrity: (chunk) =>
        pipe(
          decodeChunkData(chunk),
          Effect.mapError((error) =>
            ChunkDataValidationError({
              message: `チャンクデータのスキーマ検証に失敗しました: ${String(error)}`,
              field: 'chunk',
              value: chunk,
            })
          ),
          Effect.tap(() => service.validatePosition(chunk.position)),
          Effect.tap(() => service.validateData(chunk.blocks)),
          Effect.tap(() => service.validateMetadata(chunk.metadata)),
          Effect.as(true)
        ),

      validateChecksum: (data, expectedChecksum) =>
        pipe(
          Effect.tryPromise({
            try: async () => {
              const hashBuffer = await crypto.subtle.digest('SHA-256', data)
              return Array.from(new Uint8Array(hashBuffer))
                .map((byte) => byte.toString(16).padStart(2, '0'))
                .join('')
            },
            catch: (error) =>
              ChunkDataValidationError({
                message: `チェックサムの計算に失敗しました: ${String(error)}`,
                field: 'checksum',
                value: data,
              }),
          }),
          Effect.flatMap((calculated) =>
            pipe(
              calculated === expectedChecksum,
              Match.value,
              Match.when(true, () => Effect.succeed(true)),
              Match.orElse(() =>
                Effect.fail(
                  ChunkDataValidationError({
                    message: `チェックサムが一致しません。期待値: ${expectedChecksum}, 実際: ${calculated}`,
                    field: 'checksum',
                    value: data,
                  })
                )
              )
            )
          )
        ),

      validateChunkBounds: (x, y, z) =>
        pipe(
          Effect.Do,
          Effect.tap(() => ensureChunkCoordinate(x, 0, CHUNK_SIZE, 'x', { x, y, z })),
          Effect.tap(() => ensureChunkCoordinate(y, CHUNK_MIN_Y, CHUNK_MIN_Y + CHUNK_HEIGHT, 'y', { x, y, z })),
          Effect.tap(() => ensureChunkCoordinate(z, 0, CHUNK_SIZE, 'z', { x, y, z })),
          Effect.as(true)
        ),

      validateChunkAggregate: (aggregate) =>
        pipe(
          Effect.Do,
          Effect.tap(() => service.validatePosition(aggregate.position)),
          Effect.tap(() => service.validateIntegrity(aggregate.data)),
          Effect.as(true)
        ),
    }

    return service
  })
)
