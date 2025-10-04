import { Context, Effect, Option } from 'effect'
import type { ChunkPosition } from '../../value_object/chunk-position'
import type { ChunkData } from '../../aggregate/chunk-data'
import type { ChunkId } from '../../value_object/chunk-id'
import type { RepositoryError } from '../types/repository-error'

/**
 * Chunk Repository Interface
 *
 * チャンクデータの永続化を抽象化するリポジトリインターフェース
 * DDDのRepository Patternを完全実装
 */

// ===== Repository Query Types ===== //

/**
 * チャンク検索条件
 */
export interface ChunkQuery {
  readonly positions?: ReadonlyArray<ChunkPosition>
  readonly region?: {
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
  }
  readonly loadedAfter?: number
  readonly modifiedAfter?: number
  readonly tags?: ReadonlyArray<string>
  readonly limit?: number
  readonly offset?: number
}

/**
 * チャンク統計情報
 */
export interface ChunkStatistics {
  readonly totalChunks: number
  readonly loadedChunks: number
  readonly modifiedChunks: number
  readonly memoryUsage: number
  readonly averageLoadTime: number
  readonly cacheHitRate: number
}

/**
 * チャンク地域定義
 */
export interface ChunkRegion {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

/**
 * バッチ操作結果
 */
export interface BatchOperationResult<T> {
  readonly successful: ReadonlyArray<T>
  readonly failed: ReadonlyArray<{
    readonly item: T
    readonly error: RepositoryError
  }>
}

// ===== Repository Interface ===== //

/**
 * ChunkRepository インターフェース
 *
 * 基盤的なCRUD操作を提供する主要リポジトリ
 */
export interface ChunkRepository {
  // ===== Core CRUD Operations ===== //

  /**
   * チャンクをIDで検索
   */
  readonly findById: (id: ChunkId) => Effect.Effect<Option.Option<ChunkData>, RepositoryError>

  /**
   * チャンクを座標で検索
   */
  readonly findByPosition: (position: ChunkPosition) => Effect.Effect<Option.Option<ChunkData>, RepositoryError>

  /**
   * 地域内のチャンクを検索
   */
  readonly findByRegion: (region: ChunkRegion) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * 複数のチャンクをIDで検索
   */
  readonly findByIds: (ids: ReadonlyArray<ChunkId>) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * 複数のチャンクを座標で検索
   */
  readonly findByPositions: (positions: ReadonlyArray<ChunkPosition>) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * チャンクを保存
   */
  readonly save: (chunk: ChunkData) => Effect.Effect<ChunkData, RepositoryError>

  /**
   * 複数チャンクを一括保存
   */
  readonly saveAll: (chunks: ReadonlyArray<ChunkData>) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * チャンクをIDで削除
   */
  readonly delete: (id: ChunkId) => Effect.Effect<void, RepositoryError>

  /**
   * チャンクを座標で削除
   */
  readonly deleteByPosition: (position: ChunkPosition) => Effect.Effect<void, RepositoryError>

  /**
   * 複数チャンクを削除
   */
  readonly deleteAll: (ids: ReadonlyArray<ChunkId>) => Effect.Effect<void, RepositoryError>

  // ===== Existence and Count Operations ===== //

  /**
   * チャンクの存在確認
   */
  readonly exists: (id: ChunkId) => Effect.Effect<boolean, RepositoryError>

  /**
   * 座標によるチャンクの存在確認
   */
  readonly existsByPosition: (position: ChunkPosition) => Effect.Effect<boolean, RepositoryError>

  /**
   * 総チャンク数を取得
   */
  readonly count: () => Effect.Effect<number, RepositoryError>

  /**
   * 地域内のチャンク数を取得
   */
  readonly countByRegion: (region: ChunkRegion) => Effect.Effect<number, RepositoryError>

  // ===== Advanced Query Operations ===== //

  /**
   * 条件指定によるチャンク検索
   */
  readonly findByQuery: (query: ChunkQuery) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * 最近ロードされたチャンクを取得
   */
  readonly findRecentlyLoaded: (limit: number) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * 変更されたチャンクを取得
   */
  readonly findModified: (since: number) => Effect.Effect<ReadonlyArray<ChunkData>, RepositoryError>

  /**
   * チャンク統計情報を取得
   */
  readonly getStatistics: () => Effect.Effect<ChunkStatistics, RepositoryError>

  // ===== Batch Operations ===== //

  /**
   * バッチ保存（部分失敗対応）
   */
  readonly batchSave: (chunks: ReadonlyArray<ChunkData>) => Effect.Effect<BatchOperationResult<ChunkData>, RepositoryError>

  /**
   * バッチ削除（部分失敗対応）
   */
  readonly batchDelete: (ids: ReadonlyArray<ChunkId>) => Effect.Effect<BatchOperationResult<ChunkId>, RepositoryError>

  // ===== Maintenance Operations ===== //

  /**
   * リポジトリ初期化
   */
  readonly initialize: () => Effect.Effect<void, RepositoryError>

  /**
   * 全データクリア
   */
  readonly clear: () => Effect.Effect<void, RepositoryError>

  /**
   * データ整合性チェック
   */
  readonly validateIntegrity: () => Effect.Effect<boolean, RepositoryError>

  /**
   * キャッシュクリア
   */
  readonly clearCache: () => Effect.Effect<void, RepositoryError>

  /**
   * リソースクリーンアップ
   */
  readonly cleanup: () => Effect.Effect<void, RepositoryError>
}

// ===== Context Tag ===== //

/**
 * ChunkRepository Context Tag
 *
 * Effect-TSの依存性注入システム用のコンテキストタグ
 */
export const ChunkRepository = Context.GenericTag<ChunkRepository>('ChunkRepository')

// ===== Type Helpers ===== //

/**
 * Repository操作の戻り値型ヘルパー
 */
export type ChunkRepositoryEffect<T> = Effect.Effect<T, RepositoryError, ChunkRepository>

/**
 * チャンクオプション型
 */
export type ChunkOption = Option.Option<ChunkData>

/**
 * チャンク配列型
 */
export type ChunkArray = ReadonlyArray<ChunkData>