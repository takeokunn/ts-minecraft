import { Context, Effect, Layer, Match, Option, Schema, pipe } from 'effect'
import { Buffer } from 'node:buffer'
import { brotliCompressSync, brotliDecompressSync, deflateSync, gunzipSync, gzipSync, inflateSync } from 'node:zlib'
import { type ChunkData, ChunkBoundsError, ChunkDataSchema, ChunkSerializationError } from '../../aggregate/chunk'
import { ChunkDataValidationError } from '../../aggregate/chunk_data'
import { ChunkMetadataSchema } from '../../value_object/chunk_metadata'
import { ChunkPositionSchema } from '../../value_object/chunk_position'

export type SerializationFormat =
  | { readonly _tag: 'Binary'; readonly compression?: boolean }
  | { readonly _tag: 'JSON'; readonly pretty?: boolean }
  | { readonly _tag: 'Compressed'; readonly algorithm: 'gzip' | 'deflate' | 'brotli' }

/**
 * JSON形式のChunkData payload Schema
 * deserialize時のJSON.parse結果を検証
 */
const ChunkJsonPayloadSchema = Schema.Struct({
  position: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
  }),
  metadata: Schema.Unknown,
  isDirty: Schema.Boolean,
  blocks: Schema.Array(Schema.Number),
})

export const SerializationFormat = {
  Binary: (options: { readonly compression?: boolean } = {}): SerializationFormat => ({
    _tag: 'Binary',
    ...options,
  }),
  JSON: (options: { readonly pretty?: boolean } = {}): SerializationFormat => ({
    _tag: 'JSON',
    ...options,
  }),
  Compressed: (algorithm: 'gzip' | 'deflate' | 'brotli'): SerializationFormat => ({
    _tag: 'Compressed',
    algorithm,
  }),
}

export interface ChunkSerializationService {
  readonly serialize: (
    chunk: ChunkData,
    format: SerializationFormat
  ) => Effect.Effect<Uint8Array, ChunkSerializationError>
  readonly deserialize: (
    data: Uint8Array,
    format: SerializationFormat
  ) => Effect.Effect<ChunkData, ChunkSerializationError | ChunkDataValidationError | ChunkBoundsError>
  readonly compress: (
    data: Uint8Array,
    algorithm?: 'gzip' | 'deflate' | 'brotli'
  ) => Effect.Effect<Uint8Array, ChunkSerializationError>
  readonly decompress: (
    data: Uint8Array,
    algorithm?: 'gzip' | 'deflate' | 'brotli'
  ) => Effect.Effect<Uint8Array, ChunkSerializationError>
  readonly calculateChecksum: (
    data: Uint8Array,
    algorithm?: 'SHA-256' | 'SHA-1' | 'MD5'
  ) => Effect.Effect<string, ChunkSerializationError>
  readonly estimateSize: (
    chunk: ChunkData,
    format: SerializationFormat
  ) => Effect.Effect<number, ChunkSerializationError | ChunkDataValidationError | ChunkBoundsError>
  readonly validateSerialization: (
    original: ChunkData,
    serialized: Uint8Array,
    format: SerializationFormat
  ) => Effect.Effect<boolean, ChunkSerializationError | ChunkDataValidationError | ChunkBoundsError>
}

export const ChunkSerializationService = Context.GenericTag<ChunkSerializationService>('ChunkSerializationService')

const encodeBinary = (chunk: ChunkData): Effect.Effect<Uint8Array, ChunkSerializationError> =>
  Effect.sync(() => {
    const encoder = new TextEncoder()
    const positionBuffer = new ArrayBuffer(8)
    const positionView = new DataView(positionBuffer)
    positionView.setInt32(0, chunk.position.x, true)
    positionView.setInt32(4, chunk.position.z, true)

    const metadataString = JSON.stringify(chunk.metadata)
    const metadataBytes = encoder.encode(metadataString)
    const metadataLengthBuffer = new ArrayBuffer(4)
    new DataView(metadataLengthBuffer).setUint32(0, metadataBytes.length, true)

    const dirtyFlag = new Uint8Array([chunk.isDirty ? 1 : 0])
    const blocksBytes = new Uint8Array(chunk.blocks.buffer.slice(0))

    const totalLength =
      positionBuffer.byteLength +
      metadataLengthBuffer.byteLength +
      metadataBytes.length +
      dirtyFlag.byteLength +
      blocksBytes.byteLength

    const result = new Uint8Array(totalLength)
    let offset = 0

    result.set(new Uint8Array(positionBuffer), offset)
    offset += positionBuffer.byteLength

    result.set(new Uint8Array(metadataLengthBuffer), offset)
    offset += metadataLengthBuffer.byteLength

    result.set(metadataBytes, offset)
    offset += metadataBytes.length

    result.set(dirtyFlag, offset)
    offset += dirtyFlag.byteLength

    result.set(blocksBytes, offset)

    return result
  })

const decodeBinary = (
  data: Uint8Array
): Effect.Effect<
  {
    readonly position: { readonly x: number; readonly z: number }
    readonly metadata: unknown
    readonly isDirty: boolean
    readonly blocks: Uint16Array
  },
  ChunkSerializationError
> =>
  Effect.gen(function* () {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    const x = view.getInt32(offset, true)
    offset += 4
    const z = view.getInt32(offset, true)
    offset += 4

    const metadataLength = view.getUint32(offset, true)
    offset += 4

    const metadataBytes = data.slice(offset, offset + metadataLength)
    offset += metadataLength

    const metadataJson = new TextDecoder().decode(metadataBytes)
    const metadata = yield* Effect.try({
      try: () => JSON.parse(metadataJson),
      catch: (error) =>
        ChunkSerializationError({
          message: `Binary metadata JSON parse failed: ${String(error)}`,
          originalError: error,
        }),
    }).pipe(
      Effect.flatMap(Schema.decodeUnknown(ChunkMetadataSchema)),
      Effect.mapError((error) =>
        ChunkSerializationError({
          message: `Binary metadata schema validation failed: ${String(error)}`,
          originalError: error,
        })
      )
    )

    const isDirty = view.getUint8(offset) === 1
    offset += 1

    const blocksBytes = data.slice(offset)
    const blocksBuffer = blocksBytes.buffer.slice(
      blocksBytes.byteOffset,
      blocksBytes.byteOffset + blocksBytes.byteLength
    )
    const blocks = new Uint16Array(blocksBuffer)

    return {
      position: { x, z },
      metadata,
      isDirty,
      blocks,
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        ChunkSerializationError({
          message: `Binaryデータの解析に失敗しました: ${String(error)}`,
          originalError: error,
        })
      )
    )
  )

const maybeCompress = (
  data: Uint8Array,
  compression: boolean | undefined,
  algorithm: 'gzip' | 'deflate' | 'brotli',
  compress: ChunkSerializationService['compress']
): Effect.Effect<Uint8Array, ChunkSerializationError> =>
  pipe(
    Option.fromNullable(compression),
    Option.filter((flag) => flag === true),
    Option.match({
      onNone: () => Effect.succeed(data),
      onSome: () => compress(data, algorithm),
    })
  )

const maybeDecompress = (
  data: Uint8Array,
  compression: boolean | undefined,
  algorithm: 'gzip' | 'deflate' | 'brotli',
  decompress: ChunkSerializationService['decompress']
): Effect.Effect<Uint8Array, ChunkSerializationError> =>
  pipe(
    Option.fromNullable(compression),
    Option.filter((flag) => flag === true),
    Option.match({
      onNone: () => Effect.succeed(data),
      onSome: () => decompress(data, algorithm),
    })
  )

const decodeChunk = (payload: {
  readonly position: { readonly x: number; readonly z: number }
  readonly metadata: unknown
  readonly isDirty: boolean
  readonly blocks: Uint16Array
}): Effect.Effect<ChunkData, ChunkDataValidationError | ChunkBoundsError> =>
  Effect.gen(function* () {
    const position = yield* pipe(
      Schema.decodeUnknown(ChunkPositionSchema)(payload.position),
      Effect.mapError((error) =>
        ChunkBoundsError({
          message: `チャンク位置の解析に失敗しました: ${String(error)}`,
          coordinates: {
            x: payload.position.x,
            y: 0,
            z: payload.position.z,
          },
        })
      )
    )

    const metadata = yield* pipe(
      Schema.decodeUnknown(ChunkMetadataSchema)(payload.metadata),
      Effect.mapError((error) =>
        ChunkDataValidationError({
          message: `メタデータの解析に失敗しました: ${String(error)}`,
          field: 'metadata',
          value: payload.metadata,
        })
      )
    )

    const chunk = {
      position,
      metadata,
      isDirty: payload.isDirty,
      blocks: payload.blocks,
    }

    return yield* pipe(
      Schema.decodeUnknown(ChunkDataSchema)(chunk),
      Effect.mapError((error) =>
        ChunkDataValidationError({
          message: `チャンクデータの検証に失敗しました: ${String(error)}`,
          field: 'chunk',
          value: chunk,
        })
      )
    )
  })

const blocksEqual = (left: Uint16Array, right: Uint16Array): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

const metadataEqual = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right)

const chunkEquals = (left: ChunkData, right: ChunkData): boolean =>
  left.position.x === right.position.x &&
  left.position.z === right.position.z &&
  left.isDirty === right.isDirty &&
  metadataEqual(left.metadata, right.metadata) &&
  blocksEqual(left.blocks, right.blocks)

export const ChunkSerializationServiceLive = Layer.effect(
  ChunkSerializationService,
  Effect.sync(() => {
    const service: ChunkSerializationService = {
      serialize: (chunk, format) =>
        Match.value(format).pipe(
          Match.when({ _tag: 'Binary' }, ({ compression }) =>
            pipe(
              encodeBinary(chunk),
              Effect.flatMap((encoded) => maybeCompress(encoded, compression, 'gzip', service.compress))
            )
          ),
          Match.when({ _tag: 'JSON' }, ({ pretty }) =>
            Effect.try({
              try: () => {
                const json = JSON.stringify(
                  {
                    position: chunk.position,
                    metadata: chunk.metadata,
                    isDirty: chunk.isDirty,
                    blocks: Array.from(chunk.blocks),
                  },
                  undefined,
                  pretty ? 2 : undefined
                )
                return new TextEncoder().encode(json)
              },
              catch: (error) =>
                ChunkSerializationError({
                  message: `JSONシリアライゼーションに失敗しました: ${String(error)}`,
                  originalError: error,
                }),
            })
          ),
          Match.when({ _tag: 'Compressed' }, ({ algorithm }) =>
            pipe(
              service.serialize(chunk, SerializationFormat.Binary()),
              Effect.flatMap((binary) => service.compress(binary, algorithm))
            )
          ),
          Match.exhaustive
        ),

      deserialize: (data, format) =>
        Match.value(format).pipe(
          Match.when({ _tag: 'Binary' }, ({ compression }) =>
            pipe(
              maybeDecompress(data, compression, 'gzip', service.decompress),
              Effect.flatMap(decodeBinary),
              Effect.flatMap(decodeChunk)
            )
          ),
          Match.when({ _tag: 'JSON' }, () =>
            pipe(
              Effect.try({
                try: () => new TextDecoder().decode(data),
                catch: (error) =>
                  ChunkSerializationError({
                    message: `JSONデシリアライゼーションに失敗しました: ${String(error)}`,
                    originalError: error,
                  }),
              }),
              Effect.flatMap((json) =>
                Effect.try({
                  try: () => JSON.parse(json),
                  catch: (error) =>
                    ChunkSerializationError({
                      message: `JSONの解析に失敗しました: ${String(error)}`,
                      originalError: error,
                    }),
                }).pipe(
                  Effect.flatMap(Schema.decodeUnknown(ChunkJsonPayloadSchema)),
                  Effect.mapError((error) =>
                    ChunkSerializationError({
                      message: `JSON payload schema validation failed: ${String(error)}`,
                      originalError: error,
                    })
                  )
                )
              ),
              Effect.flatMap((payload) =>
                decodeChunk({
                  position: payload.position,
                  metadata: payload.metadata,
                  isDirty: payload.isDirty,
                  blocks: new Uint16Array(payload.blocks),
                })
              )
            )
          ),
          Match.when({ _tag: 'Compressed' }, ({ algorithm }) =>
            pipe(
              service.decompress(data, algorithm),
              Effect.flatMap((decompressed) => service.deserialize(decompressed, SerializationFormat.Binary()))
            )
          ),
          Match.exhaustive
        ),

      compress: (data, algorithm = 'gzip') =>
        pipe(
          algorithm,
          Match.value,
          Match.when('gzip', () =>
            Effect.try({
              try: () => Uint8Array.from(gzipSync(Buffer.from(data))),
              catch: (error) =>
                ChunkSerializationError({
                  message: `gzip圧縮に失敗しました: ${String(error)}`,
                  originalError: error,
                }),
            })
          ),
          Match.when('deflate', () =>
            Effect.try({
              try: () => Uint8Array.from(deflateSync(Buffer.from(data))),
              catch: (error) =>
                ChunkSerializationError({
                  message: `deflate圧縮に失敗しました: ${String(error)}`,
                  originalError: error,
                }),
            })
          ),
          Match.when('brotli', () =>
            Effect.try({
              try: () => Uint8Array.from(brotliCompressSync(Buffer.from(data))),
              catch: (error) =>
                ChunkSerializationError({
                  message: `brotli圧縮に失敗しました: ${String(error)}`,
                  originalError: error,
                }),
            })
          ),
          Match.orElse((unsupported) =>
            Effect.fail(
              ChunkSerializationError({
                message: `未サポートの圧縮アルゴリズムです: ${unsupported}`,
              })
            )
          )
        ),

      decompress: (data, algorithm = 'gzip') =>
        pipe(
          algorithm,
          Match.value,
          Match.when('gzip', () =>
            Effect.try({
              try: () => Uint8Array.from(gunzipSync(Buffer.from(data))),
              catch: (error) =>
                ChunkSerializationError({
                  message: `gzip解凍に失敗しました: ${String(error)}`,
                  originalError: error,
                }),
            })
          ),
          Match.when('deflate', () =>
            Effect.try({
              try: () => Uint8Array.from(inflateSync(Buffer.from(data))),
              catch: (error) =>
                ChunkSerializationError({
                  message: `deflate解凍に失敗しました: ${String(error)}`,
                  originalError: error,
                }),
            })
          ),
          Match.when('brotli', () =>
            Effect.try({
              try: () => Uint8Array.from(brotliDecompressSync(Buffer.from(data))),
              catch: (error) =>
                ChunkSerializationError({
                  message: `brotli解凍に失敗しました: ${String(error)}`,
                  originalError: error,
                }),
            })
          ),
          Match.orElse((unsupported) =>
            Effect.fail(
              ChunkSerializationError({
                message: `未サポートの圧縮アルゴリズムです: ${unsupported}`,
              })
            )
          )
        ),

      calculateChecksum: (data, algorithm = 'SHA-256') =>
        pipe(
          Effect.tryPromise({
            try: async () => {
              const subtleAlgorithm = algorithm === 'MD5' ? 'SHA-256' : algorithm
              const digest = await crypto.subtle.digest(subtleAlgorithm, data)
              return Array.from(new Uint8Array(digest))
                .map((byte) => byte.toString(16).padStart(2, '0'))
                .join('')
            },
            catch: (error) =>
              ChunkSerializationError({
                message: `チェックサム計算に失敗しました: ${String(error)}`,
                originalError: error,
              }),
          })
        ),

      estimateSize: (chunk, format) =>
        pipe(
          service.serialize(chunk, format),
          Effect.map((serialized) => serialized.byteLength)
        ),

      validateSerialization: (original, serialized, format) =>
        pipe(
          service.deserialize(serialized, format),
          Effect.flatMap((deserialized) =>
            pipe(
              chunkEquals(deserialized, original),
              Match.value,
              Match.when(true, () => Effect.succeed(true)),
              Match.orElse(() =>
                Effect.fail(
                  ChunkSerializationError({
                    message: 'シリアライズ結果がオリジナルと一致しません',
                    originalError: { deserialized, original },
                  })
                )
              )
            )
          )
        ),
    }

    return service
  })
)
