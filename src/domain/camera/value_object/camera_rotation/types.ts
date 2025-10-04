import { Brand, Data } from 'effect'

/**
 * ピッチ角のBrand型（上下回転、-90度から90度）
 */
export type Pitch = Brand.Brand<number, 'Pitch'> & {
  readonly min: -90
  readonly max: 90
}

/**
 * ヨー角のBrand型（左右回転、-180度から180度）
 */
export type Yaw = Brand.Brand<number, 'Yaw'> & {
  readonly min: -180
  readonly max: 180
}

/**
 * ロール角のBrand型（傾き回転、-180度から180度）
 */
export type Roll = Brand.Brand<number, 'Roll'> & {
  readonly min: -180
  readonly max: 180
}

/**
 * 角度（ラジアン）のBrand型
 */
export type Radians = Brand.Brand<number, 'Radians'>

/**
 * 角度（度）のBrand型
 */
export type Degrees = Brand.Brand<number, 'Degrees'>

/**
 * 汎用角度のBrand型（ラジアンまたは度）
 */
export type Angle = Radians | Degrees

/**
 * カメラ回転の複合Brand型
 */
export type CameraRotation = Brand.Brand<
  {
    readonly pitch: Pitch
    readonly yaw: Yaw
    readonly roll: Roll
  },
  'CameraRotation'
>

/**
 * マウス感度のBrand型
 */
export type MouseSensitivity = Brand.Brand<number, 'MouseSensitivity'> & {
  readonly min: 0.1
  readonly max: 5.0
}

/**
 * マウス移動量のBrand型
 */
export type MouseDelta = Brand.Brand<
  {
    readonly deltaX: number
    readonly deltaY: number
  },
  'MouseDelta'
>

/**
 * 回転補間係数のBrand型
 */
export type RotationLerpFactor = Brand.Brand<number, 'RotationLerpFactor'> & {
  readonly min: 0
  readonly max: 1
}

/**
 * 角速度のBrand型（度/秒）
 */
export type AngularVelocity = Brand.Brand<
  {
    readonly pitch: number
    readonly yaw: number
    readonly roll: number
  },
  'AngularVelocity'
>

/**
 * 回転制限のBrand型
 */
export type RotationLimits = Brand.Brand<
  {
    readonly maxPitch: Pitch
    readonly minPitch: Pitch
    readonly maxYaw: Yaw
    readonly minYaw: Yaw
    readonly maxRoll: Roll
    readonly minRoll: Roll
  },
  'RotationLimits'
>

/**
 * 回転関連のエラーADT
 */
export type RotationError = Data.TaggedEnum<{
  InvalidAngle: {
    readonly axis: 'pitch' | 'yaw' | 'roll'
    readonly value: number
    readonly min: number
    readonly max: number
  }
  InvalidSensitivity: { readonly sensitivity: number; readonly min: number; readonly max: number }
  InvalidDelta: { readonly field: 'deltaX' | 'deltaY'; readonly value: number; readonly expected: string }
  InvalidLerpFactor: { readonly factor: number; readonly expected: string }
  AngleNormalizationFailed: { readonly angle: number; readonly reason: string }
  RotationCalculationFailed: { readonly operation: string; readonly reason: string }
  OutOfRotationLimits: {
    readonly axis: 'pitch' | 'yaw' | 'roll'
    readonly value: number
    readonly limits: RotationLimits
  }
}>

/**
 * RotationError コンストラクタ
 */
export const RotationError = Data.taggedEnum<RotationError>()

/**
 * 回転軸の列挙型
 */
export type RotationAxis = 'pitch' | 'yaw' | 'roll'

/**
 * 回転方向の列挙型
 */
export type RotationDirection = 'clockwise' | 'counterclockwise'

/**
 * 四元数のBrand型（高度な回転表現用）
 */
export type Quaternion = Brand.Brand<
  {
    readonly x: number
    readonly y: number
    readonly z: number
    readonly w: number
  },
  'Quaternion'
> & {
  readonly normalized: true
}
