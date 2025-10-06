import { Brand, Effect, Schema } from 'effect'

// ========================================
// Brand Types
// ========================================

/**
 * FOV（視野角）のBrand型
 */
export type FOV = number & Brand.Brand<'FOV'>

/**
 * 感度のBrand型
 */
export type Sensitivity = number & Brand.Brand<'Sensitivity'>

/**
 * カメラ距離のBrand型
 */
export type CameraDistance = number & Brand.Brand<'CameraDistance'>

/**
 * ピッチ角のBrand型
 */
export type PitchAngle = number & Brand.Brand<'PitchAngle'>

/**
 * ヨー角のBrand型
 */
export type YawAngle = number & Brand.Brand<'YawAngle'>

/**
 * アニメーション時間のBrand型
 */
export type AnimationDuration = number & Brand.Brand<'AnimationDuration'>

/**
 * マウス移動量のBrand型
 */
export type MouseDelta = number & Brand.Brand<'MouseDelta'>

/**
 * デルタ時間のBrand型
 * Re-export from units with alias
 */
export type { Milliseconds as DeltaTime } from '../../shared/value_object/units'

/**
 * 3D位置のBrand型
 */
export type Position3D = {
  readonly x: number
  readonly y: number
  readonly z: number
} & Brand.Brand<'Position3D'>

/**
 * 2D回転のBrand型
 */
export type Rotation2D = {
  readonly pitch: PitchAngle
  readonly yaw: YawAngle
} & Brand.Brand<'Rotation2D'>

// ========================================
// Default Values
// ========================================

/**
 * カメラのデフォルト値定数
 */
export const CAMERA_DEFAULTS = {
  FOV: Brand.nominal<FOV>()(75),
  SENSITIVITY: Brand.nominal<Sensitivity>()(1.0),
  FIRST_PERSON_HEIGHT: 1.6,
  THIRD_PERSON_DISTANCE: Brand.nominal<CameraDistance>()(5.0),
  THIRD_PERSON_HEIGHT: 2.0,
  THIRD_PERSON_ANGLE: 0,
  ANIMATION_DURATION: Brand.nominal<AnimationDuration>()(300),
  NEAR_PLANE: 0.1,
  FAR_PLANE: 1000,
  SMOOTHING_FACTOR: 0.8,
} as const

/**
 * カメラ角度のデフォルト値
 */
export const CAMERA_ANGLE_DEFAULTS = {
  PITCH: Brand.nominal<PitchAngle>()(0),
  YAW: Brand.nominal<YawAngle>()(0),
  MAX_PITCH: Brand.nominal<PitchAngle>()(90),
  MIN_PITCH: Brand.nominal<PitchAngle>()(-90),
} as const

// ========================================
// Limit Values
// ========================================

/**
 * カメラパラメーターの制限値
 */
export const CAMERA_LIMITS = {
  FOV: { min: 30, max: 120 },
  SENSITIVITY: { min: 0.1, max: 5.0 },
  DISTANCE: { min: 1, max: 50 },
  PITCH: { min: -90, max: 90 },
  YAW: { min: -180, max: 180 },
  ANIMATION_DURATION: { min: 50, max: 2000 },
  SMOOTHING: { min: 0, max: 1 },
} as const

/**
 * カメラ物理制限値
 */
export const CAMERA_PHYSICS_LIMITS = {
  COLLISION_RADIUS: 0.3,
  MIN_DISTANCE_FROM_SURFACE: 0.1,
  MAX_MOVEMENT_SPEED: 50,
  MAX_ROTATION_SPEED: 360, // degrees per second
} as const

// ========================================
// Physics Constants
// ========================================

/**
 * カメラ物理定数
 */
export const CAMERA_PHYSICS = {
  COLLISION_RADIUS: 0.3,
  SMOOTHING_FACTOR: 0.15,
  LERP_THRESHOLD: 0.001,
  ANIMATION_EPSILON: 0.01,
  DAMPING_FACTOR: 0.9,
  SPRING_STRENGTH: 0.2,
  FRICTION_COEFFICIENT: 0.95,
} as const

/**
 * カメラアニメーション定数
 */
export const CAMERA_ANIMATION = {
  TRANSITION_EASING: 'ease-in-out' as const,
  POSITION_TRANSITION_DURATION: 500,
  ROTATION_TRANSITION_DURATION: 300,
  FOV_TRANSITION_DURATION: 200,
  SHAKE_AMPLITUDE: 0.5,
  SHAKE_FREQUENCY: 10,
} as const

// ========================================
// Camera Mode Constants
// ========================================

/**
 * カメラモード定数
 */
export const CAMERA_MODES = {
  FIRST_PERSON: 'first-person' as const,
  THIRD_PERSON: 'third-person' as const,
} as const

/**
 * カメラモード配列
 */
export const VALID_CAMERA_MODES = [CAMERA_MODES.FIRST_PERSON, CAMERA_MODES.THIRD_PERSON] as const

/**
 * カメラモード型
 */
export type CameraMode = (typeof VALID_CAMERA_MODES)[number]

// ========================================
// Type Guards
// ========================================

/**
 * カメラモードの型ガード
 */
export const isCameraMode = (value: unknown): value is CameraMode =>
  typeof value === 'string' && VALID_CAMERA_MODES.includes(value as CameraMode)

/**
 * 有効なFOVかチェック
 */
export const isValidFOV = (value: number): value is FOV =>
  value >= CAMERA_LIMITS.FOV.min && value <= CAMERA_LIMITS.FOV.max

/**
 * 有効な感度かチェック
 */
export const isValidSensitivity = (value: number): value is Sensitivity =>
  value >= CAMERA_LIMITS.SENSITIVITY.min && value <= CAMERA_LIMITS.SENSITIVITY.max

/**
 * 有効な距離かチェック
 */
export const isValidDistance = (value: number): value is CameraDistance =>
  value >= CAMERA_LIMITS.DISTANCE.min && value <= CAMERA_LIMITS.DISTANCE.max

/**
 * 有効なピッチ角かチェック
 */
export const isValidPitch = (value: number): value is PitchAngle =>
  value >= CAMERA_LIMITS.PITCH.min && value <= CAMERA_LIMITS.PITCH.max

/**
 * 有効なヨー角かチェック（制限なし、正規化のみ）
 */
export const isValidYaw = (value: number): value is YawAngle =>
  typeof value === 'number' && !isNaN(value) && isFinite(value)

/**
 * 有効なアニメーション時間かチェック
 */
export const isValidAnimationDuration = (value: number): value is AnimationDuration =>
  value >= CAMERA_LIMITS.ANIMATION_DURATION.min && value <= CAMERA_LIMITS.ANIMATION_DURATION.max

/**
 * 有効なマウス移動量かチェック
 */
export const isValidMouseDelta = (value: number): value is MouseDelta =>
  typeof value === 'number' && !isNaN(value) && isFinite(value)

/**
 * 有効なデルタ時間かチェック
 */
export const isValidDeltaTime = (value: number): value is DeltaTime => value >= 0 && !isNaN(value) && isFinite(value)

/**
 * 有効な3D位置かチェック
 */
export const isValidPosition3D = (value: unknown): value is Position3D => Schema.is(Position3DSchema)(value)

/**
 * 有効な2D回転かチェック
 */
export const isValidRotation2D = (value: unknown): value is Rotation2D => Schema.is(Rotation2DSchema)(value)

// ========================================
// Schema Factory Functions
// ========================================

/**
 * Brand型用のNumberSchemaファクトリ関数
 * 制約付きのBranded Number Schemaを作成します
 */
export const createBrandedNumberSchema = <T extends string>(
  brand: T,
  constraints: {
    min?: number
    max?: number
    positive?: boolean
    nonNegative?: boolean
    int?: boolean
    finite?: boolean
  } = {}
) => {
  let schema = Schema.Number

  // 制約の適用
  if (constraints.min !== undefined && constraints.max !== undefined) {
    schema = schema.pipe(Schema.between(constraints.min, constraints.max))
  } else if (constraints.min !== undefined) {
    schema = schema.pipe(Schema.greaterThanOrEqualTo(constraints.min))
  } else if (constraints.max !== undefined) {
    schema = schema.pipe(Schema.lessThanOrEqualTo(constraints.max))
  }

  if (constraints.positive) {
    schema = schema.pipe(Schema.positive())
  }
  if (constraints.nonNegative) {
    schema = schema.pipe(Schema.nonNegative())
  }
  if (constraints.int) {
    schema = schema.pipe(Schema.int())
  }
  if (constraints.finite) {
    schema = schema.pipe(Schema.finite())
  }

  return schema.pipe(Schema.brand(brand))
}

/**
 * Brand型用のStructSchemaファクトリ関数
 * 複合型のBranded Schemaを作成します
 * 注意: Contextの型制約により、使用は推奨されません。直接Schema.Struct().pipe(Schema.brand())を使用してください。
 */
// export const createBrandedStructSchema = <T extends string>(
//   brand: T,
//   fields: Record<string, Schema.Schema<any, any, any>>
// ) => {
//   return Schema.Struct(fields).pipe(Schema.brand(brand))
// }

// ========================================
// Validation Schemas
// ========================================

/**
 * FOVバリデーションスキーマ
 */
export const FOVSchema = createBrandedNumberSchema('FOV', {
  min: CAMERA_LIMITS.FOV.min,
  max: CAMERA_LIMITS.FOV.max,
})

/**
 * 感度バリデーションスキーマ
 */
export const SensitivitySchema = createBrandedNumberSchema('Sensitivity', {
  min: CAMERA_LIMITS.SENSITIVITY.min,
  max: CAMERA_LIMITS.SENSITIVITY.max,
})

/**
 * カメラ距離バリデーションスキーマ
 */
export const CameraDistanceSchema = createBrandedNumberSchema('CameraDistance', {
  min: CAMERA_LIMITS.DISTANCE.min,
  max: CAMERA_LIMITS.DISTANCE.max,
})

/**
 * ピッチ角バリデーションスキーマ
 */
export const PitchAngleSchema = createBrandedNumberSchema('PitchAngle', {
  min: CAMERA_LIMITS.PITCH.min,
  max: CAMERA_LIMITS.PITCH.max,
})

/**
 * ヨー角バリデーションスキーマ
 */
export const YawAngleSchema = createBrandedNumberSchema('YawAngle', {
  finite: true,
})

/**
 * アニメーション時間バリデーションスキーマ
 */
export const AnimationDurationSchema = createBrandedNumberSchema('AnimationDuration', {
  min: CAMERA_LIMITS.ANIMATION_DURATION.min,
  max: CAMERA_LIMITS.ANIMATION_DURATION.max,
  int: true,
})

/**
 * カメラモードバリデーションスキーマ
 */
export const CameraModeSchema = Schema.Literal(...VALID_CAMERA_MODES)

/**
 * マウス移動量バリデーションスキーマ
 */
export const MouseDeltaSchema = createBrandedNumberSchema('MouseDelta', {
  finite: true,
})

/**
 * デルタ時間バリデーションスキーマ
 * Re-export from units with alias
 */
export { MillisecondsSchema as DeltaTimeSchema } from '../../shared/value_object/units'

/**
 * 3D位置バリデーションスキーマ
 */
export const Position3DSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
}).pipe(Schema.brand('Position3D'))

/**
 * 2D回転バリデーションスキーマ
 */
export const Rotation2DSchema = Schema.Struct({
  pitch: PitchAngleSchema,
  yaw: YawAngleSchema,
}).pipe(Schema.brand('Rotation2D'))

// ========================================
// Brand Type Factory Functions
// ========================================

/**
 * FOVファクトリー関数
 */
export const createFOV = (value: number): Effect.Effect<FOV, Error> =>
  Effect.gen(function* () {
    return yield* Schema.decodeUnknown(FOVSchema)(value)
  })

/**
 * 感度ファクトリー関数
 */
export const createSensitivity = (value: number): Effect.Effect<Sensitivity, Error> =>
  Effect.gen(function* () {
    return yield* Schema.decodeUnknown(SensitivitySchema)(value)
  })

/**
 * カメラ距離ファクトリー関数
 */
export const createCameraDistance = (value: number): Effect.Effect<CameraDistance, Error> =>
  Effect.gen(function* () {
    return yield* Schema.decodeUnknown(CameraDistanceSchema)(value)
  })

/**
 * ピッチ角ファクトリー関数
 */
export const createPitchAngle = (value: number): Effect.Effect<PitchAngle, Error> =>
  Effect.gen(function* () {
    return yield* Schema.decodeUnknown(PitchAngleSchema)(value)
  })

/**
 * ヨー角ファクトリー関数（正規化付き）
 */
export const createYawAngle = (value: number): Effect.Effect<YawAngle, Error> =>
  Effect.gen(function* () {
    // ヨー角を-180から180の範囲に正規化
    const normalized = ((value % 360) + 360) % 360
    const finalValue = normalized > 180 ? normalized - 360 : normalized
    return yield* Schema.decodeUnknown(YawAngleSchema)(finalValue)
  })

/**
 * アニメーション時間ファクトリー関数
 */
export const createAnimationDuration = (value: number): Effect.Effect<AnimationDuration, Error> =>
  Effect.gen(function* () {
    return yield* Schema.decodeUnknown(AnimationDurationSchema)(value)
  })

/**
 * マウス移動量ファクトリー関数
 */
export const createMouseDelta = (value: number): Effect.Effect<MouseDelta, Error> =>
  Effect.gen(function* () {
    return yield* Schema.decodeUnknown(MouseDeltaSchema)(value)
  })

/**
 * デルタ時間ファクトリー関数
 */
export const createDeltaTime = (value: number): Effect.Effect<DeltaTime, Error> =>
  Effect.gen(function* () {
    return yield* Schema.decodeUnknown(DeltaTimeSchema)(value)
  })

/**
 * 3D位置ファクトリー関数
 */
export const createPosition3D = (x: number, y: number, z: number): Effect.Effect<Position3D, Error> =>
  Effect.gen(function* () {
    const position = { x, y, z }
    return yield* Schema.decodeUnknown(Position3DSchema)(position)
  })

/**
 * 2D回転ファクトリー関数
 */
export const createRotation2D = (pitch: number, yaw: number): Rotation2D => {
  const pitchAngle = createPitchAngle(pitch)
  const yawAngle = createYawAngle(yaw)
  const rotation = { pitch: pitchAngle, yaw: yawAngle }
  return Brand.nominal<Rotation2D>()(rotation)
}

// ========================================
// Utility Constants
// ========================================

/**
 * 角度変換定数
 */
export const ANGLE_CONVERSION = {
  DEGREES_TO_RADIANS: Math.PI / 180,
  RADIANS_TO_DEGREES: 180 / Math.PI,
} as const

/**
 * カメラ状態定数
 */
export const CAMERA_STATE = {
  IDLE: 'idle' as const,
  TRANSITIONING: 'transitioning' as const,
  ANIMATING: 'animating' as const,
  LOCKED: 'locked' as const,
} as const

/**
 * カメラ優先度定数
 */
export const CAMERA_PRIORITY = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  CRITICAL: 20,
} as const

/**
 * カメラコンポーネント識別子
 */
export const CAMERA_COMPONENT_IDS = {
  POSITION: 'camera-position' as const,
  ROTATION: 'camera-rotation' as const,
  SETTINGS: 'camera-settings' as const,
  ANIMATION: 'camera-animation' as const,
} as const
