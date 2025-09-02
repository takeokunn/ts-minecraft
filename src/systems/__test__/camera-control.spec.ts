import { Effect, Layer, Option } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { InputManagerService } from '@/runtime/services'
import { World, WorldLive } from '@/runtime/world'
import { cameraControlSystem } from '../camera-control'

const MockInputManager = Layer.succeed(
  InputManagerService,
  InputManagerService.of({
    getState: Effect.succeed({ keyboard: new Set(), isLocked: true, mouse: { dx: 0, dy: 0 } }),
    getMouseDelta: Effect.succeed({ dx: 100, dy: 200 }),
    registerListeners: () => Effect.void,
    cleanup: Effect.void,
  }),
)

const setupWorld = Effect.gen(function* (_) {
  const world = yield* _(World)
  const playerArchetype = createArchetype({
    type: 'player',
    pos: { x: 0, y: 1, z: 0 },
  })
  const playerId = yield* _(world.addArchetype(playerArchetype))
  return { playerId }
})

describe('cameraControlSystem', () => {
  it('should update camera state based on mouse input', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const { playerId } = yield* _(setupWorld)

      const initialCameraState = yield* _(world.getComponent(playerId, 'cameraState'))
      expect(Option.isSome(initialCameraState)).toBe(true)
      const { pitch: initialPitch, yaw: initialYaw } = Option.getOrThrow(initialCameraState)

      yield* _(cameraControlSystem)

      const updatedCameraState = yield* _(world.getComponent(playerId, 'cameraState'))
      expect(Option.isSome(updatedCameraState)).toBe(true)
      const { pitch: updatedPitch, yaw: updatedYaw } = Option.getOrThrow(updatedCameraState)

      expect(updatedPitch).not.toEqual(initialPitch)
      expect(updatedYaw).not.toEqual(initialYaw)
      expect(updatedPitch).toBeCloseTo(initialPitch - 200 * 0.002)
      expect(updatedYaw).toBeCloseTo(initialYaw - 100 * 0.002)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockInputManager)))
  })

  it('should do nothing if mouse has not moved', async () => {
    const NoopInputManager = Layer.succeed(
      InputManagerService,
      InputManagerService.of({
        getState: Effect.succeed({ keyboard: new Set(), isLocked: true, mouse: { dx: 0, dy: 0 } }),
        getMouseDelta: Effect.succeed({ dx: 0, dy: 0 }),
        registerListeners: () => Effect.void,
        cleanup: Effect.void,
      }),
    )

    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const { playerId } = yield* _(setupWorld)

      const initialCameraState = yield* _(world.getComponent(playerId, 'cameraState'))
      yield* _(cameraControlSystem)
      const updatedCameraState = yield* _(world.getComponent(playerId, 'cameraState'))

      expect(updatedCameraState).toEqual(initialCameraState)
    })

    await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, NoopInputManager)))
  })
})
