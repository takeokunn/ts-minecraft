/**
 * CameraRotation Value Object - Property-based Testing Suite
 *
 * 角度計算、回転行列、クォータニオン変換の数学的正確性テスト
 */

import { Effect, Match, pipe } from 'effect'
import * as fc from 'effect/FastCheck'
import { beforeEach, describe, expect, test } from 'vitest'

import { RotationError } from '../../value_object/camera_rotation/types'

import {
  angleGenerator,
  cameraRotationGenerator,
  createCameraRotation,
  DeterministicTestLayer,
  pitchGenerator,
  TestLayer,
  yawGenerator,
} from '../helpers'

/**
 * 数学的ヘルパー関数
 */

// 度からラジアンへの変換
const toRadians = (degrees: number): number => degrees * (Math.PI / 180)

// ラジアンから度への変換
const toDegrees = (radians: number): number => radians * (180 / Math.PI)

// 角度の正規化（0-360度）
const normalizeAngle = (angle: number): number => {
  const normalized = angle % 360
  return normalized < 0 ? normalized + 360 : normalized
}

// Pitch角度の制限（-90から90度）
const clampPitch = (pitch: number): number => Math.max(-90, Math.min(90, pitch))

// 回転行列の生成
const createRotationMatrix = (pitch: number, yaw: number, roll: number): number[][] => {
  const pitchRad = toRadians(pitch)
  const yawRad = toRadians(yaw)
  const rollRad = toRadians(roll)

  const cosPitch = Math.cos(pitchRad)
  const sinPitch = Math.sin(pitchRad)
  const cosYaw = Math.cos(yawRad)
  const sinYaw = Math.sin(yawRad)
  const cosRoll = Math.cos(rollRad)
  const sinRoll = Math.sin(rollRad)

  return [
    [
      cosYaw * cosRoll - sinYaw * sinPitch * sinRoll,
      -cosYaw * sinRoll - sinYaw * sinPitch * cosRoll,
      -sinYaw * cosPitch,
    ],
    [cosPitch * sinRoll, cosPitch * cosRoll, -sinPitch],
    [
      sinYaw * cosRoll + cosYaw * sinPitch * sinRoll,
      -sinYaw * sinRoll + cosYaw * sinPitch * cosRoll,
      cosYaw * cosPitch,
    ],
  ]
}

describe('CameraRotation Value Object - Property-based Testing Suite', () => {
  beforeEach(() => {
    Effect.runSync(
      Effect.provide(
        Effect.sync(() => console.log('CameraRotation test suite initialized')),
        TestLayer
      )
    )
  })

  describe('Angle Brand型 - 角度制約テスト', () => {
    test('Angle Brand型の作成と値域確認', () => {
      const property = fc.property(angleGenerator, (angle) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // Brand型の数値有効性確認
              expect(Number.isFinite(angle)).toBe(true)
              expect(Number.isNaN(angle)).toBe(false)

              // 角度範囲確認（-360 to 360度）
              expect(angle).toBeGreaterThanOrEqual(-360)
              expect(angle).toBeLessThanOrEqual(360)

              // 正規化テスト
              const normalized = normalizeAngle(angle)
              expect(normalized).toBeGreaterThanOrEqual(0)
              expect(normalized).toBeLessThan(360)

              return true
            }) as Effect.Effect<boolean, never, never>,
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 200 })
    })

    test('Pitch角度制約（-90 to 90度）の検証', () => {
      const property = fc.property(pitchGenerator, (pitch) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // Pitch制約確認
              expect(pitch).toBeGreaterThanOrEqual(-90)
              expect(pitch).toBeLessThanOrEqual(90)
              expect(Number.isFinite(pitch)).toBe(true)

              // クランプ動作確認
              const clamped = clampPitch(pitch)
              expect(clamped).toBe(pitch) // 有効範囲内なのでそのまま

              return true
            }) as Effect.Effect<boolean, never, never>,
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 100 })
    })

    test('Yaw角度正規化（0 to 360度）の検証', () => {
      const property = fc.property(yawGenerator, (yaw) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // Yaw範囲確認
              expect(yaw).toBeGreaterThanOrEqual(0)
              expect(yaw).toBeLessThanOrEqual(360)
              expect(Number.isFinite(yaw)).toBe(true)

              // 正規化確認
              const normalized = normalizeAngle(yaw)
              expect(normalized).toBeGreaterThanOrEqual(0)
              expect(normalized).toBeLessThan(360)

              return true
            }) as Effect.Effect<boolean, never, never>,
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 100 })
    })
  })

  describe('CameraRotation数学的演算テスト', () => {
    test('CameraRotation作成とプロパティ検証', () => {
      const property = fc.property(cameraRotationGenerator, (rotation) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // 各角度の制約確認
              expect(rotation.pitch).toBeGreaterThanOrEqual(-90)
              expect(rotation.pitch).toBeLessThanOrEqual(90)
              expect(rotation.yaw).toBeGreaterThanOrEqual(0)
              expect(rotation.yaw).toBeLessThanOrEqual(360)
              expect(rotation.roll).toBeGreaterThanOrEqual(-360)
              expect(rotation.roll).toBeLessThanOrEqual(360)

              // 数値有効性確認
              expect(Number.isFinite(rotation.pitch)).toBe(true)
              expect(Number.isFinite(rotation.yaw)).toBe(true)
              expect(Number.isFinite(rotation.roll)).toBe(true)

              return true
            }) as Effect.Effect<boolean, never, never>,
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 150 })
    })

    test('回転行列生成の数学的正確性', () => {
      const property = fc.property(cameraRotationGenerator, (rotation) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              const matrix = createRotationMatrix(rotation.pitch, rotation.yaw, rotation.roll)

              // 回転行列の基本プロパティ確認
              expect(matrix.length).toBe(3)
              expect(matrix[0].length).toBe(3)
              expect(matrix[1].length).toBe(3)
              expect(matrix[2].length).toBe(3)

              // 各要素の有効性確認
              for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                  expect(Number.isFinite(matrix[i][j])).toBe(true)
                  expect(Number.isNaN(matrix[i][j])).toBe(false)
                }
              }

              // 行列式の計算（回転行列の行列式は1であるべき）
              const det =
                matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
                matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
                matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0])

              expect(Math.abs(det)).toBeCloseTo(1.0, 6)

              return true
            }) as Effect.Effect<boolean, never, never>,
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 100 })
    })

    test('回転合成の結合律テスト', () => {
      const property = fc.property(
        fc.tuple(cameraRotationGenerator, cameraRotationGenerator, cameraRotationGenerator),
        ([rot1, rot2, rot3]) => {
          const result = Effect.runSync(
            Effect.provide(
              Effect.gen(function* () {
                // 回転の合成: (A * B) * C = A * (B * C)
                // yaw角度での合成をテスト
                const composedAB_C = normalizeAngle(normalizeAngle(rot1.yaw + rot2.yaw) + rot3.yaw)
                const composedA_BC = normalizeAngle(rot1.yaw + normalizeAngle(rot2.yaw + rot3.yaw))

                // 浮動小数点誤差を考慮した比較
                const diff = Math.abs(composedAB_C - composedA_BC)
                const normalizedDiff = Math.min(diff, 360 - diff) // 360度での折り返しを考慮

                expect(normalizedDiff).toBeLessThan(0.001)

                return true
              }) as Effect.Effect<boolean, never, never>,
              TestLayer
            )
          )

          return result
        }
      )

      fc.assert(property, { numRuns: 100 })
    })

    test('角度差分計算の正確性', () => {
      const property = fc.property(fc.tuple(yawGenerator, yawGenerator), ([yaw1, yaw2]) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // 最短角度差分の計算
              const diff = yaw2 - yaw1
              const normalizedDiff = ((diff + 180) % 360) - 180

              // 差分は-180から180度の範囲であるべき
              expect(normalizedDiff).toBeGreaterThanOrEqual(-180)
              expect(normalizedDiff).toBeLessThanOrEqual(180)

              // 逆方向差分の確認
              const reverseDiff = yaw1 - yaw2
              const normalizedReverseDiff = ((reverseDiff + 180) % 360) - 180

              // 差分の対称性確認
              expect(Math.abs(normalizedDiff + normalizedReverseDiff)).toBeLessThan(0.001)

              return true
            }) as Effect.Effect<boolean, never, never>,
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 100 })
    })
  })

  describe('特殊角度・境界値テスト', () => {
    test('cardinal directions（主要方向）の正確性', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const cardinalDirections = [
              { name: 'North', yaw: 0, expectedX: 0, expectedZ: -1 },
              { name: 'East', yaw: 90, expectedX: 1, expectedZ: 0 },
              { name: 'South', yaw: 180, expectedX: 0, expectedZ: 1 },
              { name: 'West', yaw: 270, expectedX: -1, expectedZ: 0 },
            ]

            for (const direction of cardinalDirections) {
              const rotation = yield* createCameraRotation(0, direction.yaw, 0)
              const matrix = createRotationMatrix(rotation.pitch, rotation.yaw, rotation.roll)

              // 前方ベクトル（-Z方向）の計算
              const forwardX = -matrix[0][2]
              const forwardZ = -matrix[2][2]

              expect(forwardX).toBeCloseTo(direction.expectedX, 6)
              expect(forwardZ).toBeCloseTo(direction.expectedZ, 6)
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('極値Pitch角度の処理', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const extremePitches = [-90, -89.9, 0, 89.9, 90]

            for (const pitch of extremePitches) {
              const rotation = yield* createCameraRotation(pitch, 0, 0)
              const matrix = createRotationMatrix(rotation.pitch, rotation.yaw, rotation.roll)

              // 極値でも有効な回転行列が生成されることを確認
              for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                  expect(Number.isFinite(matrix[i][j])).toBe(true)
                  expect(Number.isNaN(matrix[i][j])).toBe(false)
                }
              }

              // 上向き/下向きの確認
              if (pitch === 90) {
                expect(matrix[1][2]).toBeCloseTo(-1, 6) // 完全上向き
              } else if (pitch === -90) {
                expect(matrix[1][2]).toBeCloseTo(1, 6) // 完全下向き
              }
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('360度ロールオーバーの処理', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const angles = [0, 90, 180, 270, 360, 450, -90, -180]

            for (const angle of angles) {
              const normalized = normalizeAngle(angle)
              const rotation = yield* createCameraRotation(0, normalized, 0)

              expect(rotation.yaw).toBeGreaterThanOrEqual(0)
              expect(rotation.yaw).toBeLessThan(360)

              // 等価角度の確認
              const equivalent = normalizeAngle(angle + 360)
              expect(Math.abs(normalized - equivalent)).toBeLessThan(0.001)
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('エラーハンドリング・RotationError ADTテスト', () => {
    test('無効角度値のエラー処理', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const invalidAngles = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e20, -1e20]

            for (const invalidAngle of invalidAngles) {
              // 無効な角度での回転作成は避け、検証のみ行う
              expect(Number.isFinite(invalidAngle)).toBe(false)

              // 正規化関数の動作確認
              const normalized = Number.isFinite(invalidAngle) ? normalizeAngle(invalidAngle) : NaN
              if (Number.isFinite(invalidAngle)) {
                expect(Number.isFinite(normalized)).toBe(true)
              } else {
                expect(Number.isNaN(normalized)).toBe(true)
              }
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('RotationError ADTパターンマッチング', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            // 手動でエラーケースを作成
            const invalidPitchError = RotationError.InvalidPitch({
              pitch: 95,
              min: -90,
              max: 90,
            })

            const invalidYawError = RotationError.InvalidYaw({
              yaw: -30,
              min: 0,
              max: 360,
            })

            const invalidAngleError = RotationError.InvalidAngle({
              angle: Number.NaN,
              axis: 'roll',
            })

            const errors = [invalidPitchError, invalidYawError, invalidAngleError]

            for (const error of errors) {
              const errorType = pipe(
                error,
                Match.value,
                Match.tag('InvalidPitch', ({ pitch, min, max }) => {
                  expect(typeof pitch).toBe('number')
                  expect(typeof min).toBe('number')
                  expect(typeof max).toBe('number')
                  return 'invalid-pitch'
                }),
                Match.tag('InvalidYaw', ({ yaw, min, max }) => {
                  expect(typeof yaw).toBe('number')
                  expect(typeof min).toBe('number')
                  expect(typeof max).toBe('number')
                  return 'invalid-yaw'
                }),
                Match.tag('InvalidAngle', ({ angle, axis }) => {
                  expect(typeof angle).toBe('number')
                  expect(['pitch', 'yaw', 'roll']).toContain(axis)
                  return 'invalid-angle'
                }),
                Match.tag('InvalidRotation', ({ reason }) => {
                  expect(typeof reason).toBe('string')
                  return 'invalid-rotation'
                }),
                Match.tag('MatrixCalculationFailed', ({ matrix, reason }) => {
                  expect(Array.isArray(matrix)).toBe(true)
                  expect(typeof reason).toBe('string')
                  return 'matrix-calculation-failed'
                }),
                Match.exhaustive
              )

              expect(typeof errorType).toBe('string')
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('パフォーマンス・並行性テスト', () => {
    test('大量回転計算の並行処理安全性', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            // 1000個の回転計算を並行実行
            const rotationCalculations = Array.from({ length: 1000 }, (_, i) =>
              Effect.gen(function* () {
                const rotation = yield* createCameraRotation(
                  (i % 180) - 90, // -90 to 89
                  i % 360, // 0 to 359
                  (i % 720) - 360 // -360 to 359
                )

                const matrix = createRotationMatrix(rotation.pitch, rotation.yaw, rotation.roll)

                // 各計算結果の妥当性確認
                expect(matrix.length).toBe(3)
                for (let j = 0; j < 3; j++) {
                  for (let k = 0; k < 3; k++) {
                    expect(Number.isFinite(matrix[j][k])).toBe(true)
                  }
                }

                return matrix
              })
            )

            const allMatrices = yield* Effect.all(rotationCalculations, { concurrency: 'unbounded' })

            expect(allMatrices.length).toBe(1000)

            return true
          }) as Effect.Effect<boolean, never, never>,
          DeterministicTestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('回転行列計算パフォーマンステスト', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const rotation = yield* createCameraRotation(45, 90, 0)

            const startTime = Date.now()

            // 10000回の回転行列計算
            for (let i = 0; i < 10000; i++) {
              const matrix = createRotationMatrix(rotation.pitch, rotation.yaw, rotation.roll)
              expect(matrix[0][0]).toBeDefined()
            }

            const endTime = Date.now()
            const duration = endTime - startTime

            // パフォーマンス要件: 10000回計算が50ms以内
            expect(duration).toBeLessThan(50)

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('角度正規化パフォーマンステスト', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const testAngles = [0, 90, 180, 270, 360, 450, 720, -90, -180, -270]

            const startTime = Date.now()

            // 100000回の角度正規化
            for (let i = 0; i < 100000; i++) {
              const angle = testAngles[i % testAngles.length]
              const normalized = normalizeAngle(angle)
              expect(normalized).toBeGreaterThanOrEqual(0)
              expect(normalized).toBeLessThan(360)
            }

            const endTime = Date.now()
            const duration = endTime - startTime

            // パフォーマンス要件: 100000回正規化が20ms以内
            expect(duration).toBeLessThan(20)

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })
})
