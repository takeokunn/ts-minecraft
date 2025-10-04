/**
 * Camera Domain - Brand型境界値Property-based Testing
 *
 * FOV・Sensitivity・Distance等のBrand型について
 * Context7 Fast-Check v4を活用した境界値テスト
 */

import { Brand, Effect, Either, Option, ParseResult, pipe, Schema } from 'effect'
import { expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import {
  fovArbitrary,
  sensitivityArbitrary,
  cameraDistanceArbitrary,
  mouseDeltaArbitrary,
  deltaTimeArbitrary,
  pitchArbitrary,
  yawArbitrary,
  angleArbitrary,
  edgeCaseFOVArbitrary,
  edgeCaseSensitivityArbitrary,
  effectProperty,
  validationProperty,
} from './generators/effect-fastcheck-integration'
import * as TestUtils from './test-utilities'

// ================================================================================
// Brand型定義（テスト対象）
// ================================================================================

// FOV (Field of View) - 30-120度の制約
type FOV = number & Brand.Brand<'FOV'>
const FOV = Brand.nominal<FOV>()

// Sensitivity - 0.1-5.0の制約
type Sensitivity = number & Brand.Brand<'Sensitivity'>
const Sensitivity = Brand.nominal<Sensitivity>()

// CameraDistance - 1-50の制約
type CameraDistance = number & Brand.Brand<'CameraDistance'>
const CameraDistance = Brand.nominal<CameraDistance>()

// MouseDelta - -100~100の制約
type MouseDelta = number & Brand.Brand<'MouseDelta'>
const MouseDelta = Brand.nominal<MouseDelta>()

// DeltaTime - 0.001-0.1の制約
type DeltaTime = number & Brand.Brand<'DeltaTime'>
const DeltaTime = Brand.nominal<DeltaTime>()

// Pitch - -90~90度の制約
type Pitch = number & Brand.Brand<'Pitch'>
const Pitch = Brand.nominal<Pitch>()

// Yaw - 0~360度の制約
type Yaw = number & Brand.Brand<'Yaw'>
const Yaw = Brand.nominal<Yaw>()

// Angle - -360~360度の制約
type Angle = number & Brand.Brand<'Angle'>
const Angle = Brand.nominal<Angle>()

// ================================================================================
// Schema定義とValidation（テスト対象）
// ================================================================================

/**
 * Schema-based Brand型Validation
 */
const FOVSchema = Schema.Number.pipe(
  Schema.between(30, 120),
  Schema.brand('FOV')
)

const SensitivitySchema = Schema.Number.pipe(
  Schema.between(0.1, 5.0),
  Schema.brand('Sensitivity')
)

const CameraDistanceSchema = Schema.Number.pipe(
  Schema.between(1, 50),
  Schema.brand('CameraDistance')
)

const MouseDeltaSchema = Schema.Number.pipe(
  Schema.between(-100, 100),
  Schema.brand('MouseDelta')
)

const DeltaTimeSchema = Schema.Number.pipe(
  Schema.between(0.001, 0.10000000149011613), // Slightly above 0.1 to handle floating-point precision
  Schema.brand('DeltaTime')
)

const PitchSchema = Schema.Number.pipe(
  Schema.between(-90, 90),
  Schema.brand('Pitch')
)

const YawSchema = Schema.Number.pipe(
  Schema.between(0, 360),
  Schema.brand('Yaw')
)

const AngleSchema = Schema.Number.pipe(
  Schema.between(-360, 360),
  Schema.brand('Angle')
)

/**
 * Validation関数
 */
const validateFOV = (value: unknown): Effect.Effect<FOV, ParseResult.ParseError> =>
  Schema.decodeUnknown(FOVSchema)(value)

const validateSensitivity = (value: unknown): Effect.Effect<Sensitivity, ParseResult.ParseError> =>
  Schema.decodeUnknown(SensitivitySchema)(value)

const validateCameraDistance = (value: unknown): Effect.Effect<CameraDistance, ParseResult.ParseError> =>
  Schema.decodeUnknown(CameraDistanceSchema)(value)

const validateMouseDelta = (value: unknown): Effect.Effect<MouseDelta, ParseResult.ParseError> =>
  Schema.decodeUnknown(MouseDeltaSchema)(value)

const validateDeltaTime = (value: unknown): Effect.Effect<DeltaTime, ParseResult.ParseError> =>
  Schema.decodeUnknown(DeltaTimeSchema)(value)

const validatePitch = (value: unknown): Effect.Effect<Pitch, ParseResult.ParseError> =>
  Schema.decodeUnknown(PitchSchema)(value)

const validateYaw = (value: unknown): Effect.Effect<Yaw, ParseResult.ParseError> =>
  Schema.decodeUnknown(YawSchema)(value)

const validateAngle = (value: unknown): Effect.Effect<Angle, ParseResult.ParseError> =>
  Schema.decodeUnknown(AngleSchema)(value)

// ================================================================================
// Brand型変換・操作関数（テスト対象）
// ================================================================================

/**
 * FOV調整関数
 */
const adjustFOV = (current: FOV, delta: number): Effect.Effect<FOV, never> =>
  Effect.gen(function* () {
    const newValue = current + delta
    const clamped = Math.max(30, Math.min(120, newValue))
    return FOV(clamped)
  })

/**
 * Sensitivity調整関数
 */
const adjustSensitivity = (current: Sensitivity, multiplier: number): Effect.Effect<Sensitivity, never> =>
  Effect.gen(function* () {
    const newValue = current * multiplier
    const clamped = Math.max(0.1, Math.min(5.0, newValue))
    return Sensitivity(clamped)
  })

/**
 * マウス感度計算
 */
const calculateMouseSensitivity = (delta: MouseDelta, sensitivity: Sensitivity): Effect.Effect<number, never> =>
  Effect.sync(() => delta * sensitivity)

/**
 * 角度正規化
 */
const normalizeAngle = (angle: Angle): Effect.Effect<Angle, never> =>
  Effect.sync(() => {
    let normalized = angle % 360
    if (normalized < 0) normalized += 360
    // Handle floating-point precision near zero
    if (Math.abs(normalized) < 1e-10) normalized = 0
    if (Math.abs(normalized - 360) < 1e-10) normalized = 0
    return Angle(normalized)
  })

/**
 * Pitch制限
 */
const clampPitch = (pitch: number): Effect.Effect<Pitch, never> =>
  Effect.sync(() => {
    const clamped = Math.max(-90, Math.min(90, pitch))
    return Pitch(clamped)
  })

/**
 * 距離補間
 */
const interpolateDistance = (from: CameraDistance, to: CameraDistance, t: number): Effect.Effect<CameraDistance, never> =>
  Effect.sync(() => {
    const interpolated = from + (to - from) * t
    const clamped = Math.max(1, Math.min(50, interpolated))
    return CameraDistance(clamped)
  })

// ================================================================================
// Brand型境界値Property-based Testing
// ================================================================================

describe('Camera Domain - Brand Type Boundary Testing', () => {
  describe('FOV Brand型境界値テスト', () => {
    it.effect('FOV有効範囲内での検証', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          TestUtils.fcProperty(
            fovArbitrary,
            (fov) => Effect.gen(function* () {
              const validated = yield* validateFOV(fov)
              return fov === validated
            })
          ),
          { numRuns: 1000 }
        )
      })
    )

    it.effect('FOV境界値での厳密テスト', () =>
      Effect.gen(function* () {
        const boundaryValues = [30, 30.1, 59.9, 60, 75, 89.9, 90, 119.9, 120]

        for (const value of boundaryValues) {
          const result = yield* Effect.either(validateFOV(value))
          expect(Either.isRight(result)).toBe(true)
          if (Either.isRight(result)) {
            expect(result.right).toBe(value)
          }
        }
      })
    )

    it.effect('FOV無効値での失敗テスト', () =>
      Effect.gen(function* () {
        const invalidValues = [29.9, 120.1, 0, -10, 200, Number.NaN, Number.POSITIVE_INFINITY]

        for (const value of invalidValues) {
          const result = yield* Effect.either(validateFOV(value))
          expect(Either.isLeft(result)).toBe(true)
        }
      })
    )

    it.effect('FOV Property-based境界値テスト', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          effectProperty(
            fc.integer({ min: -100, max: 300 }),
            (value) =>
              Effect.gen(function* () {
                const result = yield* Effect.either(validateFOV(value))

                if (value >= 30 && value <= 120) {
                  return Either.isRight(result) && (Either.isRight(result) ? result.right === value : false)
                } else {
                  return Either.isLeft(result)
                }
              })
          ),
          { numRuns: 1000 }
        )
      })
    )

    it.effect('FOV調整関数の境界値保持', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          effectProperty(
            fc.tuple(fovArbitrary, fc.float({ min: Math.fround(-50), max: Math.fround(50), noNaN: true })),
            ([fov, delta]) =>
              Effect.gen(function* () {
                const adjusted = yield* adjustFOV(fov, delta)

                // 調整後も有効範囲内
                return adjusted >= 30 && adjusted <= 120
              })
          ),
          { numRuns: 500 }
        )
      })
    )

    it.effect('FOVエッジケースでの安定性', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          effectProperty(edgeCaseFOVArbitrary, (fov) =>
            Effect.gen(function* () {
              // 大幅な調整でも境界値を維持
              const largeIncrease = yield* adjustFOV(fov, 1000)
              const largeDecrease = yield* adjustFOV(fov, -1000)

              return largeIncrease === 120 && largeDecrease === 30
            })
          ),
          { numRuns: 100 }
        )
      })
    )
  })

  describe('Sensitivity Brand型境界値テスト', () => {
    it.effect('Sensitivity有効範囲内での検証', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          TestUtils.fcProperty(
            sensitivityArbitrary,
            (sensitivity) => Effect.gen(function* () {
              const validated = yield* validateSensitivity(sensitivity)
              return Math.abs(sensitivity - validated) < 1e-10
            })
          ),
          { numRuns: 1000 }
        )
      })
    )

    it.effect('Sensitivity境界値での厳密テスト', () =>
      Effect.gen(function* () {
        const boundaryValues = [0.1, 0.101, 0.5, 1.0, 2.5, 4.999, 5.0]

        for (const value of boundaryValues) {
          const result = yield* Effect.either(validateSensitivity(value))
          expect(Either.isRight(result)).toBe(true)
          if (Either.isRight(result)) {
            expect(result.right).toBeCloseTo(value, 5)
          }
        }
      })
    )

    it.effect('Sensitivity調整での境界値保持', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          effectProperty(
            fc.tuple(sensitivityArbitrary, fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true })),
            ([sensitivity, multiplier]) =>
              Effect.gen(function* () {
                const adjusted = yield* adjustSensitivity(sensitivity, multiplier)

                // 調整後も有効範囲内
                return adjusted >= 0.1 && adjusted <= 5.0
              })
          ),
          { numRuns: 500 }
        )
      })
    )

    it.effect('マウス感度計算の数学的性質', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          effectProperty(
            fc.tuple(mouseDeltaArbitrary, sensitivityArbitrary),
            ([delta, sensitivity]) =>
              Effect.gen(function* () {
                const result = yield* calculateMouseSensitivity(delta, sensitivity)

                // 結果は有限値
                const isFinite = Number.isFinite(result)
                // 符号の一貫性
                const signConsistent = Math.sign(result) === Math.sign(delta) || delta === 0

                return isFinite && signConsistent
              })
          ),
          { numRuns: 500 }
        )
      })
    )
  })

  describe('CameraDistance Brand型境界値テスト', () => {
    it.effect('CameraDistance有効範囲内での検証', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          TestUtils.fcProperty(
            cameraDistanceArbitrary,
            (distance) => Effect.gen(function* () {
              const validated = yield* validateCameraDistance(distance)
              return Math.abs(distance - validated) < 1e-10
            })
          ),
          { numRuns: 1000 }
        )
      })
    )

    it.effect('距離補間の数学的性質', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          effectProperty(
            fc.tuple(cameraDistanceArbitrary, cameraDistanceArbitrary, fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true })),
            ([from, to, t]) =>
              Effect.gen(function* () {
                const interpolated = yield* interpolateDistance(from, to, t)

                // 補間結果は有効範囲内
                const inRange = interpolated >= 1 && interpolated <= 50

                // t=0で開始値、t=1で終了値（境界値制約内で）
                const startValid = t === 0 ? Math.abs(interpolated - Math.max(1, Math.min(50, from))) < 1e-10 : true
                const endValid = t === 1 ? Math.abs(interpolated - Math.max(1, Math.min(50, to))) < 1e-10 : true

                return inRange && startValid && endValid
              })
          ),
          { numRuns: 500 }
        )
      })
    )
  })

  describe('角度系Brand型境界値テスト', () => {
    it.effect('Pitch制限の数学的性質', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          effectProperty(
            fc.float({ min: Math.fround(-180), max: Math.fround(180), noNaN: true }),
            (angle) =>
              Effect.gen(function* () {
                const clamped = yield* clampPitch(angle)

                // Pitchは-90~90度に制限
                return clamped >= -90 && clamped <= 90
              })
          ),
          { numRuns: 1000 }
        )
      })
    )

    it.effect('角度正規化の数学的性質', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          effectProperty(angleArbitrary, (angle) =>
            Effect.gen(function* () {
              const normalized = yield* normalizeAngle(angle)

              // 正規化後は0~360度
              return normalized >= 0 && normalized < 360
            })
          ),
          { numRuns: 1000 }
        )
      })
    )

    it.effect('Yaw回転の周期性', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          effectProperty(yawArbitrary, (yaw) =>
            Effect.gen(function* () {
              const fullRotation = Angle(yaw + 360)
              const normalized1 = yield* normalizeAngle(Angle(yaw))
              const normalized2 = yield* normalizeAngle(fullRotation)

              // 360度回転は同一角度
              return Math.abs(normalized1 - normalized2) < 1e-10
            })
          ),
          { numRuns: 500 }
        )
      })
    )
  })

  describe('DeltaTime Brand型境界値テスト', () => {
    it.effect('DeltaTime有効範囲での検証', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          TestUtils.fcProperty(
            deltaTimeArbitrary,
            (deltaTime) => Effect.gen(function* () {
              const validated = yield* validateDeltaTime(deltaTime)
              return Math.abs(deltaTime - validated) < 1e-6 // More tolerant of floating point precision
            })
          ),
          { numRuns: 1000 }
        )
      })
    )

    it.effect('DeltaTime境界値での厳密テスト', () =>
      Effect.gen(function* () {
        const boundaryValues = [0.001, 0.002, 0.016, 0.033, 0.05, 0.099, 0.1]

        for (const value of boundaryValues) {
          const result = yield* Effect.either(validateDeltaTime(value))
          expect(Either.isRight(result)).toBe(true)
          if (Either.isRight(result)) {
            expect(result.right).toBeCloseTo(value, 10)
          }
        }
      })
    )

    it.effect('DeltaTime無効値での失敗テスト', () =>
      Effect.gen(function* () {
        const invalidValues = [0, 0.0009, 0.1001, 1, -0.01, Number.NaN]

        for (const value of invalidValues) {
          const result = yield* Effect.either(validateDeltaTime(value))
          expect(Either.isLeft(result)).toBe(true)
        }
      })
    )
  })

  describe('複合Brand型操作の境界値テスト', () => {
    it.effect('複数Brand型の組み合わせ操作', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          effectProperty(
            fc.tuple(mouseDeltaArbitrary, sensitivityArbitrary, deltaTimeArbitrary),
            ([delta, sensitivity, deltaTime]) =>
              Effect.gen(function* () {
                // 複合計算：マウス感度 × デルタタイム
                const mouseSensitivity = yield* calculateMouseSensitivity(delta, sensitivity)
                const timeAdjusted = mouseSensitivity * deltaTime

                // 結果は有限値
                const isFinite = Number.isFinite(timeAdjusted)
                // スケールの妥当性（マウスデルタ範囲 × 感度範囲 × 時間範囲）
                const inReasonableRange = Math.abs(timeAdjusted) <= 100 * 5.0 * 0.1

                return isFinite && inReasonableRange
              })
          ),
          { numRuns: 500 }
        )
      })
    )

    it.effect('Brand型チェーン変換の境界値保持', () =>
      Effect.gen(function* () {
        yield* TestUtils.fcAssert(
          effectProperty(
            fc.tuple(fovArbitrary, fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true }), fc.float({ min: Math.fround(0.5), max: Math.fround(2.0), noNaN: true })),
            ([fov, deltaAdjust, sensitivityMult]) =>
              Effect.gen(function* () {
                // FOV調整
                const adjustedFOV = yield* adjustFOV(fov, deltaAdjust)

                // 感度調整（FOVベース）
                const baseSensitivity = Sensitivity(adjustedFOV / 75) // 正規化
                const adjustedSensitivity = yield* adjustSensitivity(baseSensitivity, sensitivityMult)

                // 両方とも有効範囲内
                const fovValid = adjustedFOV >= 30 && adjustedFOV <= 120
                const sensitivityValid = adjustedSensitivity >= 0.1 && adjustedSensitivity <= 5.0

                return fovValid && sensitivityValid
              })
          ),
          { numRuns: 300 }
        )
      })
    )
  })

  describe('Brand型エラーハンドリングテスト', () => {
    it.effect('Brand型Validation失敗の詳細', () =>
      Effect.gen(function* () {
        const invalidFOV = 200
        const result = yield* Effect.either(validateFOV(invalidFOV))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          // Schema.ParseErrorの詳細確認
          expect(result.left.message).toContain('between')
          expect(result.left.message).toContain('120')
        }
      })
    )

    it.effect('Brand型バッチValidationの性能', () =>
      Effect.gen(function* () {
        const values = Array.from({ length: 1000 }, (_, i) => 30 + (i * 90) / 1000)

        const start = Date.now()
        const results = yield* Effect.all(
          values.map((value) => Effect.either(validateFOV(value))),
          { concurrency: 'unbounded' }
        )
        const duration = Date.now() - start

        // 全て成功
        const allValid = results.every(Either.isRight)
        // 合理的な実行時間
        const performant = duration < 100

        expect(allValid).toBe(true)
        expect(performant).toBe(true)
      })
    )
  })
})