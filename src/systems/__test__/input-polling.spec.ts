import { describe, it, expect, vi } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import { inputPollingSystem } from '../input-polling'
import { InputManager, World } from '@/runtime/services'
import { EntityId, toEntityId } from '@/domain/entity'
import { InputState } from '@/domain/components'
import { SoA } from '@/domain/world'
import { playerInputQuery } from '@/domain/queries'

describe('inputPollingSystem', () => {
  it.effect('should update input state for all player entities', () =>
    Effect.gen(function* (_) {
      const entityId1 = toEntityId(1)
      const entityId2 = toEntityId(2)
      const inputState = {
        forward: true,
        backward: false,
        left: true,
        right: false,
        jump: true,
        sprint: false,
        place: false,
        destroy: false,
        isLocked: false,
      }
      const soa: SoA<typeof playerInputQuery> = {
        entities: [entityId1, entityId2],
        components: {
          inputState: [],
        },
      }

      const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa),
        updateComponent: updateComponentMock,
      }

      const mockInputManager: InputManager = {
        isLocked: Ref.unsafeMake(false),
        getState: () => Effect.succeed(inputState),
        getMouseState: () => Effect.succeed({ dx: 0, dy: 0 }),
      }

      const testLayer = Layer.merge(
        Layer.succeed(World, mockWorld as World),
        Layer.succeed(InputManager, mockInputManager),
      )

      yield* _(inputPollingSystem.pipe(Effect.provide(testLayer)))

      expect(updateComponentMock).toHaveBeenCalledTimes(2)
      const expectedInputState: InputState = { ...inputState, isLocked: false }
      expect(updateComponentMock).toHaveBeenCalledWith(entityId1, 'inputState', expectedInputState)
      expect(updateComponentMock).toHaveBeenCalledWith(entityId2, 'inputState', expectedInputState)
    }))

  it.effect('should not fail when there are no player entities', () =>
    Effect.gen(function* (_) {
      const soa: SoA<typeof playerInputQuery> = {
        entities: [],
        components: {
          inputState: [],
        },
      }

      const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa),
        updateComponent: updateComponentMock,
      }

      const mockInputManager: InputManager = {
        isLocked: Ref.unsafeMake(false),
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
        getMouseState: () => Effect.succeed({ dx: 0, dy: 0 }),
      }

      const testLayer = Layer.merge(
        Layer.succeed(World, mockWorld as World),
        Layer.succeed(InputManager, mockInputManager),
      )

      yield* _(inputPollingSystem.pipe(Effect.provide(testLayer)))

      expect(updateComponentMock).not.toHaveBeenCalled()
    }))
})
