/**
 * Effect-TS + Fast-Check 統合テストジェネレーター
 *
 * Context7最新仕様準拠のProperty-based Testing基盤
 * - Fast-Check v4の型推論強化対応
 * - Effect-TS v3.17+統合パターン
 * - Brand型・ADT完全対応
 */

import { Brand, Data, Effect, Option, pipe } from 'effect'
import * as fc from 'fast-check'
import type {
  CameraDistance,
  Position3D,
  ViewOffset,
  LerpFactor,
  Velocity3D,
  Direction3D,
  BoundingBox,
  Axis,
} from '../../value_object/camera_position/types'
import type {
  Pitch,
  Yaw,
  CameraRotation,
  MouseDelta,
} from '../../value_object/camera_rotation/types'
import type {
  FOV,
  Sensitivity,
} from '../../value_object/camera_settings/types'
import type { ViewMode as ViewModeType } from '../../value_object/view_mode/types'
import { ViewMode } from '../../value_object/view_mode/types'
import type { CameraError } from '../../types/errors'
import {
  InitializationFailed,
  CameraNotInitialized,
  InvalidConfiguration,
  InvalidMode,
  InvalidParameter,
  ResourceError,
  AnimationError,
  CollisionError,
} from '../../types/errors'

// Local type definitions for testing
type Angle = number & Brand.Brand<'Angle'>
type DeltaTime = number & Brand.Brand<'DeltaTime'>

// ================================================================================
// Fast-Check v4 最新機能活用
// ================================================================================

/**
 * Fast-Check v4の改善された型推論を活用したBrand型Arbitrary
 * Context7確認済み：v4では明示的型注釈不要
 */

// 数値範囲Brand型Generator（Fast-Check v4型推論対応）
export const fovArbitrary = fc
  .integer({ min: 30, max: 120 })
  .map((n) => Brand.nominal<FOV>()(n))

export const sensitivityArbitrary = fc
  .float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true })
  .map((n) => Brand.nominal<Sensitivity>()(n))

export const mouseDeltaArbitrary = fc
  .float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true })
  .map((n) => Brand.nominal<MouseDelta>()(n))

export const deltaTimeArbitrary = fc
  .float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true })
  .map((n) => Brand.nominal<DeltaTime>()(n))

// 角度系Brand型Generator
export const angleArbitrary = fc
  .float({ min: Math.fround(-360), max: Math.fround(360), noNaN: true, noDefaultInfinity: true })
  .filter(n => Math.abs(n) > 1e-20 || n === 0) // Exclude subnormal numbers
  .map((angle) => Brand.nominal<Angle>()(angle))

export const pitchArbitrary = fc
  .float({ min: Math.fround(-90), max: Math.fround(90), noNaN: true })
  .map((pitch) => Brand.nominal<Pitch>()(pitch))

export const yawArbitrary = fc
  .float({ min: Math.fround(0), max: Math.fround(360), noNaN: true })
  .map((yaw) => Brand.nominal<Yaw>()(yaw))

// 位置系Brand型Generator
export const coordinateArbitrary = fc.float({
  min: Math.fround(-1000),
  max: Math.fround(1000),
  noNaN: true,
  noDefaultInfinity: true,
})

export const position3DArbitrary = fc
  .record({
    x: coordinateArbitrary,
    y: coordinateArbitrary,
    z: coordinateArbitrary,
  })
  .map(({ x, y, z }) => Brand.nominal<Position3D>()({ x, y, z }))

export const cameraDistanceArbitrary = fc
  .float({ min: Math.fround(1), max: Math.fround(50), noNaN: true })
  .map((distance) => Brand.nominal<CameraDistance>()(distance))

export const viewOffsetArbitrary = fc
  .record({
    x: fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true }),
    y: fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true }),
    z: fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true }),
  })
  .map(({ x, y, z }) => Brand.nominal<ViewOffset>()({ x, y, z }))

export const lerpFactorArbitrary = fc
  .float({ min: Math.fround(0), max: Math.fround(1), noNaN: true })
  .map((factor) => Brand.nominal<LerpFactor>()(factor))

export const velocity3DArbitrary = fc
  .record({
    x: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
    y: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
    z: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
  })
  .map(({ x, y, z }) => Brand.nominal<Velocity3D>()({ x, y, z }))

// 正規化されたDirection3D（Fast-Check v4 filter + map パターン）
export const direction3DArbitrary = fc
  .record({
    x: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
    y: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
    z: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
  })
  .filter(({ x, y, z }) => {
    const magnitude = Math.sqrt(x * x + y * y + z * z)
    return magnitude > 0.001 // ゼロベクトル除外
  })
  .map(({ x, y, z }) => {
    const magnitude = Math.sqrt(x * x + y * y + z * z)
    return Brand.nominal<Direction3D>()({
      x: x / magnitude,
      y: y / magnitude,
      z: z / magnitude,
    })
  })

// 複合Brand型Generator
export const cameraRotationArbitrary = fc
  .record({
    pitch: pitchArbitrary,
    yaw: yawArbitrary,
    roll: angleArbitrary,
  })
  .map((rotation) => Brand.nominal<CameraRotation>()(rotation))

export const boundingBoxArbitrary = fc
  .tuple(position3DArbitrary, position3DArbitrary)
  .map(([pos1, pos2]) => {
    const minX = Math.min(pos1.x, pos2.x)
    const maxX = Math.max(pos1.x, pos2.x)
    const minY = Math.min(pos1.y, pos2.y)
    const maxY = Math.max(pos1.y, pos2.y)
    const minZ = Math.min(pos1.z, pos2.z)
    const maxZ = Math.max(pos1.z, pos2.z)

    return Brand.nominal<BoundingBox>()({
      min: Brand.nominal<Position3D>()({ x: minX, y: minY, z: minZ }),
      max: Brand.nominal<Position3D>()({ x: maxX, y: maxY, z: maxZ }),
    })
  })

// ================================================================================
// ADT (Algebraic Data Type) Generators
// ================================================================================

/**
 * Camera Error ADT Generator（全パターン網羅）
 * 正しいCameraErrorコンストラクタ使用版
 */
export const cameraErrorArbitrary: fc.Arbitrary<CameraError> = fc.oneof(
  // InitializationFailed
  fc
    .record({
      message: fc.constantFrom('Camera initialization failed', 'Invalid camera configuration', 'Resource allocation error', 'Animation setup failed', 'Collision detection error'),
      cause: fc.option(fc.anything()),
    })
    .map(({ message, cause }) =>
      InitializationFailed({
        message,
        cause: cause === null ? Option.none() : Option.some(cause)
      })
    ),

  // CameraNotInitialized
  fc
    .record({
      operation: fc.constantFrom('rotate', 'setFOV', 'setSensitivity', 'update', 'switchMode'),
    })
    .map(({ operation }) =>
      CameraNotInitialized({ operation })
    ),

  // InvalidConfiguration
  fc
    .record({
      message: fc.constantFrom('Camera initialization failed', 'Invalid camera configuration', 'Resource allocation error', 'Animation setup failed', 'Collision detection error'),
      config: fc.option(fc.dictionary(fc.string(), fc.anything())),
    })
    .map(({ message, config }) =>
      InvalidConfiguration({
        message,
        config: config === null ? Option.none() : Option.some(config)
      })
    ),

  // InvalidMode
  fc
    .record({
      mode: fc.string({ minLength: 1, maxLength: 20 }),
      validModes: fc.array(fc.constantFrom('first-person', 'third-person', 'spectator', 'cinematic'), {
        minLength: 1,
        maxLength: 4,
      }),
    })
    .map(({ mode, validModes }) =>
      InvalidMode({ mode, validModes })
    ),

  // InvalidParameter
  fc
    .record({
      parameter: fc.constantFrom('fov', 'sensitivity', 'distance', 'smoothing', 'position', 'rotation'),
      value: fc.anything(),
      expected: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
    })
    .map(({ parameter, value, expected }) =>
      InvalidParameter({
        parameter,
        value,
        expected: expected === null ? Option.none() : Option.some(expected)
      })
    ),

  // ResourceError
  fc
    .record({
      message: fc.constantFrom('Camera initialization failed', 'Invalid camera configuration', 'Resource allocation error', 'Animation setup failed', 'Collision detection error'),
      cause: fc.option(fc.anything()),
    })
    .map(({ message, cause }) =>
      ResourceError({
        message,
        cause: cause === null ? Option.none() : Option.some(cause)
      })
    ),

  // AnimationError
  fc
    .record({
      message: fc.constantFrom('Camera initialization failed', 'Invalid camera configuration', 'Resource allocation error', 'Animation setup failed', 'Collision detection error'),
      context: fc.option(fc.record({ timeline: fc.string(), keyframe: fc.nat() })),
    })
    .map(({ message, context }) =>
      AnimationError({
        message,
        context: context === null ? Option.none() : Option.some(context)
      })
    ),

  // CollisionError
  fc
    .record({
      message: fc.constantFrom('Camera initialization failed', 'Invalid camera configuration', 'Resource allocation error', 'Animation setup failed', 'Collision detection error'),
      details: fc.option(fc.record({ position: position3DArbitrary, bounds: boundingBoxArbitrary })),
    })
    .map(({ message, details }) =>
      CollisionError({
        message,
        details: details === null ? Option.none() : Option.some(details)
      })
    )
)

/**
 * ViewMode ADT Generator（Fast-Check v4 constantFrom型推論対応）
 */
export const viewModeArbitrary = fc.oneof(
  // FirstPerson
  fc
    .record({
      bobbing: fc.boolean(),
      mouseSensitivity: sensitivityArbitrary,
      smoothing: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
      headOffset: fc.float({ min: Math.fround(0), max: Math.fround(2), noNaN: true }),
    })
    .map((settings) =>
      ViewMode.FirstPerson({ settings })
    ),

  // ThirdPerson
  fc
    .record({
      settings: fc.record({
        mouseSensitivity: sensitivityArbitrary,
        smoothing: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        distance: cameraDistanceArbitrary,
        verticalOffset: fc.float({ min: Math.fround(-2), max: Math.fround(2), noNaN: true }),
        collisionEnabled: fc.boolean(),
      }),
      distance: cameraDistanceArbitrary,
    })
    .map(({ settings, distance }) =>
      ViewMode.ThirdPerson({ settings, distance })
    ),

  // Spectator
  fc
    .record({
      movementSpeed: fc.float({ min: Math.fround(1), max: Math.fround(50), noNaN: true }),
      mouseSensitivity: sensitivityArbitrary,
      freefly: fc.boolean(),
      nightVision: fc.boolean(),
    })
    .map((settings) =>
      ViewMode.Spectator({ settings })
    ),

  // Cinematic
  fc
    .record({
      settings: fc.record({
        easing: fc.boolean(),
        duration: fc.float({ min: Math.fround(0.1), max: Math.fround(10.0), noNaN: true }),
        interpolation: fc.constantFrom('linear', 'smooth', 'bezier'), // Fast-Check v4型推論
        lockInput: fc.boolean(),
      }),
      timeline: fc.record({
        keyframes: fc.array(fc.record({
          time: fc.float({ min: Math.fround(0), max: Math.fround(10), noNaN: true }),
          position: fc.record({
            x: fc.float({ min: -100, max: 100 }),
            y: fc.float({ min: -100, max: 100 }),
            z: fc.float({ min: -100, max: 100 }),
          }),
          rotation: fc.record({
            pitch: fc.float({ min: -Math.PI/2, max: Math.PI/2 }),
            yaw: fc.float({ min: -Math.PI, max: Math.PI }),
          }),
          easing: fc.constantFrom('linear', 'ease-in', 'ease-out', 'ease-in-out'),
        }), { minLength: 2, maxLength: 10 }),
        duration: fc.float({ min: Math.fround(0.1), max: Math.fround(10.0), noNaN: true }),
        loop: fc.boolean(),
      }),
    })
    .map(({ settings, timeline }) =>
      ViewMode.Cinematic({ settings, timeline })
    )
)

// ================================================================================
// Effect-TS統合Property-based Testing Helpers
// ================================================================================

/**
 * Effect-TS統合Property-based Testing関数
 * Context7確認済み：最新のEffect.gen + fc.assert パターン
 */
export const effectProperty = <T, E, R>(
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => Effect.Effect<boolean, E, R>
): fc.AsyncProperty<[T]> =>
  fc.asyncProperty(arbitrary, async (value: T) => {
    const result = await Effect.runPromise(predicate(value))
    return result
  })

/**
 * 数学的性質テスト用ヘルパー
 * 精度を考慮した浮動小数点比較
 */
export const EPSILON = 1e-10

export const approximatelyEqual = (a: number, b: number, epsilon = EPSILON): boolean =>
  Math.abs(a - b) < epsilon

export const position3DApproximatelyEqual = (
  pos1: Position3D,
  pos2: Position3D,
  epsilon = EPSILON
): boolean =>
  approximatelyEqual(pos1.x, pos2.x, epsilon) &&
  approximatelyEqual(pos1.y, pos2.y, epsilon) &&
  approximatelyEqual(pos1.z, pos2.z, epsilon)

/**
 * 境界値テスト用のEdge Caseジェネレーター
 * Fast-Check v4の改善されたconstant + oneof パターン
 */
export const edgeCasePositionArbitrary = fc.oneof(
  // ゼロ座標
  fc.constant(Brand.nominal<Position3D>()({ x: 0, y: 0, z: 0 })),
  // 境界値
  fc.constant(Brand.nominal<Position3D>()({ x: 1000, y: 1000, z: 1000 })),
  fc.constant(Brand.nominal<Position3D>()({ x: -1000, y: -1000, z: -1000 })),
  // 最小値付近
  fc.constant(Brand.nominal<Position3D>()({ x: 0.001, y: 0.001, z: 0.001 })),
  fc.constant(Brand.nominal<Position3D>()({ x: -0.001, y: -0.001, z: -0.001 })),
  // 大きな値
  fc.constant(Brand.nominal<Position3D>()({ x: 999.999, y: 999.999, z: 999.999 })),
  fc.constant(Brand.nominal<Position3D>()({ x: -999.999, y: -999.999, z: -999.999 }))
)

export const edgeCaseFOVArbitrary = fc.oneof(
  fc.constant(Brand.nominal<FOV>()(30)), // 最小値
  fc.constant(Brand.nominal<FOV>()(120)), // 最大値
  fc.constant(Brand.nominal<FOV>()(75)), // デフォルト値
  fc.constant(Brand.nominal<FOV>()(90)), // 一般的な値
  fc.constant(Brand.nominal<FOV>()(60)) // 一般的な値
)

export const edgeCaseSensitivityArbitrary = fc.oneof(
  fc.constant(Brand.nominal<Sensitivity>()(0.1)), // 最小値
  fc.constant(Brand.nominal<Sensitivity>()(5.0)), // 最大値
  fc.constant(Brand.nominal<Sensitivity>()(1.0)), // デフォルト値
  fc.constant(Brand.nominal<Sensitivity>()(0.5)), // 一般的な値
  fc.constant(Brand.nominal<Sensitivity>()(2.0)) // 一般的な値
)

/**
 * 性能テスト用大量データGenerator
 */
export const largeBatchPositionArbitrary = fc.array(position3DArbitrary, {
  minLength: 1000,
  maxLength: 10000,
})

export const largeBatchRotationArbitrary = fc.array(cameraRotationArbitrary, {
  minLength: 1000,
  maxLength: 10000,
})

/**
 * 並行処理テスト用ID付きデータGenerator
 */
export const concurrentCameraOperationArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  position: position3DArbitrary,
  rotation: cameraRotationArbitrary,
  fov: fovArbitrary,
  sensitivity: sensitivityArbitrary,
})

export const concurrentOperationBatchArbitrary = fc.array(concurrentCameraOperationArbitrary, {
  minLength: 10,
  maxLength: 100,
})

/**
 * Fast-Check v4 + Effect統合のアサーション関数
 */
export const assertEffectSuccess = <T, E, R>(
  effect: Effect.Effect<T, E, R>
): Effect.Effect<T, E, R> =>
  pipe(
    effect,
    Effect.tap((result) =>
      Effect.sync(() => {
        expect(result).toBeDefined()
      })
    )
  )

export const assertEffectFailure = <T, E, R>(
  effect: Effect.Effect<T, E, R>
): Effect.Effect<E, never, R> =>
  pipe(
    effect,
    Effect.flip,
    Effect.tap((error) =>
      Effect.sync(() => {
        expect(error).toBeDefined()
      })
    )
  )

/**
 * バリデーション関数のProperty-based Testing用Wrapper
 */
export const validationProperty = <T, U, E>(
  arbitrary: fc.Arbitrary<T>,
  validator: (input: T) => Effect.Effect<U, E, never>,
  predicate: (input: T, output: U) => boolean
) =>
  effectProperty(arbitrary, (input: T) =>
    pipe(
      validator(input),
      Effect.map((output) => predicate(input, output)),
      Effect.catchAll(() => Effect.succeed(false))
    )
  )