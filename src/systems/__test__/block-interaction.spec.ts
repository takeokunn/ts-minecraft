import { describe, it, assert, vi } from '@effect/vitest'
import { Effect, Layer, Gen } from 'effect'
import { blockInteractionSystem } from '../block-interaction'
import { World } from '@/runtime/services'
import { EntityId } from '@/domain/entity'
import { InputState, Target, Hotbar, TargetNone } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { playerTargetQuery } from '@/domain/queries'
import * as fc from 'effect/FastCheck'
import {
  arbitraryInputState,
  arbitraryTargetBlock,
  arbitraryHotbarWithoutAir,
  arbitraryHotbarWithAir,
  arbitraryTargetNone,
  arbitraryHotbar,
} from './arbitraries'

describe('blockInteractionSystem', () => {
  const entityId = EntityId('1')

  const createMockWorld = (
    inputState: Partial<InputState>,
    target: Target,
    hotbar: Hotbar,
  ) => {
    const soa: SoAResult<typeof playerTargetQuery.components> = {
      entities: [entityId],
      components: {
        inputState: [{ ...InputState.default, ...inputState }],
        target: [target],
        hotbar: [hotbar],
      },
    }

    const mockWorld: Partial<World> = {
      querySoA: () => Effect.succeed(soa),
      addArchetype: () => Effect.succeed(EntityId('3')),
      removeEntity: () => Effect.succeed(undefined),
      updateComponent: () => Effect.succeed(undefined),
    }
    return mockWorld
  }

  it.effect('should destroy a block', () =>
    Gen.flatMap(arbitraryTargetBlock, (target) =>
      Gen.flatMap(arbitraryHotbar, (hotbar) =>
        Effect.gen(function* () {
          const mockWorld = createMockWorld({ destroy: true }, target, hotbar)
          const removeEntitySpy = vi.spyOn(mockWorld, 'removeEntity')
          const updateComponentSpy = vi.spyOn(mockWorld, 'updateComponent')

          yield* blockInteractionSystem.pipe(
            Effect.provide(Layer.succeed(World, mockWorld as World)),
          )

          assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 1)
          assert.deepStrictEqual(
            removeEntitySpy.mock.calls[0][0],
            target.entityId,
          )
          assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 1)
          assert.deepStrictEqual(updateComponentSpy.mock.calls[0], [
            entityId,
            'target',
            { _tag: 'none' },
          ])
        }),
      ),
    ))

  it.effect('should place a block', () =>
    Gen.flatMap(arbitraryTargetBlock, (target) =>
      Gen.flatMap(arbitraryHotbarWithoutAir, (hotbar) =>
        Effect.gen(function* () {
          const inputState = { place: true }
          const mockWorld = createMockWorld(inputState, target, hotbar)
          const addArchetypeSpy = vi.spyOn(mockWorld, 'addArchetype')
          const updateComponentSpy = vi.spyOn(mockWorld, 'updateComponent')

          yield* blockInteractionSystem.pipe(
            Effect.provide(Layer.succeed(World, mockWorld as World)),
          )

          assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 1)
          assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 1)
          assert.deepStrictEqual(updateComponentSpy.mock.calls[0], [
            entityId,
            'inputState',
            { ...InputState.default, ...inputState, place: false },
          ])
        }),
      ),
    ))

  it.effect('should do nothing if not placing or destroying', () =>
    Gen.flatMap(arbitraryTargetBlock, (target) =>
      Gen.flatMap(arbitraryHotbar, (hotbar) =>
        Effect.gen(function* () {
          const mockWorld = createMockWorld({}, target, hotbar)
          const addArchetypeSpy = vi.spyOn(mockWorld, 'addArchetype')
          const removeEntitySpy = vi.spyOn(mockWorld, 'removeEntity')
          const updateComponentSpy = vi.spyOn(mockWorld, 'updateComponent')

          yield* blockInteractionSystem.pipe(
            Effect.provide(Layer.succeed(World, mockWorld as World)),
          )

          assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 0)
          assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 0)
          assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
        }),
      ),
    ))

  it.effect('should do nothing if target is not a block', () =>
    Gen.flatMap(arbitraryInputState, (inputState) =>
      Gen.flatMap(arbitraryTargetNone, (target) =>
        Gen.flatMap(arbitraryHotbar, (hotbar) =>
          Effect.gen(function* () {
            const mockWorld = createMockWorld(inputState, target, hotbar)
            const addArchetypeSpy = vi.spyOn(mockWorld, 'addArchetype')
            const removeEntitySpy = vi.spyOn(mockWorld, 'removeEntity')
            const updateComponentSpy = vi.spyOn(mockWorld, 'updateComponent')

            yield* blockInteractionSystem.pipe(
              Effect.provide(Layer.succeed(World, mockWorld as World)),
            )

            assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 0)
            assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 0)
            assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
          }),
        ),
      ),
    ))

  it.effect('should do nothing if trying to place air', () =>
    Gen.flatMap(arbitraryTargetBlock, (target) =>
      Gen.flatMap(arbitraryHotbarWithAir, (hotbar) =>
        Effect.gen(function* () {
          const mockWorld = createMockWorld({ place: true }, target, hotbar)
          const addArchetypeSpy = vi.spyOn(mockWorld, 'addArchetype')
          const removeEntitySpy = vi.spyOn(mockWorld, 'removeEntity')
          const updateComponentSpy = vi.spyOn(mockWorld, 'updateComponent')

          yield* blockInteractionSystem.pipe(
            Effect.provide(Layer.succeed(World, mockWorld as World)),
          )

          assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 0)
          assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 0)
          assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
        }),
      ),
    ))
})
