import { Brand, Data } from 'effect'

/**
 * 3D位置座標のBrand型
 */
export type Position3D = Brand.Brand<
  {
    readonly x: number
    readonly y: number
    readonly z: number
  },
  'Position3D'
>

/**
 * カメラ距離のBrand型（制約付き）
 */
export type CameraDistance = Brand.Brand<number, 'CameraDistance'> & {
  readonly min: 1
  readonly max: 50
}

/**
 * 視点オフセットのBrand型
 */
export type ViewOffset = Brand.Brand<
  {
    readonly x: number
    readonly y: number
    readonly z: number
  },
  'ViewOffset'
>

/**
 * 補間係数のBrand型（0-1の範囲）
 */
export type LerpFactor = Brand.Brand<number, 'LerpFactor'> & {
  readonly min: 0
  readonly max: 1
}

/**
 * 速度ベクトルのBrand型
 */
export type Velocity3D = Brand.Brand<
  {
    readonly x: number
    readonly y: number
    readonly z: number
  },
  'Velocity3D'
>

/**
 * 境界ボックスのBrand型
 */
export type BoundingBox = Brand.Brand<
  {
    readonly min: Position3D
    readonly max: Position3D
  },
  'BoundingBox'
>

/**
 * Position関連のエラーADT
 */
export type PositionError = Data.TaggedEnum<{
  InvalidCoordinate: { readonly axis: 'x' | 'y' | 'z'; readonly value: number; readonly expected: string }
  OutOfBounds: {
    readonly position: { x: number; y: number; z: number }
    readonly bounds: { min: Position3D; max: Position3D }
  }
  InvalidDistance: { readonly distance: number; readonly min: number; readonly max: number }
  InvalidLerpFactor: { readonly factor: number; readonly expected: string }
  InvalidOffset: { readonly field: string; readonly value: number; readonly expected: string }
  DistanceCalculationFailed: { readonly from: Position3D; readonly to: Position3D; readonly reason: string }
}>

/**
 * PositionError コンストラクタ
 */
export const PositionError = Data.taggedEnum<PositionError>()

/**
 * 座標軸の列挙型
 */
export type Axis = 'x' | 'y' | 'z'

/**
 * 方向ベクトルの正規化された値
 */
export type Direction3D = Brand.Brand<
  {
    readonly x: number
    readonly y: number
    readonly z: number
  },
  'Direction3D'
> & {
  readonly magnitude: 1
}
