/**
 * ViewMode Value Object - Property-based Testing Suite
 *
 * 世界最高峰のProperty-based Testing実装
 * ADT網羅的パターンマッチング、型安全性、不変性の完全テスト
 */

import { Effect, Match, pipe } from 'effect'
import * as fc from 'effect/FastCheck'
import { beforeEach, describe, expect, test } from 'vitest'

import { ViewMode, ViewModeError, type AnimationTimeline } from '../../value_object/view_mode/types'

import {
  cameraDistanceGenerator,
  cinematicSettingsGenerator,
  createCinematicViewMode,
  createFirstPersonViewMode,
  createSpectatorViewMode,
  createThirdPersonViewMode,
  DeterministicTestLayer,
  firstPersonSettingsGenerator,
  spectatorSettingsGenerator,
  TestLayer,
  thirdPersonSettingsGenerator,
  viewModeErrorGenerator,
  viewModeGenerator,
} from '../helpers'

describe('ViewMode Value Object - Property-based Testing Suite', () => {
  beforeEach(() => {
    // テスト間のクリーンアップ
    Effect.runSync(
      Effect.provide(
        Effect.sync(() => console.log('ViewMode test suite initialized')),
        TestLayer
      )
    )
  })

  describe('ADT Pattern Matching - 網羅性テスト', () => {
    test('全ViewModeタグの網羅的パターンマッチング', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            // 全ViewModeバリアントを作成
            const firstPerson = yield* createFirstPersonViewMode()
            const thirdPerson = yield* createThirdPersonViewMode(8.0)
            const spectator = yield* createSpectatorViewMode()
            const cinematic = yield* createCinematicViewMode()

            const allModes = [firstPerson, thirdPerson, spectator, cinematic]

            // 各モードに対してパターンマッチング
            for (const mode of allModes) {
              const matchResult = pipe(
                mode,
                Match.value,
                Match.tag('FirstPerson', ({ settings }) => ({
                  type: 'first-person' as const,
                  hasMouseSensitivity: 'mouseSensitivity' in settings,
                  hasHeadOffset: 'headOffset' in settings,
                })),
                Match.tag('ThirdPerson', ({ settings, distance }) => ({
                  type: 'third-person' as const,
                  hasDistance: distance > 0,
                  hasCollisionEnabled: 'collisionEnabled' in settings,
                })),
                Match.tag('Spectator', ({ settings }) => ({
                  type: 'spectator' as const,
                  hasMovementSpeed: 'movementSpeed' in settings,
                  hasFreefly: 'freefly' in settings,
                })),
                Match.tag('Cinematic', ({ settings, timeline }) => ({
                  type: 'cinematic' as const,
                  hasTimeline: timeline.keyframes.length > 0,
                  hasEasing: 'easing' in settings,
                })),
                Match.exhaustive // コンパイル時網羅性保証
              )

              expect(matchResult.type).toBeDefined()
              expect(typeof matchResult).toBe('object')
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('ViewMode判定ガード関数の正確性', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const firstPerson = yield* createFirstPersonViewMode()
            const thirdPerson = yield* createThirdPersonViewMode(5.0)
            const spectator = yield* createSpectatorViewMode()
            const cinematic = yield* createCinematicViewMode()

            // 各ViewModeの判定テスト
            expect(firstPerson._tag).toBe('FirstPerson')
            expect(thirdPerson._tag).toBe('ThirdPerson')
            expect(spectator._tag).toBe('Spectator')
            expect(cinematic._tag).toBe('Cinematic')

            // 相互排他性テスト
            expect(firstPerson._tag !== thirdPerson._tag).toBe(true)
            expect(spectator._tag !== cinematic._tag).toBe(true)

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('Property-based Testing - 型安全性と不変性', () => {
    test('ViewMode作成・変換・比較のProperty', () => {
      const property = fc.property(viewModeGenerator, (viewMode) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // 不変性テスト: オブジェクト変更試行
              const originalTag = viewMode._tag
              const originalData = JSON.stringify(viewMode)

              // パターンマッチング操作（副作用なし）
              const processedResult = pipe(
                viewMode,
                Match.value,
                Match.tag('FirstPerson', (data) => ({ ...data, processed: true })),
                Match.tag('ThirdPerson', (data) => ({ ...data, processed: true })),
                Match.tag('Spectator', (data) => ({ ...data, processed: true })),
                Match.tag('Cinematic', (data) => ({ ...data, processed: true })),
                Match.exhaustive
              )

              // 元のオブジェクトが変更されていないことを確認
              expect(viewMode._tag).toBe(originalTag)
              expect(JSON.stringify(viewMode)).toBe(originalData)

              // 処理結果の整合性確認
              expect(processedResult.processed).toBe(true)

              // 型安全性テスト: 適切なタグが設定されていることを確認
              const isValidTag = ['FirstPerson', 'ThirdPerson', 'Spectator', 'Cinematic'].includes(viewMode._tag)
              expect(isValidTag).toBe(true)

              return true
            }),
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 100 })
    })

    test('CameraDistance Brand型制約のProperty-based Testing', () => {
      const property = fc.property(cameraDistanceGenerator, (distance) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // Brand型の値域チェック
              expect(distance).toBeGreaterThanOrEqual(1)
              expect(distance).toBeLessThanOrEqual(50)
              expect(Number.isFinite(distance)).toBe(true)
              expect(Number.isNaN(distance)).toBe(false)

              // ThirdPersonViewModeでの使用テスト
              const thirdPersonMode = yield* createThirdPersonViewMode(distance)
              expect(thirdPersonMode._tag).toBe('ThirdPerson')
              expect(thirdPersonMode.distance).toBe(distance)

              return true
            }),
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 200 })
    })

    test('Settings オブジェクトのProperty-based 検証', () => {
      const property = fc.property(
        fc.oneof(
          firstPersonSettingsGenerator,
          thirdPersonSettingsGenerator,
          spectatorSettingsGenerator,
          cinematicSettingsGenerator
        ),
        (settings) => {
          const result = Effect.runSync(
            Effect.provide(
              Effect.gen(function* () {
                // 共通プロパティの検証
                if ('mouseSensitivity' in settings) {
                  expect(settings.mouseSensitivity).toBeGreaterThan(0)
                  expect(settings.mouseSensitivity).toBeLessThanOrEqual(5.0)
                }

                if ('smoothing' in settings) {
                  expect(settings.smoothing).toBeGreaterThanOrEqual(0)
                  expect(settings.smoothing).toBeLessThanOrEqual(1)
                }

                // 数値の有効性チェック
                const allNumericValues = Object.values(settings).filter((v) => typeof v === 'number')
                for (const value of allNumericValues) {
                  expect(Number.isFinite(value)).toBe(true)
                  expect(Number.isNaN(value)).toBe(false)
                }

                return true
              }),
              TestLayer
            )
          )

          return result
        }
      )

      fc.assert(property, { numRuns: 150 })
    })
  })

  describe('ViewMode操作の数学的性質テスト', () => {
    test('ViewMode変換の可逆性（往復変換）', () => {
      const property = fc.property(viewModeGenerator, (originalMode) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // ViewModeから設定を抽出して再構築
              const reconstructed = pipe(
                originalMode,
                Match.value,
                Match.tag('FirstPerson', ({ settings }) => ViewMode.FirstPerson({ settings })),
                Match.tag('ThirdPerson', ({ settings, distance }) => ViewMode.ThirdPerson({ settings, distance })),
                Match.tag('Spectator', ({ settings }) => ViewMode.Spectator({ settings })),
                Match.tag('Cinematic', ({ settings, timeline }) => ViewMode.Cinematic({ settings, timeline })),
                Match.exhaustive
              )

              // 往復変換の等価性確認
              expect(reconstructed._tag).toBe(originalMode._tag)
              expect(JSON.stringify(reconstructed)).toBe(JSON.stringify(originalMode))

              return true
            }),
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 100 })
    })

    test('ViewModeの合成可能性テスト', () => {
      const property = fc.property(fc.tuple(viewModeGenerator, viewModeGenerator), ([mode1, mode2]) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              // モード変換シーケンスの合成
              const transformationSequence = [mode1, mode2]

              // 各変換が有効であることを確認
              for (const mode of transformationSequence) {
                const isValid = pipe(
                  mode,
                  Match.value,
                  Match.tag('FirstPerson', () => true),
                  Match.tag('ThirdPerson', ({ distance }) => distance >= 1 && distance <= 50),
                  Match.tag('Spectator', () => true),
                  Match.tag('Cinematic', ({ timeline }) => timeline.keyframes.length >= 2),
                  Match.exhaustive
                )

                expect(isValid).toBe(true)
              }

              return true
            }),
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 80 })
    })
  })

  describe('ViewModeError ADTテスト', () => {
    test('ViewModeErrorの全タグパターンマッチング', () => {
      const property = fc.property(viewModeErrorGenerator, (error) => {
        const result = Effect.runSync(
          Effect.provide(
            Effect.gen(function* () {
              const errorType = pipe(
                error,
                Match.value,
                Match.tag('InvalidDistance', ({ distance, min, max }) => {
                  expect(typeof distance).toBe('number')
                  expect(typeof min).toBe('number')
                  expect(typeof max).toBe('number')
                  return 'invalid-distance'
                }),
                Match.tag('InvalidSettings', ({ field, value, expected }) => {
                  expect(typeof field).toBe('string')
                  expect(typeof expected).toBe('string')
                  return 'invalid-settings'
                }),
                Match.tag('InvalidTimeline', ({ reason }) => {
                  expect(typeof reason).toBe('string')
                  return 'invalid-timeline'
                }),
                Match.tag('InvalidMode', ({ mode }) => {
                  return 'invalid-mode'
                }),
                Match.exhaustive
              )

              expect(typeof errorType).toBe('string')
              expect(errorType.length).toBeGreaterThan(0)

              return true
            }),
            TestLayer
          )
        )

        return result
      })

      fc.assert(property, { numRuns: 100 })
    })

    test('エラー作成ファクトリーの型安全性', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            // 各エラータイプの作成テスト
            const invalidDistanceError = ViewModeError.InvalidDistance({
              distance: -5,
              min: 1,
              max: 50,
            })

            const invalidSettingsError = ViewModeError.InvalidSettings({
              field: 'mouseSensitivity',
              value: 'invalid',
              expected: 'number between 0.1 and 5.0',
            })

            const invalidTimelineError = ViewModeError.InvalidTimeline({
              reason: 'Keyframes must be in ascending time order',
            })

            const invalidModeError = ViewModeError.InvalidMode({
              mode: 'unknown-mode',
            })

            // 全エラーのタグ確認
            expect(invalidDistanceError._tag).toBe('InvalidDistance')
            expect(invalidSettingsError._tag).toBe('InvalidSettings')
            expect(invalidTimelineError._tag).toBe('InvalidTimeline')
            expect(invalidModeError._tag).toBe('InvalidMode')

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('エッジケース・境界値テスト', () => {
    test('CameraDistance境界値テスト', () => {
      const boundaryValues = [1.0, 1.1, 25.0, 49.9, 50.0]

      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            for (const distance of boundaryValues) {
              const thirdPersonMode = yield* createThirdPersonViewMode(distance)
              expect(thirdPersonMode._tag).toBe('ThirdPerson')
              expect(thirdPersonMode.distance).toBe(distance)
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('Settings極値テスト', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            // 極値設定でのViewMode作成
            const extremeFirstPerson = yield* createFirstPersonViewMode({
              mouseSensitivity: 0.1, // 最小値
              smoothing: 0, // 最小値
              headOffset: 0, // 最小値
              bobbing: false,
            })

            const extremeSpectator = yield* createSpectatorViewMode({
              movementSpeed: 50.0, // 最大値
              mouseSensitivity: 5.0, // 最大値
              freefly: true,
              nightVision: true,
            })

            expect(extremeFirstPerson._tag).toBe('FirstPerson')
            expect(extremeSpectator._tag).toBe('Spectator')

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('AnimationTimeline最小構成テスト', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            // 最小限のキーフレーム構成
            const minimalTimeline: AnimationTimeline = {
              keyframes: [
                {
                  time: 0,
                  position: { x: 0, y: 0, z: 0 },
                  rotation: { pitch: 0, yaw: 0 },
                  easing: 'linear',
                },
                {
                  time: 1,
                  position: { x: 1, y: 1, z: 1 },
                  rotation: { pitch: 0, yaw: 90 },
                  easing: 'linear',
                },
              ],
              duration: 1.0,
              loop: false,
            }

            const cinematicMode = yield* createCinematicViewMode(minimalTimeline)
            expect(cinematicMode._tag).toBe('Cinematic')
            expect(cinematicMode.timeline.keyframes.length).toBe(2)

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })

  describe('並行性・パフォーマンステスト', () => {
    test('大量ViewMode作成の並行処理安全性', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            // 1000個のViewModeを並行作成
            const viewModeCreations = Array.from({ length: 1000 }, (_, i) => {
              const modeType = i % 4
              switch (modeType) {
                case 0:
                  return createFirstPersonViewMode()
                case 1:
                  return createThirdPersonViewMode(5.0 + (i % 10))
                case 2:
                  return createSpectatorViewMode()
                case 3:
                  return createCinematicViewMode()
                default:
                  return createFirstPersonViewMode()
              }
            })

            const allViewModes = yield* Effect.all(viewModeCreations, { concurrency: 'unbounded' })

            expect(allViewModes.length).toBe(1000)

            // 各ViewModeの整合性確認
            for (const mode of allViewModes) {
              expect(['FirstPerson', 'ThirdPerson', 'Spectator', 'Cinematic']).toContain(mode._tag)
            }

            return true
          }) as Effect.Effect<boolean, never, never>,
          DeterministicTestLayer
        )
      )

      expect(result).toBe(true)
    })

    test('ViewMode変換パフォーマンステスト', () => {
      const result = Effect.runSync(
        Effect.provide(
          Effect.gen(function* () {
            const startTime = Date.now()

            // 10000回のViewMode変換処理
            for (let i = 0; i < 10000; i++) {
              const mode = yield* createFirstPersonViewMode()

              const processed = pipe(
                mode,
                Match.value,
                Match.tag('FirstPerson', ({ settings }) => ({
                  type: 'processed',
                  originalTag: 'FirstPerson',
                  hasSettings: !!settings,
                })),
                Match.orElse(() => ({ type: 'unknown', originalTag: 'unknown', hasSettings: false }))
              )

              expect(processed.type).toBe('processed')
            }

            const endTime = Date.now()
            const duration = endTime - startTime

            // パフォーマンス要件: 10000回変換が1秒以内
            expect(duration).toBeLessThan(1000)

            return true
          }) as Effect.Effect<boolean, never, never>,
          TestLayer
        )
      )

      expect(result).toBe(true)
    })
  })
})
