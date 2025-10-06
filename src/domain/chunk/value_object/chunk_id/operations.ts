import { Clock, Effect, Match, Option, Random, Schema, pipe } from 'effect'
import { createChunkPosition, type ChunkPosition } from '../chunk_position'
import {
  ChunkIdError,
  ChunkIdSchema,
  ChunkId as MakeChunkId,
  ChunkIdVersion as MakeChunkIdVersion,
  type ChunkId,
  type ChunkIdVersion,
  type ChunkUUID,
} from './index'

const chunkPrefix = 'chunk'
const chunkUuidPrefix = `${chunkPrefix}_uuid`
const chunkVersionPrefix = `${chunkPrefix}_v`

const invalidIdError = (message: string, value?: unknown) =>
  ChunkIdError({
    message,
    value,
  })

const ensurePositiveVersion = (version: ChunkIdVersion) =>
  Effect.filterOrFail(
    Effect.succeed(version),
    (value) => value >= 1,
    (value) => invalidIdError(`チャンクIDバージョンは1以上である必要があります: ${value}`, value)
  )

/**
 * チャンク座標からIDを生成
 */
export const createChunkIdFromPosition = (
  position: ChunkPosition,
  version: ChunkIdVersion = MakeChunkIdVersion(1)
): Effect.Effect<ChunkId, ChunkIdError> =>
  pipe(
    ensurePositiveVersion(version),
    Effect.zipRight(Effect.succeed(MakeChunkId(`${chunkVersionPrefix}${version}_${position.x}_${position.z}`)))
  )

/**
 * UUIDベースのチャンクIDを生成
 */
export const createChunkIdFromUUID = (uuid: ChunkUUID): Effect.Effect<ChunkId, ChunkIdError> =>
  Effect.succeed(MakeChunkId(`${chunkUuidPrefix}_${uuid}`))

/**
 * ランダムなチャンクIDを生成
 */
export const generateRandomChunkId = (): Effect.Effect<ChunkId, ChunkIdError> =>
  Effect.gen(function* () {
    const randomBytes = yield* Random.nextIntBetween(100_000, 999_999)
    const timestamp = yield* Clock.currentTimeMillis
    return MakeChunkId(`${chunkPrefix}_${timestamp}_${randomBytes}`)
  })

/**
 * チャンクIDの検証
 */
export const validateChunkId = (value: unknown): Effect.Effect<ChunkId, ChunkIdError> =>
  pipe(
    Schema.decode(ChunkIdSchema)(value),
    Effect.map(MakeChunkId),
    Effect.mapError((error) => invalidIdError(`チャンクIDの検証に失敗しました: ${String(error)}`, value))
  )

/**
 * チャンクIDからタイプを判定
 */
export const getChunkIdType = (chunkId: ChunkId): 'versioned' | 'uuid' | 'timestamped' | 'unknown' =>
  pipe(
    chunkId,
    Match.value,
    Match.when(
      (id) => id.startsWith(chunkVersionPrefix),
      () => 'versioned' as const
    ),
    Match.when(
      (id) => id.startsWith(chunkUuidPrefix),
      () => 'uuid' as const
    ),
    Match.when(
      (id) => id.includes('_'),
      () => 'timestamped' as const
    ),
    Match.orElse(() => 'unknown' as const)
  )

/**
 * バージョン付きチャンクIDから座標を抽出
 */
export const extractPositionFromVersionedId = (chunkId: ChunkId): Effect.Effect<ChunkPosition, ChunkIdError> =>
  pipe(
    Option.fromNullable(chunkId.split('_')),
    Option.filter((parts) => parts.length >= 4 && parts[0] === chunkPrefix && parts[1]?.startsWith('v')),
    Option.flatMap((parts) =>
      pipe(
        Effect.tuple(
          Schema.decode(Schema.NumberFromString)(parts[2]!),
          Schema.decode(Schema.NumberFromString)(parts[3]!)
        ),
        Effect.option
      )
    ),
    Effect.fromOption(() => invalidIdError(`バージョン付きチャンクIDの解析に失敗しました: ${chunkId}`, chunkId)),
    Effect.flatMap(([x, z]) => createChunkPosition(x, z))
  )

/**
 * チャンクIDから名前空間を抽出
 */
export const extractNamespace = (chunkId: ChunkId): string => chunkId.split('_')[0] ?? chunkPrefix

/**
 * チャンクIDを正規化
 */
export const normalizeChunkId = (chunkId: ChunkId): ChunkId => MakeChunkId(chunkId.toLowerCase().trim())

/**
 * チャンクIDの短縮形を生成
 */
export const createShortChunkId = (chunkId: ChunkId, length: number = 8): string => {
  const normalizedLength = Math.max(1, length)
  const hash = Array.from(chunkId).reduce((accumulator, char) => {
    const computed = (accumulator << 5) - accumulator + char.charCodeAt(0)
    return computed | 0
  }, 0)
  return Math.abs(hash).toString(36).slice(0, normalizedLength)
}

/**
 * チャンクIDの階層を生成（ディレクトリ構造用）
 */
export const createChunkIdHierarchy = (chunkId: ChunkId, depth: number = 2): ReadonlyArray<string> =>
  Array.from({ length: Math.max(0, depth) }, (_, index) => chunkId.slice(index * 2, index * 2 + 2)).filter(
    (segment) => segment.length > 0
  )

/**
 * チャンクIDのバッチ検証
 */
export const validateChunkIds = (values: ReadonlyArray<unknown>): Effect.Effect<ReadonlyArray<ChunkId>, ChunkIdError> =>
  Effect.forEach(values, validateChunkId, {
    concurrency: 'unbounded',
  })
