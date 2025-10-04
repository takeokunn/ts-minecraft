import { Schema } from '@effect/schema'
import { Brand, Data, Effect, Option, pipe } from 'effect'

/**
 * チャンク座標の値オブジェクト
 */
export type ChunkX = number & Brand.Brand<'ChunkX'>
export const ChunkX = Brand.refined<ChunkX>(
  (value): value is ChunkX => Number.isInteger(value),
  (value) => Brand.error(`整数値が必要です: ${value}`)
)

export type ChunkZ = number & Brand.Brand<'ChunkZ'>
export const ChunkZ = Brand.refined<ChunkZ>(
  (value): value is ChunkZ => Number.isInteger(value),
  (value) => Brand.error(`整数値が必要です: ${value}`)
)

const integerCoordinate = Schema.Number.pipe(
  Schema.int(),
  Schema.brand('ChunkCoordinate')
)

/**
 * チャンク座標のスキーマ定義
 */
export const ChunkPositionSchema = Schema.Struct({
  x: integerCoordinate,
  z: integerCoordinate,
}).pipe(Schema.brand('ChunkPosition'))

export type ChunkPosition = Schema.Schema.Type<typeof ChunkPositionSchema>

/**
 * チャンク座標エラー型（ADT）
 */
export interface ChunkPositionError {
  readonly _tag: 'ChunkPositionError'
  readonly message: string
  readonly details?: {
    readonly x?: number
    readonly z?: number
  }
  readonly cause?: unknown
}

export const ChunkPositionError = Data.tagged<ChunkPositionError>('ChunkPositionError')

/**
 * チャンク距離の値オブジェクト
 */
export type ChunkDistance = number & Brand.Brand<'ChunkDistance'>
export const ChunkDistance = Brand.refined<ChunkDistance>(
  (value): value is ChunkDistance => Number.isFinite(value) && value >= 0,
  (value) => Brand.error(`非負の有限実数が必要です: ${value}`)
)

/**
 * チャンクハッシュの値オブジェクト
 */
export type ChunkHash = string & Brand.Brand<'ChunkHash'>
export const ChunkHash = Brand.nominal<ChunkHash>()

const hashDelimiter = ':'

/**
 * チャンク座標ファクトリ
 */
export const createChunkPosition = (x: number, z: number): Effect.Effect<ChunkPosition, ChunkPositionError> =>
  pipe(
    Schema.decodeEffect(ChunkPositionSchema)({ x, z }),
    Effect.mapError((issue) =>
      ChunkPositionError({
        message: 'チャンク座標の構築に失敗しました',
        details: { x, z },
        cause: issue,
      })
    )
  )

/**
 * チャンク座標を同期的に生成
 */
export const createChunkPositionSync = (x: number, z: number): ChunkPosition =>
  Schema.decodeSync(ChunkPositionSchema)({ x, z })

/**
 * ワールド座標からチャンク座標へ変換
 */
export const worldToChunkPosition = (worldX: number, worldZ: number): ChunkPosition =>
  createChunkPositionSync(Math.floor(worldX / 16), Math.floor(worldZ / 16))

/**
 * チャンク座標からワールド座標へ変換
 */
export const chunkToWorldPosition = (
  position: ChunkPosition
): { readonly x: number; readonly z: number } => ({
  x: position.x * 16,
  z: position.z * 16,
})

/**
 * チャンク距離を計算
 */
export const calculateChunkDistance = (
  from: ChunkPosition,
  to: ChunkPosition
): ChunkDistance => {
  const dx = to.x - from.x
  const dz = to.z - from.z
  return ChunkDistance(Math.hypot(dx, dz))
}

/**
 * チャンクハッシュを生成
 */
export const getChunkHash = (position: ChunkPosition): ChunkHash =>
  ChunkHash(`${position.x}${hashDelimiter}${position.z}`)

/**
 * チャンクハッシュを解析
 */
export const parseChunkHash = (hash: string): Effect.Effect<ChunkPosition, ChunkPositionError> =>
  pipe(
    Option.fromNullable(hash.split(hashDelimiter)),
    Option.filter((parts) => parts.length === 2),
    Option.flatMap((parts) =>
      pipe(
        Effect.tuple(
          Schema.decodeEffect(Schema.NumberFromString)(parts[0]!),
          Schema.decodeEffect(Schema.NumberFromString)(parts[1]!)
        ),
        Effect.map(([xValue, zValue]) => ({ x: xValue, z: zValue })),
        Effect.option
      )
    ),
    Effect.fromOption(() =>
      ChunkPositionError({
        message: `チャンクハッシュの解析に失敗しました: ${hash}`,
      })
    ),
    Effect.flatMap((coords) => createChunkPosition(coords.x, coords.z))
  )
