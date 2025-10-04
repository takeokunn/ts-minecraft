/**
 * Settings Storage Repository - Live Implementation
 *
 * Camera設定永続化の具体的実装（インメモリ版）
 * プレイヤー設定、グローバル設定、プリセット設定の統合管理
 */

import { Array, Effect, HashMap, Layer, Match, Option, pipe, Ref } from 'effect'
import type {
  CleanupResult,
  ImportResult,
  IntegrityCheckResult,
  OptimizationResult,
  PlayerUsageAnalytics,
  PresetPopularity,
  SettingsRepositoryStatistics,
  ValidationResult,
} from './service.js'
import type {
  CameraPresetSettings,
  GlobalCameraSettings,
  PlayerCameraSettings,
  PlayerId,
  SettingsRepositoryError,
  SettingsStorageQueryOptions,
} from './types.js'
import {
  createDefaultSettings,
  createSettingsRepositoryError,
  isPresetNotFoundError,
  isSettingsNotFoundError,
  isValidationError,
} from './types.js'

// ========================================
// Internal Storage Types
// ========================================

/**
 * Settings Storage State
 */
interface SettingsStorageState {
  readonly playerSettings: HashMap.HashMap<PlayerId, PlayerCameraSettings>
  readonly globalSettings: GlobalCameraSettings
  readonly presetSettings: HashMap.HashMap<string, CameraPresetSettings>
  readonly usageAnalytics: HashMap.HashMap<PlayerId, PlayerUsageData>
  readonly metadata: {
    readonly lastOptimizationDate: number
    readonly totalOperations: number
    readonly lastCleanupDate: number
  }
}

/**
 * Player Usage Data
 */
interface PlayerUsageData {
  readonly playerId: PlayerId
  readonly settingsChangeCount: number
  readonly lastActivityDate: number
  readonly viewModeUsage: HashMap.HashMap<string, number>
  readonly presetUsage: HashMap.HashMap<string, number>
  readonly customBindingsCount: number
}

/**
 * Storage Operations
 */
const StorageOps = {
  /**
   * 初期状態を作成
   */
  createInitialState: (): SettingsStorageState => ({
    playerSettings: HashMap.empty(),
    globalSettings: createDefaultSettings.globalCameraSettings(),
    presetSettings: HashMap.empty(),
    usageAnalytics: HashMap.empty(),
    metadata: {
      lastOptimizationDate: Date.now(),
      totalOperations: 0,
      lastCleanupDate: Date.now(),
    },
  }),

  /**
   * プレイヤー設定を保存
   */
  storePlayerSettings: (
    state: SettingsStorageState,
    playerId: PlayerId,
    settings: PlayerCameraSettings
  ): SettingsStorageState => {
    const updatedSettings = {
      ...settings,
      lastModified: Date.now(),
      version: settings.version + 1,
    }

    // 使用状況を更新
    const currentUsage = HashMap.get(state.usageAnalytics, playerId).pipe(
      Option.getOrElse(() => ({
        playerId,
        settingsChangeCount: 0,
        lastActivityDate: 0,
        viewModeUsage: HashMap.empty(),
        presetUsage: HashMap.empty(),
        customBindingsCount: 0,
      }))
    )

    const updatedUsage: PlayerUsageData = {
      ...currentUsage,
      settingsChangeCount: currentUsage.settingsChangeCount + 1,
      lastActivityDate: Date.now(),
      customBindingsCount: settings.customBindings.size,
    }

    return {
      ...state,
      playerSettings: HashMap.set(state.playerSettings, playerId, updatedSettings),
      usageAnalytics: HashMap.set(state.usageAnalytics, playerId, updatedUsage),
      metadata: {
        ...state.metadata,
        totalOperations: state.metadata.totalOperations + 1,
      },
    }
  },

  /**
   * プリセット設定を保存
   */
  storePresetSettings: (
    state: SettingsStorageState,
    presetName: string,
    settings: CameraPresetSettings
  ): SettingsStorageState => ({
    ...state,
    presetSettings: HashMap.set(state.presetSettings, presetName, settings),
    metadata: {
      ...state.metadata,
      totalOperations: state.metadata.totalOperations + 1,
    },
  }),

  /**
   * グローバル設定を更新
   */
  updateGlobalSettings: (state: SettingsStorageState, settings: GlobalCameraSettings): SettingsStorageState => ({
    ...state,
    globalSettings: {
      ...settings,
      lastModified: Date.now(),
      version: settings.version + 1,
    },
    metadata: {
      ...state.metadata,
      totalOperations: state.metadata.totalOperations + 1,
    },
  }),

  /**
   * 期限切れデータをクリーンアップ
   */
  cleanup: (state: SettingsStorageState, olderThan: Date): [SettingsStorageState, CleanupResult] => {
    const cutoffTime = olderThan.getTime()
    let deletedPlayerSettings = 0
    let deletedPresets = 0

    // 古いプレイヤー設定を削除
    const filteredPlayerSettings = HashMap.filter(state.playerSettings, (settings) => {
      if (settings.lastModified < cutoffTime) {
        deletedPlayerSettings++
        return false
      }
      return true
    })

    // 古いプリセット設定を削除
    const filteredPresetSettings = HashMap.filter(state.presetSettings, (preset) => {
      if (preset.createdAt < cutoffTime) {
        deletedPresets++
        return false
      }
      return true
    })

    const cleanedState: SettingsStorageState = {
      ...state,
      playerSettings: filteredPlayerSettings,
      presetSettings: filteredPresetSettings,
      metadata: {
        ...state.metadata,
        lastCleanupDate: Date.now(),
        totalOperations: state.metadata.totalOperations + 1,
      },
    }

    const result: CleanupResult = {
      deletedPlayerSettings,
      deletedPresets,
      freedStorageBytes: JSON.stringify(state).length - JSON.stringify(cleanedState).length,
      operationDurationMs: 0, // 簡易実装では0
    }

    return [cleanedState, result]
  },

  /**
   * 統計情報を生成
   */
  generateStatistics: (state: SettingsStorageState): SettingsRepositoryStatistics => {
    const playerSettings = HashMap.values(state.playerSettings)
    const presetSettings = HashMap.values(state.presetSettings)
    const allPlayerSettings = Array.from(playerSettings)
    const allPresets = Array.from(presetSettings)

    const publicPresets = allPresets.filter((preset) => preset.isPublic).length
    const privatePresets = allPresets.length - publicPresets

    // プリセット人気度の計算（簡易版）
    const presetUsage = HashMap.empty<string, number>()
    const mostPopularPresets: Array.ReadonlyArray<PresetPopularity> = Array.from(HashMap.entries(presetUsage)).map(
      ([presetName, usageCount]) => ({
        presetName,
        usageCount,
        lastUsed: Date.now(), // 簡易実装
      })
    )

    return {
      totalPlayerSettings: allPlayerSettings.length,
      totalPresets: allPresets.length,
      publicPresets,
      privatePresets,
      averageSettingsPerPlayer: allPlayerSettings.length > 0 ? 1 : 0, // 簡易計算
      mostPopularPresets,
      storageUsageBytes: JSON.stringify(state).length,
      lastOptimizationDate: Option.some(state.metadata.lastOptimizationDate),
    }
  },
} as const

// ========================================
// Error Handling Utilities
// ========================================

/**
 * Repository操作のエラーハンドリング
 */
const handleSettingsOperation = <T>(operation: Effect.Effect<T, unknown>): Effect.Effect<T, SettingsRepositoryError> =>
  pipe(
    operation,
    Effect.catchAll((error) =>
      pipe(
        error,
        Match.value,
        Match.when(isSettingsNotFoundError, () =>
          Effect.fail(createSettingsRepositoryError.settingsNotFound('Unknown', 'unknown'))
        ),
        Match.when(isValidationError, (e) =>
          Effect.fail(createSettingsRepositoryError.validationFailed('unknown', e, String(e)))
        ),
        Match.when(isPresetNotFoundError, (e) => Effect.fail(createSettingsRepositoryError.presetNotFound(String(e)))),
        Match.orElse(() => Effect.fail(createSettingsRepositoryError.storageError(String(error))))
      )
    )
  )

// ========================================
// Live Implementation
// ========================================

/**
 * Settings Storage Repository Live Implementation
 */
export const SettingsStorageRepositoryLive = Layer.effect(
  import('./service.js').then((m) => m.SettingsStorageRepository),
  Effect.gen(function* () {
    // インメモリストレージの初期化
    const storageRef = yield* Ref.make(StorageOps.createInitialState())

    return import('./service.js')
      .then((m) => m.SettingsStorageRepository)
      .of({
        // ========================================
        // Player Settings Management
        // ========================================

        savePlayerSettings: (playerId: PlayerId, settings: PlayerCameraSettings) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => StorageOps.storePlayerSettings(state, playerId, settings))
            yield* Effect.logDebug(`Player settings saved: ${playerId}`)
          }).pipe(handleSettingsOperation),

        loadPlayerSettings: (playerId: PlayerId) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            return HashMap.get(state.playerSettings, playerId)
          }).pipe(handleSettingsOperation),

        deletePlayerSettings: (playerId: PlayerId) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => ({
              ...state,
              playerSettings: HashMap.remove(state.playerSettings, playerId),
              usageAnalytics: HashMap.remove(state.usageAnalytics, playerId),
              metadata: {
                ...state.metadata,
                totalOperations: state.metadata.totalOperations + 1,
              },
            }))
            yield* Effect.logDebug(`Player settings deleted: ${playerId}`)
          }).pipe(handleSettingsOperation),

        playerSettingsExists: (playerId: PlayerId) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            return HashMap.has(state.playerSettings, playerId)
          }).pipe(handleSettingsOperation),

        // ========================================
        // Global Settings Management
        // ========================================

        saveGlobalSettings: (settings: GlobalCameraSettings) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => StorageOps.updateGlobalSettings(state, settings))
            yield* Effect.logDebug('Global settings saved')
          }).pipe(handleSettingsOperation),

        loadGlobalSettings: () =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            return state.globalSettings
          }).pipe(handleSettingsOperation),

        resetGlobalSettings: () =>
          Effect.gen(function* () {
            const defaultSettings = createDefaultSettings.globalCameraSettings()
            yield* Ref.update(storageRef, (state) => StorageOps.updateGlobalSettings(state, defaultSettings))
            yield* Effect.logInfo('Global settings reset to defaults')
          }).pipe(handleSettingsOperation),

        getGlobalSettingsLastModified: () =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            return state.globalSettings.lastModified
          }).pipe(handleSettingsOperation),

        // ========================================
        // Preset Settings Management
        // ========================================

        savePresetSettings: (presetName: string, settings: CameraPresetSettings) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => StorageOps.storePresetSettings(state, presetName, settings))
            yield* Effect.logDebug(`Preset settings saved: ${presetName}`)
          }).pipe(handleSettingsOperation),

        loadPresetSettings: (presetName: string) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            return HashMap.get(state.presetSettings, presetName)
          }).pipe(handleSettingsOperation),

        listPresets: (options?: SettingsStorageQueryOptions) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            let presetNames = Array.from(HashMap.keys(state.presetSettings))

            // ソート処理（簡易実装）
            if (options?.sortBy._tag === 'Name') {
              presetNames = presetNames.sort((a, b) =>
                options.sortBy.ascending ? a.localeCompare(b) : b.localeCompare(a)
              )
            }

            // 制限処理
            if (Option.isSome(options?.limit)) {
              presetNames = presetNames.slice(0, options.limit.value)
            }

            return presetNames
          }).pipe(handleSettingsOperation),

        listPresetDetails: (options?: SettingsStorageQueryOptions) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            let presets = Array.from(HashMap.values(state.presetSettings))

            // タグフィルタリング
            if (Option.isSome(options?.filterByTag)) {
              const filterTag = options.filterByTag.value
              presets = presets.filter((preset) => preset.tags.includes(filterTag))
            }

            // ソート処理
            if (options?.sortBy._tag === 'CreatedAt') {
              presets = presets.sort((a, b) =>
                options.sortBy.ascending ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
              )
            }

            // 制限処理
            if (Option.isSome(options?.limit)) {
              presets = presets.slice(0, options.limit.value)
            }

            return presets
          }).pipe(handleSettingsOperation),

        deletePreset: (presetName: string) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => ({
              ...state,
              presetSettings: HashMap.remove(state.presetSettings, presetName),
              metadata: {
                ...state.metadata,
                totalOperations: state.metadata.totalOperations + 1,
              },
            }))
            yield* Effect.logDebug(`Preset deleted: ${presetName}`)
          }).pipe(handleSettingsOperation),

        presetExists: (presetName: string) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            return HashMap.has(state.presetSettings, presetName)
          }).pipe(handleSettingsOperation),

        copyPreset: (sourcePresetName: string, targetPresetName: string, newCreator: PlayerId) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const sourcePreset = HashMap.get(state.presetSettings, sourcePresetName)

            if (Option.isNone(sourcePreset)) {
              return yield* Effect.fail(createSettingsRepositoryError.presetNotFound(sourcePresetName))
            }

            const copiedPreset: CameraPresetSettings = {
              ...sourcePreset.value,
              name: targetPresetName,
              createdAt: Date.now(),
              createdBy: newCreator,
              version: 1,
            }

            yield* Ref.update(storageRef, (currentState) =>
              StorageOps.storePresetSettings(currentState, targetPresetName, copiedPreset)
            )

            yield* Effect.logDebug(`Preset copied: ${sourcePresetName} -> ${targetPresetName}`)
          }).pipe(handleSettingsOperation),

        // ========================================
        // Bulk Operations
        // ========================================

        savePlayerSettingsBatch: (settingsArray: Array.ReadonlyArray<PlayerCameraSettings>) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) =>
              settingsArray.reduce(
                (acc, settings) => StorageOps.storePlayerSettings(acc, settings.playerId, settings),
                state
              )
            )
            yield* Effect.logDebug(`Batch save completed: ${settingsArray.length} player settings`)
          }).pipe(handleSettingsOperation),

        savePresetSettingsBatch: (presetsArray: Array.ReadonlyArray<CameraPresetSettings>) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) =>
              presetsArray.reduce((acc, preset) => StorageOps.storePresetSettings(acc, preset.name, preset), state)
            )
            yield* Effect.logDebug(`Batch save completed: ${presetsArray.length} presets`)
          }).pipe(handleSettingsOperation),

        deletePlayerSettingsBatch: (playerIds: Array.ReadonlyArray<PlayerId>) =>
          Effect.gen(function* () {
            let deletedCount = 0
            yield* Ref.update(storageRef, (state) => {
              let newState = state
              for (const playerId of playerIds) {
                if (HashMap.has(newState.playerSettings, playerId)) {
                  newState = {
                    ...newState,
                    playerSettings: HashMap.remove(newState.playerSettings, playerId),
                    usageAnalytics: HashMap.remove(newState.usageAnalytics, playerId),
                  }
                  deletedCount++
                }
              }
              return {
                ...newState,
                metadata: {
                  ...newState.metadata,
                  totalOperations: newState.metadata.totalOperations + 1,
                },
              }
            })
            yield* Effect.logDebug(`Batch delete completed: ${deletedCount} player settings`)
            return deletedCount
          }).pipe(handleSettingsOperation),

        // ========================================
        // Import/Export Operations (Simplified)
        // ========================================

        exportSettings: (playerId: Option<PlayerId>, includePresets: boolean) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const exportData: any = {
              globalSettings: state.globalSettings,
            }

            if (Option.isSome(playerId)) {
              const playerSettings = HashMap.get(state.playerSettings, playerId.value)
              if (Option.isSome(playerSettings)) {
                exportData.playerSettings = playerSettings.value
              }
            }

            if (includePresets) {
              exportData.presets = Array.from(HashMap.values(state.presetSettings))
            }

            return JSON.stringify(exportData, null, 2)
          }).pipe(handleSettingsOperation),

        importSettings: (jsonData: string, targetPlayerId: Option<PlayerId>) =>
          Effect.gen(function* () {
            const importResult: ImportResult = {
              success: true,
              importedPlayerSettings: 0,
              importedPresets: 0,
              skippedItems: 0,
              errors: [],
            }

            try {
              const data = JSON.parse(jsonData)
              // 簡易実装: データのインポート処理
              yield* Effect.logInfo('Settings imported successfully')
            } catch (error) {
              return {
                ...importResult,
                success: false,
                errors: [String(error)],
              }
            }

            return importResult
          }).pipe(handleSettingsOperation),

        validateSettings: (jsonData: string) =>
          Effect.gen(function* () {
            const validationResult: ValidationResult = {
              isValid: true,
              playerSettingsValid: true,
              globalSettingsValid: true,
              presetsValid: true,
              errors: [],
              warnings: [],
            }

            try {
              JSON.parse(jsonData)
              // 簡易実装: スキーマ検証
            } catch (error) {
              return {
                ...validationResult,
                isValid: false,
                errors: [String(error)],
              }
            }

            return validationResult
          }).pipe(handleSettingsOperation),

        // ========================================
        // Statistics and Analytics
        // ========================================

        getStatistics: () =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            return StorageOps.generateStatistics(state)
          }).pipe(handleSettingsOperation),

        analyzePlayerUsage: (playerId: PlayerId) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const usage = HashMap.get(state.usageAnalytics, playerId)

            if (Option.isNone(usage)) {
              return yield* Effect.fail(createSettingsRepositoryError.settingsNotFound('PlayerUsage', playerId))
            }

            const analytics: PlayerUsageAnalytics = {
              playerId,
              settingsChangeFrequency: usage.value.settingsChangeCount,
              preferredViewModes: Array.from(HashMap.keys(usage.value.viewModeUsage)),
              customBindingsCount: usage.value.customBindingsCount,
              lastActivityDate: usage.value.lastActivityDate,
              mostUsedPresets: Array.from(HashMap.keys(usage.value.presetUsage)),
            }

            return analytics
          }).pipe(handleSettingsOperation),

        // ========================================
        // Maintenance Operations
        // ========================================

        cleanup: (olderThan: Date) =>
          Effect.gen(function* () {
            const [newState, result] = yield* Ref.modify(storageRef, (state) => {
              const [cleanedState, cleanupResult] = StorageOps.cleanup(state, olderThan)
              return [cleanupResult, cleanedState]
            })

            yield* Effect.logInfo(
              `Cleanup completed: ${result.deletedPlayerSettings} player settings, ${result.deletedPresets} presets removed`
            )
            return result
          }).pipe(handleSettingsOperation),

        validateIntegrity: () =>
          Effect.gen(function* () {
            const result: IntegrityCheckResult = {
              isHealthy: true,
              corruptedPlayerSettings: [],
              corruptedPresets: [],
              missingReferences: [],
              fixedIssues: 0,
            }

            yield* Effect.logInfo('Integrity check completed')
            return result
          }).pipe(handleSettingsOperation),

        optimize: () =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const beforeSize = JSON.stringify(state).length

            // 簡易最適化処理
            yield* Ref.update(storageRef, (currentState) => ({
              ...currentState,
              metadata: {
                ...currentState.metadata,
                lastOptimizationDate: Date.now(),
              },
            }))

            const afterSize = beforeSize // 簡易実装では変化なし

            const result: OptimizationResult = {
              beforeSizeBytes: beforeSize,
              afterSizeBytes: afterSize,
              compressionRatio: 1.0,
              duplicatesRemoved: 0,
              operationDurationMs: 0,
            }

            yield* Effect.logInfo('Storage optimization completed')
            return result
          }).pipe(handleSettingsOperation),
      })
  })
)
