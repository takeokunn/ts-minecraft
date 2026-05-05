import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Array as Arr, Effect, Layer, MutableRef, Option, Schema } from 'effect'
import * as THREE from 'three'
import { PlayerInputService } from '@ts-minecraft/player'
import { PlayerCameraStateService, PlayerCameraStateLive, PITCH_MIN, PITCH_MAX } from '@ts-minecraft/player'
import {
  FirstPersonCameraService,
  FirstPersonCameraServiceLive,
} from '@ts-minecraft/player'
import { createTestInputService } from './movement-service-test-utils'

const createTestLayers = (inputService: PlayerInputService) =>
  Layer.merge(
    Layer.succeed(PlayerInputService, inputService),
    PlayerCameraStateLive
  )

describe('FirstPersonCameraService', () => {
  describe('attachToPlayer', () => {
    it.effect('should sync camera rotation with player camera state', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        const cameraState = yield* PlayerCameraStateService

        yield* cameraState.setYaw(Math.PI / 4)
        yield* cameraState.setPitch(Math.PI / 6)

        yield* cameraService.attachToPlayer(camera)

        const rotation = yield* cameraState.getRotation()

        expect(camera.rotation.x).toBeCloseTo(rotation.pitch)
        expect(camera.rotation.y).toBeCloseTo(rotation.yaw)
        expect(camera.rotation.z).toBe(0)
        expect(camera.rotation.order).toBe('YXZ')
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
    })

    it.effect('should use YXZ rotation order', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.attachToPlayer(camera)

        expect(camera.rotation.order).toBe('YXZ')
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
    })

    it.effect('should not change the camera state values', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        const cameraState = yield* PlayerCameraStateService

        yield* cameraState.setYaw(1.23)
        yield* cameraState.setPitch(0.45)

        const beforeRotation = yield* cameraState.getRotation()
        yield* cameraService.attachToPlayer(camera)
        const afterRotation = yield* cameraState.getRotation()

        expect(afterRotation.yaw).toBeCloseTo(beforeRotation.yaw)
        expect(afterRotation.pitch).toBeCloseTo(beforeRotation.pitch)
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
    })
  })

  describe('pitch clamping — property test', () => {
    it.effect.prop(
      'pitch is always within [PITCH_MIN, PITCH_MAX] for any sequence of mouse Y deltas',
      {
        deltas: Arbitrary.make(
          Schema.Array(Schema.Number.pipe(Schema.between(-1000, 1000))).pipe(Schema.minItems(1), Schema.maxItems(100))
        ),
      },
      ({ deltas }) => {
        const deltaIdxRef = MutableRef.make(0)
        const inputService = PlayerInputService.of({
          _tag: '@minecraft/application/PlayerInputService' as const,
          isKeyPressed: () => Effect.sync(() => false),
          consumeKeyPress: () => Effect.sync(() => false),
          getMouseDelta: () =>
            Effect.sync(() => {
              const currentIdx = MutableRef.get(deltaIdxRef)
              const dy = currentIdx < deltas.length ? Option.getOrElse(Arr.get(deltas, currentIdx), () => 0) : 0
              MutableRef.set(deltaIdxRef, currentIdx + 1)
              return { x: 0, y: dy }
            }),
          isPointerLocked: () => Effect.sync(() => true),
          consumeWheelDelta: () => Effect.sync(() => 0),
        })

        const testLayers = createTestLayers(inputService)
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

        return Effect.gen(function* () {
          const cameraService = yield* FirstPersonCameraService
          const cameraState = yield* PlayerCameraStateService

          yield* Effect.forEach(Arr.makeBy(deltas.length, () => undefined), () => cameraService.update(camera), { concurrency: 1 })

          const rotation = yield* cameraState.getRotation()
          const pitch = rotation.pitch

          expect(pitch).toBeGreaterThanOrEqual(PITCH_MIN - 0.001)
          expect(pitch).toBeLessThanOrEqual(PITCH_MAX + 0.001)
        }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
      }
    )
  })
})
