import { Brand, Effect, pipe, Schema } from 'effect'
import {
  Axis,
  BoundingBox,
  BoundingBoxSchema,
  CameraDistance,
  CameraDistanceSchema,
  Direction3D,
  Direction3DSchema,
  LerpFactor,
  LerpFactorSchema,
  Position3D,
  Position3DSchema,
  PositionError,
  ViewOffset,
  ViewOffsetSchema,
} from './index'

/**
 * Position3D ファクトリー関数
 */
export const createPosition3D = (x: number, y: number, z: number): Effect.Effect<Position3D, PositionError> =>
  pipe(
    Schema.decodeUnknown(Position3DSchema)({ x, y, z }),
    Effect.mapError((parseError) => {
      // どの座標軸がエラーかを判定
      const errorAxis: Axis = parseError.message.includes('x') ? 'x' : parseError.message.includes('y') ? 'y' : 'z'
      const errorValue = errorAxis === 'x' ? x : errorAxis === 'y' ? y : z

      return PositionError.InvalidCoordinate({
        axis: errorAxis,
        value: errorValue,
        expected: 'finite number',
      })
    })
  )

/**
 * CameraDistance ファクトリー関数
 */
export const createCameraDistance = (distance: number): Effect.Effect<CameraDistance, PositionError> =>
  pipe(
    Schema.decodeUnknown(CameraDistanceSchema)(distance),
    Effect.mapError(() =>
      PositionError.InvalidDistance({
        distance,
        min: 1,
        max: 50,
      })
    )
  )

/**
 * ViewOffset ファクトリー関数
 */
export const createViewOffset = (x: number, y: number, z: number): Effect.Effect<ViewOffset, PositionError> =>
  pipe(
    Schema.decodeUnknown(ViewOffsetSchema)({ x, y, z }),
    Effect.mapError((parseError) =>
      PositionError.InvalidOffset({
        field: 'viewOffset',
        value: parseError.message.includes('x') ? x : parseError.message.includes('y') ? y : z,
        expected: 'number between -10 and 10',
      })
    )
  )

/**
 * LerpFactor ファクトリー関数
 */
export const createLerpFactor = (factor: number): Effect.Effect<LerpFactor, PositionError> =>
  pipe(
    Schema.decodeUnknown(LerpFactorSchema)(factor),
    Effect.mapError(() =>
      PositionError.InvalidLerpFactor({
        factor,
        expected: 'number between 0 and 1',
      })
    )
  )

/**
 * Direction3D ファクトリー関数（自動正規化）
 */
export const createDirection3D = (x: number, y: number, z: number): Effect.Effect<Direction3D, PositionError> => {
  const magnitude = Math.sqrt(x * x + y * y + z * z)

  if (magnitude === 0) {
    return Effect.fail(
      PositionError.InvalidCoordinate({
        axis: 'x', // 代表値
        value: 0,
        expected: 'non-zero vector for normalization',
      })
    )
  }

  const normalized = {
    x: x / magnitude,
    y: y / magnitude,
    z: z / magnitude,
  }

  return pipe(
    Schema.decodeUnknown(Direction3DSchema)(normalized),
    Effect.mapError(() =>
      PositionError.InvalidCoordinate({
        axis: 'x', // 代表値
        value: magnitude,
        expected: 'normalizable vector',
      })
    )
  )
}

/**
 * Position3D 操作関数群
 */
export const Position3DOps = {
  /**
   * 座標の加算
   */
  add: (a: Position3D, b: Position3D): Position3D =>
    Brand.nominal<Position3D>()({
      x: a.x + b.x,
      y: a.y + b.y,
      z: a.z + b.z,
    }),

  /**
   * 座標の減算
   */
  subtract: (a: Position3D, b: Position3D): Position3D =>
    Brand.nominal<Position3D>()({
      x: a.x - b.x,
      y: a.y - b.y,
      z: a.z - b.z,
    }),

  /**
   * スカラー倍
   */
  multiply: (position: Position3D, scalar: number): Position3D =>
    Brand.nominal<Position3D>()({
      x: position.x * scalar,
      y: position.y * scalar,
      z: position.z * scalar,
    }),

  /**
   * 2点間の距離計算
   */
  distance: (a: Position3D, b: Position3D): Effect.Effect<number, PositionError> =>
    Effect.try({
      try: () => {
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dz = b.z - a.z
        return Math.sqrt(dx * dx + dy * dy + dz * dz)
      },
      catch: (error) =>
        PositionError.DistanceCalculationFailed({
          from: a,
          to: b,
          reason: String(error),
        }),
    }),

  /**
   * 線形補間
   */
  lerp: (from: Position3D, to: Position3D, factor: LerpFactor): Position3D => {
    const t = factor as number // Brand型をnumberとして扱う
    return Brand.nominal<Position3D>()({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t,
    })
  },

  /**
   * 原点からの距離（マグニチュード）
   */
  magnitude: (position: Position3D): number =>
    Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z),

  /**
   * 正規化
   */
  normalize: (position: Position3D): Effect.Effect<Direction3D, PositionError> =>
    createDirection3D(position.x, position.y, position.z),

  /**
   * 境界内チェック
   */
  isInBounds: (position: Position3D, bounds: BoundingBox): boolean =>
    position.x >= bounds.min.x &&
    position.x <= bounds.max.x &&
    position.y >= bounds.min.y &&
    position.y <= bounds.max.y &&
    position.z >= bounds.min.z &&
    position.z <= bounds.max.z,

  /**
   * 境界でクランプ
   */
  clamp: (position: Position3D, bounds: BoundingBox): Position3D =>
    Brand.nominal<Position3D>()({
      x: Math.max(bounds.min.x, Math.min(bounds.max.x, position.x)),
      y: Math.max(bounds.min.y, Math.min(bounds.max.y, position.y)),
      z: Math.max(bounds.min.z, Math.min(bounds.max.z, position.z)),
    }),

  /**
   * 近似比較（浮動小数点誤差考慮）
   */
  equals: (a: Position3D, b: Position3D, epsilon: number = 0.0001): boolean =>
    Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon && Math.abs(a.z - b.z) < epsilon,
}

/**
 * 事前定義された定数
 */
export const Position3DConstants = {
  ORIGIN: Brand.nominal<Position3D>()({ x: 0, y: 0, z: 0 }),
  UNIT_X: Brand.nominal<Position3D>()({ x: 1, y: 0, z: 0 }),
  UNIT_Y: Brand.nominal<Position3D>()({ x: 0, y: 1, z: 0 }),
  UNIT_Z: Brand.nominal<Position3D>()({ x: 0, y: 0, z: 1 }),

  // Minecraft固有の定数
  WORLD_HEIGHT_MIN: -64,
  WORLD_HEIGHT_MAX: 320,
  WORLD_BORDER_MAX: 30000000,
} as const

/**
 * BoundingBox 操作関数群
 */
export const BoundingBoxOps = {
  /**
   * BoundingBox作成
   */
  create: (min: Position3D, max: Position3D): Effect.Effect<BoundingBox, PositionError> =>
    pipe(
      Schema.decodeUnknown(BoundingBoxSchema)({ min, max }),
      Effect.mapError(() =>
        PositionError.OutOfBounds({
          position: { x: min.x, y: min.y, z: min.z },
          bounds: { min, max },
        })
      )
    ),

  /**
   * 中心点取得
   */
  center: (bbox: BoundingBox): Position3D => Position3DOps.lerp(bbox.min, bbox.max, Brand.nominal<LerpFactor>()(0.5)),

  /**
   * サイズ取得
   */
  size: (bbox: BoundingBox): Position3D => Position3DOps.subtract(bbox.max, bbox.min),

  /**
   * BoundingBox拡張
   */
  expand: (bbox: BoundingBox, amount: number): BoundingBox => {
    const expansion = Brand.nominal<Position3D>()({ x: amount, y: amount, z: amount })
    return Brand.nominal<BoundingBox>()({
      min: Position3DOps.subtract(bbox.min, expansion),
      max: Position3DOps.add(bbox.max, expansion),
    })
  },
}
