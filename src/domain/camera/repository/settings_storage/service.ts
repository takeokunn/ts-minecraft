/**
 * Settings Storage Repository - Service Interface
 *
 * Camera設定永続化のためのRepository抽象化インターフェース
 * プレイヤー設定、グローバル設定、プリセット設定の統合管理
 */

import { Array, Context, Effect, Option } from 'effect'
import type {
  CameraPresetSettings,
  GlobalCameraSettings,
  PlayerCameraSettings,
  PlayerId,
  SettingsRepositoryError,
  SettingsStorageQueryOptions,
} from './index'

// ========================================
// Repository Interface
// ========================================

/**
 * Settings Storage Repository Interface
 *
 * Camera設定の永続化・復元・管理を抽象化するインターフェース
 * プレイヤー設定、グローバル設定、プリセット設定を統合管理
 */
export interface SettingsStorageRepository {
  // ========================================
  // Player Settings Management
  // ========================================

  /**
   * プレイヤー固有のCamera設定を保存
   */
  readonly savePlayerSettings: (
    playerId: PlayerId,
    settings: PlayerCameraSettings
  ) => Effect.Effect<void, SettingsRepositoryError>

  /**
   * プレイヤー固有のCamera設定を読み込み
   */
  readonly loadPlayerSettings: (
    playerId: PlayerId
  ) => Effect.Effect<Option<PlayerCameraSettings>, SettingsRepositoryError>

  /**
   * プレイヤー設定の削除
   */
  readonly deletePlayerSettings: (playerId: PlayerId) => Effect.Effect<void, SettingsRepositoryError>

  /**
   * プレイヤー設定の存在確認
   */
  readonly playerSettingsExists: (playerId: PlayerId) => Effect.Effect<boolean, SettingsRepositoryError>

  // ========================================
  // Global Settings Management
  // ========================================

  /**
   * グローバルCamera設定を保存
   */
  readonly saveGlobalSettings: (settings: GlobalCameraSettings) => Effect.Effect<void, SettingsRepositoryError>

  /**
   * グローバルCamera設定を読み込み
   */
  readonly loadGlobalSettings: () => Effect.Effect<GlobalCameraSettings, SettingsRepositoryError>

  /**
   * グローバル設定をデフォルトにリセット
   */
  readonly resetGlobalSettings: () => Effect.Effect<void, SettingsRepositoryError>

  /**
   * グローバル設定の最終更新日時を取得
   */
  readonly getGlobalSettingsLastModified: () => Effect.Effect<number, SettingsRepositoryError>

  // ========================================
  // Preset Settings Management
  // ========================================

  /**
   * プリセット設定を保存
   */
  readonly savePresetSettings: (
    presetName: string,
    settings: CameraPresetSettings
  ) => Effect.Effect<void, SettingsRepositoryError>

  /**
   * プリセット設定を読み込み
   */
  readonly loadPresetSettings: (
    presetName: string
  ) => Effect.Effect<Option<CameraPresetSettings>, SettingsRepositoryError>

  /**
   * プリセット一覧を取得
   */
  readonly listPresets: (
    options?: SettingsStorageQueryOptions
  ) => Effect.Effect<Array.ReadonlyArray<string>, SettingsRepositoryError>

  /**
   * プリセット設定の詳細一覧を取得
   */
  readonly listPresetDetails: (
    options?: SettingsStorageQueryOptions
  ) => Effect.Effect<Array.ReadonlyArray<CameraPresetSettings>, SettingsRepositoryError>

  /**
   * プリセット設定を削除
   */
  readonly deletePreset: (presetName: string) => Effect.Effect<void, SettingsRepositoryError>

  /**
   * プリセットの存在確認
   */
  readonly presetExists: (presetName: string) => Effect.Effect<boolean, SettingsRepositoryError>

  /**
   * プリセット設定をコピー
   */
  readonly copyPreset: (
    sourcePresetName: string,
    targetPresetName: string,
    newCreator: PlayerId
  ) => Effect.Effect<void, SettingsRepositoryError>

  // ========================================
  // Bulk Operations
  // ========================================

  /**
   * 複数プレイヤー設定の一括保存
   */
  readonly savePlayerSettingsBatch: (
    settingsArray: Array.ReadonlyArray<PlayerCameraSettings>
  ) => Effect.Effect<void, SettingsRepositoryError>

  /**
   * 複数プリセット設定の一括保存
   */
  readonly savePresetSettingsBatch: (
    presetsArray: Array.ReadonlyArray<CameraPresetSettings>
  ) => Effect.Effect<void, SettingsRepositoryError>

  /**
   * プレイヤー設定の一括削除
   */
  readonly deletePlayerSettingsBatch: (
    playerIds: Array.ReadonlyArray<PlayerId>
  ) => Effect.Effect<number, SettingsRepositoryError>

  // ========================================
  // Import/Export Operations
  // ========================================

  /**
   * 設定のエクスポート（JSON形式）
   */
  readonly exportSettings: (
    playerId: Option<PlayerId>,
    includePresets: boolean
  ) => Effect.Effect<string, SettingsRepositoryError>

  /**
   * 設定のインポート（JSON形式）
   */
  readonly importSettings: (
    jsonData: string,
    targetPlayerId: Option<PlayerId>
  ) => Effect.Effect<ImportResult, SettingsRepositoryError>

  /**
   * 設定の検証
   */
  readonly validateSettings: (jsonData: string) => Effect.Effect<ValidationResult, SettingsRepositoryError>

  // ========================================
  // Statistics and Analytics
  // ========================================

  /**
   * 設定統計情報を取得
   */
  readonly getStatistics: () => Effect.Effect<SettingsRepositoryStatistics, SettingsRepositoryError>

  /**
   * プレイヤー設定の使用状況分析
   */
  readonly analyzePlayerUsage: (playerId: PlayerId) => Effect.Effect<PlayerUsageAnalytics, SettingsRepositoryError>

  // ========================================
  // Maintenance Operations
  // ========================================

  /**
   * 期限切れ設定のクリーンアップ
   */
  readonly cleanup: (olderThan: Date) => Effect.Effect<CleanupResult, SettingsRepositoryError>

  /**
   * 設定の整合性チェック
   */
  readonly validateIntegrity: () => Effect.Effect<IntegrityCheckResult, SettingsRepositoryError>

  /**
   * 設定の最適化（重複除去、圧縮など）
   */
  readonly optimize: () => Effect.Effect<OptimizationResult, SettingsRepositoryError>
}

// ========================================
// Supporting Types
// ========================================

/**
 * Import Result
 */
export interface ImportResult {
  readonly success: boolean
  readonly importedPlayerSettings: number
  readonly importedPresets: number
  readonly skippedItems: number
  readonly errors: Array.ReadonlyArray<string>
}

/**
 * Validation Result
 */
export interface ValidationResult {
  readonly isValid: boolean
  readonly playerSettingsValid: boolean
  readonly globalSettingsValid: boolean
  readonly presetsValid: boolean
  readonly errors: Array.ReadonlyArray<string>
  readonly warnings: Array.ReadonlyArray<string>
}

/**
 * Settings Repository Statistics
 */
export interface SettingsRepositoryStatistics {
  readonly totalPlayerSettings: number
  readonly totalPresets: number
  readonly publicPresets: number
  readonly privatePresets: number
  readonly averageSettingsPerPlayer: number
  readonly mostPopularPresets: Array.ReadonlyArray<PresetPopularity>
  readonly storageUsageBytes: number
  readonly lastOptimizationDate: Option<number>
}

/**
 * Preset Popularity
 */
export interface PresetPopularity {
  readonly presetName: string
  readonly usageCount: number
  readonly lastUsed: number
}

/**
 * Player Usage Analytics
 */
export interface PlayerUsageAnalytics {
  readonly playerId: PlayerId
  readonly settingsChangeFrequency: number
  readonly preferredViewModes: Array.ReadonlyArray<string>
  readonly customBindingsCount: number
  readonly lastActivityDate: number
  readonly mostUsedPresets: Array.ReadonlyArray<string>
}

/**
 * Cleanup Result
 */
export interface CleanupResult {
  readonly deletedPlayerSettings: number
  readonly deletedPresets: number
  readonly freedStorageBytes: number
  readonly operationDurationMs: number
}

/**
 * Integrity Check Result
 */
export interface IntegrityCheckResult {
  readonly isHealthy: boolean
  readonly corruptedPlayerSettings: Array.ReadonlyArray<PlayerId>
  readonly corruptedPresets: Array.ReadonlyArray<string>
  readonly missingReferences: Array.ReadonlyArray<string>
  readonly fixedIssues: number
}

/**
 * Optimization Result
 */
export interface OptimizationResult {
  readonly beforeSizeBytes: number
  readonly afterSizeBytes: number
  readonly compressionRatio: number
  readonly duplicatesRemoved: number
  readonly operationDurationMs: number
}

// ========================================
// Context Tag Definition
// ========================================

/**
 * Settings Storage Repository Context Tag
 */
export const SettingsStorageRepository = Context.GenericTag<SettingsStorageRepository>(
  '@minecraft/domain/camera/SettingsStorageRepository'
)

// ========================================
// Repository Access Helpers
// ========================================

/**
 * Repository操作のヘルパー関数群
 */
export const SettingsStorageRepositoryOps = {
  /**
   * プレイヤー設定の安全な保存
   */
  safeSavePlayerSettings: (playerId: PlayerId, settings: PlayerCameraSettings) =>
    Effect.gen(function* () {
      const repository = yield* SettingsStorageRepository
      yield* repository.savePlayerSettings(playerId, settings)
    }),

  /**
   * プレイヤー設定の安全な読み込み
   */
  safeLoadPlayerSettings: (playerId: PlayerId) =>
    Effect.gen(function* () {
      const repository = yield* SettingsStorageRepository
      return yield* repository.loadPlayerSettings(playerId)
    }),

  /**
   * グローバル設定の安全な読み込み
   */
  safeLoadGlobalSettings: () =>
    Effect.gen(function* () {
      const repository = yield* SettingsStorageRepository
      return yield* repository.loadGlobalSettings()
    }),

  /**
   * プリセット一覧の安全な取得
   */
  safeListPresets: (options?: SettingsStorageQueryOptions) =>
    Effect.gen(function* () {
      const repository = yield* SettingsStorageRepository
      return yield* repository.listPresets(options)
    }),

  /**
   * 統計情報の安全な取得
   */
  safeGetStatistics: () =>
    Effect.gen(function* () {
      const repository = yield* SettingsStorageRepository
      return yield* repository.getStatistics()
    }),
} as const

// ========================================
// Export Types for Consumer Modules
// ========================================

export type {
  CameraPresetSettings,
  GlobalCameraSettings,
  PlayerCameraSettings,
  PlayerId,
  SettingsRepositoryError,
  SettingsStorageQueryOptions,
} from './index'
