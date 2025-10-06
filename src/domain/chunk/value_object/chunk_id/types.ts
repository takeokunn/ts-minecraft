import { Brand, Data, Schema } from 'effect'

/**
 * チャンクIDの値オブジェクト
 */
export type ChunkId = string & Brand.Brand<'ChunkId'>
export const ChunkId = Brand.refined<ChunkId>(
  (value): value is ChunkId => value.length > 0,
  (value) => Brand.error(`空文字列は許可されていません: ${value}`)
)

/**
 * チャンクIDのスキーマ定義
 */
export const ChunkIdSchema = Schema.String.pipe(Schema.nonEmptyString(), Schema.brand('ChunkId'))

/**
 * チャンクIDエラー型（ADT）
 */
export interface ChunkIdError {
  readonly _tag: 'ChunkIdError'
  readonly message: string
  readonly value?: unknown
}

export const ChunkIdError = Data.tagged<ChunkIdError>('ChunkIdError')

/**
 * チャンクIDバージョンの値オブジェクト
 */
export type ChunkIdVersion = number & Brand.Brand<'ChunkIdVersion'>
export const ChunkIdVersion = Brand.refined<ChunkIdVersion>(
  (value): value is ChunkIdVersion => Number.isInteger(value) && value >= 1,
  (value) => Brand.error(`1以上の整数が必要です: ${value}`)
)

/**
 * チャンクUUIDの値オブジェクト
 */
export type ChunkUUID = string & Brand.Brand<'ChunkUUID'>
export const ChunkUUID = Brand.refined<ChunkUUID>(
  (value): value is ChunkUUID => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value),
  (value) => Brand.error(`UUID形式ではありません: ${value}`)
)
