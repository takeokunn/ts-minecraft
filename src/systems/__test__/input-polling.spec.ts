import { describe, it, assert, vi } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { inputPollingSystem } from '../input-polling'
import { InputManager, World } from '@/runtime/services'
import { EntityId } from '@/domain/entity'
import { InputState } from '@/domain/components'
import { SoA } from '@/domain/world'
import { playerInputQuery } from '@/domain/queries'

describe('inputPollingSystem', () => {
  it.effect('should update input state for all player entities', () =>
    Effect.gen(function* (_) {
      const entityId1 = EntityId('1')
      const entityId2 = EntityId('2')
      const inputState = {
        forward: true,
        backward: false,
        left: true,
        right: false,
        jump: true,
        sprint: false,
        place: false,
        destroy: false,
      }
      const soa: SoA<typeof playerInputQuery> = {
        entities: [entityId1, entityId2],
        components: {
          inputState: [],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa),
        updateComponent: () => Effect.succeed(undefined),
      }

      const mockInputManager: Partial<InputManager> = {
        getState: () => Effect.succeed(inputState),
      }

      const worldLayer = Layer.succeed(World, mockWorld as World)
      const inputManagerLayer = Layer.succeed(InputManager, mockInputManager as InputManager)
      const testLayer = worldLayer.pipe(Layer.provide(inputManagerLayer))

      const world = yield* _(World)
      const querySoaSpy = vi.spyOn(world, 'querySoA')
      const updateComponentSpy = vi.spyOn(world, 'updateComponent')

      yield* _(inputPollingSystem.pipe(Effect.provide(testLayer)))

      assert.deepStrictEqual(querySoaSpy.mock.calls.length, 1)
      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 2)

      const expectedInputState = new InputState(inputState)
      assert.deepStrictEqual(updateComponentSpy.mock.calls[0], [entityId1, 'inputState', expectedInputState])
      assert.deepStrictEqual(updateComponentSpy.mock.calls[1], [entityId2, 'inputState', expectedInputState])
    }))

  it.effect('should not fail when there are no player entities', () =>
    Effect.gen(function* (_) {
      const soa: SoA<typeof playerInputQuery> = {
        entities: [],
        components: {
          inputState: [],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa),
        updateComponent: () => Effect.succeed(undefined),
      }

      const mockInputManager: Partial<InputManager> = {
        getState: () => Effect.succeed({} as any),
      }

      const worldLayer = Layer.succeed(World, mockWorld as World)
      const inputManagerLayer = Layer.succeed(InputManager, mockInputManager as InputManager)
      const testLayer = worldLayer.pipe(Layer.provide(inputManagerLayer))

      const world = yield* _(World)
      const querySoaSpy = vi.spyOn(world, 'querySoA')
      const updateComponentSpy = vi.spyOn(world, 'updateComponent')

      yield* _(inputPollingSystem.pipe(Effect.provide(testLayer)))

      assert.deepStrictEqual(querySoaSpy.mock.calls.length, 1)
      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
    }))
})
