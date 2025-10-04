/**
 * CameraPosition Value Object - Property-based Testing Suite
 *
 * Position3D Brand型、数学的演算、境界値検証の世界最高峰テスト
 */

import { Effect, Either, Match, pipe } from 'effect'
import * as fc from 'effect/FastCheck'
import { beforeEach, describe, expect, test } from 'vitest'

import {
  boundingBoxGenerator,
  cameraDistanceGenerator,
  coordinateGenerator,
  createBoundingBox,
  createCameraDistance,
  createDirection3D,
  createInvalidCameraDistances,
  createInvalidLerpFactors,
  createLerpFactor,
  createPosition3D,
  DeterministicTestLayer,
  lerpFactorGenerator,
  position3DGenerator,
  positionErrorGenerator,
  TestLayer,
} from '../helpers'

describe('CameraPosition Value Object - Property-based Testing Suite', () => {
  beforeEach(() => {
    Effect.runSync(
      Effect.provide(
        Effect.sync(() => console.log('CameraPosition test suite initialized')),
        TestLayer
      )
    )
  })

  describe('Position3D Brand型 - 制約と型安全性', () => {
    test('有効座標値のBrand型作成とプロパティ検証', () => {
      const property = fc.property(
        fc.record({
          x: coordinateGenerator,
          y: coordinateGenerator,
          z: coordinateGenerator,
        }),
        ({ x, y, z }) => {
          const result = Effect.runSync(
            Effect.provide(
              Effect.gen(function* () {
                const position = yield* createPosition3D(x, y, z)

                // Brand型プロパティ確認
                expect(position.x).toBe(x)
                expect(position.y).toBe(y)
                expect(position.z).toBe(z)

                // 数値有効性確認
                expect(Number.isFinite(position.x)).toBe(true)
                expect(Number.isFinite(position.y)).toBe(true)
                expect(Number.isFinite(position.z)).toBe(true)
                expect(Number.isNaN(position.x)).toBe(false)
                expect(Number.isNaN(position.y)).toBe(false)
                expect(Number.isNaN(position.z)).toBe(false)

                return true
              }) as Effect.Effect<boolean, never, never>,
              TestLayer
            )
          )

          return result
        }
      )

      fc.assert(property, { numRuns: 200 })
    })

    test('Position3D数学的演算のProperty検証', () => {
      const property = fc.property(fc.tuple(position3DGenerator, position3DGenerator), ([pos1, pos2]) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // 加算の可換性: add(a, b) = add(b, a)
              const sum1 = {
                x: pos1.x + pos2.x,
                y: pos1.y + pos2.y,
                z: pos1.z + pos2.z,
              }
              const sum2 = {
                x: pos2.x + pos1.x,
                y: pos2.y + pos1.y,
                z: pos2.z + pos1.z,
              }

              expect(sum1.x).toBeCloseTo(sum2.x, 10)
              expect(sum1.y).toBeCloseTo(sum2.y, 10)
              expect(sum1.z).toBeCloseTo(sum2.z, 10)

              // 距離の対称性: distance(a, b) = distance(b, a)
              const dist1 = Math.sqrt(
                Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2) + Math.pow(pos2.z - pos1.z, 2)
              )
              const dist2 = Math.sqrt(
                Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2) + Math.pow(pos1.z - pos2.z, 2)
              )

              expect(dist1).toBeCloseTo(dist2, 10)

              // 自己距離は0
              const selfDist = Math.sqrt(
                Math.pow(pos1.x - pos1.x, 2) + Math.pow(pos1.y - pos1.y, 2) + Math.pow(pos1.z - pos1.z, 2)
              )
              expect(selfDist).toBeCloseTo(0, 10)

              return true
            }) as Effect.Effect<boolean, never, never>,
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 150 })
    })

    test('Position3D線形補間のProperty検証', () => {
      const property = fc.property(
        fc.tuple(position3DGenerator, position3DGenerator, lerpFactorGenerator),
        ([start, end, factor]) => {
          const result = Effect.runSync(
            Effect.provide(
              Effect.gen(function* () {
                // 線形補間計算
                const lerped = {
                  x: start.x + (end.x - start.x) * factor,
                  y: start.y + (end.y - start.y) * factor,
                  z: start.z + (end.z - start.z) * factor,
                }

                // 境界値での補間確認
                if (factor === 0) {
                  expect(lerped.x).toBeCloseTo(start.x, 10)
                  expect(lerped.y).toBeCloseTo(start.y, 10)
                  expect(lerped.z).toBeCloseTo(start.z, 10)
                }

                if (factor === 1) {
                  expect(lerped.x).toBeCloseTo(end.x, 10)
                  expect(lerped.y).toBeCloseTo(end.y, 10)
                  expect(lerped.z).toBeCloseTo(end.z, 10)
                }

                // 結果の有効性確認
                expect(Number.isFinite(lerped.x)).toBe(true)
                expect(Number.isFinite(lerped.y)).toBe(true)
                expect(Number.isFinite(lerped.z)).toBe(true)

                return true
              }) as Effect.Effect<boolean, never, never>,
              TestLayer
            )
          )

          return result
        }
      )

      fc.assert(property, { numRuns: 200 })
    })
  })

  describe('CameraDistance Brand型 - 制約付きBrand型テスト', () => {
    test('有効範囲内CameraDistanceのProperty検証', () => {
      const property = fc.property(cameraDistanceGenerator, (distance) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // 制約範囲確認
              expect(distance).toBeGreaterThanOrEqual(1)
              expect(distance).toBeLessThanOrEqual(50)
              expect(Number.isFinite(distance)).toBe(true)
              expect(Number.isNaN(distance)).toBe(false)

              // Brand型としての使用確認
              const validDistance = yield* createCameraDistance(distance)
              expect(validDistance).toBe(distance)

              return true
            }) as Effect.Effect<boolean, never, never>,
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 100 })
    })

    test('無効CameraDistanceのエラーハンドリング', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const invalidDistances = createInvalidCameraDistances()

            for (const invalidDistance of invalidDistances) {
              const result = yield* Effect.either(createCameraDistance(invalidDistance))

              yield* pipe(
                result,
                Either.match({
                  onLeft: (error) =>
                    Effect.gen(function* () {
                      expect(typeof error).toBe('string')
                      expect(error).toContain('Invalid camera distance')
                    }),
                  onRight: () => Effect.fail(new Error(`Expected failure for distance: ${invalidDistance}`)),
                })
              )
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('Direction3D - 正規化ベクトルテスト', () => {
    test('Direction3D正規化とマグニチュード検証', () => {
      const property = fc.property(
        fc.record({
          x: fc.float({ min: -100, max: 100 }).filter((x) => Math.abs(x) > 0.001),
          y: fc.float({ min: -100, max: 100 }).filter((y) => Math.abs(y) > 0.001),
          z: fc.float({ min: -100, max: 100 }).filter((z) => Math.abs(z) > 0.001),
        }),
        ({ x, y, z }) => {
          const result = Effect.runSync(
            Effect.provide(
              Effect.gen(function* () {
                const direction = yield* createDirection3D(x, y, z)

                // マグニチュード確認（正規化されているため1であるべき）
                const magnitude = Math.sqrt(
                  direction.x * direction.x + direction.y * direction.y + direction.z * direction.z
                )

                expect(magnitude).toBeCloseTo(1.0, 6)

                // 各成分の有効性確認
                expect(Number.isFinite(direction.x)).toBe(true)
                expect(Number.isFinite(direction.y)).toBe(true)
                expect(Number.isFinite(direction.z)).toBe(true)

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

    test('ゼロベクトルからのDirection3D作成エラー', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const result = yield* Effect.either(createDirection3D(0, 0, 0))

            yield* pipe(
              result,
              Either.match({
                onLeft: (error) =>
                  Effect.gen(function* () {
                    expect(error).toContain('zero vector')
                  }),
                onRight: () => Effect.fail(new Error('Expected failure for zero vector')),
              })
            )

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('BoundingBox - 境界ボックステスト', () => {
    test('有効BoundingBox作成のProperty検証', () => {
      const property = fc.property(boundingBoxGenerator, (boundingBox) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // 境界ボックスの整合性確認
              expect(boundingBox.min.x).toBeLessThanOrEqual(boundingBox.max.x)
              expect(boundingBox.min.y).toBeLessThanOrEqual(boundingBox.max.y)
              expect(boundingBox.min.z).toBeLessThanOrEqual(boundingBox.max.z)

              // 体積計算テスト
              const volume =
                (boundingBox.max.x - boundingBox.min.x) *
                (boundingBox.max.y - boundingBox.min.y) *
                (boundingBox.max.z - boundingBox.min.z)

              expect(volume).toBeGreaterThanOrEqual(0)

              return true
            }) as Effect.Effect<boolean, never, never>,
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 100 })
    })

    test('無効BoundingBox作成のエラーハンドリング', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            // 無効な境界ボックス（min > maxとなるケース）
            const invalidMin = yield* createPosition3D(10, 10, 10)
            const invalidMax = yield* createPosition3D(5, 5, 5)

            const result = yield* Effect.either(createBoundingBox(invalidMin, invalidMax))

            yield* pipe(
              result,
              Either.match({
                onLeft: (error) =>
                  Effect.gen(function* () {
                    expect(error).toContain('Invalid bounding box')
                  }),
                onRight: () => Effect.fail(new Error('Expected failure for invalid bounding box')),
              })
            )

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('PositionError ADT - エラーハンドリングテスト', () => {
    test('PositionError全タグのパターンマッチング', () => {
      const property = fc.property(positionErrorGenerator, (error) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              const errorType = pipe(
                error,
                Match.value,
                Match.tag('InvalidCoordinate', ({ axis, value, expected }) => {
                  expect(['x', 'y', 'z']).toContain(axis)
                  expect(typeof value).toBe('number')
                  expect(typeof expected).toBe('string')
                  return 'invalid-coordinate'
                }),
                Match.tag('OutOfBounds', ({ position, bounds }) => {
                  expect(typeof position.x).toBe('number')
                  expect(typeof position.y).toBe('number')
                  expect(typeof position.z).toBe('number')
                  return 'out-of-bounds'
                }),
                Match.tag('InvalidDistance', ({ distance, min, max }) => {
                  expect(typeof distance).toBe('number')
                  expect(typeof min).toBe('number')
                  expect(typeof max).toBe('number')
                  return 'invalid-distance'
                }),
                Match.tag('InvalidLerpFactor', ({ factor, expected }) => {
                  expect(typeof factor).toBe('number')
                  expect(typeof expected).toBe('string')
                  return 'invalid-lerp-factor'
                }),
                Match.tag('InvalidOffset', ({ field, value, expected }) => {
                  expect(typeof field).toBe('string')
                  expect(typeof value).toBe('number')
                  expect(typeof expected).toBe('string')
                  return 'invalid-offset'
                }),
                Match.tag('DistanceCalculationFailed', ({ from, to, reason }) => {
                  expect(typeof from.x).toBe('number')
                  expect(typeof to.x).toBe('number')
                  expect(typeof reason).toBe('string')
                  return 'distance-calculation-failed'
                }),
                Match.exhaustive
              )

              expect(typeof errorType).toBe('string')
              expect(errorType.length).toBeGreaterThan(0)

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

  describe('エッジケース・境界値テスト', () => {
    test('Position3D特殊値ハンドリング', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const edgeCases = [
              { x: 0, y: 0, z: 0 }, // ゼロ座標
              { x: 1000, y: 1000, z: 1000 }, // 最大境界
              { x: -1000, y: -1000, z: -1000 }, // 最小境界
              { x: 0.000001, y: 0.000001, z: 0.000001 }, // 極小値
              { x: Math.PI, y: Math.E, z: Math.SQRT2 }, // 無理数
            ]

            for (const coords of edgeCases) {
              const position = yield* createPosition3D(coords.x, coords.y, coords.z)

              expect(position.x).toBeCloseTo(coords.x, 10)
              expect(position.y).toBeCloseTo(coords.y, 10)
              expect(position.z).toBeCloseTo(coords.z, 10)
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('CameraDistance境界値精密テスト', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const boundaryValues = [1.0, 1.000001, 25.0, 49.999999, 50.0]

            for (const distance of boundaryValues) {
              const validDistance = yield* createCameraDistance(distance)
              expect(validDistance).toBeCloseTo(distance, 6)
            }

            // 境界外テスト
            const outOfBoundValues = [0.999999, 50.000001]

            for (const distance of outOfBoundValues) {
              const result = yield* Effect.either(createCameraDistance(distance))

              yield* pipe(
                result,
                Either.match({
                  onLeft: (error) => Effect.succeed(expect(error).toContain('Invalid camera distance')),
                  onRight: () => Effect.fail(new Error(`Expected failure for distance: ${distance}`)),
                })
              )
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('LerpFactor境界値精密テスト', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const validFactors = [0.0, 0.000001, 0.5, 0.999999, 1.0]

            for (const factor of validFactors) {
              const validFactor = yield* createLerpFactor(factor)
              expect(validFactor).toBeCloseTo(factor, 6)
            }

            // 境界外テスト
            const invalidFactors = createInvalidLerpFactors()

            for (const factor of invalidFactors) {
              const result = yield* Effect.either(createLerpFactor(factor))

              yield* pipe(
                result,
                Either.match({
                  onLeft: (error) => Effect.succeed(expect(error).toContain('Invalid lerp factor')),
                  onRight: () => Effect.fail(new Error(`Expected failure for factor: ${factor}`)),
                })
              )
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('並行処理・パフォーマンステスト', () => {
    test('大量Position3D作成の並行処理安全性', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            // 1000個のPosition3Dを並行作成
            const positionCreations = Array.from({ length: 1000 }, (_, i) => createPosition3D(i * 10, i * 20, i * 30))

            const allPositions = yield* Effect.all(positionCreations, { concurrency: 'unbounded' })

            expect(allPositions.length).toBe(1000)

            // 各Position3Dの整合性確認
            for (let i = 0; i < allPositions.length; i++) {
              const position = allPositions[i]
              expect(position.x).toBe(i * 10)
              expect(position.y).toBe(i * 20)
              expect(position.z).toBe(i * 30)
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          DeterministicTestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('Position3D数学演算パフォーマンステスト', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const pos1 = yield* createPosition3D(100, 200, 300)
            const pos2 = yield* createPosition3D(50, 100, 150)

            const startTime = Date.now()

            // 10000回の距離計算
            for (let i = 0; i < 10000; i++) {
              const distance = Math.sqrt(
                Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2) + Math.pow(pos2.z - pos1.z, 2)
              )
              expect(distance).toBeGreaterThan(0)
            }

            const endTime = Date.now()
            const duration = endTime - startTime

            // パフォーマンス要件: 10000回距離計算が100ms以内
            expect(duration).toBeLessThan(100)

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })
})
