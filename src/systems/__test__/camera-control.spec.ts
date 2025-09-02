import { Effect, Layer } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { CameraState } from '@/domain/components'
import { InputManagerService } from '@/runtime/services'
import * as World from '@/runtime/world-pure'
import { provideTestWorld } from 'test/utils'
import { cameraControlSystem } from '../camera-control'

const MockInputManager = (dx: number, dy: number) =>
  Layer.succeed(
    InputManagerService,
    InputManagerService.of({
      getMouseDelta: Effect.succeed({ dx, dy }),
      getState: Effect.succeed({ keyboard: new Set(), isLocked: true, mouse: { dx, dy } }),
      registerListeners: () => Effect.void,
      cleanup: Effect.void,
    }),
  )

const setupWorld = (camera: Partial<CameraState>) =>
  Effect.gen(function* ($) {
    const playerArchetype = createArchetype({
      type: 'player',
      pos: { x: 0, y: 0, z: 0 },
    })
    const playerId = yield* $(World.addArchetype(playerArchetype))
    yield* $(World.updateComponent(playerId, 'cameraState', new CameraState({ pitch: 0, yaw: 0, ...camera })))
    return { playerId }
  })

describe('cameraControlSystem', () => {
  it('should update camera state based on mouse delta', () =>
    Effect.gen(function* ($) {
      const { playerId } = yield* $(setupWorld({ pitch: 0, yaw: 0 }))
      const initialCameraState = yield* $(World.getComponent(playerId, 'cameraState'))

      yield* $(cameraControlSystem)

      const updatedCameraState = yield* $(World.getComponent(playerId, 'cameraState'))

      expect(updatedCameraState).not.toEqual(initialCameraState)
    }).pipe(Effect.provide(provideTestWorld().pipe(Layer.provide(MockInputManager(100, 200))))))

  it('should not update camera state if mouse has not moved', () =>
    Effect.gen(function* ($) {
      const { playerId } = yield* $(setupWorld({ pitch: 0, yaw: 0 }))
      const initialCameraState = yield* $(World.getComponent(playerId, 'cameraState'))

      yield* $(cameraControlSystem)

      const updatedCameraState = yield* $(World.getComponent(playerId, 'cameraState'))
      expect(updatedCameraState).toEqual(initialCameraState)
    }).pipe(Effect.provide(provideTestWorld().pipe(Layer.provide(MockInputManager(0, 0))))))
})
