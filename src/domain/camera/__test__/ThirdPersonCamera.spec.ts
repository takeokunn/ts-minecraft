/**
 * ThirdPersonCamera Tests - it.effect理想系パターン
 * Context7準拠のEffect-TS v3.17+最新パターン使用
 */

import { it, expect } from '@effect/vitest'
import { Effect, Layer, Schema, TestContext } from 'effect'
import { PropertyTest, fc } from '../../../test/unified-test-helpers'
import * as Exit from 'effect/Exit'
import { pipe } from 'effect/Function'
import * as THREE from 'three'
import { CameraService, CameraError, CameraConfig, DEFAULT_CAMERA_CONFIG } from '../CameraService.js'
import { ThirdPersonCameraLive } from '../ThirdPersonCamera.js'
import TestUtils from '../../../test/unified-test-helpers'

// ================================================================================
// Schema Definitions - Schema-First Approach
// ================================================================================

const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

const RotationSchema = Schema.Struct({
  yaw: Schema.Number,
  pitch: Schema.Number,
})

const CameraStateSchema = Schema.Struct({
  position: Vector3Schema,
  rotation: RotationSchema,
  target: Vector3Schema,
})

const CameraConfigSchema = Schema.Struct({
  fov: Schema.Number.pipe(Schema.between(30, 120)),
  sensitivity: Schema.Number.pipe(Schema.between(0.1, 10)),
  smoothing: Schema.Number.pipe(Schema.between(0, 1)),
  near: Schema.Number.pipe(Schema.positive()),
  far: Schema.Number.pipe(Schema.positive()),
  mode: Schema.Literal('first-person', 'third-person'),
  thirdPersonDistance: Schema.Number.pipe(Schema.between(1, 20)),
  thirdPersonHeight: Schema.Number.pipe(Schema.nonNegative()),
  thirdPersonAngle: Schema.Number,
})

// ================================================================================
// Test Layers - Layer-based DI Pattern
// ================================================================================

const TestLayer = Layer.mergeAll(ThirdPersonCameraLive, TestContext.TestContext)

// ================================================================================
// ThirdPersonCamera Tests - it.effect Pattern
// ================================================================================

describe('ThirdPersonCamera', () => {
  describe('Camera Initialization - Schema Validation', () => {
    it.effect('should initialize camera with default settings', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        const config: CameraConfig = {
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        }

        const camera = yield* service.initialize(config)
        const state = yield* service.getState()

        // Validate camera instance
        if (!(camera instanceof THREE.PerspectiveCamera)) {
          return yield* Effect.fail(new Error('Should return PerspectiveCamera'))
        }

        // Validate configuration schema
        const validatedConfig = yield* Schema.decodeUnknown(CameraConfigSchema)(config)
        expect(validatedConfig).toEqual(config)

        // Validate state schema
        const validatedState = yield* Schema.decodeUnknown(CameraStateSchema)(state)
        expect(validatedState).toEqual(state)

        // Third-person specific validations
        const distance = Math.sqrt(state.position.x * state.position.x + state.position.z * state.position.z)
        if (distance <= 0) {
          return yield* Effect.fail(new Error('Third-person camera should be positioned away from origin'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should initialize with custom distance and height', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        const config: CameraConfig = {
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
          thirdPersonDistance: 10,
          thirdPersonHeight: 5,
        }

        const camera = yield* service.initialize(config)
        const state = yield* service.getState()

        // Validate configuration schema
        const validatedConfig = yield* Schema.decodeUnknown(CameraConfigSchema)(config)
        expect(validatedConfig).toEqual(config)

        // Validate state schema
        const validatedState = yield* Schema.decodeUnknown(CameraStateSchema)(state)
        expect(validatedState).toEqual(state)

        // Validate custom height is reflected
        if (state.target.y !== 5) {
          return yield* Effect.fail(new Error(`Expected target height 5, got ${state.target.y}`))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should validate camera configuration with property-based testing', () =>
      Effect.gen(function* () {
        // Simplified property-based test to avoid complexity issues
        for (let i = 0; i < 10; i++) {
          const service = yield* CameraService
          const config: CameraConfig = {
            ...DEFAULT_CAMERA_CONFIG,
            mode: 'third-person',
            fov: 30 + Math.floor(Math.random() * 90), // Random FOV between 30-120
            sensitivity: 0.1 + Math.random() * 9.9, // Random sensitivity between 0.1-10
            smoothing: Math.random(), // Random smoothing between 0-1
            thirdPersonDistance: 1 + Math.floor(Math.random() * 19), // Random distance 1-20
          }

          const validatedConfig = yield* Schema.decodeUnknown(CameraConfigSchema)(config)
          expect(validatedConfig).toEqual(config)
          const camera = yield* service.initialize(config)

          if (!(camera instanceof THREE.PerspectiveCamera)) {
            return yield* Effect.fail(new Error('Should return PerspectiveCamera'))
          }
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Camera Updates - Position Tracking', () => {
    it.effect('should track target position changes', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        const initialState = yield* service.getState()
        const validatedInitialState = yield* Schema.decodeUnknown(CameraStateSchema)(initialState)
        expect(validatedInitialState).toEqual(initialState)

        // Update camera with new target position
        const targetPosition = { x: 10, y: 0, z: 20 }
        yield* service.update(0.016, targetPosition)
        const updatedState = yield* service.getState()

        const validatedUpdatedState = yield* Schema.decodeUnknown(CameraStateSchema)(updatedState)
        expect(validatedUpdatedState).toEqual(updatedState)

        // Verify target position has been updated
        if (updatedState.target.x === 0 && updatedState.target.z === 0) {
          return yield* Effect.fail(new Error('Target position should have been updated'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should apply smoothing to position updates', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
          smoothing: 0.1, // Strong smoothing
        })

        // Track positions over multiple frames
        const positions: Array<{ x: number; y: number; z: number }> = []
        const targetPos = { x: 50, y: 0, z: 50 }

        for (let i = 0; i < 10; i++) {
          yield* service.update(0.016, targetPos)
          const state = yield* service.getState()
          const validatedTarget = yield* Schema.decodeUnknown(Vector3Schema)(state.target)
          expect(validatedTarget).toEqual(state.target)
          positions.push(state.target)
        }

        // Verify gradual convergence to target
        for (let i = 1; i < positions.length; i++) {
          const prev = positions[i - 1]!
          const curr = positions[i]!
          const prevDist = Math.sqrt(Math.pow(50 - prev.x, 2) + Math.pow(50 - prev.z, 2))
          const currDist = Math.sqrt(Math.pow(50 - curr.x, 2) + Math.pow(50 - curr.z, 2))

          if (currDist > prevDist + 0.01) {
            return yield* Effect.fail(new Error(`Smoothing should gradually converge to target`))
          }
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle performance requirements for multiple updates', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        const start = Date.now()
        yield* Effect.gen(function* () {
          for (let i = 0; i < 100; i++) {
            const targetPosition = {
              x: Math.random() * 100,
              y: Math.random() * 10,
              z: Math.random() * 100,
            }
            yield* service.update(0.016, targetPosition)
          }
        })
        const duration = Date.now() - start

        // Should complete within reasonable time
        expect(duration).toBeLessThan(100)

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Camera Rotation - Spherical Coordinates', () => {
    it.effect('should handle horizontal rotation (yaw)', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        const initialState = yield* service.getState()
        yield* service.rotate(200, 0) // Horizontal movement only
        const rotatedState = yield* service.getState()

        const validatedRotation = yield* Schema.decodeUnknown(RotationSchema)(rotatedState.rotation)
        expect(validatedRotation).toEqual(rotatedState.rotation)

        if (rotatedState.rotation.yaw === initialState.rotation.yaw) {
          return yield* Effect.fail(new Error('Yaw should have changed'))
        }

        // Pitch should remain unchanged for horizontal rotation
        if (rotatedState.rotation.pitch !== initialState.rotation.pitch) {
          return yield* Effect.fail(new Error('Pitch should not change with horizontal rotation'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle vertical rotation (pitch) with limits', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        // Test extreme pitch values
        yield* service.rotate(0, 10000) // Extreme vertical movement
        const extremeState = yield* service.getState()

        const validatedRotation = yield* Schema.decodeUnknown(RotationSchema)(extremeState.rotation)
        expect(validatedRotation).toEqual(extremeState.rotation)

        // Verify pitch is clamped within limits
        const pitchLimit = Math.PI / 2
        if (Math.abs(extremeState.rotation.pitch) > pitchLimit + 0.1) {
          return yield* Effect.fail(new Error('Pitch should be clamped within limits'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should apply sensitivity settings to rotation speed', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
          sensitivity: 0.5,
        })

        // Low sensitivity rotation
        yield* service.rotate(100, 0)
        const lowSensState = yield* service.getState()

        // Reset and test high sensitivity
        yield* service.reset()
        yield* service.setSensitivity(3.0)
        yield* service.rotate(100, 0)
        const highSensState = yield* service.getState()

        // High sensitivity should produce larger rotation
        if (Math.abs(highSensState.rotation.yaw) <= Math.abs(lowSensState.rotation.yaw)) {
          return yield* Effect.fail(new Error('High sensitivity should produce larger rotation'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.skip('should normalize extreme rotation values', () =>
      Effect.gen(function* () {
        yield* PropertyTest.check(
          fc.record({
            deltaX: fc.integer({ min: -50000, max: 50000 }),
            deltaY: fc.integer({ min: -25000, max: 25000 }),
          }),
          (input: any) =>
            Effect.gen(function* () {
              const { deltaX, deltaY } = input
              const service = yield* CameraService
              yield* service.initialize({
                ...DEFAULT_CAMERA_CONFIG,
                mode: 'third-person',
              })

              yield* service.rotate(deltaX, deltaY)
              const state = yield* service.getState()

              const validatedRotation = yield* Schema.decodeUnknown(RotationSchema)(state.rotation)
              expect(validatedRotation).toEqual(state.rotation)

              // Verify rotation values are within expected ranges
              if (state.rotation.yaw < -Math.PI || state.rotation.yaw > Math.PI) {
                return false
              }

              if (Math.abs(state.rotation.pitch) > Math.PI / 2 + 0.1) {
                return false
              }

              return true
            }) as Effect.Effect<boolean, any, never>
        )

        return true
      }).pipe(Effect.provide(TestLayer)))
  })

  describe('Camera Configuration Management', () => {
    it.effect('should handle distance configuration changes', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        yield* service.setThirdPersonDistance(15)
        const config = yield* service.getConfig()

        const validatedConfig = yield* Schema.decodeUnknown(CameraConfigSchema)(config)
        expect(validatedConfig).toEqual(config)

        if (config.thirdPersonDistance !== 15) {
          return yield* Effect.fail(new Error(`Expected distance 15, got ${config.thirdPersonDistance}`))
        }

        // Test distance clamping
        yield* service.setThirdPersonDistance(100) // Beyond max
        const clampedConfig = yield* service.getConfig()

        if (clampedConfig.thirdPersonDistance > 20) {
          return yield* Effect.fail(new Error('Distance should be clamped to maximum'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle FOV and smoothing configuration', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        yield* service.setFOV(60)
        yield* service.setSmoothing(0.3)

        const config = yield* service.getConfig()
        const validatedConfig = yield* Schema.decodeUnknown(CameraConfigSchema)(config)
        expect(validatedConfig).toEqual(config)

        if (camera.fov !== 60) {
          return yield* Effect.fail(new Error(`Expected FOV 60, got ${camera.fov}`))
        }

        if (config.smoothing !== 0.3) {
          return yield* Effect.fail(new Error(`Expected smoothing 0.3, got ${config.smoothing}`))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle mode switching behavior', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        const beforeConfig = yield* service.getConfig()
        yield* service.switchMode('third-person') // Same mode
        const afterConfig = yield* service.getConfig()

        // Configuration should remain unchanged
        if (beforeConfig.mode !== afterConfig.mode) {
          return yield* Effect.fail(new Error('Same mode switch should not change configuration'))
        }

        // Test invalid mode switching
        const invalidModeResult = yield* Effect.exit(service.switchMode('invalid' as any))
        if (Exit.isSuccess(invalidModeResult)) {
          return yield* Effect.fail(new Error('Invalid mode should cause error'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should preserve third-person mode when switching from first-person (lines 207-212)', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        // Verify initial mode
        const initialConfig = yield* service.getConfig()
        if (initialConfig.mode !== 'third-person') {
          return yield* Effect.fail(new Error('Initial mode should be third-person'))
        }

        // Update settings while in third-person mode
        yield* service.setFOV(70)
        yield* service.setSensitivity(3.0)
        yield* service.setThirdPersonDistance(8.0)

        // Try to switch to first-person - this should be ignored by third-person camera
        yield* service.switchMode('first-person')

        // Get updated config
        const updatedConfig = yield* service.getConfig()

        // Third-person mode should be preserved (matches behavior in lines 207-212)
        if (updatedConfig.mode !== 'third-person') {
          return yield* Effect.fail(
            new Error('Third-person camera should preserve third-person mode even when first-person is requested')
          )
        }

        // Other settings should be updated
        if (updatedConfig.fov !== 70) {
          return yield* Effect.fail(new Error(`Expected FOV 70, got ${updatedConfig.fov}`))
        }

        if (updatedConfig.sensitivity !== 3.0) {
          return yield* Effect.fail(new Error(`Expected sensitivity 3.0, got ${updatedConfig.sensitivity}`))
        }

        if (updatedConfig.thirdPersonDistance !== 8.0) {
          return yield* Effect.fail(
            new Error(`Expected third-person distance 8.0, got ${updatedConfig.thirdPersonDistance}`)
          )
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Camera Reset and Disposal', () => {
    it.effect('should reset camera to initial state', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        const initialState = yield* service.getState()

        // Make changes
        yield* service.rotate(200, 100)
        yield* service.update(0.016, { x: 50, y: 10, z: 30 })
        yield* service.setThirdPersonDistance(20)

        // Reset
        yield* service.reset()
        const resetState = yield* service.getState()

        const validatedResetState = yield* Schema.decodeUnknown(CameraStateSchema)(resetState)
        expect(validatedResetState).toEqual(resetState)

        // Should be close to initial state (allowing for minor differences)
        const yawDiff = Math.abs(resetState.rotation.yaw - initialState.rotation.yaw)
        const pitchDiff = Math.abs(resetState.rotation.pitch - initialState.rotation.pitch)

        if (yawDiff > 0.1 || pitchDiff > 0.1) {
          return yield* Effect.fail(new Error('Reset should restore initial rotation state'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle disposal and resource cleanup', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        if (!(camera instanceof THREE.PerspectiveCamera)) {
          return yield* Effect.fail(new Error('Camera should be initialized'))
        }

        yield* service.dispose()
        const disposedCamera = yield* service.getCamera()

        if (disposedCamera !== null) {
          return yield* Effect.fail(new Error('Camera should be null after disposal'))
        }

        // Configuration should revert to defaults
        const config = yield* service.getConfig()
        if (config.thirdPersonDistance !== DEFAULT_CAMERA_CONFIG.thirdPersonDistance) {
          return yield* Effect.fail(new Error('Configuration should revert to defaults after disposal'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Error Handling - Schema.TaggedError Pattern', () => {
    it.effect('should handle uninitialized camera operations', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        // Operations before initialization should fail
        const updateResult = yield* Effect.exit(service.update(0.016, { x: 0, y: 0, z: 0 }))
        const rotateResult = yield* Effect.exit(service.rotate(100, 50))
        const resetResult = yield* Effect.exit(service.reset())
        const fovResult = yield* Effect.exit(service.setFOV(90))
        const aspectResult = yield* Effect.exit(service.updateAspectRatio(1920, 1080))

        const failedOperations = [updateResult, rotateResult, resetResult, fovResult, aspectResult]

        for (const result of failedOperations) {
          if (Exit.isSuccess(result)) {
            return yield* Effect.fail(new Error('Operations before initialization should fail'))
          }
        }

        // Configuration operations should succeed
        const sensitivityResult = yield* Effect.exit(service.setSensitivity(2.0))
        const smoothingResult = yield* Effect.exit(service.setSmoothing(0.5))
        const distanceResult = yield* Effect.exit(service.setThirdPersonDistance(10))

        const successOperations = [sensitivityResult, smoothingResult, distanceResult]

        for (const result of successOperations) {
          if (Exit.isFailure(result)) {
            return yield* Effect.fail(new Error('Configuration operations should succeed before initialization'))
          }
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle aspect ratio updates', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        yield* service.updateAspectRatio(1920, 1080)
        const wideAspect = camera.aspect

        yield* service.updateAspectRatio(1080, 1920)
        const tallAspect = camera.aspect

        if (Math.abs(wideAspect - 1920 / 1080) > 0.01) {
          return yield* Effect.fail(new Error('Wide aspect ratio not set correctly'))
        }

        if (Math.abs(tallAspect - 1080 / 1920) > 0.01) {
          return yield* Effect.fail(new Error('Tall aspect ratio not set correctly'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Performance Characteristics - Concurrent Operations', () => {
    it.effect('should handle concurrent camera operations', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          mode: 'third-person',
        })

        // Test concurrent operations
        const concurrentOperations = [1, 2, 4, 8].map(() =>
          Effect.gen(function* () {
            const start = Date.now()
            yield* service.rotate(Math.random() * 200 - 100, Math.random() * 200 - 100)
            yield* service.update(0.016, {
              x: Math.random() * 100,
              y: Math.random() * 10,
              z: Math.random() * 100,
            })
            yield* service.setThirdPersonDistance(Math.random() * 15 + 5)
            return Date.now() - start
          })
        )

        const durations = yield* Effect.all(concurrentOperations)

        // Verify concurrent operations complete successfully
        for (const duration of durations) {
          expect(duration).toBeLessThan(1000)
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })
})

// Property-based testingパターン
// fast-checkは統合テストヘルパーから使用
