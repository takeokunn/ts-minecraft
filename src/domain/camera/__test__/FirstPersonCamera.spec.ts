/**
 * FirstPersonCamera Tests - it.effect理想系パターン
 * Context7準拠のEffect-TS v3.17+最新パターン使用
 */

import { it, expect } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as TestContext from 'effect/TestContext'
import * as Schema from '@effect/schema/Schema'
import * as Exit from 'effect/Exit'
import { pipe } from 'effect/Function'
import * as THREE from 'three'
import { CameraService, CameraError, CameraConfig, DEFAULT_CAMERA_CONFIG } from '../CameraService.js'
import { FirstPersonCameraLive } from '../FirstPersonCamera.js'
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

const TestLayer = Layer.mergeAll(FirstPersonCameraLive, TestContext.TestContext)

// ================================================================================
// FirstPersonCamera Tests - it.effect Pattern
// ================================================================================

describe('FirstPersonCamera', () => {
  describe('Camera Initialization - Schema Validation', () => {
    it.effect('should initialize camera with default settings', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        const config = yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        // Validate configuration
        const resultConfig = yield* service.getConfig()
        const validatedConfig = yield* Schema.decodeUnknown(CameraConfigSchema)(resultConfig)
        expect(validatedConfig).toEqual(resultConfig)

        if (resultConfig.mode !== 'first-person') {
          return yield* Effect.fail(new Error(`Expected first-person mode, got ${resultConfig.mode}`))
        }

        // Validate state schema
        const state = yield* service.getState()
        const validatedState = yield* Schema.decodeUnknown(CameraStateSchema)(state)
        expect(validatedState).toEqual(state)

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should initialize with custom configuration', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        const customConfig: CameraConfig = {
          fov: 90,
          near: 0.5,
          far: 1500,
          sensitivity: 1.5,
          smoothing: 0.8,
          mode: 'first-person',
          thirdPersonDistance: 5,
          thirdPersonHeight: 2,
          thirdPersonAngle: 0,
        }

        const camera = yield* service.initialize(customConfig)
        const resultConfig = yield* service.getConfig()

        // Validate configuration schema
        const validatedConfig = yield* Schema.decodeUnknown(CameraConfigSchema)(resultConfig)
        expect(validatedConfig).toEqual(resultConfig)

        // Verify configuration was applied
        if (resultConfig.fov !== 90) {
          return yield* Effect.fail(new Error(`Expected FOV 90, got ${resultConfig.fov}`))
        }

        if (resultConfig.sensitivity !== 1.5) {
          return yield* Effect.fail(new Error(`Expected sensitivity 1.5, got ${resultConfig.sensitivity}`))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should validate configuration with property-based testing', () =>
      Effect.gen(function* () {
        // Simplified property-based test approach
        for (let i = 0; i < 10; i++) {
          const service = yield* CameraService
          const config: CameraConfig = {
            ...DEFAULT_CAMERA_CONFIG,
            mode: 'first-person',
            fov: 30 + Math.floor(Math.random() * 90), // Random FOV between 30-120
            sensitivity: 0.1 + Math.random() * 9.9, // Random sensitivity between 0.1-10
            smoothing: Math.random(), // Random smoothing between 0-1
            near: 0.1 + Math.random() * 1.9, // Random near between 0.1-2
            far: 500 + Math.floor(Math.random() * 1500), // Random far between 500-2000
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
    it.effect('should update camera position based on target position', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const initialState = yield* service.getState()
        const validatedInitialState = yield* Schema.decodeUnknown(CameraStateSchema)(initialState)
        expect(validatedInitialState).toEqual(initialState)

        const targetPosition = { x: 10, y: 5, z: -5 }
        yield* service.update(0.016, targetPosition)
        const updatedState = yield* service.getState()

        const validatedUpdatedState = yield* Schema.decodeUnknown(CameraStateSchema)(updatedState)
        expect(validatedUpdatedState).toEqual(updatedState)

        // Verify position has moved towards target (with smoothing)
        if (updatedState.position.x <= 0) {
          return yield* Effect.fail(new Error('Position should move in positive X direction'))
        }

        if (updatedState.position.y <= 1.7) {
          return yield* Effect.fail(new Error('Position should move upward from initial height'))
        }

        if (updatedState.position.z >= 0) {
          return yield* Effect.fail(new Error('Position should move in negative Z direction'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should apply smoothing to position updates', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({
          ...DEFAULT_CAMERA_CONFIG,
          smoothing: 0.1, // Strong smoothing
        })

        const targetPosition = { x: 10, y: 0, z: 0 }

        // First frame
        yield* service.update(0.016, targetPosition)
        const state1 = yield* service.getState()

        // Second frame
        yield* service.update(0.016, targetPosition)
        const state2 = yield* service.getState()

        const validatedState1 = yield* Schema.decodeUnknown(CameraStateSchema)(state1)
        expect(validatedState1).toEqual(state1)
        const validatedState2 = yield* Schema.decodeUnknown(CameraStateSchema)(state2)
        expect(validatedState2).toEqual(state2)

        // Verify gradual movement (second position closer to target)
        const dist1 = Math.abs(state1.position.x - 10)
        const dist2 = Math.abs(state2.position.x - 10)

        if (dist2 >= dist1) {
          return yield* Effect.fail(new Error('Smoothing should gradually move camera closer to target'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle performance requirements for position updates', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const start = Date.now()
        yield* Effect.gen(function* () {
          for (let i = 0; i < 100; i++) {
            const targetPosition = {
              x: Math.random() * 100,
              y: Math.random() * 20,
              z: Math.random() * 100,
            }
            yield* service.update(0.016, targetPosition)
          }
        })
        const duration = Date.now() - start

        // Should complete within reasonable time
        expect(duration).toBeLessThan(50)

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Camera Rotation - Mouse Input', () => {
    it.effect('should change yaw with horizontal mouse movement', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const initialState = yield* service.getState()
        yield* service.rotate(100, 0) // 100px horizontal movement
        const rotatedState = yield* service.getState()

        const validatedRotation = yield* Schema.decodeUnknown(RotationSchema)(rotatedState.rotation)
        expect(validatedRotation).toEqual(rotatedState.rotation)

        if (rotatedState.rotation.yaw === initialState.rotation.yaw) {
          return yield* Effect.fail(new Error('Yaw should have changed with horizontal movement'))
        }

        if (rotatedState.rotation.pitch !== initialState.rotation.pitch) {
          return yield* Effect.fail(new Error('Pitch should not change with horizontal movement'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should change pitch with vertical mouse movement', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const initialState = yield* service.getState()
        yield* service.rotate(0, 50) // 50px vertical movement
        const rotatedState = yield* service.getState()

        const validatedRotation = yield* Schema.decodeUnknown(RotationSchema)(rotatedState.rotation)
        expect(validatedRotation).toEqual(rotatedState.rotation)

        if (rotatedState.rotation.pitch === initialState.rotation.pitch) {
          return yield* Effect.fail(new Error('Pitch should have changed with vertical movement'))
        }

        if (rotatedState.rotation.yaw !== initialState.rotation.yaw) {
          return yield* Effect.fail(new Error('Yaw should not change with vertical movement'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should clamp pitch within limits', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        // Test extreme vertical movement
        yield* service.rotate(0, 10000)
        const extremeState = yield* service.getState()

        const validatedRotation = yield* Schema.decodeUnknown(RotationSchema)(extremeState.rotation)
        expect(validatedRotation).toEqual(extremeState.rotation)

        // Verify pitch is within limits
        const pitchLimit = Math.PI / 2
        if (extremeState.rotation.pitch < -pitchLimit || extremeState.rotation.pitch > pitchLimit) {
          return yield* Effect.fail(new Error('Pitch should be clamped within [-π/2, π/2]'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should apply sensitivity to rotation speed', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({ ...DEFAULT_CAMERA_CONFIG, sensitivity: 0.5 })

        // Low sensitivity rotation
        yield* service.rotate(100, 100)
        const lowSensState = yield* service.getState()

        // Change to high sensitivity
        yield* service.setSensitivity(2.0)
        yield* service.rotate(100, 100)
        const highSensState = yield* service.getState()

        // High sensitivity should produce larger rotation difference
        const yawDiff1 = Math.abs(lowSensState.rotation.yaw)
        const yawDiff2 = Math.abs(highSensState.rotation.yaw - lowSensState.rotation.yaw)

        if (yawDiff2 <= yawDiff1) {
          return yield* Effect.fail(new Error('High sensitivity should produce larger rotation'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.skip('should normalize extreme rotation values', () =>
      Effect.gen(function* () {
        yield* PropertyTest.check(
          fc.record({
            deltaX: fc.integer({ min: -100000, max: 100000 }),
            deltaY: fc.integer({ min: -50000, max: 50000 }),
          }),
          (input: any) =>
            Effect.gen(function* () {
              const { deltaX, deltaY } = input
              const service = yield* CameraService
              yield* service.initialize(DEFAULT_CAMERA_CONFIG)

              yield* service.rotate(deltaX, deltaY)
              const state = yield* service.getState()

              const validatedRotation = yield* Schema.decodeUnknown(RotationSchema)(state.rotation)
              expect(validatedRotation).toEqual(state.rotation)

              // Verify yaw normalization
              if (state.rotation.yaw < -Math.PI || state.rotation.yaw > Math.PI) {
                return false
              }

              // Verify pitch clamping
              if (Math.abs(state.rotation.pitch) > Math.PI / 2) {
                return false
              }

              return true
            }) as Effect.Effect<boolean, any, never>
        )

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Camera Configuration Management', () => {
    it.effect('should handle mode switching (first-person to first-person)', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({ ...DEFAULT_CAMERA_CONFIG, mode: 'first-person' })

        const config1 = yield* service.getConfig()
        yield* service.switchMode('first-person')
        const config2 = yield* service.getConfig()

        // Configuration should remain unchanged for same mode
        if (config1.mode !== config2.mode) {
          return yield* Effect.fail(new Error('Same mode switch should not change configuration'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should apply configuration constraints', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        // Test sensitivity clamping
        yield* service.setSensitivity(-1) // Below range
        const config1 = yield* service.getConfig()

        if (config1.sensitivity < 0.1 || config1.sensitivity > 10.0) {
          return yield* Effect.fail(new Error('Sensitivity should be clamped to valid range'))
        }

        // Test smoothing clamping
        yield* service.setSmoothing(2.0) // Above range
        const config2 = yield* service.getConfig()

        if (config2.smoothing < 0.0 || config2.smoothing > 1.0) {
          return yield* Effect.fail(new Error('Smoothing should be clamped to valid range'))
        }

        // Test FOV within range
        yield* service.setFOV(90)
        const config3 = yield* service.getConfig()

        if (config3.fov !== 90) {
          return yield* Effect.fail(new Error(`Expected FOV 90, got ${config3.fov}`))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle third-person distance (no effect in first-person)', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const initialConfig = yield* service.getConfig()
        yield* service.setThirdPersonDistance(15)
        const updatedConfig = yield* service.getConfig()

        // Third-person distance should remain unchanged in first-person mode
        if (updatedConfig.thirdPersonDistance !== initialConfig.thirdPersonDistance) {
          return yield* Effect.fail(new Error('Third-person distance should not affect first-person camera'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle third-person mode switching (no effect)', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const config1 = yield* service.getConfig()
        yield* service.switchMode('third-person')
        const config2 = yield* service.getConfig()

        // First-person camera should not switch to third-person
        if (config1.mode !== 'first-person' || config2.mode !== 'first-person') {
          return yield* Effect.fail(new Error('First-person camera should remain in first-person mode'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should preserve first-person mode when individually updating settings (lines 155-160)', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        // Verify initial mode
        const initialConfig = yield* service.getConfig()
        if (initialConfig.mode !== 'first-person') {
          return yield* Effect.fail(new Error('Initial mode should be first-person'))
        }

        // Update individual settings - these should work
        yield* service.setFOV(85)
        yield* service.setSensitivity(2.5)
        yield* service.setSmoothing(0.8)

        // Try to switch to third-person - this should be ignored
        yield* service.switchMode('third-person')

        // Get updated config
        const updatedConfig = yield* service.getConfig()

        // First-person mode should be preserved (matches behavior in lines 155-160)
        if (updatedConfig.mode !== 'first-person') {
          return yield* Effect.fail(
            new Error('First-person camera should preserve first-person mode even when third-person is requested')
          )
        }

        // Other settings should be updated
        if (updatedConfig.fov !== 85) {
          return yield* Effect.fail(new Error(`Expected FOV 85, got ${updatedConfig.fov}`))
        }

        if (updatedConfig.sensitivity !== 2.5) {
          return yield* Effect.fail(new Error(`Expected sensitivity 2.5, got ${updatedConfig.sensitivity}`))
        }

        if (updatedConfig.smoothing !== 0.8) {
          return yield* Effect.fail(new Error(`Expected smoothing 0.8, got ${updatedConfig.smoothing}`))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Camera Reset and Disposal', () => {
    it.effect('should reset camera to initial state', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const initialState = yield* service.getState()

        // Make changes
        yield* service.rotate(100, 50)
        yield* service.update(0.016, { x: 10, y: 5, z: -5 })

        // Reset
        yield* service.reset()
        const resetState = yield* service.getState()

        const validatedResetState = yield* Schema.decodeUnknown(CameraStateSchema)(resetState)
        expect(validatedResetState).toEqual(resetState)

        // Should restore initial rotation
        if (Math.abs(resetState.rotation.yaw - initialState.rotation.yaw) > 0.01) {
          return yield* Effect.fail(new Error('Reset should restore initial yaw'))
        }

        if (Math.abs(resetState.rotation.pitch - initialState.rotation.pitch) > 0.01) {
          return yield* Effect.fail(new Error('Reset should restore initial pitch'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle disposal and re-initialization', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        const camera1 = yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        if (!(camera1 instanceof THREE.PerspectiveCamera)) {
          return yield* Effect.fail(new Error('Initial camera should be PerspectiveCamera'))
        }

        yield* service.dispose()

        // Re-initialize after disposal
        const camera2 = yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        const config = yield* service.getConfig()

        if (!(camera2 instanceof THREE.PerspectiveCamera)) {
          return yield* Effect.fail(new Error('Re-initialized camera should be PerspectiveCamera'))
        }

        const validatedConfig = yield* Schema.decodeUnknown(CameraConfigSchema)(config)
        expect(validatedConfig).toEqual(config)

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Error Handling - Schema.TaggedError Pattern', () => {
    it.effect('should handle uninitialized camera operations', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        // Operations that should fail before initialization
        const updateResult = yield* Effect.exit(service.update(0.016, { x: 0, y: 0, z: 0 }))
        const rotateResult = yield* Effect.exit(service.rotate(100, 50))
        const resetResult = yield* Effect.exit(service.reset())
        const fovResult = yield* Effect.exit(service.setFOV(90))
        const aspectResult = yield* Effect.exit(service.updateAspectRatio(1920, 1080))

        const shouldFailResults = [updateResult, rotateResult, resetResult, fovResult, aspectResult]

        for (const result of shouldFailResults) {
          if (Exit.isSuccess(result)) {
            return yield* Effect.fail(new Error('Operations before initialization should fail'))
          }
        }

        // Operations that should succeed before initialization
        const sensitivityResult = yield* Effect.exit(service.setSensitivity(2.0))
        const smoothingResult = yield* Effect.exit(service.setSmoothing(0.8))

        if (Exit.isFailure(sensitivityResult) || Exit.isFailure(smoothingResult)) {
          return yield* Effect.fail(new Error('Configuration operations should succeed before initialization'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle invalid mode switching', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        const invalidModeResult = yield* Effect.exit(service.switchMode('invalid' as any))

        if (Exit.isSuccess(invalidModeResult)) {
          return yield* Effect.fail(new Error('Invalid mode should cause error'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle camera instance retrieval', () =>
      Effect.gen(function* () {
        const service = yield* CameraService

        // Before initialization
        const uninitializedCamera = yield* service.getCamera()
        if (uninitializedCamera !== null) {
          return yield* Effect.fail(new Error('Camera should be null before initialization'))
        }

        // After initialization
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)
        const initializedCamera = yield* service.getCamera()

        if (!(initializedCamera instanceof THREE.PerspectiveCamera)) {
          return yield* Effect.fail(new Error('Camera should be PerspectiveCamera after initialization'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle aspect ratio updates', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        const camera = yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        yield* service.updateAspectRatio(1920, 1080)

        // Verify aspect ratio was applied
        if (Math.abs(camera.aspect - 1920 / 1080) > 0.01) {
          return yield* Effect.fail(new Error('Aspect ratio should be applied correctly'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Performance Characteristics - Edge Cases', () => {
    it.effect('should handle extreme yaw angle normalization', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

        // Multiple full rotations
        yield* service.rotate(100000, 0)
        const state = yield* service.getState()

        const validatedRotation = yield* Schema.decodeUnknown(RotationSchema)(state.rotation)
        expect(validatedRotation).toEqual(state.rotation)

        // Verify yaw is normalized
        if (state.rotation.yaw < -Math.PI || state.rotation.yaw > Math.PI) {
          return yield* Effect.fail(new Error('Yaw should be normalized to [-π, π]'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle minimal smoothing values', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize({ ...DEFAULT_CAMERA_CONFIG, smoothing: 0.001 })

        yield* service.update(0.016, { x: 100, y: 0, z: 0 })
        const state = yield* service.getState()

        const validatedState = yield* Schema.decodeUnknown(CameraStateSchema)(state)
        expect(validatedState).toEqual(state)

        // Even with minimal smoothing, should have some movement
        if (Math.abs(state.position.x) < 0.05) {
          return yield* Effect.fail(new Error('Minimal smoothing should still produce movement'))
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle concurrent operations', () =>
      Effect.gen(function* () {
        const service = yield* CameraService
        yield* service.initialize(DEFAULT_CAMERA_CONFIG)

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
            yield* service.setSensitivity(Math.random() * 5 + 0.5)
            return Date.now() - start
          })
        )

        const durations = yield* Effect.all(concurrentOperations)

        // Verify concurrent operations complete successfully
        for (const duration of durations) {
          expect(duration).toBeLessThan(500)
        }

        return true
      }).pipe(Effect.provide(TestLayer))
    )
  })
})

// Add property-based test factory pattern
const fc = require('fast-check')
