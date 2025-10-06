/**
 * Settings Storage Repository - Types
 *
 * Camera設定永続化のためのRepository専用型定義
 * プレイヤー設定、グローバル設定、プリセット設定の管理
 */

import type { CameraSettings, FOV, Sensitivity } from '@domain/camera/types'
import { Brand, Clock, Data, Effect, Option, ReadonlyMap, Schema } from 'effect'
import type { ViewMode } from '../../value_object/index'

// ========================================
// Repository専用Brand型定義
// ========================================

/**
 * Player ID - プレイヤー識別子
 * 専用value_objectから再エクスポート
 */
export type { PlayerId } from '@domain/player/value_object/player_id'

/**
 * Key Binding - キーバインディング設定
 */
export type KeyBinding = Brand<
  {
    readonly key: string
    readonly modifiers: Array.ReadonlyArray<string>
    readonly action: string
  },
  'KeyBinding'
>

/**
 * Player Camera Settings - プレイヤー固有のCamera設定
 */
export type PlayerCameraSettings = Brand<
  {
    readonly playerId: PlayerId
    readonly sensitivity: Sensitivity
    readonly fov: FOV
    readonly viewModePreference: ViewMode
    readonly animationEnabled: boolean
    readonly collisionEnabled: boolean
    readonly customBindings: ReadonlyMap<string, KeyBinding>
    readonly lastModified: number
    readonly version: number
  },
  'PlayerCameraSettings'
>

/**
 * Global Camera Settings - グローバルCamera設定
 */
export type GlobalCameraSettings = Brand<
  {
    readonly defaultSensitivity: Sensitivity
    readonly defaultFOV: FOV
    readonly animationDuration: number
    readonly collisionDetectionEnabled: boolean
    readonly debugMode: boolean
    readonly maxRenderDistance: number
    readonly qualityLevel: QualityLevel
    readonly performanceMode: boolean
    readonly lastModified: number
    readonly version: number
  },
  'GlobalCameraSettings'
>

/**
 * Camera Preset Settings - Camera設定プリセット
 */
export type CameraPresetSettings = Brand<
  {
    readonly name: string
    readonly description: string
    readonly settings: CameraSettings
    readonly viewModeSettings: ViewModeSettings
    readonly createdAt: number
    readonly createdBy: PlayerId
    readonly isPublic: boolean
    readonly tags: Array.ReadonlyArray<string>
    readonly version: number
  },
  'CameraPresetSettings'
>

/**
 * Quality Level - 品質レベル
 */
export type QualityLevel = Data.TaggedEnum<{
  readonly Low: {}
  readonly Medium: {}
  readonly High: {}
  readonly Ultra: {}
  readonly Custom: { readonly customSettings: CustomQualitySettings }
}>

/**
 * Custom Quality Settings - カスタム品質設定
 */
export type CustomQualitySettings = Brand<
  {
    readonly renderDistance: number
    readonly shadowQuality: number
    readonly textureQuality: number
    readonly effectsQuality: number
    readonly antiAliasing: boolean
  },
  'CustomQualitySettings'
>

/**
 * View Mode Settings - ViewMode固有設定
 */
export type ViewModeSettings = Brand<
  {
    readonly firstPersonSettings: FirstPersonViewSettings
    readonly thirdPersonSettings: ThirdPersonViewSettings
    readonly spectatorSettings: SpectatorViewSettings
    readonly cinematicSettings: CinematicViewSettings
  },
  'ViewModeSettings'
>

/**
 * First Person View Settings - 一人称視点設定
 */
export type FirstPersonViewSettings = Brand<
  {
    readonly handVisible: boolean
    readonly headBobbing: boolean
    readonly fovAdjustment: number
    readonly mouseSensitivity: number
  },
  'FirstPersonViewSettings'
>

/**
 * Third Person View Settings - 三人称視点設定
 */
export type ThirdPersonViewSettings = Brand<
  {
    readonly distance: number
    readonly height: number
    readonly smoothing: number
    readonly collisionAdjustment: boolean
  },
  'ThirdPersonViewSettings'
>

/**
 * Spectator View Settings - 観戦者視点設定
 */
export type SpectatorViewSettings = Brand<
  {
    readonly speed: number
    readonly acceleration: number
    readonly deceleration: number
    readonly noClip: boolean
  },
  'SpectatorViewSettings'
>

/**
 * Cinematic View Settings - シネマティック視点設定
 */
export type CinematicViewSettings = Brand<
  {
    readonly smoothingFactor: number
    readonly transitionDuration: number
    readonly pauseOnInteraction: boolean
    readonly fadeInOut: boolean
  },
  'CinematicViewSettings'
>

/**
 * Settings Storage Query Options - 設定ストレージクエリオプション
 */
export type SettingsStorageQueryOptions = Brand<
  {
    readonly includeDefaults: boolean
    readonly filterByTag: Option<string>
    readonly sortBy: SettingsSortBy
    readonly limit: Option<number>
  },
  'SettingsStorageQueryOptions'
>

/**
 * Settings Sort By - 設定ソート方法
 */
export type SettingsSortBy = Data.TaggedEnum<{
  readonly Name: { readonly ascending: boolean }
  readonly CreatedAt: { readonly ascending: boolean }
  readonly LastModified: { readonly ascending: boolean }
  readonly Popularity: { readonly ascending: boolean }
}>

// ========================================
// Repository Error型定義
// ========================================

/**
 * Settings Repository Error - 設定Repository操作エラー
 */
export type SettingsRepositoryError = Data.TaggedEnum<{
  readonly SettingsNotFound: {
    readonly settingsType: string
    readonly identifier: string
  }
  readonly DuplicateSettings: {
    readonly settingsType: string
    readonly identifier: string
  }
  readonly ValidationFailed: {
    readonly field: string
    readonly value: unknown
    readonly reason: string
  }
  readonly PresetNotFound: {
    readonly presetName: string
  }
  readonly PresetAlreadyExists: {
    readonly presetName: string
  }
  readonly UnauthorizedAccess: {
    readonly operation: string
    readonly playerId: PlayerId
  }
  readonly StorageError: {
    readonly message: string
    readonly cause: Option<unknown>
  }
  readonly EncodingFailed: {
    readonly settingsType: string
    readonly reason: string
  }
  readonly DecodingFailed: {
    readonly settingsType: string
    readonly reason: string
  }
}>

// ========================================
// Schema定義
// ========================================

/**
 * Player ID Schema
 */
export const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))

/**
 * Key Binding Schema
 */
export const KeyBindingSchema = Schema.Struct({
  key: Schema.String,
  modifiers: Schema.Array(Schema.String),
  action: Schema.String,
}).pipe(Schema.brand('KeyBinding'))

/**
 * Quality Level Schema
 */
export const QualityLevelSchema = Schema.Union(
  Schema.TaggedStruct('Low', {}),
  Schema.TaggedStruct('Medium', {}),
  Schema.TaggedStruct('High', {}),
  Schema.TaggedStruct('Ultra', {}),
  Schema.TaggedStruct('Custom', {
    customSettings: Schema.Struct({
      renderDistance: Schema.Number.pipe(Schema.positive()),
      shadowQuality: Schema.Number.pipe(Schema.clamp(0, 10)),
      textureQuality: Schema.Number.pipe(Schema.clamp(0, 10)),
      effectsQuality: Schema.Number.pipe(Schema.clamp(0, 10)),
      antiAliasing: Schema.Boolean,
    }).pipe(Schema.brand('CustomQualitySettings')),
  })
)

/**
 * Player Camera Settings Schema
 */
export const PlayerCameraSettingsSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  sensitivity: Schema.Number.pipe(Schema.positive()),
  fov: Schema.Number.pipe(Schema.clamp(30, 120)),
  viewModePreference: Schema.String,
  animationEnabled: Schema.Boolean,
  collisionEnabled: Schema.Boolean,
  customBindings: Schema.Map({
    key: Schema.String,
    value: KeyBindingSchema,
  }),
  lastModified: Schema.Number.pipe(Schema.positive()),
  version: Schema.Number.pipe(Schema.positive()),
}).pipe(Schema.brand('PlayerCameraSettings'))

/**
 * Global Camera Settings Schema
 */
export const GlobalCameraSettingsSchema = Schema.Struct({
  defaultSensitivity: Schema.Number.pipe(Schema.positive()),
  defaultFOV: Schema.Number.pipe(Schema.clamp(30, 120)),
  animationDuration: Schema.Number.pipe(Schema.positive()),
  collisionDetectionEnabled: Schema.Boolean,
  debugMode: Schema.Boolean,
  maxRenderDistance: Schema.Number.pipe(Schema.positive()),
  qualityLevel: QualityLevelSchema,
  performanceMode: Schema.Boolean,
  lastModified: Schema.Number.pipe(Schema.positive()),
  version: Schema.Number.pipe(Schema.positive()),
}).pipe(Schema.brand('GlobalCameraSettings'))

/**
 * View Mode Settings Schema
 */
export const ViewModeSettingsSchema = Schema.Struct({
  firstPersonSettings: Schema.Struct({
    handVisible: Schema.Boolean,
    headBobbing: Schema.Boolean,
    fovAdjustment: Schema.Number,
    mouseSensitivity: Schema.Number.pipe(Schema.positive()),
  }).pipe(Schema.brand('FirstPersonViewSettings')),
  thirdPersonSettings: Schema.Struct({
    distance: Schema.Number.pipe(Schema.positive()),
    height: Schema.Number,
    smoothing: Schema.Number.pipe(Schema.clamp(0, 1)),
    collisionAdjustment: Schema.Boolean,
  }).pipe(Schema.brand('ThirdPersonViewSettings')),
  spectatorSettings: Schema.Struct({
    speed: Schema.Number.pipe(Schema.positive()),
    acceleration: Schema.Number.pipe(Schema.positive()),
    deceleration: Schema.Number.pipe(Schema.positive()),
    noClip: Schema.Boolean,
  }).pipe(Schema.brand('SpectatorViewSettings')),
  cinematicSettings: Schema.Struct({
    smoothingFactor: Schema.Number.pipe(Schema.clamp(0, 1)),
    transitionDuration: Schema.Number.pipe(Schema.positive()),
    pauseOnInteraction: Schema.Boolean,
    fadeInOut: Schema.Boolean,
  }).pipe(Schema.brand('CinematicViewSettings')),
}).pipe(Schema.brand('ViewModeSettings'))

/**
 * Camera Preset Settings Schema
 */
export const CameraPresetSettingsSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  settings: Schema.Struct({
    fov: Schema.Number,
    sensitivity: Schema.Number,
    smoothing: Schema.Number,
  }),
  viewModeSettings: ViewModeSettingsSchema,
  createdAt: Schema.Number.pipe(Schema.positive()),
  createdBy: PlayerIdSchema,
  isPublic: Schema.Boolean,
  tags: Schema.Array(Schema.String),
  version: Schema.Number.pipe(Schema.positive()),
}).pipe(Schema.brand('CameraPresetSettings'))

/**
 * Settings Storage Query Options Schema
 */
export const SettingsStorageQueryOptionsSchema = Schema.Struct({
  includeDefaults: Schema.Boolean,
  filterByTag: Schema.OptionFromNullable(Schema.String),
  sortBy: Schema.Union(
    Schema.TaggedStruct('Name', { ascending: Schema.Boolean }),
    Schema.TaggedStruct('CreatedAt', { ascending: Schema.Boolean }),
    Schema.TaggedStruct('LastModified', { ascending: Schema.Boolean }),
    Schema.TaggedStruct('Popularity', { ascending: Schema.Boolean })
  ),
  limit: Schema.OptionFromNullable(Schema.Number.pipe(Schema.positive())),
}).pipe(Schema.brand('SettingsStorageQueryOptions'))

/**
 * Settings Repository Error Schema
 */
export const SettingsRepositoryErrorSchema = Schema.Union(
  Schema.TaggedStruct('SettingsNotFound', {
    settingsType: Schema.String,
    identifier: Schema.String,
  }),
  Schema.TaggedStruct('DuplicateSettings', {
    settingsType: Schema.String,
    identifier: Schema.String,
  }),
  Schema.TaggedStruct('ValidationFailed', {
    field: Schema.String,
    value: Schema.Unknown,
    reason: Schema.String,
  }),
  Schema.TaggedStruct('PresetNotFound', {
    presetName: Schema.String,
  }),
  Schema.TaggedStruct('PresetAlreadyExists', {
    presetName: Schema.String,
  }),
  Schema.TaggedStruct('UnauthorizedAccess', {
    operation: Schema.String,
    playerId: PlayerIdSchema,
  }),
  Schema.TaggedStruct('StorageError', {
    message: Schema.String,
    cause: Schema.OptionFromNullable(Schema.Unknown),
  }),
  Schema.TaggedStruct('EncodingFailed', {
    settingsType: Schema.String,
    reason: Schema.String,
  }),
  Schema.TaggedStruct('DecodingFailed', {
    settingsType: Schema.String,
    reason: Schema.String,
  })
)

// ========================================
// Factory Functions
// ========================================

/**
 * Settings Repository Error Factory
 */
export const createSettingsRepositoryError = {
  settingsNotFound: (settingsType: string, identifier: string): SettingsRepositoryError =>
    Data.tagged('SettingsNotFound', { settingsType, identifier }),

  duplicateSettings: (settingsType: string, identifier: string): SettingsRepositoryError =>
    Data.tagged('DuplicateSettings', { settingsType, identifier }),

  validationFailed: (field: string, value: unknown, reason: string): SettingsRepositoryError =>
    Data.tagged('ValidationFailed', { field, value, reason }),

  presetNotFound: (presetName: string): SettingsRepositoryError => Data.tagged('PresetNotFound', { presetName }),

  presetAlreadyExists: (presetName: string): SettingsRepositoryError =>
    Data.tagged('PresetAlreadyExists', { presetName }),

  unauthorizedAccess: (operation: string, playerId: PlayerId): SettingsRepositoryError =>
    Data.tagged('UnauthorizedAccess', { operation, playerId }),

  storageError: (message: string, cause?: unknown): SettingsRepositoryError =>
    Data.tagged('StorageError', {
      message,
      cause: cause ? Option.some(cause) : Option.none(),
    }),

  encodingFailed: (settingsType: string, reason: string): SettingsRepositoryError =>
    Data.tagged('EncodingFailed', { settingsType, reason }),

  decodingFailed: (settingsType: string, reason: string): SettingsRepositoryError =>
    Data.tagged('DecodingFailed', { settingsType, reason }),
} as const

/**
 * Default Settings Factory
 */
export const createDefaultSettings = {
  globalCameraSettings: (): Effect.Effect<GlobalCameraSettings> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      return {
        defaultSensitivity: 1.0 as Sensitivity,
        defaultFOV: 75 as FOV,
        animationDuration: 200,
        collisionDetectionEnabled: true,
        debugMode: false,
        maxRenderDistance: 256,
        qualityLevel: Data.tagged('Medium', {}),
        performanceMode: false,
        lastModified: now,
        version: 1,
      } as GlobalCameraSettings
    }),

  playerCameraSettings: (playerId: PlayerId): Effect.Effect<PlayerCameraSettings> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      return {
        playerId,
        sensitivity: 1.0 as Sensitivity,
        fov: 75 as FOV,
        viewModePreference: 'first-person' as ViewMode,
        animationEnabled: true,
        collisionEnabled: true,
        customBindings: new Map(),
        lastModified: now,
        version: 1,
      } as PlayerCameraSettings
    }),

  viewModeSettings: (): ViewModeSettings =>
    ({
      firstPersonSettings: {
        handVisible: true,
        headBobbing: true,
        fovAdjustment: 0,
        mouseSensitivity: 1.0,
      } as FirstPersonViewSettings,
      thirdPersonSettings: {
        distance: 5.0,
        height: 1.0,
        smoothing: 0.1,
        collisionAdjustment: true,
      } as ThirdPersonViewSettings,
      spectatorSettings: {
        speed: 10.0,
        acceleration: 2.0,
        deceleration: 1.5,
        noClip: true,
      } as SpectatorViewSettings,
      cinematicSettings: {
        smoothingFactor: 0.8,
        transitionDuration: 1000,
        pauseOnInteraction: true,
        fadeInOut: true,
      } as CinematicViewSettings,
    }) as ViewModeSettings,
} as const

// ========================================
// Type Guards
// ========================================

/**
 * Settings Repository Error Type Guards
 */
export const isSettingsNotFoundError = (error: SettingsRepositoryError): boolean => error._tag === 'SettingsNotFound'

export const isValidationError = (error: SettingsRepositoryError): boolean => error._tag === 'ValidationFailed'

export const isPresetNotFoundError = (error: SettingsRepositoryError): boolean => error._tag === 'PresetNotFound'

export const isUnauthorizedError = (error: SettingsRepositoryError): boolean => error._tag === 'UnauthorizedAccess'

export const isStorageError = (error: SettingsRepositoryError): boolean => error._tag === 'StorageError'

// ========================================
// Import/Export Data Schemas
// ========================================

/**
 * Export Data Schema
 * exportSettings関数で生成されるJSONデータの構造を定義
 */
export const ExportDataSchema = Schema.Struct({
  globalSettings: GlobalCameraSettingsSchema,
  playerSettings: Schema.optional(PlayerCameraSettingsSchema),
  presets: Schema.optional(Schema.Array(CameraPresetSettingsSchema)),
})

export type ExportData = Schema.Schema.Type<typeof ExportDataSchema>
