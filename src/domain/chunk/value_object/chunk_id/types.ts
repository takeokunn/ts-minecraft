import { Brand } from 'effect'

// ChunkId は共有カーネルから提供されます
// このファイルは後方互換性のためのレガシー型定義のみを含みます

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
