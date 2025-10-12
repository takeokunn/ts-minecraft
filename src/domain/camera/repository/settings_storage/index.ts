/**
 * Settings Storage Repository - Module Export
 *
 * Camera設定永続化Repository層の統合エクスポート
 * プレイヤー設定、グローバル設定、プリセット設定の統合管理
 */

import { Clock, Effect, Either, pipe } from 'effect'

// ========================================
// Repository Interface & Context
// ========================================

export type {
  CleanupResult,
  ImportResult,
  IntegrityCheckResult,
  OptimizationResult,
  PlayerUsageAnalytics,
  PresetPopularity,
  SettingsRepositoryStatistics,
  SettingsStorageRepository,
  ValidationResult,
} from './service'

export { SettingsStorageRepository, SettingsStorageRepositoryOps } from './service'

// ========================================
// Repository Types
// ========================================

export type {
  CameraPresetSettings,
  CinematicViewSettings,
  CustomQualitySettings,
  FirstPersonViewSettings,
  GlobalCameraSettings,
  KeyBinding,
  PlayerCameraSettings,
  PlayerId,
  QualityLevel,
  SettingsRepositoryError,
  SettingsSortBy,
  SettingsStorageQueryOptions,
  SpectatorViewSettings,
  ThirdPersonViewSettings,
  ViewModeSettings,
} from './types'

export {
  CameraPresetSettingsSchema,
  // Default settings factory
  createDefaultSettings,
  // Error factory functions
  createSettingsRepositoryError,
  GlobalCameraSettingsSchema,
  isPresetNotFoundError,
  // Type guards
  isSettingsNotFoundError,
  isStorageError,
  isUnauthorizedError,
  isValidationError,
  KeyBindingSchema,
  PlayerCameraSettingsSchema,
  // Schema definitions
  PlayerIdSchema,
  QualityLevelSchema,
  SettingsRepositoryErrorSchema,
  SettingsStorageQueryOptionsSchema,
  ViewModeSettingsSchema,
} from './types'

// ========================================
// Live Implementation
// ========================================

export { SettingsStorageRepositoryLive } from './live'

// ========================================
// Module Integration Utilities
// ========================================

/**
 * Repository モジュール情報
 */
export const SettingsStorageRepositoryModule = {
  name: 'SettingsStorageRepository',
  version: '1.0.0',
  description: 'Camera設定永続化Repository（プレイヤー・グローバル・プリセット統合管理）',
  provides: ['SettingsStorageRepository'] as const,
  dependencies: [] as const,
} as const

/**
 * Repository 操作のタイプセーフティユーティリティ
 */
export const SettingsRepositoryTypeGuards = {
  isSettingsStorageRepository: (value: unknown): value is SettingsStorageRepository => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'savePlayerSettings' in value &&
      'loadPlayerSettings' in value &&
      'saveGlobalSettings' in value &&
      'loadGlobalSettings' in value &&
      'savePresetSettings' in value &&
      'loadPresetSettings' in value &&
      'listPresets' in value &&
      'deletePreset' in value
    )
  },

  isPlayerCameraSettings: (value: unknown): value is PlayerCameraSettings => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'playerId' in value &&
      'sensitivity' in value &&
      'fov' in value &&
      'viewModePreference' in value
    )
  },

  isGlobalCameraSettings: (value: unknown): value is GlobalCameraSettings => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'defaultSensitivity' in value &&
      'defaultFOV' in value &&
      'animationDuration' in value
    )
  },

  isCameraPresetSettings: (value: unknown): value is CameraPresetSettings => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'name' in value &&
      'description' in value &&
      'settings' in value &&
      'createdBy' in value
    )
  },
} as const

// ========================================
// Settings Validation Utilities
// ========================================

/**
 * 設定値検証ユーティリティ
 */
export const SettingsValidationUtils = {
  /**
   * プレイヤー設定の基本検証
   */
  validatePlayerSettings: (settings: PlayerCameraSettings): boolean => {
    return settings.sensitivity > 0 && settings.fov >= 30 && settings.fov <= 120 && settings.version > 0
  },

  /**
   * グローバル設定の基本検証
   */
  validateGlobalSettings: (settings: GlobalCameraSettings): boolean => {
    return (
      settings.defaultSensitivity > 0 &&
      settings.defaultFOV >= 30 &&
      settings.defaultFOV <= 120 &&
      settings.animationDuration > 0 &&
      settings.maxRenderDistance > 0
    )
  },

  /**
   * プリセット設定の基本検証
   */
  validatePresetSettings: (settings: CameraPresetSettings): boolean => {
    return settings.name.length > 0 && settings.description.length > 0 && settings.createdAt > 0 && settings.version > 0
  },

  /**
   * 設定値の範囲チェック
   */
  isValidFOV: (fov: number): boolean => fov >= 30 && fov <= 120,
  isValidSensitivity: (sensitivity: number): boolean => sensitivity > 0 && sensitivity <= 10,
  isValidAnimationDuration: (duration: number): boolean => duration > 0 && duration <= 5000,
} as const

// ========================================
// Settings Conversion Utilities
// ========================================

/**
 * 設定変換ユーティリティ
 */
export const SettingsConversionUtils = {
  /**
   * プレイヤー設定からプリセット設定への変換
   */
  playerSettingsToPreset: (
    playerSettings: PlayerCameraSettings,
    presetName: string,
    description: string
  ): Effect.Effect<CameraPresetSettings> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      return {
        name: presetName,
        description,
        settings: {
          fov: playerSettings.fov,
          sensitivity: playerSettings.sensitivity,
          smoothing: 0.1, // デフォルト値
        },
        viewModeSettings: createDefaultSettings.viewModeSettings(),
        createdAt: now,
        createdBy: playerSettings.playerId,
        isPublic: false,
        tags: [],
        version: 1,
      } as CameraPresetSettings
    }),

  /**
   * プリセット設定からプレイヤー設定への変換
   */
  presetToPlayerSettings: (preset: CameraPresetSettings, playerId: PlayerId): Effect.Effect<PlayerCameraSettings> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      return {
        playerId,
        sensitivity: preset.settings.sensitivity,
        fov: preset.settings.fov,
        viewModePreference: 'first-person' as 'first-person' | 'third-person' | 'spectator' | 'cinematic',
        animationEnabled: true,
        collisionEnabled: true,
        customBindings: new Map(),
        lastModified: now,
        version: 1,
      } as PlayerCameraSettings
    }),

  /**
   * JSON文字列からの設定復元
   */
  parseSettingsFromJson: (jsonString: string): unknown =>
    pipe(
      Either.try({
        try: () => JSON.parse(jsonString),
        catch: (error) => new Error(`Invalid JSON format: ${String(error)}`),
      }),
      Either.match({
        onLeft: (error) => {
          throw error
        },
        onRight: (value) => value,
      })
    ),

  /**
   * 設定をJSON文字列に変換
   */
  settingsToJson: (settings: unknown): string => {
    return JSON.stringify(settings, null, 2)
  },
} as const

// ========================================
// Re-export for Convenience
// ========================================

/**
 * Repository層で頻繁に使用される型の便利エクスポート
 */
export type { FOV, Sensitivity } from '@domain/camera/types'
export type { ViewMode } from '../../value_object/index'

// ========================================
// Documentation Export
// ========================================

/**
 * Settings Storage Repository Documentation
 *
 * ## 概要
 * Camera設定の永続化・復元・管理を抽象化するRepository層の実装
 * プレイヤー設定、グローバル設定、プリセット設定を統合管理
 *
 * ## 設計原則
 * - Effect-TSのContext.GenericTagによる依存性注入
 * - Brand型とSchema検証による型安全性
 * - インメモリ実装によるドメイン層での技術的関心事の分離
 * - 関数型プログラミングによる副作用の明示的管理
 *
 * ## 管理する設定タイプ
 * 1. **Player Settings**: プレイヤー固有の設定（感度、FOV、カスタムキーバインドなど）
 * 2. **Global Settings**: 全体的なデフォルト設定・品質設定
 * 3. **Preset Settings**: 設定プリセット（共有可能、タグ付け可能）
 *
 * ## 使用例
 * ```typescript
 * import { SettingsStorageRepository, SettingsStorageRepositoryLive } from './settings_storage'
 * import { Effect, Layer } from 'effect'
 *
 * // プレイヤー設定保存
 * const savePlayerSettings = (playerId: PlayerId, settings: PlayerCameraSettings) =>
 *   Effect.gen(function* () {
 *     const repo = yield* SettingsStorageRepository
 *     yield* repo.savePlayerSettings(playerId, settings)
 *   })
 *
 * // Layer提供
 * const program = savePlayerSettings(playerId, settings).pipe(
 *   Effect.provide(SettingsStorageRepositoryLive)
 * )
 * ```
 *
 * ## Repository Method Categories
 *
 * ### Player Settings Management
 * - `savePlayerSettings`: プレイヤー設定保存
 * - `loadPlayerSettings`: プレイヤー設定読み込み
 * - `deletePlayerSettings`: プレイヤー設定削除
 * - `playerSettingsExists`: プレイヤー設定存在確認
 *
 * ### Global Settings Management
 * - `saveGlobalSettings`: グローバル設定保存
 * - `loadGlobalSettings`: グローバル設定読み込み
 * - `resetGlobalSettings`: グローバル設定リセット
 * - `getGlobalSettingsLastModified`: 最終更新日時取得
 *
 * ### Preset Settings Management
 * - `savePresetSettings`: プリセット設定保存
 * - `loadPresetSettings`: プリセット設定読み込み
 * - `listPresets`: プリセット一覧取得
 * - `listPresetDetails`: プリセット詳細一覧取得
 * - `deletePreset`: プリセット削除
 * - `presetExists`: プリセット存在確認
 * - `copyPreset`: プリセットコピー
 *
 * ### Bulk Operations
 * - `savePlayerSettingsBatch`: プレイヤー設定一括保存
 * - `savePresetSettingsBatch`: プリセット設定一括保存
 * - `deletePlayerSettingsBatch`: プレイヤー設定一括削除
 *
 * ### Import/Export Operations
 * - `exportSettings`: 設定エクスポート（JSON）
 * - `importSettings`: 設定インポート（JSON）
 * - `validateSettings`: 設定検証
 *
 * ### Analytics & Statistics
 * - `getStatistics`: 統計情報取得
 * - `analyzePlayerUsage`: プレイヤー使用状況分析
 *
 * ### Maintenance Operations
 * - `cleanup`: 期限切れデータクリーンアップ
 * - `validateIntegrity`: データ整合性チェック
 * - `optimize`: ストレージ最適化
 */
export const SettingsStorageRepositoryDocs = {
  overview: 'Camera設定永続化Repository（統合管理）',
  version: '1.0.0',
  lastUpdated: '2025-01-XX',
  maintainer: 'Camera Domain Team',
  features: [
    'プレイヤー固有設定管理',
    'グローバル設定管理',
    'プリセット設定管理',
    'インポート・エクスポート機能',
    '使用状況分析',
    'データクリーンアップ',
    'ストレージ最適化',
  ],
} as const
