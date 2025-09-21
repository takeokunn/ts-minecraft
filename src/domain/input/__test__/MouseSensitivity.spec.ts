import { describe, expect, it as vitestIt } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import {
  MouseSensitivity,
  MouseSensitivityError,
  MockMouseSensitivity,
  defaultSensitivityConfig,
  sensitivityPresets,
} from '../MouseSensitivity'
import type { MouseSensitivityConfig, AdjustedMouseDelta } from '../MouseSensitivity'
import { MouseDelta } from '../types'

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
        yield* mouseSensitivity.setSensitivity(1.5, 1.2)
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
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MouseSensitivityError')
          expect(result.left.message).toBe('Failed to get config')
        }
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
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MouseSensitivityError')
          expect(result.left.message).toBe('Failed to apply sensitivity')
        }
      }).pipe(Effect.provide(FailingLayer))
    )
  })

  describe('Type Safety', () => {
    it('should ensure MouseSensitivityConfig interface is correctly typed', () => {
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

    it('should ensure AdjustedMouseDelta interface is correctly typed', () => {
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
  })

  describe('Error Types', () => {
    it('should create MouseSensitivityError with proper structure', () => {
      const error = MouseSensitivityError({
        message: 'Test error',
        config: { preset: 'invalid' },
      })

      expect(error._tag).toBe('MouseSensitivityError')
      expect(error.message).toBe('Test error')
      expect(error.config).toEqual({ preset: 'invalid' })
    })

    it('should create MouseSensitivityError without optional fields', () => {
      const error = MouseSensitivityError({
        message: 'Test error',
      })

      expect(error._tag).toBe('MouseSensitivityError')
      expect(error.message).toBe('Test error')
      expect(error.config).toBeUndefined()
    })
  })
})
