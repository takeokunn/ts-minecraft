import { BrandedTypes } from '@domain/core/types/brands'
import { it } from '@effect/vitest'
import { Effect, Either, Layer, pipe } from 'effect'
import { describe, expect, it as vitestIt } from 'vitest'
import type { AdjustedMouseDelta, MouseSensitivityConfig } from '../MouseSensitivity'
import {
  MockMouseSensitivity,
  MouseSensitivity,
  MouseSensitivityError,
  MouseSensitivityLive,
  defaultSensitivityConfig,
  sensitivityPresets,
} from '../MouseSensitivity'
import { MouseDelta } from '../types'

// テストヘルパー関数
const createTestDelta = (deltaX: number, deltaY: number, timestamp?: number): MouseDelta => ({
  deltaX,
  deltaY,
  timestamp: timestamp ?? Date.now(),
})

const expectDeltaEquals = (actual: AdjustedMouseDelta, expected: Partial<AdjustedMouseDelta>) => {
  if (expected.deltaX !== undefined) {
    expect(actual.deltaX).toBeCloseTo(expected.deltaX, 5)
  }
  if (expected.deltaY !== undefined) {
    expect(actual.deltaY).toBeCloseTo(expected.deltaY, 5)
  }
  if (expected.originalDeltaX !== undefined) {
    expect(actual.originalDeltaX).toBe(expected.originalDeltaX)
  }
  if (expected.originalDeltaY !== undefined) {
    expect(actual.originalDeltaY).toBe(expected.originalDeltaY)
  }
  if (expected.appliedSensitivity !== undefined) {
    expect(actual.appliedSensitivity).toBeCloseTo(expected.appliedSensitivity, 5)
  }
}

const createMockLayer = (initialConfig?: Partial<MouseSensitivityConfig>) => {
  const config = { ...defaultSensitivityConfig, ...initialConfig }
  return Layer.succeed(
    MouseSensitivity,
    MouseSensitivity.of({
      getConfig: () => Effect.succeed(config),
      setConfig: () => Effect.succeed(undefined),
      applySensitivity: (delta) =>
        Effect.succeed({
          deltaX: delta.deltaX * config.xSensitivity * config.globalMultiplier,
          deltaY: delta.deltaY * config.ySensitivity * config.globalMultiplier,
          originalDeltaX: delta.deltaX,
          originalDeltaY: delta.deltaY,
          appliedSensitivity: Math.sqrt(config.xSensitivity ** 2 + config.ySensitivity ** 2),
          timestamp: delta.timestamp,
        }),
      setPreset: () => Effect.succeed(undefined),
      setSensitivity: () => Effect.succeed(undefined),
      setGlobalMultiplier: () => Effect.succeed(undefined),
      invertAxis: () => Effect.succeed(undefined),
      setCurve: () => Effect.succeed(undefined),
      resetToDefault: () => Effect.succeed(undefined),
    })
  )
}

describe('MouseSensitivity', () => {
  describe('Interface Definition', () => {
    vitestIt('should define MouseSensitivity interface correctly', () => {
      expect(MouseSensitivity).toBeDefined()
      expect(typeof MouseSensitivity).toBe('object')
    })

    vitestIt('should have correct tag identifier', () => {
      expect(MouseSensitivity.toString()).toContain('@minecraft/MouseSensitivity')
    })
  })

  describe('Default Configuration', () => {
    vitestIt('should have valid default configuration', () => {
      expect(defaultSensitivityConfig.xSensitivity).toBe(1.0)
      expect(defaultSensitivityConfig.ySensitivity).toBe(1.0)
      expect(defaultSensitivityConfig.globalMultiplier).toBe(1.0)
      expect(defaultSensitivityConfig.dpi).toBe(800)
      expect(defaultSensitivityConfig.invertX).toBe(false)
      expect(defaultSensitivityConfig.invertY).toBe(false)
      expect(defaultSensitivityConfig.curve).toBe('linear')
      expect(defaultSensitivityConfig.preset).toBe('medium')
      expect(defaultSensitivityConfig.deadZone).toBe(0.0)
      expect(defaultSensitivityConfig.smoothing).toBe(0.0)
    })

    vitestIt('should have valid preset configurations', () => {
      expect(sensitivityPresets.low.xSensitivity).toBe(0.3)
      expect(sensitivityPresets.medium.xSensitivity).toBe(1.0)
      expect(sensitivityPresets.high.xSensitivity).toBe(2.0)
      expect(sensitivityPresets.gaming.curve).toBe('accelerated')
      expect(sensitivityPresets.precision.curve).toBe('decelerated')
    })
  })

  describe('Service Contract', () => {
    const TestLayer = MockMouseSensitivity

    it.effect('should get default configuration', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity
        const config = yield* mouseSensitivity.getConfig()

        expect(config.xSensitivity).toBe(1.0)
        expect(config.ySensitivity).toBe(1.0)
        expect(config.globalMultiplier).toBe(1.0)
        expect(config.preset).toBe('medium')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should set configuration', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity
        const newConfig: MouseSensitivityConfig = {
          ...defaultSensitivityConfig,
          xSensitivity: 2.0,
          ySensitivity: 1.5,
        }

        // Should not throw an error
        yield* mouseSensitivity.setConfig(newConfig)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should apply sensitivity to mouse delta', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity
        const delta: MouseDelta = {
          deltaX: 10,
          deltaY: -5,
          timestamp: Date.now(),
        }

        const adjustedDelta = yield* mouseSensitivity.applySensitivity(delta)

        expect(typeof adjustedDelta.deltaX).toBe('number')
        expect(typeof adjustedDelta.deltaY).toBe('number')
        expect(adjustedDelta.originalDeltaX).toBe(10)
        expect(adjustedDelta.originalDeltaY).toBe(-5)
        expect(typeof adjustedDelta.appliedSensitivity).toBe('number')
        expect(typeof adjustedDelta.timestamp).toBe('number')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should set preset configuration', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity

        // Should not throw an error
        yield* mouseSensitivity.setPreset('high')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should set individual sensitivity values', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity

        // Should not throw an error
        yield* mouseSensitivity.setSensitivity(
          BrandedTypes.createSensitivityValue(1.5),
          BrandedTypes.createSensitivityValue(1.2)
        )
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should set global multiplier', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity

        // Should not throw an error
        yield* mouseSensitivity.setGlobalMultiplier(1.8)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should invert axes', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity

        // Should not throw an error
        yield* mouseSensitivity.invertAxis(true, false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should set sensitivity curve', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity

        // Should not throw an error
        yield* mouseSensitivity.setCurve('accelerated')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should reset to default configuration', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity

        // Should not throw an error
        yield* mouseSensitivity.resetToDefault()
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Sensitivity Application Logic', () => {
    const TestLayer = MockMouseSensitivity

    it.effect('should preserve original delta values', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity
        const originalDelta: MouseDelta = {
          deltaX: 15,
          deltaY: -8,
          timestamp: Date.now(),
        }

        const adjustedDelta = yield* mouseSensitivity.applySensitivity(originalDelta)

        expect(adjustedDelta.originalDeltaX).toBe(15)
        expect(adjustedDelta.originalDeltaY).toBe(-8)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle zero delta', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity
        const zeroDelta: MouseDelta = {
          deltaX: 0,
          deltaY: 0,
          timestamp: Date.now(),
        }

        const adjustedDelta = yield* mouseSensitivity.applySensitivity(zeroDelta)

        expect(adjustedDelta.deltaX).toBe(0)
        expect(adjustedDelta.deltaY).toBe(0)
        expect(adjustedDelta.originalDeltaX).toBe(0)
        expect(adjustedDelta.originalDeltaY).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Error Handling', () => {
    const failingMouseSensitivity: MouseSensitivity = {
      getConfig: () =>
        Effect.fail(
          MouseSensitivityError({
            message: 'Failed to get config',
          })
        ),

      setConfig: () =>
        Effect.fail(
          MouseSensitivityError({
            message: 'Failed to set config',
          })
        ),

      applySensitivity: () =>
        Effect.fail(
          MouseSensitivityError({
            message: 'Failed to apply sensitivity',
          })
        ),

      setPreset: () =>
        Effect.fail(
          MouseSensitivityError({
            message: 'Failed to set preset',
          })
        ),

      setSensitivity: () =>
        Effect.fail(
          MouseSensitivityError({
            message: 'Failed to set sensitivity',
          })
        ),

      setGlobalMultiplier: () =>
        Effect.fail(
          MouseSensitivityError({
            message: 'Failed to set global multiplier',
          })
        ),

      invertAxis: () =>
        Effect.fail(
          MouseSensitivityError({
            message: 'Failed to invert axis',
          })
        ),

      setCurve: () =>
        Effect.fail(
          MouseSensitivityError({
            message: 'Failed to set curve',
          })
        ),

      resetToDefault: () =>
        Effect.fail(
          MouseSensitivityError({
            message: 'Failed to reset to default',
          })
        ),
    }

    const FailingLayer = Layer.succeed(MouseSensitivity, failingMouseSensitivity)

    it.effect('should handle config get error', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity
        const result = yield* Effect.either(mouseSensitivity.getConfig())

        expect(result._tag).toBe('Left')
        pipe(
          result,
          Either.match({
            onLeft: (error) => {
              expect(error._tag).toBe('MouseSensitivityError')
              expect(error.message).toBe('Failed to get config')
            },
            onRight: () => {
              // 失敗ケースなので到達しない
            },
          })
        )
      }).pipe(Effect.provide(FailingLayer))
    )

    it.effect('should handle sensitivity application error', () =>
      Effect.gen(function* () {
        const mouseSensitivity = yield* MouseSensitivity
        const delta: MouseDelta = {
          deltaX: 10,
          deltaY: -5,
          timestamp: Date.now(),
        }

        const result = yield* Effect.either(mouseSensitivity.applySensitivity(delta))

        expect(result._tag).toBe('Left')
        pipe(
          result,
          Either.match({
            onLeft: (error) => {
              expect(error._tag).toBe('MouseSensitivityError')
              expect(error.message).toBe('Failed to apply sensitivity')
            },
            onRight: () => {
              // 失敗ケースなので到達しない
            },
          })
        )
      }).pipe(Effect.provide(FailingLayer))
    )
  })

  describe('Type Safety', () => {
    it.effect('should ensure MouseSensitivityConfig interface is correctly typed', () =>
      Effect.gen(function* () {
        const config: MouseSensitivityConfig = {
          xSensitivity: 1.5,
          ySensitivity: 1.2,
          globalMultiplier: 1.0,
          dpi: 1000,
          invertX: false,
          invertY: true,
          curve: 'linear',
          preset: 'custom',
          deadZone: 0.05,
          smoothing: 0.1,
        }

        expect(typeof config.xSensitivity).toBe('number')
        expect(typeof config.ySensitivity).toBe('number')
        expect(typeof config.globalMultiplier).toBe('number')
        expect(typeof config.dpi).toBe('number')
        expect(typeof config.invertX).toBe('boolean')
        expect(typeof config.invertY).toBe('boolean')
        expect(config.curve).toBe('linear')
        expect(config.preset).toBe('custom')
        expect(typeof config.deadZone).toBe('number')
        expect(typeof config.smoothing).toBe('number')
      })
    )

    it.effect('should ensure AdjustedMouseDelta interface is correctly typed', () =>
      Effect.gen(function* () {
        const adjustedDelta: AdjustedMouseDelta = {
          deltaX: 15.5,
          deltaY: -8.2,
          originalDeltaX: 10.0,
          originalDeltaY: -5.0,
          appliedSensitivity: 1.5,
          timestamp: Date.now(),
        }

        expect(typeof adjustedDelta.deltaX).toBe('number')
        expect(typeof adjustedDelta.deltaY).toBe('number')
        expect(typeof adjustedDelta.originalDeltaX).toBe('number')
        expect(typeof adjustedDelta.originalDeltaY).toBe('number')
        expect(typeof adjustedDelta.appliedSensitivity).toBe('number')
        expect(typeof adjustedDelta.timestamp).toBe('number')
      })
    )
  })

  describe('Error Types', () => {
    it.effect('should create MouseSensitivityError with proper structure', () =>
      Effect.gen(function* () {
        const error = MouseSensitivityError({
          message: 'Test error',
          config: { preset: 'invalid' },
        })

        expect(error._tag).toBe('MouseSensitivityError')
        expect(error.message).toBe('Test error')
        expect(error.config).toEqual({ preset: 'invalid' })
      })
    )

    it.effect('should create MouseSensitivityError without optional fields', () =>
      Effect.gen(function* () {
        const error = MouseSensitivityError({
          message: 'Test error',
        })

        expect(error._tag).toBe('MouseSensitivityError')
        expect(error.message).toBe('Test error')
        expect(error.config).toBeUndefined()
      })
    )
  })

  describe('MouseSensitivityLive Implementation', () => {
    const TestLayer = MouseSensitivityLive

    describe('Configuration Management', () => {
      it.effect('should get initial default configuration', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const config = yield* mouseSensitivity.getConfig()

          expect(config).toEqual(defaultSensitivityConfig)
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should set and retrieve custom configuration', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const customConfig: MouseSensitivityConfig = {
            ...defaultSensitivityConfig,
            xSensitivity: 2.5,
            ySensitivity: 1.8,
            globalMultiplier: 1.2,
            curve: 'accelerated',
          }

          yield* mouseSensitivity.setConfig(customConfig)
          const retrievedConfig = yield* mouseSensitivity.getConfig()

          expect(retrievedConfig).toEqual(customConfig)
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should validate configuration and fail with invalid data', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const invalidConfig = {
            ...defaultSensitivityConfig,
            xSensitivity: -1, // invalid: should be positive
          }

          const result = yield* Effect.either(mouseSensitivity.setConfig(invalidConfig))

          expect(result._tag).toBe('Left')
          pipe(
            result,
            Either.match({
              onLeft: (error) => {
                expect(error._tag).toBe('MouseSensitivityError')
                expect(error.message).toBe('Invalid configuration provided')
              },
              onRight: () => {
                // 失敗ケースなので到達しない
              },
            })
          )
        }).pipe(Effect.provide(TestLayer))
      )
    })

    describe('Preset Management', () => {
      Object.entries(sensitivityPresets).forEach(([presetName, presetConfig]) => {
        if (presetName !== 'custom') {
          it.effect(`should apply ${presetName} preset correctly`, () =>
            Effect.gen(function* () {
              const mouseSensitivity = yield* MouseSensitivity

              yield* mouseSensitivity.setPreset(presetName as any)
              const config = yield* mouseSensitivity.getConfig()

              expect(config.preset).toBe(presetName)
              if (presetConfig.xSensitivity !== undefined) {
                expect(config.xSensitivity).toBe(presetConfig.xSensitivity)
              }
              if (presetConfig.ySensitivity !== undefined) {
                expect(config.ySensitivity).toBe(presetConfig.ySensitivity)
              }
              if (presetConfig.globalMultiplier !== undefined) {
                expect(config.globalMultiplier).toBe(presetConfig.globalMultiplier)
              }
              if (presetConfig.curve !== undefined) {
                expect(config.curve).toBe(presetConfig.curve)
              }
            }).pipe(Effect.provide(TestLayer))
          )
        }
      })
    })

    describe('Individual Setting Updates', () => {
      it.effect('should update individual sensitivity values', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity

          yield* mouseSensitivity.setSensitivity(
            BrandedTypes.createSensitivityValue(2.5),
            BrandedTypes.createSensitivityValue(1.8)
          )
          const config = yield* mouseSensitivity.getConfig()

          expect(config.xSensitivity).toBe(2.5)
          expect(config.ySensitivity).toBe(1.8)
          expect(config.preset).toBe('custom')
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should enforce minimum sensitivity values', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity

          // Use very small positive values that will be clamped to 0.01
          yield* mouseSensitivity.setSensitivity(
            BrandedTypes.createSensitivityValue(0.001),
            BrandedTypes.createSensitivityValue(0.005)
          )
          const config = yield* mouseSensitivity.getConfig()

          expect(config.xSensitivity).toBe(0.01)
          expect(config.ySensitivity).toBe(0.01)
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should update global multiplier', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity

          yield* mouseSensitivity.setGlobalMultiplier(1.5)
          const config = yield* mouseSensitivity.getConfig()

          expect(config.globalMultiplier).toBe(1.5)
          expect(config.preset).toBe('custom')
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should enforce minimum global multiplier', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity

          yield* mouseSensitivity.setGlobalMultiplier(-0.5)
          const config = yield* mouseSensitivity.getConfig()

          expect(config.globalMultiplier).toBe(0.01)
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should invert axes', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity

          yield* mouseSensitivity.invertAxis(true, false)
          const config = yield* mouseSensitivity.getConfig()

          expect(config.invertX).toBe(true)
          expect(config.invertY).toBe(false)
          expect(config.preset).toBe('custom')
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should set sensitivity curve', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity

          yield* mouseSensitivity.setCurve('decelerated')
          const config = yield* mouseSensitivity.getConfig()

          expect(config.curve).toBe('decelerated')
          expect(config.preset).toBe('custom')
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should reset to default configuration', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity

          // First modify the configuration
          yield* mouseSensitivity.setSensitivity(
            BrandedTypes.createSensitivityValue(5.0),
            BrandedTypes.createSensitivityValue(3.0)
          )
          yield* mouseSensitivity.setGlobalMultiplier(2.0)

          // Then reset
          yield* mouseSensitivity.resetToDefault()
          const config = yield* mouseSensitivity.getConfig()

          expect(config).toEqual(defaultSensitivityConfig)
        }).pipe(Effect.provide(TestLayer))
      )
    })

    describe('Sensitivity Application - Curve Types', () => {
      it.effect('should apply linear curve correctly', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const delta = createTestDelta(10, -5)

          yield* mouseSensitivity.setCurve('linear')
          const result = yield* mouseSensitivity.applySensitivity(delta)

          // Linear curve should preserve the original values (with sensitivity applied)
          expectDeltaEquals(result, {
            deltaX: 10 * defaultSensitivityConfig.xSensitivity * defaultSensitivityConfig.globalMultiplier,
            deltaY: -5 * defaultSensitivityConfig.ySensitivity * defaultSensitivityConfig.globalMultiplier,
            originalDeltaX: 10,
            originalDeltaY: -5,
          })
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should apply accelerated curve correctly', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const delta = createTestDelta(10, -5)

          yield* mouseSensitivity.setCurve('accelerated')
          const result = yield* mouseSensitivity.applySensitivity(delta)

          // Accelerated curve: sign * pow(abs(value), 1.2)
          const expectedX = Math.sign(10) * Math.pow(Math.abs(10), 1.2)
          const expectedY = Math.sign(-5) * Math.pow(Math.abs(-5), 1.2)

          expectDeltaEquals(result, {
            originalDeltaX: 10,
            originalDeltaY: -5,
          })

          // Values should be different from linear (higher for positive inputs)
          expect(Math.abs(result.deltaX)).toBeGreaterThan(10)
          expect(Math.abs(result.deltaY)).toBeGreaterThan(5)
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should apply decelerated curve correctly', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const delta = createTestDelta(10, -5)

          yield* mouseSensitivity.setCurve('decelerated')
          const result = yield* mouseSensitivity.applySensitivity(delta)

          expectDeltaEquals(result, {
            originalDeltaX: 10,
            originalDeltaY: -5,
          })

          // Values should be smaller than linear (decelerated)
          expect(Math.abs(result.deltaX)).toBeLessThan(10)
          expect(Math.abs(result.deltaY)).toBeLessThan(5)
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should apply custom curve with points', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const customConfig: MouseSensitivityConfig = {
            ...defaultSensitivityConfig,
            curve: 'custom',
            customCurvePoints: [0, 0.5, 1.0, 1.5],
          }
          const delta = createTestDelta(0.5, -0.3)

          yield* mouseSensitivity.setConfig(customConfig)
          const result = yield* mouseSensitivity.applySensitivity(delta)

          expectDeltaEquals(result, {
            originalDeltaX: 0.5,
            originalDeltaY: -0.3,
          })

          // Custom curve should interpolate between points
          expect(typeof result.deltaX).toBe('number')
          expect(typeof result.deltaY).toBe('number')
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should fallback to linear when custom curve has no points', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const customConfig: MouseSensitivityConfig = {
            ...defaultSensitivityConfig,
            curve: 'custom',
            customCurvePoints: [],
          }
          const delta = createTestDelta(10, -5)

          yield* mouseSensitivity.setConfig(customConfig)
          const result = yield* mouseSensitivity.applySensitivity(delta)

          // Should behave like linear curve when no custom points
          expectDeltaEquals(result, {
            deltaX: 10,
            deltaY: -5,
            originalDeltaX: 10,
            originalDeltaY: -5,
          })
        }).pipe(Effect.provide(TestLayer))
      )
    })

    describe('Sensitivity Application - Advanced Features', () => {
      it.effect('should apply dead zone correctly', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const smallDelta = createTestDelta(0.01, 0.01) // Very small movement
          const configWithDeadZone: MouseSensitivityConfig = {
            ...defaultSensitivityConfig,
            deadZone: 0.02, // Larger than the input
          }

          yield* mouseSensitivity.setConfig(configWithDeadZone)
          const result = yield* mouseSensitivity.applySensitivity(smallDelta)

          // Movement smaller than dead zone should result in zero
          expectDeltaEquals(result, {
            deltaX: 0,
            deltaY: 0,
            originalDeltaX: 0.01,
            originalDeltaY: 0.01,
            appliedSensitivity: 0,
          })
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should apply axis inversion correctly', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const delta = createTestDelta(10, -5)

          yield* mouseSensitivity.invertAxis(true, true)
          const result = yield* mouseSensitivity.applySensitivity(delta)

          // Both axes should be inverted
          expect(result.deltaX).toBeLessThan(0) // Original positive becomes negative
          expect(result.deltaY).toBeGreaterThan(0) // Original negative becomes positive
          expectDeltaEquals(result, {
            originalDeltaX: 10,
            originalDeltaY: -5,
          })
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should apply smoothing correctly', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const configWithSmoothing: MouseSensitivityConfig = {
            ...defaultSensitivityConfig,
            smoothing: 0.3,
          }

          yield* mouseSensitivity.setConfig(configWithSmoothing)

          // Apply several deltas to test smoothing buffer
          const delta1 = createTestDelta(10, 0)
          const delta2 = createTestDelta(0, 10)
          const delta3 = createTestDelta(5, 5)

          yield* mouseSensitivity.applySensitivity(delta1)
          yield* mouseSensitivity.applySensitivity(delta2)
          const result = yield* mouseSensitivity.applySensitivity(delta3)

          // Final result should be influenced by smoothing (weighted average)
          expectDeltaEquals(result, {
            originalDeltaX: 5,
            originalDeltaY: 5,
          })

          // Smoothed values should be different from original
          expect(result.deltaX).not.toBe(5)
          expect(result.deltaY).not.toBe(5)
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should handle zero smoothing correctly', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const configNoSmoothing: MouseSensitivityConfig = {
            ...defaultSensitivityConfig,
            smoothing: 0,
          }
          const delta = createTestDelta(10, -5)

          yield* mouseSensitivity.setConfig(configNoSmoothing)
          const result = yield* mouseSensitivity.applySensitivity(delta)

          // No smoothing should preserve values (with sensitivity applied)
          expectDeltaEquals(result, {
            deltaX: 10,
            deltaY: -5,
            originalDeltaX: 10,
            originalDeltaY: -5,
          })
        }).pipe(Effect.provide(TestLayer))
      )
    })

    describe('Edge Cases and Error Conditions', () => {
      it.effect('should handle zero delta correctly', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const zeroDelta = createTestDelta(0, 0)

          const result = yield* mouseSensitivity.applySensitivity(zeroDelta)

          expectDeltaEquals(result, {
            deltaX: 0,
            deltaY: 0,
            originalDeltaX: 0,
            originalDeltaY: 0,
          })
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should handle very large delta values', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const largeDelta = createTestDelta(1000000, -1000000)

          const result = yield* mouseSensitivity.applySensitivity(largeDelta)

          expectDeltaEquals(result, {
            originalDeltaX: 1000000,
            originalDeltaY: -1000000,
          })

          expect(typeof result.deltaX).toBe('number')
          expect(typeof result.deltaY).toBe('number')
          expect(isFinite(result.deltaX)).toBe(true)
          expect(isFinite(result.deltaY)).toBe(true)
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should handle very small delta values', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const smallDelta = createTestDelta(0.000001, -0.000001)

          const result = yield* mouseSensitivity.applySensitivity(smallDelta)

          expectDeltaEquals(result, {
            originalDeltaX: 0.000001,
            originalDeltaY: -0.000001,
          })

          expect(typeof result.deltaX).toBe('number')
          expect(typeof result.deltaY).toBe('number')
        }).pipe(Effect.provide(TestLayer))
      )

      it.effect('should handle high sensitivity values correctly', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity
          const delta = createTestDelta(1, 1)

          yield* mouseSensitivity.setSensitivity(
            BrandedTypes.createSensitivityValue(100),
            BrandedTypes.createSensitivityValue(100)
          )
          yield* mouseSensitivity.setGlobalMultiplier(10)
          const result = yield* mouseSensitivity.applySensitivity(delta)

          // High sensitivity should amplify the movement significantly
          expect(Math.abs(result.deltaX)).toBeGreaterThan(100)
          expect(Math.abs(result.deltaY)).toBeGreaterThan(100)
          expectDeltaEquals(result, {
            originalDeltaX: 1,
            originalDeltaY: 1,
          })
        }).pipe(Effect.provide(TestLayer))
      )
    })
  })

  describe('Test Helpers Validation', () => {
    it.effect('should create test delta correctly', () =>
      Effect.gen(function* () {
        const delta = createTestDelta(5, -3, 12345)

        expect(delta.deltaX).toBe(5)
        expect(delta.deltaY).toBe(-3)
        expect(delta.timestamp).toBe(12345)
      })
    )

    it.effect('should create test delta with auto timestamp', () =>
      Effect.gen(function* () {
        const before = Date.now()
        const delta = createTestDelta(1, 2)
        const after = Date.now()

        expect(delta.deltaX).toBe(1)
        expect(delta.deltaY).toBe(2)
        expect(delta.timestamp).toBeGreaterThanOrEqual(before)
        expect(delta.timestamp).toBeLessThanOrEqual(after)
      })
    )

    it.effect('should validate delta expectations correctly', () =>
      Effect.gen(function* () {
        const testDelta: AdjustedMouseDelta = {
          deltaX: 1.5,
          deltaY: -2.3,
          originalDeltaX: 1,
          originalDeltaY: -2,
          appliedSensitivity: 1.2,
          timestamp: 12345,
        }

        // This should not throw
        expectDeltaEquals(testDelta, {
          deltaX: 1.5,
          deltaY: -2.3,
          originalDeltaX: 1,
          originalDeltaY: -2,
          appliedSensitivity: 1.2,
        })
      })
    )

    // ========================================
    // Phase 2: カーブ補間エッジケースカバレッジテスト
    // ========================================

    describe('Curve Interpolation Edge Cases (Phase 2)', () => {
      it.effect('最後のセグメントに到達したときの処理をテスト (lines 164-170)', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity

          // カーブ補間の最後のセグメントに達するテストケース
          const configWithCurve: MouseSensitivityConfig = {
            ...defaultSensitivityConfig,
            smoothing: 0.0,
            xSensitivity: 2.0,
            ySensitivity: 2.0,
            globalMultiplier: 1.0,
            dpi: 800,
            invertX: false,
            invertY: false,
            curve: 'custom',
            preset: 'custom',
            customCurvePoints: [0.1, 0.5, 1.0], // 3ポイントのカーブ
            deadZone: 0.0,
          }

          yield* mouseSensitivity.setConfig(configWithCurve)

          // 最大入力値（1.0）でテスト - これによりsegmentIndex >= points.length - 1がトリガーされる
          const maxDelta: MouseDelta = {
            deltaX: 100, // 大きな値で正規化後に1.0になるように
            deltaY: 100,
            timestamp: Date.now(),
          }

          const result = yield* mouseSensitivity.applySensitivity(maxDelta)

          // lines 164-170 のコードパスが実行されることをテスト
          expect(typeof result.deltaX).toBe('number')
          expect(typeof result.deltaY).toBe('number')
          expect(result.originalDeltaX).toBe(maxDelta.deltaX)
          expect(result.originalDeltaY).toBe(maxDelta.deltaY)
          // カーブ処理が正常に動作したことを確認
          expect(isFinite(result.deltaX)).toBe(true)
          expect(isFinite(result.deltaY)).toBe(true)
        }).pipe(Effect.provide(MouseSensitivityLive))
      )

      it.effect('カーブポイントが null の場合のフォールバック処理をテスト', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity

          // 最後のポイントが undefined/null になりうるエッジケース
          const edgeCaseConfig: MouseSensitivityConfig = {
            ...defaultSensitivityConfig,
            xSensitivity: 1.5,
            ySensitivity: 1.5,
            globalMultiplier: 1.0,
            curve: 'custom',
            preset: 'custom',
            customCurvePoints: [0.2, 0.8], // 2ポイントのカーブ（より最後のセグメントに到達しやすい）
          }

          yield* mouseSensitivity.setConfig(edgeCaseConfig)

          // 境界値テスト - 最後のセグメントの計算
          const boundaryDelta: MouseDelta = {
            deltaX: 50, // 中程度の値
            deltaY: -50,
            timestamp: Date.now(),
          }

          const result = yield* mouseSensitivity.applySensitivity(boundaryDelta)

          // Option.fromNullable(points[points.length - 1]) の処理確認
          expect(result.deltaX).not.toBe(0)
          expect(result.deltaY).not.toBe(0)
          expect(result.originalDeltaX).toBe(boundaryDelta.deltaX)
          expect(result.originalDeltaY).toBe(boundaryDelta.deltaY)
        }).pipe(Effect.provide(MouseSensitivityLive))
      )

      it.effect('segmentIndex境界条件での onNone/onSome パス検証', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity

          // 単一ポイントカーブで Option.match の onNone/onSome を確実にテスト
          const singlePointConfig: MouseSensitivityConfig = {
            ...defaultSensitivityConfig,
            xSensitivity: 3.0,
            ySensitivity: 3.0,
            globalMultiplier: 1.0,
            curve: 'custom',
            preset: 'custom',
            customCurvePoints: [1.0], // 単一ポイント
          }

          yield* mouseSensitivity.setConfig(singlePointConfig)

          // 単一ポイントカーブでの処理確認
          const testDelta: MouseDelta = {
            deltaX: 25,
            deltaY: -25,
            timestamp: Date.now(),
          }

          const result = yield* mouseSensitivity.applySensitivity(testDelta)

          // Option.match の onSome パスが実行されることを確認
          expect(typeof result.deltaX).toBe('number')
          expect(typeof result.deltaY).toBe('number')
          expect(result.originalDeltaX).toBe(testDelta.deltaX)
          expect(result.originalDeltaY).toBe(testDelta.deltaY)
          // カーブ処理と感度が適用されたことを確認
          expect(isFinite(result.deltaX)).toBe(true)
          expect(isFinite(result.deltaY)).toBe(true)
        }).pipe(Effect.provide(MouseSensitivityLive))
      )

      it.effect('正規化された入力値=1.0での最終セグメント処理', () =>
        Effect.gen(function* () {
          const mouseSensitivity = yield* MouseSensitivity

          // 複数ポイントカーブでの境界値テスト
          const multiPointConfig: MouseSensitivityConfig = {
            ...defaultSensitivityConfig,
            xSensitivity: 1.0,
            ySensitivity: 1.0,
            globalMultiplier: 2.0,
            curve: 'custom',
            preset: 'custom',
            customCurvePoints: [0.25, 0.5, 0.75, 1.0], // 4ポイントカーブ
          }

          yield* mouseSensitivity.setConfig(multiPointConfig)

          // 完全に最大化された入力（normalizedInput = 1.0）
          const maximalDelta: MouseDelta = {
            deltaX: 200, // 十分大きな値
            deltaY: 200,
            timestamp: Date.now(),
          }

          const result = yield* mouseSensitivity.applySensitivity(maximalDelta)

          // segmentIndex >= points.length - 1 の条件が実行されることを確認
          expect(typeof result.deltaX).toBe('number')
          expect(typeof result.deltaY).toBe('number')
          expect(result.originalDeltaX).toBe(maximalDelta.deltaX)
          expect(result.originalDeltaY).toBe(maximalDelta.deltaY)
          // カーブ処理が正常に動作したことを確認
          expect(isFinite(result.deltaX)).toBe(true)
          expect(isFinite(result.deltaY)).toBe(true)
          // グローバル倍率が適用されたことを確認
          expect(typeof result.appliedSensitivity).toBe('number')
        }).pipe(Effect.provide(MouseSensitivityLive))
      )
    })
  })
})
