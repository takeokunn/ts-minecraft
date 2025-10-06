import { Clock, Data, Effect, Schema } from 'effect'
import type {
  CameraDistance,
  CameraMode,
  FOV,
  Position3D as Position3DBrand,
  Rotation2D as Rotation2DBrand,
  Sensitivity,
} from './index'
import { Position3DSchema, Rotation2DSchema } from './index'

// ========================================
// Event Base Types
// ========================================

/**
 * カメラIDのBrand型
 */
export type CameraId = string & { readonly _brand: 'CameraId' }

/**
 * Position3D型（constants.jsからの再エクスポート）
 */
export type Position3D = Position3DBrand

/**
 * CameraRotation型（constants.jsのRotation2Dとしての再エクスポート）
 */
export type CameraRotation = Rotation2DBrand

/**
 * CameraSettings型
 */
export type CameraSettings = {
  readonly fov: FOV
  readonly sensitivity: Sensitivity
  readonly distance: CameraDistance
  readonly smoothing: number
}

/**
 * AnimationState型
 */
export type AnimationState = {
  readonly id: string
  readonly type: 'position' | 'rotation' | 'fov' | 'transition'
  readonly progress: number
  readonly duration: number
  readonly startTime: number
}

// ========================================
// Domain Events ADT
// ========================================

/**
 * カメラドメインイベント
 */
export type CameraEvent = Data.TaggedEnum<{
  CameraInitialized: {
    readonly cameraId: CameraId
    readonly viewMode: CameraMode
    readonly timestamp: number
  }
  ViewModeChanged: {
    readonly cameraId: CameraId
    readonly fromMode: CameraMode
    readonly toMode: CameraMode
    readonly timestamp: number
  }
  PositionUpdated: {
    readonly cameraId: CameraId
    readonly fromPosition: Position3D
    readonly toPosition: Position3D
    readonly timestamp: number
  }
  RotationUpdated: {
    readonly cameraId: CameraId
    readonly fromRotation: CameraRotation
    readonly toRotation: CameraRotation
    readonly timestamp: number
  }
  SettingsChanged: {
    readonly cameraId: CameraId
    readonly changedSettings: Partial<CameraSettings>
    readonly timestamp: number
  }
  AnimationStarted: {
    readonly cameraId: CameraId
    readonly animationState: AnimationState
    readonly timestamp: number
  }
  AnimationCompleted: {
    readonly cameraId: CameraId
    readonly animationState: AnimationState
    readonly timestamp: number
  }
  AnimationCancelled: {
    readonly cameraId: CameraId
    readonly animationState: AnimationState
    readonly reason: string
    readonly timestamp: number
  }
  CollisionDetected: {
    readonly cameraId: CameraId
    readonly position: Position3D
    readonly obstruction: unknown
    readonly timestamp: number
  }
  CameraLocked: {
    readonly cameraId: CameraId
    readonly reason: string
    readonly timestamp: number
  }
  CameraUnlocked: {
    readonly cameraId: CameraId
    readonly timestamp: number
  }
  FOVChanged: {
    readonly cameraId: CameraId
    readonly fromFOV: FOV
    readonly toFOV: FOV
    readonly timestamp: number
  }
  SensitivityChanged: {
    readonly cameraId: CameraId
    readonly fromSensitivity: Sensitivity
    readonly toSensitivity: Sensitivity
    readonly timestamp: number
  }
  CameraShakeStarted: {
    readonly cameraId: CameraId
    readonly intensity: number
    readonly duration: number
    readonly timestamp: number
  }
  CameraShakeEnded: {
    readonly cameraId: CameraId
    readonly timestamp: number
  }
}>

// ========================================
// Schema Definitions
// ========================================

/**
 * CameraIdスキーマ
 */
export const CameraIdSchema = Schema.String.pipe(Schema.brand('CameraId'))

/**
 * Position3Dスキーマ（constants.jsからの再エクスポート）
 */
export { Position3DSchema } from './index'

/**
 * CameraRotationスキーマ（constants.jsのRotation2DSchemaとしての再エクスポート）
 */
export const CameraRotationSchema = Rotation2DSchema

/**
 * CameraSettingsスキーマ
 */
export const CameraSettingsSchema = Schema.Struct({
  fov: Schema.Number.pipe(Schema.brand('FOV')),
  sensitivity: Schema.Number.pipe(Schema.brand('Sensitivity')),
  distance: Schema.Number.pipe(Schema.brand('CameraDistance')),
  smoothing: Schema.Number,
})

/**
 * AnimationStateスキーマ
 */
export const AnimationStateSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal('position', 'rotation', 'fov', 'transition'),
  progress: Schema.Number.pipe(Schema.between(0, 1)),
  duration: Schema.Number.pipe(Schema.positive()),
  startTime: Schema.Number,
})

/**
 * 個別のイベントスキーマ
 */
export const CameraInitializedSchema = Schema.Struct({
  _tag: Schema.Literal('CameraInitialized'),
  cameraId: CameraIdSchema,
  viewMode: Schema.Literal('first-person', 'third-person'),
  timestamp: Schema.Number,
})

export const ViewModeChangedSchema = Schema.Struct({
  _tag: Schema.Literal('ViewModeChanged'),
  cameraId: CameraIdSchema,
  fromMode: Schema.Literal('first-person', 'third-person'),
  toMode: Schema.Literal('first-person', 'third-person'),
  timestamp: Schema.Number,
})

export const PositionUpdatedSchema = Schema.Struct({
  _tag: Schema.Literal('PositionUpdated'),
  cameraId: CameraIdSchema,
  fromPosition: Position3DSchema,
  toPosition: Position3DSchema,
  timestamp: Schema.Number,
})

export const RotationUpdatedSchema = Schema.Struct({
  _tag: Schema.Literal('RotationUpdated'),
  cameraId: CameraIdSchema,
  fromRotation: CameraRotationSchema,
  toRotation: CameraRotationSchema,
  timestamp: Schema.Number,
})

export const SettingsChangedSchema = Schema.Struct({
  _tag: Schema.Literal('SettingsChanged'),
  cameraId: CameraIdSchema,
  changedSettings: Schema.partial(CameraSettingsSchema),
  timestamp: Schema.Number,
})

export const AnimationStartedSchema = Schema.Struct({
  _tag: Schema.Literal('AnimationStarted'),
  cameraId: CameraIdSchema,
  animationState: AnimationStateSchema,
  timestamp: Schema.Number,
})

export const AnimationCompletedSchema = Schema.Struct({
  _tag: Schema.Literal('AnimationCompleted'),
  cameraId: CameraIdSchema,
  animationState: AnimationStateSchema,
  timestamp: Schema.Number,
})

export const AnimationCancelledSchema = Schema.Struct({
  _tag: Schema.Literal('AnimationCancelled'),
  cameraId: CameraIdSchema,
  animationState: AnimationStateSchema,
  reason: Schema.String,
  timestamp: Schema.Number,
})

export const CollisionDetectedSchema = Schema.Struct({
  _tag: Schema.Literal('CollisionDetected'),
  cameraId: CameraIdSchema,
  position: Position3DSchema,
  obstruction: Schema.Unknown,
  timestamp: Schema.Number,
})

export const CameraLockedSchema = Schema.Struct({
  _tag: Schema.Literal('CameraLocked'),
  cameraId: CameraIdSchema,
  reason: Schema.String,
  timestamp: Schema.Number,
})

export const CameraUnlockedSchema = Schema.Struct({
  _tag: Schema.Literal('CameraUnlocked'),
  cameraId: CameraIdSchema,
  timestamp: Schema.Number,
})

export const FOVChangedSchema = Schema.Struct({
  _tag: Schema.Literal('FOVChanged'),
  cameraId: CameraIdSchema,
  fromFOV: Schema.Number.pipe(Schema.brand('FOV')),
  toFOV: Schema.Number.pipe(Schema.brand('FOV')),
  timestamp: Schema.Number,
})

export const SensitivityChangedSchema = Schema.Struct({
  _tag: Schema.Literal('SensitivityChanged'),
  cameraId: CameraIdSchema,
  fromSensitivity: Schema.Number.pipe(Schema.brand('Sensitivity')),
  toSensitivity: Schema.Number.pipe(Schema.brand('Sensitivity')),
  timestamp: Schema.Number,
})

export const CameraShakeStartedSchema = Schema.Struct({
  _tag: Schema.Literal('CameraShakeStarted'),
  cameraId: CameraIdSchema,
  intensity: Schema.Number.pipe(Schema.between(0, 1)),
  duration: Schema.Number.pipe(Schema.positive()),
  timestamp: Schema.Number,
})

export const CameraShakeEndedSchema = Schema.Struct({
  _tag: Schema.Literal('CameraShakeEnded'),
  cameraId: CameraIdSchema,
  timestamp: Schema.Number,
})

/**
 * カメライベント統合スキーマ
 */
export const CameraEventSchema = Schema.Union(
  CameraInitializedSchema,
  ViewModeChangedSchema,
  PositionUpdatedSchema,
  RotationUpdatedSchema,
  SettingsChangedSchema,
  AnimationStartedSchema,
  AnimationCompletedSchema,
  AnimationCancelledSchema,
  CollisionDetectedSchema,
  CameraLockedSchema,
  CameraUnlockedSchema,
  FOVChangedSchema,
  SensitivityChangedSchema,
  CameraShakeStartedSchema,
  CameraShakeEndedSchema
)

// ========================================
// Event Factory Functions
// ========================================

/**
 * カメライベントファクトリー
 */
export const createCameraEvent = {
  cameraInitialized: (cameraId: CameraId, viewMode: CameraMode): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'CameraInitialized' as const,
        cameraId,
        viewMode,
        timestamp,
      })
    }),

  viewModeChanged: (cameraId: CameraId, fromMode: CameraMode, toMode: CameraMode): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'ViewModeChanged' as const,
        cameraId,
        fromMode,
        toMode,
        timestamp,
      })
    }),

  positionUpdated: (cameraId: CameraId, fromPosition: Position3D, toPosition: Position3D): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'PositionUpdated' as const,
        cameraId,
        fromPosition,
        toPosition,
        timestamp,
      })
    }),

  rotationUpdated: (
    cameraId: CameraId,
    fromRotation: CameraRotation,
    toRotation: CameraRotation
  ): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'RotationUpdated' as const,
        cameraId,
        fromRotation,
        toRotation,
        timestamp,
      })
    }),

  settingsChanged: (cameraId: CameraId, changedSettings: Partial<CameraSettings>): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'SettingsChanged' as const,
        cameraId,
        changedSettings,
        timestamp,
      })
    }),

  animationStarted: (cameraId: CameraId, animationState: AnimationState): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'AnimationStarted' as const,
        cameraId,
        animationState,
        timestamp,
      })
    }),

  animationCompleted: (cameraId: CameraId, animationState: AnimationState): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'AnimationCompleted' as const,
        cameraId,
        animationState,
        timestamp,
      })
    }),

  animationCancelled: (
    cameraId: CameraId,
    animationState: AnimationState,
    reason: string
  ): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'AnimationCancelled' as const,
        cameraId,
        animationState,
        reason,
        timestamp,
      })
    }),

  collisionDetected: (cameraId: CameraId, position: Position3D, obstruction: unknown): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'CollisionDetected' as const,
        cameraId,
        position,
        obstruction,
        timestamp,
      })
    }),

  cameraLocked: (cameraId: CameraId, reason: string): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'CameraLocked' as const,
        cameraId,
        reason,
        timestamp,
      })
    }),

  cameraUnlocked: (cameraId: CameraId): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'CameraUnlocked' as const,
        cameraId,
        timestamp,
      })
    }),

  fovChanged: (cameraId: CameraId, fromFOV: FOV, toFOV: FOV): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'FOVChanged' as const,
        cameraId,
        fromFOV,
        toFOV,
        timestamp,
      })
    }),

  sensitivityChanged: (
    cameraId: CameraId,
    fromSensitivity: Sensitivity,
    toSensitivity: Sensitivity
  ): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'SensitivityChanged' as const,
        cameraId,
        fromSensitivity,
        toSensitivity,
        timestamp,
      })
    }),

  cameraShakeStarted: (cameraId: CameraId, intensity: number, duration: number): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'CameraShakeStarted' as const,
        cameraId,
        intensity,
        duration,
        timestamp,
      })
    }),

  cameraShakeEnded: (cameraId: CameraId): Effect.Effect<CameraEvent> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'CameraShakeEnded' as const,
        cameraId,
        timestamp,
      })
    }),
} as const

// ========================================
// Event Type Guards
// ========================================

/**
 * カメラ初期化イベントかチェック
 */
export const isCameraInitializedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'CameraInitialized' } =>
  event._tag === 'CameraInitialized'

/**
 * ビューモード変更イベントかチェック
 */
export const isViewModeChangedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'ViewModeChanged' } =>
  event._tag === 'ViewModeChanged'

/**
 * 位置更新イベントかチェック
 */
export const isPositionUpdatedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'PositionUpdated' } =>
  event._tag === 'PositionUpdated'

/**
 * 回転更新イベントかチェック
 */
export const isRotationUpdatedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'RotationUpdated' } =>
  event._tag === 'RotationUpdated'

/**
 * 設定変更イベントかチェック
 */
export const isSettingsChangedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'SettingsChanged' } =>
  event._tag === 'SettingsChanged'

/**
 * アニメーション関連イベントかチェック
 */
export const isAnimationEvent = (event: CameraEvent): boolean =>
  event._tag === 'AnimationStarted' || event._tag === 'AnimationCompleted' || event._tag === 'AnimationCancelled'

/**
 * 衝突検出イベントかチェック
 */
export const isCollisionDetectedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'CollisionDetected' } =>
  event._tag === 'CollisionDetected'
