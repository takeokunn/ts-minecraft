import { describe, it, assert } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import { cameraControlSystem } from '../camera-control'
import { World, InputManager } from '@/runtime/services'
import { WorldLive } from '@/infrastructure/world'
import { createArchetype } from '@/domain/archetypes'
import { toFloat } from '@/core/common'

const InputManagerTest = Layer.effect(
  InputManager,
  Effect.gen(function* () {
    const isLocked = yield* Ref.make(true)
    return InputManager.of({
      isLocked,
      getState: () => Effect.succeed({
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: false,
      }),
      getMouseState: () => Effect.succeed({
        dx: 10,
        dy: 5,
      }),
    })
  })
)

const TestLayer = Layer.mergeAll(WorldLive, InputManagerTest)

describe('cameraControlSystem', () => {
  it.effect('should update camera state based on mouse input', () =>
    Effect.gen(function* () {
      const world = yield* World
      
      // Create a player with camera state
      const player = yield* createArchetype({
        type: 'player',
        pos: { x: 0, y: 0, z: 0 },
        cameraState: {
          pitch: toFloat(0),
          yaw: toFloat(0),
        },
      })
      
      yield* world.addArchetype(player)
      
      // Run the camera control system
      yield* cameraControlSystem
      
      // Verify the camera state was updated
      const result = yield* world.querySingle({
        components: ['cameraState'] as const,
      })
      
      if (result._tag === 'Some') {
        const [, [cameraState]] = result.value
        // Mouse movement should have updated the camera
        assert.isTrue(cameraState.pitch !== 0)
        assert.isTrue(cameraState.yaw !== 0)
      } else {
        assert.fail('No player with camera state found')
      }
    }).pipe(Effect.provide(TestLayer))
  )

  it.effect('should handle no mouse movement', () => {
    const inputManager = InputManager.of({
      isLocked: Ref.unsafeMake(true),
      getState: () => Effect.succeed({
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: false,
      }),
      getMouseState: () => Effect.succeed({
        dx: 0,
        dy: 0,
      }),
    })
    
    const testLayerNoMovement = Layer.mergeAll(
      WorldLive,
      Layer.succeed(InputManager, inputManager)
    )
    
    return Effect.gen(function* () {
      const world = yield* World
      const player = yield* createArchetype({
        type: 'player',
        pos: { x: 0, y: 0, z: 0 },
        cameraState: {
          pitch: toFloat(0),
          yaw: toFloat(0),
        },
      })
      
      yield* world.addArchetype(player)
      yield* cameraControlSystem
      
      const result = yield* world.querySingle({
        components: ['cameraState'] as const,
      })
      
      if (result._tag === 'Some') {
        const [, [cameraState]] = result.value
        // No mouse movement, camera should not change
        assert.strictEqual(cameraState.pitch, 0)
        assert.strictEqual(cameraState.yaw, 0)
      } else {
        assert.fail('No player with camera state found')
      }
    }).pipe(Effect.provide(testLayerNoMovement))
  })

  it.effect('should handle no players', () =>
    Effect.gen(function* () {
      // Simply test that the system runs without errors when no players exist
      yield* cameraControlSystem
      // If we reach here, the test passed
    }).pipe(Effect.provide(TestLayer))
  )
})