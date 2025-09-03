import { describe, it, expect, vi, assert } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import * as fc from 'effect/FastCheck'
import { inputPollingSystem } from '../input-polling'
import { InputManager, World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { InputState } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { playerInputQuery } from '@/domain/queries'
import { arbitraryInputState, arbitraryEntityId } from '@test/arbitraries'

describe('inputPollingSystem', () => {
  it.effect('should adhere to input polling properties', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(
          arbitraryInputState,
          fc.array(arbitraryEntityId),
          fc.boolean(),
          async (inputState, entityIds, isLocked) => {
            const soa: SoAResult<typeof playerInputQuery.components> = {
              entities: entityIds,
              components: {
                inputState: [],
                player: [],
              },
            }

            const updateComponentMock = vi.fn(() => Effect.succeed(undefined))

            const mockWorld: Partial<World> = {
              querySoA: () => Effect.succeed(soa as any),
              updateComponent: updateComponentMock,
            }

            const mockInputManager: InputManager = {
              isLocked: Ref.unsafeMake(isLocked),
              getState: () => Effect.succeed(inputState),
              getMouseState: () => Effect.succeed({ dx: 0, dy: 0 }),
            }

            const testLayer = Layer.merge(
              Layer.succeed(World, mockWorld as World),
              Layer.succeed(InputManager, mockInputManager),
            )

            await Effect.runPromise(inputPollingSystem.pipe(Effect.provide(testLayer)))

            assert.strictEqual(updateComponentMock.mock.calls.length, entityIds.length)
            const expectedInputState: InputState = { ...inputState, isLocked }
            entityIds.forEach((entityId, i) => {
              assert.deepStrictEqual(updateComponentMock.mock.calls[i], [
                entityId,
                'inputState',
                expectedInputState,
              ])
            })
          },
        ),
      ),
    ),
  )
})