import { describe, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { expect } from 'vitest'
import { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state';
import { ThirdPersonCameraService } from '../application/third-person-camera-service'
import type { CameraTransformPort } from '@ts-minecraft/core'

// ─── Test helpers ─────────────────────────────────────────────────────────────

type CapturedCall = { x: number; y: number; z: number }

const makeMockCamera = (): CameraTransformPort & { positionCalls: CapturedCall[]; lookAtCalls: CapturedCall[] } => {
  const positionCalls: CapturedCall[] = []
  const lookAtCalls: CapturedCall[] = []
  return {
    rotation: { set: () => {} },
    position: { set: (x, y, z) => { positionCalls.push({ x, y, z }) } },
    lookAt: (x, y, z) => { lookAtCalls.push({ x, y, z }) },
    positionCalls,
    lookAtCalls,
  }
}

// provideMerge(dep) piped on the consumer keeps dep's output in scope for tests.
// ThirdPersonCameraService.Default requires PlayerCameraStateService; the merged
// layer exposes both so tests can call cameraState.setYaw / setPitch directly.
const TestLayer = ThirdPersonCameraService.Default.pipe(
  Layer.provideMerge(PlayerCameraStateService.Default),
)

const withServices = <A>(
  f: (camera: ThirdPersonCameraService, cameraState: PlayerCameraStateService) => Effect.Effect<A, never>,
): Effect.Effect<A, never, never> =>
  Effect.gen(function* () {
    const camera = yield* ThirdPersonCameraService
    const cameraState = yield* PlayerCameraStateService
    return yield* f(camera, cameraState)
  }).pipe(Effect.provide(TestLayer))

// ─── Camera positioning ───────────────────────────────────────────────────────

describe('ThirdPersonCameraService — camera positioning', () => {
  it.effect('calls position.set and lookAt once per update', () =>
    withServices((service, _cameraState) =>
      Effect.gen(function* () {
        const mock = makeMockCamera()
        yield* service.update(mock, { x: 0, y: 64, z: 0 })
        expect(mock.positionCalls).toHaveLength(1)
        expect(mock.lookAtCalls).toHaveLength(1)
      })
    )
  )

  it.effect('lookAt targets the player eye position', () =>
    withServices((service, _cameraState) =>
      Effect.gen(function* () {
        const mock = makeMockCamera()
        const playerPos = { x: 10, y: 64, z: -5 }
        const eyeLevelOffset = 0.7
        yield* service.update(mock, playerPos, eyeLevelOffset)
        const call = mock.lookAtCalls[0]!
        // lookAt(x, eyeY, z) where eyeY = playerPos.y + eyeLevelOffset
        expect(call.x).toBeCloseTo(playerPos.x)
        expect(call.y).toBeCloseTo(playerPos.y + eyeLevelOffset)
        expect(call.z).toBeCloseTo(playerPos.z)
      })
    )
  )

  it.effect('at yaw=0, pitch=0 camera is placed 4 blocks behind player (z+4 offset) and 1.5 blocks up', () =>
    withServices((service, _cameraState) =>
      Effect.gen(function* () {
        const mock = makeMockCamera()
        const playerPos = { x: 0, y: 64, z: 0 }
        yield* service.update(mock, playerPos)
        const call = mock.positionCalls[0]!
        // yaw=0, pitch=0: offsetX=0, offsetZ=4, offsetY=1.5
        // camera = (0 - 0, (64 + 0.7) + 1.5, 0 - 4)
        expect(call.x).toBeCloseTo(0)
        expect(call.y).toBeCloseTo(64 + 0.7 + 1.5)
        expect(call.z).toBeCloseTo(-4)
      })
    )
  )

  it.effect('yaw=π places camera in front of player along +Z', () =>
    withServices((service, cameraState) =>
      Effect.gen(function* () {
        yield* cameraState.setYaw(Math.PI)
        const mock = makeMockCamera()
        yield* service.update(mock, { x: 0, y: 64, z: 0 })
        const call = mock.positionCalls[0]!
        // yaw=π: sin(π)≈0, cos(π)≈-1 → offsetZ = cos(π)*4 = -4
        // camera.z = 0 - (-4) = 4 (in front of player)
        expect(call.z).toBeCloseTo(4, 3)
      })
    )
  )

  it.effect('pitch=π/6 tilts camera upward', () =>
    withServices((service, cameraState) =>
      Effect.gen(function* () {
        yield* cameraState.setPitch(Math.PI / 6)
        const mock = makeMockCamera()
        yield* service.update(mock, { x: 0, y: 64, z: 0 })
        const call = mock.positionCalls[0]!
        // pitch=π/6: sin(π/6)=0.5, cos(π/6)≈0.866
        // offsetY = sin(π/6)*4 + 1.5 = 2 + 1.5 = 3.5
        expect(call.y).toBeCloseTo(64 + 0.7 + 3.5, 3)
      })
    )
  )

  it.effect('custom eyeLevelOffset is reflected in lookAt y and camera y', () =>
    withServices((service, _cameraState) =>
      Effect.gen(function* () {
        const mock = makeMockCamera()
        yield* service.update(mock, { x: 0, y: 50, z: 0 }, 1.2)
        const lookCall = mock.lookAtCalls[0]!
        // eyeY = 50 + 1.2 = 51.2
        expect(lookCall.y).toBeCloseTo(51.2)
      })
    )
  )
})
