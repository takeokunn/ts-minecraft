import { describe, it, assert, vi } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { blockInteractionSystem } from '../block-interaction'
import { World } from '@/runtime/services'
import { EntityId, toEntityId } from '@/domain/entity'
import { InputState, Target, Hotbar } from '@/domain/components'
import { SoAResult } from '@/domain/types'
import { playerTargetQuery } from '@/domain/queries'
import * as Arbitrary from 'effect/Arbitrary'
import {
  arbitraryInputState,
  arbitraryTargetBlock,
  arbitraryHotbarWithoutAir,
  arbitraryHotbarWithAir,
  arbitraryTargetNone,
  arbitraryHotbar,
} from './arbitraries'

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

  it.effect('should destroy a block', () =>
    Effect.flatMap(arbitraryTargetBlock, (target) =>
      Effect.flatMap(arbitraryHotbar, (hotbar) =>
        Effect.gen(function* () {
          const mockWorld = createMockWorld({ destroy: true }, target, hotbar)
          const removeEntitySpy = vi.spyOn(mockWorld, 'removeEntity')
          const updateComponentSpy = vi.spyOn(mockWorld, 'updateComponent')

          yield* blockInteractionSystem.pipe(
            Effect.provide(Layer.succeed(World, mockWorld)),
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
    Effect.flatMap(arbitraryTargetBlock, (target) =>
      Effect.flatMap(arbitraryHotbarWithoutAir, (hotbar) =>
        Effect.gen(function* () {
          const inputState = { place: true }
          const mockWorld = createMockWorld(inputState, target, hotbar)
          const addArchetypeSpy = vi.spyOn(mockWorld, 'addArchetype')
          const updateComponentSpy = vi.spyOn(mockWorld, 'updateComponent')

          yield* blockInteractionSystem.pipe(
            Effect.provide(Layer.succeed(World, mockWorld)),
          )

          assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 1)
          assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 1)
          assert.deepStrictEqual(updateComponentSpy.mock.calls[0], [
            entityId,
            'inputState',
            { ...defaultInputState, ...inputState, place: false },
          ])
        }),
      ),
    ))

  it.effect('should do nothing if not placing or destroying', () =>
    Effect.flatMap(arbitraryTargetBlock, (target) =>
      Effect.flatMap(arbitraryHotbar, (hotbar) =>
        Effect.gen(function* () {
          const mockWorld = createMockWorld({}, target, hotbar)
          const addArchetypeSpy = vi.spyOn(mockWorld, 'addArchetype')
          const removeEntitySpy = vi.spyOn(mockWorld, 'removeEntity')
          const updateComponentSpy = vi.spyOn(mockWorld, 'updateComponent')

          yield* blockInteractionSystem.pipe(
            Effect.provide(Layer.succeed(World, mockWorld)),
          )

          assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 0)
          assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 0)
          assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
        }),
      ),
    ))

  it.effect('should do nothing if target is not a block', () =>
    Effect.flatMap(arbitraryInputState, (inputState) =>
      Effect.flatMap(arbitraryTargetNone, (target) =>
        Effect.flatMap(arbitraryHotbar, (hotbar) =>
          Effect.gen(function* () {
            const mockWorld = createMockWorld(inputState, target, hotbar)
            const addArchetypeSpy = vi.spyOn(mockWorld, 'addArchetype')
            const removeEntitySpy = vi.spyOn(mockWorld, 'removeEntity')
            const updateComponentSpy = vi.spyOn(mockWorld, 'updateComponent')

            yield* blockInteractionSystem.pipe(
              Effect.provide(Layer.succeed(World, mockWorld)),
            )

            assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 0)
            assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 0)
            assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
          }),
        ),
      ),
    ))

  it.effect('should do nothing if trying to place air', () =>
    Effect.flatMap(arbitraryTargetBlock, (target) =>
      Effect.flatMap(arbitraryHotbarWithAir, (hotbar) =>
        Effect.gen(function* () {
          const mockWorld = createMockWorld({ place: true }, target, hotbar)
          const addArchetypeSpy = vi.spyOn(mockWorld, 'addArchetype')
          const removeEntitySpy = vi.spyOn(mockWorld, 'removeEntity')
          const updateComponentSpy = vi.spyOn(mockWorld, 'updateComponent')

          yield* blockInteractionSystem.pipe(
            Effect.provide(Layer.succeed(World, mockWorld)),
          )

          assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 0)
          assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 0)
          assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
        }),
      ),
    ))
})
