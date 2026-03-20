import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Effect, Layer, Schema } from 'effect'
import * as THREE from 'three'
import { PlayerInputService } from '../../application/input/player-input-service'
import type { MouseDelta } from '../../application/input/player-input-service'
import type { InputServicePort as InputServiceType } from '@/application/input'
import { PlayerCameraStateService, PlayerCameraStateLive, PITCH_MIN, PITCH_MAX } from '@/application/camera/camera-state'
import {
  FirstPersonCameraService,
  FirstPersonCameraServiceLive,
  BASE_MOUSE_SENSITIVITY,
} from './first-person-camera-service'

/**
 * Test implementation of InputService with controllable state
 */
const createTestInputService = (initialState: {
  mouseDelta?: MouseDelta
  pointerLocked?: boolean
} = {}): InputServiceType & { setMouseDelta: (delta: MouseDelta) => void; setPointerLocked: (locked: boolean) => void } => {
  let mouseDelta = initialState.mouseDelta ?? { x: 0, y: 0 }
  let pointerLocked = initialState.pointerLocked ?? false

  return {
    isKeyPressed: () => Effect.sync(() => false),
    consumeKeyPress: () => Effect.sync(() => false),
    getMouseDelta: () =>
      Effect.sync(() => {
        const delta = { ...mouseDelta }
        mouseDelta = { x: 0, y: 0 }
        return delta
      }),
    isMouseDown: () => Effect.sync(() => false),
    requestPointerLock: () =>
      Effect.sync(() => {
        pointerLocked = true
      }),
    exitPointerLock: () =>
      Effect.sync(() => {
        pointerLocked = false
      }),
    isPointerLocked: () => Effect.sync(() => pointerLocked),
    consumeMouseClick: () => Effect.sync(() => false),
    consumeWheelDelta: () => Effect.sync(() => 0),
    setMouseDelta: (delta: MouseDelta) => {
      mouseDelta = delta
    },
    setPointerLocked: (locked: boolean) => {
      pointerLocked = locked
    },
  } as unknown as InputServiceType & { setMouseDelta: (delta: MouseDelta) => void; setPointerLocked: (locked: boolean) => void }
}

/**
 * Helper to create test layers with mock PlayerInputService
 */
const createTestLayers = (inputService: InputServiceType) =>
  Layer.merge(
    Layer.succeed(PlayerInputService, inputService as unknown as PlayerInputService),
    PlayerCameraStateLive
  )

describe('FirstPersonCameraService', () => {
  describe('BASE_MOUSE_SENSITIVITY', () => {
    it('should have a base sensitivity value', () => {
      expect(BASE_MOUSE_SENSITIVITY).toBe(0.004)
    })

    it('should be a positive number', () => {
      expect(BASE_MOUSE_SENSITIVITY).toBeGreaterThan(0)
    })
  })

  describe('update', () => {
    it('should not update camera rotation when pointer is not locked', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 100, y: 50 },
        pointerLocked: false,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      const initialRotation = camera.rotation.clone()

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)
      })

      Effect.runSync(program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers)))

      expect(camera.rotation.x).toBe(initialRotation.x)
      expect(camera.rotation.y).toBe(initialRotation.y)
      expect(camera.rotation.z).toBe(initialRotation.z)
    })

    it('should update camera rotation when pointer is locked', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 100, y: 50 },
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        const cameraState = yield* PlayerCameraStateService
        return yield* cameraState.getRotation()
      })

      const rotation = Effect.runSync(
        program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
      )

      // Verify rotation was updated (negative for intuitive direction)
      const expectedYaw = -100 * BASE_MOUSE_SENSITIVITY * 0.5
      const expectedPitch = -50 * BASE_MOUSE_SENSITIVITY * 0.5

      expect(rotation.yaw).toBeCloseTo(expectedYaw)
      expect(rotation.pitch).toBeCloseTo(expectedPitch)

      // Verify camera rotation matches state
      expect(camera.rotation.x).toBeCloseTo(expectedPitch)
      expect(camera.rotation.y).toBeCloseTo(expectedYaw)
      expect(camera.rotation.z).toBe(0)
    })

    it('should use YXZ rotation order', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 100, y: 50 },
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)
      })

      Effect.runSync(program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers)))

      expect(camera.rotation.order).toBe('YXZ')
    })

    it('should not update when mouse delta is zero', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 0, y: 0 },
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        const cameraState = yield* PlayerCameraStateService

        // Set initial rotation
        yield* cameraState.setYaw(0.5)
        yield* cameraState.setPitch(0.3)
        yield* cameraService.attachToPlayer(camera)

        const beforeRotation = yield* cameraState.getRotation()
        yield* cameraService.update(camera)
        const afterRotation = yield* cameraState.getRotation()

        return { beforeRotation, afterRotation }
      })

      const { beforeRotation, afterRotation } = Effect.runSync(
        program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
      )

      expect(afterRotation.yaw).toBeCloseTo(beforeRotation.yaw)
      expect(afterRotation.pitch).toBeCloseTo(beforeRotation.pitch)
    })

    it('should apply negative multiplier for intuitive rotation (mouse right = look right)', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 100, y: 0 }, // Mouse moved right
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        const cameraState = yield* PlayerCameraStateService
        return yield* cameraState.getRotation()
      })

      const rotation = Effect.runSync(
        program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
      )

      // Negative delta.x * sensitivity = positive yaw (looking right)
      expect(rotation.yaw).toBeCloseTo(-100 * BASE_MOUSE_SENSITIVITY * 0.5)
    })

    it('should accumulate multiple updates', () => {
      let mouseDelta = { x: 50, y: 25 }
      const inputService = {
        isKeyPressed: () => Effect.sync(() => false),
        consumeKeyPress: () => Effect.sync(() => false),
        getMouseDelta: () =>
          Effect.sync(() => {
            const delta = { ...mouseDelta }
            mouseDelta = { x: 0, y: 0 }
            return delta
          }),
        isMouseDown: () => Effect.sync(() => false),
        requestPointerLock: () => Effect.sync(() => {}),
        exitPointerLock: () => Effect.sync(() => {}),
        isPointerLocked: () => Effect.sync(() => true),
        consumeMouseClick: () => Effect.sync(() => false),
        consumeWheelDelta: () => Effect.sync(() => 0),
      } as unknown as InputServiceType
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        // Reset mouse delta for second update
        mouseDelta = { x: 50, y: 25 }
        yield* cameraService.update(camera)

        const cameraState = yield* PlayerCameraStateService
        return yield* cameraState.getRotation()
      })

      const rotation = Effect.runSync(
        program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
      )

      // Two updates should accumulate
      const expectedYaw = -100 * BASE_MOUSE_SENSITIVITY * 0.5
      const expectedPitch = -50 * BASE_MOUSE_SENSITIVITY * 0.5

      expect(rotation.yaw).toBeCloseTo(expectedYaw)
      expect(rotation.pitch).toBeCloseTo(expectedPitch)
    })
  })

  describe('update with pitch clamping', () => {
    it('should clamp pitch to PITCH_MAX when looking too far up', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 0, y: -10000 }, // Large upward movement
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        const cameraState = yield* PlayerCameraStateService
        return yield* cameraState.getRotation()
      })

      const rotation = Effect.runSync(
        program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
      )

      // Pitch should be clamped to near PI/2
      expect(rotation.pitch).toBeLessThan(Math.PI / 2)
      expect(rotation.pitch).toBeGreaterThan(1.5) // Close to PI/2
    })

    it('should clamp pitch to PITCH_MIN when looking too far down', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 0, y: 10000 }, // Large downward movement
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        const cameraState = yield* PlayerCameraStateService
        return yield* cameraState.getRotation()
      })

      const rotation = Effect.runSync(
        program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
      )

      // Pitch should be clamped to near -PI/2
      expect(rotation.pitch).toBeGreaterThan(-Math.PI / 2)
      expect(rotation.pitch).toBeLessThan(-1.5) // Close to -PI/2
    })
  })

  describe('attachToPlayer', () => {
    it('should sync camera rotation with player camera state', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        const cameraState = yield* PlayerCameraStateService

        // Set state values
        yield* cameraState.setYaw(Math.PI / 4)
        yield* cameraState.setPitch(Math.PI / 6)

        // Attach camera to player
        yield* cameraService.attachToPlayer(camera)

        const rotation = yield* cameraState.getRotation()
        return rotation
      })

      const rotation = Effect.runSync(
        program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
      )

      expect(camera.rotation.x).toBeCloseTo(rotation.pitch)
      expect(camera.rotation.y).toBeCloseTo(rotation.yaw)
      expect(camera.rotation.z).toBe(0)
      expect(camera.rotation.order).toBe('YXZ')
    })

    it('should use YXZ rotation order', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.attachToPlayer(camera)
      })

      Effect.runSync(program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers)))

      expect(camera.rotation.order).toBe('YXZ')
    })

    it('should not change the camera state values', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        const cameraState = yield* PlayerCameraStateService

        yield* cameraState.setYaw(1.23)
        yield* cameraState.setPitch(0.45)

        const beforeRotation = yield* cameraState.getRotation()
        yield* cameraService.attachToPlayer(camera)
        const afterRotation = yield* cameraState.getRotation()

        return { beforeRotation, afterRotation }
      })

      const { beforeRotation, afterRotation } = Effect.runSync(
        program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
      )

      expect(afterRotation.yaw).toBeCloseTo(beforeRotation.yaw)
      expect(afterRotation.pitch).toBeCloseTo(beforeRotation.pitch)
    })
  })

  describe('pitch clamping — property test', () => {
    it.prop(
      'pitch is always within [PITCH_MIN, PITCH_MAX] for any sequence of mouse Y deltas',
      {
        deltas: Arbitrary.make(
          Schema.Array(Schema.Number.pipe(Schema.between(-1000, 1000))).pipe(Schema.minItems(1), Schema.maxItems(100))
        ),
      },
      ({ deltas }) => {
        // Build a fresh input service that returns deltas one at a time
        let deltaIdx = 0
        const inputService = {
          isKeyPressed: () => Effect.sync(() => false),
          consumeKeyPress: () => Effect.sync(() => false),
          getMouseDelta: () =>
            Effect.sync(() => {
              const dy = deltaIdx < deltas.length ? (deltas[deltaIdx++] ?? 0) : 0
              return { x: 0, y: dy }
            }),
          isMouseDown: () => Effect.sync(() => false),
          requestPointerLock: () => Effect.sync(() => {}),
          exitPointerLock: () => Effect.sync(() => {}),
          isPointerLocked: () => Effect.sync(() => true),
          consumeMouseClick: () => Effect.sync(() => false),
          consumeWheelDelta: () => Effect.sync(() => 0),
        } as unknown as InputServiceType

        const testLayers = createTestLayers(inputService)
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

        const program = Effect.gen(function* () {
          const cameraService = yield* FirstPersonCameraService
          const cameraState = yield* PlayerCameraStateService

          for (let i = 0; i < deltas.length; i++) {
            yield* cameraService.update(camera)
          }

          const rotation = yield* cameraState.getRotation()
          return rotation.pitch
        })

        const pitch = Effect.runSync(
          program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
        )

        expect(pitch).toBeGreaterThanOrEqual(PITCH_MIN - 0.001)
        expect(pitch).toBeLessThanOrEqual(PITCH_MAX + 0.001)
      }
    )
  })

  describe('integration scenarios', () => {
    it('should handle typical mouse look sequence', () => {
      let mouseDelta = { x: 0, y: 0 }
      let pointerLocked = false

      const inputService = {
        isKeyPressed: () => Effect.sync(() => false),
        consumeKeyPress: () => Effect.sync(() => false),
        getMouseDelta: () =>
          Effect.sync(() => {
            const delta = { ...mouseDelta }
            mouseDelta = { x: 0, y: 0 }
            return delta
          }),
        isMouseDown: () => Effect.sync(() => false),
        requestPointerLock: () =>
          Effect.sync(() => {
            pointerLocked = true
          }),
        exitPointerLock: () =>
          Effect.sync(() => {
            pointerLocked = false
          }),
        isPointerLocked: () => Effect.sync(() => pointerLocked),
        consumeMouseClick: () => Effect.sync(() => false),
        consumeWheelDelta: () => Effect.sync(() => 0),
      } as unknown as InputServiceType
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      // Set pointer locked via closure variable
      pointerLocked = true

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        const cameraState = yield* PlayerCameraStateService

        // First mouse movement - look right and up
        mouseDelta = { x: 200, y: -100 }
        yield* cameraService.update(camera)

        // Second mouse movement - look left and down
        mouseDelta = { x: -100, y: 50 }
        yield* cameraService.update(camera)

        return yield* cameraState.getRotation()
      })

      const rotation = Effect.runSync(
        program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
      )

      // Net movement: yaw = -(200 - 100) * 0.002 = -0.2
      // Net movement: pitch = -(-100 + 50) * 0.002 = 0.1
      expect(rotation.yaw).toBeCloseTo(-100 * BASE_MOUSE_SENSITIVITY * 0.5)
      expect(rotation.pitch).toBeCloseTo(50 * BASE_MOUSE_SENSITIVITY * 0.5)
    })

    it('should handle pointer lock/unlock during gameplay', () => {
      let mouseDelta = { x: 100, y: 50 }
      let pointerLocked = true

      const inputService = {
        isKeyPressed: () => Effect.sync(() => false),
        consumeKeyPress: () => Effect.sync(() => false),
        getMouseDelta: () =>
          Effect.sync(() => {
            const delta = { ...mouseDelta }
            mouseDelta = { x: 0, y: 0 }
            return delta
          }),
        isMouseDown: () => Effect.sync(() => false),
        requestPointerLock: () =>
          Effect.sync(() => {
            pointerLocked = true
          }),
        exitPointerLock: () =>
          Effect.sync(() => {
            pointerLocked = false
          }),
        isPointerLocked: () => Effect.sync(() => pointerLocked),
        consumeMouseClick: () => Effect.sync(() => false),
        consumeWheelDelta: () => Effect.sync(() => 0),
      } as unknown as InputServiceType
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      const program = Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        const cameraState = yield* PlayerCameraStateService

        // First update with pointer locked
        yield* cameraService.update(camera)
        const rotation1 = yield* cameraState.getRotation()

        // Exit pointer lock via closure variable
        pointerLocked = false

        // Set mouse delta but shouldn't be applied
        mouseDelta = { x: 200, y: 100 }
        yield* cameraService.update(camera)
        const rotation2 = yield* cameraState.getRotation()

        return { rotation1, rotation2 }
      })

      const { rotation1, rotation2 } = Effect.runSync(
        program.pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
      )

      // Second update should not have changed rotation
      expect(rotation2.yaw).toBeCloseTo(rotation1.yaw)
      expect(rotation2.pitch).toBeCloseTo(rotation1.pitch)
    })
  })
})
