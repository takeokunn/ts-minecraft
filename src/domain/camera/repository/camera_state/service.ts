/**
 * Camera State Repository - Service Interface
 *
 * Camera状態永続化のためのRepository抽象化インターフェース
 * Effect-TSのContext.GenericTagを使用した依存性注入対応
 */

import { Array, Context, Effect, Option } from 'effect'
import type { CameraId } from '@domain/camera/types'
import type { Camera, CameraSnapshot, CameraStateQueryOptions, PlayerId, RepositoryError } from './index'

// ========================================
// Repository Interface
// ========================================

/**
 * Camera State Repository Interface
 *
 * Camera状態の永続化・復元・管理を抽象化するインターフェース
 * Effect-TSの関数型アプローチを採用し、副作用を明示的に管理
 */
export interface CameraStateRepository {
  /**
   * Cameraエンティティを保存
   */
  readonly save: (camera: Camera) => Effect.Effect<void, RepositoryError>

  /**
   * ID によるCamera検索
   */
  readonly findById: (cameraId: CameraId) => Effect.Effect<Option<Camera>, RepositoryError>

  /**
   * プレイヤーID によるCamera検索
   */
  readonly findByPlayerId: (playerId: PlayerId) => Effect.Effect<Option<Camera>, RepositoryError>

  /**
   * Cameraスナップショットを保存
   */
  readonly saveSnapshot: (cameraId: CameraId, snapshot: CameraSnapshot) => Effect.Effect<void, RepositoryError>

  /**
   * Cameraスナップショットを読み込み
   */
  readonly loadSnapshot: (cameraId: CameraId) => Effect.Effect<Option<CameraSnapshot>, RepositoryError>

  /**
   * Camera削除
   */
  readonly delete: (cameraId: CameraId) => Effect.Effect<void, RepositoryError>

  /**
   * アクティブなCamera ID一覧を取得
   */
  readonly listActive: () => Effect.Effect<Array.ReadonlyArray<CameraId>, RepositoryError>

  /**
   * 期限切れCamera のクリーンアップ
   *
   * @param olderThan 指定日時より古いカメラを削除
   * @returns 削除されたCamera数
   */
  readonly cleanup: (olderThan: Date) => Effect.Effect<number, RepositoryError>

  /**
   * Camera状態履歴を取得（オプション指定付き）
   */
  readonly getHistory: (
    cameraId: CameraId,
    options: CameraStateQueryOptions
  ) => Effect.Effect<Array.ReadonlyArray<CameraSnapshot>, RepositoryError>

  /**
   * 複数Cameraの一括保存
   */
  readonly saveBatch: (cameras: Array.ReadonlyArray<Camera>) => Effect.Effect<void, RepositoryError>

  /**
   * Camera統計情報を取得
   */
  readonly getStatistics: () => Effect.Effect<CameraRepositoryStatistics, RepositoryError>

  /**
   * Camera存在確認
   */
  readonly exists: (cameraId: CameraId) => Effect.Effect<boolean, RepositoryError>

  /**
   * Snapshot バージョン管理
   */
  readonly getLatestSnapshotVersion: (cameraId: CameraId) => Effect.Effect<Option<number>, RepositoryError>

  /**
   * 特定バージョンのSnapshot取得
   */
  readonly getSnapshotByVersion: (
    cameraId: CameraId,
    version: number
  ) => Effect.Effect<Option<CameraSnapshot>, RepositoryError>
}

// ========================================
// Statistics Type
// ========================================

/**
 * Camera Repository Statistics
 */
export interface CameraRepositoryStatistics {
  readonly totalCameras: number
  readonly activeCameras: number
  readonly inactiveCameras: number
  readonly totalSnapshots: number
  readonly averageSnapshotsPerCamera: number
  readonly oldestSnapshotTimestamp: Option<number>
  readonly newestSnapshotTimestamp: Option<number>
  readonly storageUsageBytes: number
}

// ========================================
// Context Tag Definition
// ========================================

/**
 * Camera State Repository Context Tag
 *
 * Effect-TSの依存性注入システムで使用される識別子
 */
export const CameraStateRepository = Context.GenericTag<CameraStateRepository>(
  '@minecraft/domain/camera/CameraStateRepository'
)

// ========================================
// Repository Access Helpers
// ========================================

/**
 * Repository操作のヘルパー関数群
 */
export const CameraStateRepositoryOps = {
  /**
   * Camera保存の安全な実行
   */
  safeSave: (camera: Camera) =>
    Effect.gen(function* () {
      const repository = yield* CameraStateRepository
      yield* repository.save(camera)
    }),

  /**
   * Camera検索の安全な実行
   */
  safeFind: (cameraId: CameraId) =>
    Effect.gen(function* () {
      const repository = yield* CameraStateRepository
      return yield* repository.findById(cameraId)
    }),

  /**
   * Camera存在確認の安全な実行
   */
  safeExists: (cameraId: CameraId) =>
    Effect.gen(function* () {
      const repository = yield* CameraStateRepository
      return yield* repository.exists(cameraId)
    }),

  /**
   * アクティブCamera一覧の安全な取得
   */
  safeListActive: () =>
    Effect.gen(function* () {
      const repository = yield* CameraStateRepository
      return yield* repository.listActive()
    }),

  /**
   * 統計情報の安全な取得
   */
  safeGetStatistics: () =>
    Effect.gen(function* () {
      const repository = yield* CameraStateRepository
      return yield* repository.getStatistics()
    }),
} as const

// ========================================
// Repository Method Types (for type safety)
// ========================================

/**
 * Repository method signatures for compile-time verification
 */
export type CameraStateRepositoryMethods = {
  [K in keyof CameraStateRepository]: CameraStateRepository[K]
}

/**
 * Repository operation result types
 */
export type RepositoryOperationResult<T> = Effect.Effect<T, RepositoryError>

/**
 * Repository query result types
 */
export type RepositoryQueryResult<T> = Effect.Effect<Option<T>, RepositoryError>

/**
 * Repository list result types
 */
export type RepositoryListResult<T> = Effect.Effect<Array.ReadonlyArray<T>, RepositoryError>

// ========================================
// Export Types for Consumer Modules
// ========================================

export type { Camera, CameraSnapshot, CameraStateQueryOptions, PlayerId, RepositoryError } from './index'
