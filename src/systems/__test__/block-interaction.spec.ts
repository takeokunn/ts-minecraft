import { describe, it, assert, vi } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import * as fc from 'effect/FastCheck'
import * as S from 'effect/Schema'
import { blockInteractionSystem } from '../block-interaction'
import { World } from '@/runtime/services'
import { toEntityId } from '@/domain/entity'
import { InputState, Target, Hotbar } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { playerTargetQuery } from '@/domain/queries'
import {
  arbitraryInputState,
  arbitraryTarget,
  arbitraryHotbar,
} from '@test/arbitraries'

const defaultInputState = S.decodeSync(InputState)(S.Struct.fields(InputState.fields))

describe('blockInteractionSystem', () => {
  const entityId = toEntityId('1')

  const createMockWorld = (
    inputState: Partial<InputState>,
    target: Target,
    hotbar: Hotbar,
  ) => {
    const soa: SoAResult<typeof playerTargetQuery.components> = {
      entities: [entityId],
      components: {
        inputState: [{ ...defaultInputState, ...inputState }],
        target: [target],
        hotbar: [hotbar],
        player: [],
        position: [],
      },
    }

    const mockWorld: World = {
      querySoA: () => Effect.succeed(soa as any),
      addArchetype: () => Effect.succeed(toEntityId('3')),
      removeEntity: () => Effect.succeed(undefined),
      updateComponent: () => Effect.succeed(undefined),
    }
    return mockWorld
  }

  it.effect('should adhere to block interaction properties', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(
          arbitraryInputState,
          arbitraryTarget,
          arbitraryHotbar,
          async (partialInputState, target, hotbar) => {
            const inputState = { ...defaultInputState, ...partialInputState }
            const mockWorld = createMockWorld(inputState, target, hotbar)
            const addArchetypeSpy = vi.spyOn(mockWorld, 'addArchetype')
            const removeEntitySpy = vi.spyOn(mockWorld, 'removeEntity')
            const updateComponentSpy = vi.spyOn(mockWorld, 'updateComponent')

            await Effect.runPromise(
              blockInteractionSystem.pipe(
                Effect.provide(Layer.succeed(World, mockWorld)),
              ),
            )

            const shouldDestroy = inputState.destroy && target._tag === 'block'
            const selectedBlock = hotbar.slots[hotbar.selectedIndex]
            const shouldPlace =
              inputState.place &&
              target._tag === 'block' &&
              selectedBlock &&
              selectedBlock !== 'air'

            if (shouldDestroy) {
              assert.strictEqual(removeEntitySpy.mock.calls.length, 1, 'removeEntity should be called once for destroy')
              assert.deepStrictEqual(removeEntitySpy.mock.calls[0][0], target.entityId)
              assert.strictEqual(updateComponentSpy.mock.calls.length, 1, 'updateComponent should be called once for destroy')
              assert.deepStrictEqual(updateComponentSpy.mock.calls[0], [
                entityId,
                'target',
                { _tag: 'none' },
              ])
            } else if (shouldPlace) {
              assert.strictEqual(addArchetypeSpy.mock.calls.length, 1, 'addArchetype should be called once for place')
              assert.strictEqual(updateComponentSpy.mock.calls.length, 1, 'updateComponent should be called once for place')
              assert.deepStrictEqual(updateComponentSpy.mock.calls[0], [
                entityId,
                'inputState',
                { ...inputState, place: false },
              ])
            } else {
              assert.strictEqual(addArchetypeSpy.mock.calls.length, 0, 'addArchetype should not be called')
              assert.strictEqual(removeEntitySpy.mock.calls.length, 0, 'removeEntity should not be called')
              assert.strictEqual(updateComponentSpy.mock.calls.length, 0, 'updateComponent should not be called')
            }
          },
        ),
      ),
    ))
})