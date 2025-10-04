/**
 * Camera State Repository - Module Export
 *
 * Camera状態永続化Repository層の統合エクスポート
 * Effect-TSパターンに準拠したRepository抽象化
 */

// ========================================
// Repository Interface & Context
// ========================================

export type {
  CameraRepositoryStatistics,
  CameraStateRepository,
  RepositoryListResult,
  RepositoryOperationResult,
  RepositoryQueryResult,
} from './service.js'

export { CameraStateRepository, CameraStateRepositoryOps } from './service.js'

// ========================================
// Repository Types
// ========================================

export type {
  Camera,
  CameraSnapshot,
  CameraStateQueryOptions,
  PlayerId,
  RepositoryError,
  SnapshotTimestamp,
  VersionNumber,
} from './types.js'

export {
  CameraSchema,
  // Schema definitions
  CameraSnapshotSchema,
  CameraStateQueryOptionsSchema,
  PlayerIdSchema,
  RepositoryErrorSchema,
  SnapshotTimestampSchema,
  VersionNumberSchema,
  // Error factory functions
  createRepositoryError,
  isDecodingError,
  isEncodingError,
  // Type guards
  isEntityNotFoundError,
  isStorageError,
  isValidationError,
} from './types.js'

// ========================================
// Live Implementation
// ========================================

export { CameraStateRepositoryLive } from './live.js'

// ========================================
// Module Integration Utilities
// ========================================

/**
 * Repository モジュール情報
 */
export const CameraStateRepositoryModule = {
  name: 'CameraStateRepository',
  version: '1.0.0',
  description: 'Camera状態永続化Repository',
  provides: ['CameraStateRepository'] as const,
  dependencies: [] as const,
} as const

/**
 * Repository 操作のタイプセーフティユーティリティ
 */
export const RepositoryTypeGuards = {
  isCameraStateRepository: (value: unknown): value is CameraStateRepository => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'save' in value &&
      'findById' in value &&
      'findByPlayerId' in value &&
      'saveSnapshot' in value &&
      'loadSnapshot' in value &&
      'delete' in value &&
      'listActive' in value &&
      'cleanup' in value
    )
  },
} as const

// ========================================
// Re-export for Convenience
// ========================================

/**
 * Repository層で頻繁に使用される型の便利エクスポート
 */
export type { CameraId } from '../../types/index.js'
export type { ViewMode } from '../../value_object/index.js'

// ========================================
// Documentation Export
// ========================================

/**
 * Camera State Repository Documentation
 *
 * ## 概要
 * Camera状態の永続化・復元・管理を抽象化するRepository層の実装
 *
 * ## 設計原則
 * - Effect-TSのContext.GenericTagによる依存性注入
 * - Brand型とSchema検証による型安全性
 * - インメモリ実装によるドメイン層での技術的関心事の分離
 * - 関数型プログラミングによる副作用の明示的管理
 *
 * ## 使用例
 * ```typescript
 * import { CameraStateRepository, CameraStateRepositoryLive } from './camera_state'
 * import { Effect, Layer } from 'effect'
 *
 * // Repository使用
 * const saveCamera = (camera: Camera) =>
 *   Effect.gen(function* () {
 *     const repo = yield* CameraStateRepository
 *     yield* repo.save(camera)
 *   })
 *
 * // Layer提供
 * const program = saveCamera(myCamera).pipe(
 *   Effect.provide(CameraStateRepositoryLive)
 * )
 * ```
 *
 * ## Repository Method一覧
 * - `save`: Cameraエンティティ保存
 * - `findById`: ID検索
 * - `findByPlayerId`: プレイヤーID検索
 * - `saveSnapshot`: スナップショット保存
 * - `loadSnapshot`: スナップショット読み込み
 * - `delete`: Camera削除
 * - `listActive`: アクティブCamera一覧
 * - `cleanup`: 期限切れデータクリーンアップ
 * - `getHistory`: 履歴取得
 * - `saveBatch`: 一括保存
 * - `getStatistics`: 統計情報取得
 * - `exists`: 存在確認
 * - `getLatestSnapshotVersion`: 最新バージョン取得
 * - `getSnapshotByVersion`: バージョン指定取得
 */
export const CameraStateRepositoryDocs = {
  overview: 'Camera状態永続化Repository',
  version: '1.0.0',
  lastUpdated: '2025-01-XX',
  maintainer: 'Camera Domain Team',
} as const
