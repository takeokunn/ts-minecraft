import { Effect, Match, Schema, pipe } from 'effect'
import { ChunkIdError } from './errors'
import { ChunkIdSchema, type ChunkId } from './schema'

/**
 * バリデーション付きChunkId生成
 */
export const make = (value: string): Effect.Effect<ChunkId, ChunkIdError> =>
  Schema.decode(ChunkIdSchema)(value).pipe(
    Effect.mapError((error) =>
      ChunkIdError.make({
        message: 'Invalid chunk ID format',
        value,
        cause: error,
      })
    )
  )

/**
 * 検証なしChunkId生成（パフォーマンス最適化用）
 */
export const makeUnsafe = (value: string): ChunkId => value as ChunkId

/**
 * 文字列変換
 */
export const toString = (id: ChunkId): string => id

/**
 * 等価性チェック
 */
export const equals = (a: ChunkId, b: ChunkId): boolean => a === b

/**
 * チャンク座標からChunkIdを生成
 */
export const fromCoordinates = (x: number, z: number): ChunkId => makeUnsafe(`chunk_${x}_${z}`)

/**
 * ChunkIdから座標を抽出
 */
export const toCoordinates = (id: ChunkId): Effect.Effect<{ x: number; z: number }, ChunkIdError> =>
  Effect.gen(function* () {
    const parts = id.split('_')
    yield* pipe(
      Match.value(parts.length === 3 && parts[0] === 'chunk'),
      Match.when(
        (isValidFormat) => !isValidFormat,
        () =>
          Effect.fail(
            ChunkIdError.make({
              message: `Invalid chunk ID format: ${id}`,
              value: id,
            })
          )
      ),
      Match.orElse(() => Effect.void)
    )

    const x = Number.parseInt(parts[1]!, 10)
    const z = Number.parseInt(parts[2]!, 10)

    yield* pipe(
      Match.value(Number.isNaN(x) || Number.isNaN(z)),
      Match.when(
        (hasNaN) => hasNaN,
        () =>
          Effect.fail(
            ChunkIdError.make({
              message: `Invalid coordinates in chunk ID: ${id}`,
              value: id,
            })
          )
      ),
      Match.orElse(() => Effect.void)
    )

    return { x, z }
  })
