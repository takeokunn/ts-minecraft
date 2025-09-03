import { describe, it, assert, vi } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { blockInteractionSystem } from '../block-interaction'
import { World } from '@/runtime/services'
import { EntityId } from '@/domain/entity'
import { Hotbar, InputState, Position, TargetBlock, TargetNone } from '@/domain/components'
import { SoA } from '@/domain/world'
import { playerTargetQuery } from '@/domain/queries'

const mockWorld: Partial<World> = {
  querySoA: vi.fn(),
  addArchetype: vi.fn(),
  removeEntity: vi.fn(),
  updateComponent: vi.fn(),
}

const worldLayer = Layer.succeed(World, mockWorld as World)

describe('blockInteractionSystem', () => {
  

  it.effect('should destroy a block', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('1')
      const targetEntityId = EntityId('2')
      const targetPosition = new Position({ x: 1, y: 2, z: 3 })
      const target = new TargetBlock({
        _tag: 'block',
        entityId: targetEntityId,
        position: targetPosition,
        face: [0, 1, 0],
      })
      const inputState = new InputState({ ...InputState.default, destroy: true })
      const hotbar = new Hotbar({ selectedIndex: 0, slots: ['air'] })

      const soa: SoA<typeof playerTargetQuery> = {
        entities: [entityId],
        components: {
          inputState: [inputState],
          target: [target],
          hotbar: [hotbar],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa),
        removeEntity: () => Effect.succeed(undefined),
        updateComponent: () => Effect.succeed(undefined),
      }

      const worldLayer = Layer.succeed(World, mockWorld as World)

      const world = yield* $(World)
      const removeEntitySpy = vi.spyOn(world, 'removeEntity')
      const updateComponentSpy = vi.spyOn(world, 'updateComponent')

      yield* $(blockInteractionSystem.pipe(Effect.provide(worldLayer)))

      assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 1)
      assert.deepStrictEqual(removeEntitySpy.mock.calls[0][0], targetEntityId)
      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 1)
      assert.deepStrictEqual(updateComponentSpy.mock.calls[0], [entityId, 'target', new TargetNone({ _tag: 'none' })])
    }))

  it.effect('should place a block', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('1')
      const targetEntityId = EntityId('2')
      const targetPosition = new Position({ x: 1, y: 2, z: 3 })
      const target = new TargetBlock({
        _tag: 'block',
        entityId: targetEntityId,
        position: targetPosition,
        face: [0, 1, 0],
      })
      const inputState = new InputState({ ...InputState.default, place: true })
      const hotbar = new Hotbar({ selectedIndex: 0, slots: ['stone'] })

      const soa: SoA<typeof playerTargetQuery> = {
        entities: [entityId],
        components: {
          inputState: [inputState],
          target: [target],
          hotbar: [hotbar],
        },
      }

      const mockWorld: Partial<World> = {
        querySoA: () => Effect.succeed(soa),
        addArchetype: () => Effect.succeed(EntityId('3')),
        updateComponent: () => Effect.succeed(undefined),
      }

      const worldLayer = Layer.succeed(World, mockWorld as World)

      const world = yield* $(World)
      const addArchetypeSpy = vi.spyOn(world, 'addArchetype')
      const updateComponentSpy = vi.spyOn(world, 'updateComponent')

      yield* $(blockInteractionSystem.pipe(Effect.provide(worldLayer)))

      assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 1)
      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 1)
      assert.deepStrictEqual(updateComponentSpy.mock.calls[0], [entityId, 'inputState', { ...inputState, place: false }])
    }))

  it.effect('should do nothing if not placing or destroying', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('1')
      const targetEntityId = EntityId('2')
      const targetPosition = new Position({ x: 1, y: 2, z: 3 })
      const target = new TargetBlock({
        _tag: 'block',
        entityId: targetEntityId,
        position: targetPosition,
        face: [0, 1, 0],
      })
      const inputState = new InputState({ ...InputState.default })
      const hotbar = new Hotbar({ selectedIndex: 0, slots: ['stone'] })

      const soa: SoA<typeof playerTargetQuery> = {
        entities: [entityId],
        components: {
          inputState: [inputState],
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

      const worldLayer = Layer.succeed(World, mockWorld as World)

      const world = yield* $(World)
      const addArchetypeSpy = vi.spyOn(world, 'addArchetype')
      const removeEntitySpy = vi.spyOn(world, 'removeEntity')
      const updateComponentSpy = vi.spyOn(world, 'updateComponent')

      yield* $(blockInteractionSystem.pipe(Effect.provide(worldLayer)))

      assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 0)
      assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 0)
      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
    }))

  it.effect('should do nothing if target is not a block', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('1')
      const target = new TargetNone()
      const inputState = new InputState({ ...InputState.default, place: true, destroy: true })
      const hotbar = new Hotbar({ selectedIndex: 0, slots: ['stone'] })

      const soa: SoA<typeof playerTargetQuery> = {
        entities: [entityId],
        components: {
          inputState: [inputState],
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

      const worldLayer = Layer.succeed(World, mockWorld as World)

      const world = yield* $(World)
      const addArchetypeSpy = vi.spyOn(world, 'addArchetype')
      const removeEntitySpy = vi.spyOn(world, 'removeEntity')
      const updateComponentSpy = vi.spyOn(world, 'updateComponent')

      yield* $(blockInteractionSystem.pipe(Effect.provide(worldLayer)))

      assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 0)
      assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 0)
      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
    }))

  it.effect('should do nothing if trying to place air', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('1')
      const targetEntityId = EntityId('2')
      const targetPosition = new Position({ x: 1, y: 2, z: 3 })
      const target = new TargetBlock({
        _tag: 'block',
        entityId: targetEntityId,
        position: targetPosition,
        face: [0, 1, 0],
      })
      const inputState = new InputState({ ...InputState.default, place: true })
      const hotbar = new Hotbar({ selectedIndex: 0, slots: ['air'] })

      const soa: SoA<typeof playerTargetQuery> = {
        entities: [entityId],
        components: {
          inputState: [inputState],
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

      const worldLayer = Layer.succeed(World, mockWorld as World)

      const world = yield* $(World)
      const addArchetypeSpy = vi.spyOn(world, 'addArchetype')
      const removeEntitySpy = vi.spyOn(world, 'removeEntity')
      const updateComponentSpy = vi.spyOn(world, 'updateComponent')

      yield* $(blockInteractionSystem.pipe(Effect.provide(worldLayer)))

      assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 0)
      assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 0)
      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
    }))

  it.effect('should do nothing if hotbar slot is empty', () =>
    Effect.gen(function* ($) {
      const entityId = EntityId('1')
      const targetEntityId = EntityId('2')
      const targetPosition = new Position({ x: 1, y: 2, z: 3 })
      const target = new TargetBlock({
        _tag: 'block',
        entityId: targetEntityId,
        position: targetPosition,
        face: [0, 1, 0],
      })
      const inputState = new InputState({ ...InputState.default, place: true })
      const hotbar = new Hotbar({ selectedIndex: 0, slots: [] })

      const soa: SoA<typeof playerTargetQuery> = {
        entities: [entityId],
        components: {
          inputState: [inputState],
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

      const worldLayer = Layer.succeed(World, mockWorld as World)

      const world = yield* $(World)
      const addArchetypeSpy = vi.spyOn(world, 'addArchetype')
      const removeEntitySpy = vi.spyOn(world, 'removeEntity')
      const updateComponentSpy = vi.spyOn(world, 'updateComponent')

      yield* $(blockInteractionSystem.pipe(Effect.provide(worldLayer)))

      assert.deepStrictEqual(addArchetypeSpy.mock.calls.length, 0)
      assert.deepStrictEqual(removeEntitySpy.mock.calls.length, 0)
      assert.deepStrictEqual(updateComponentSpy.mock.calls.length, 0)
    }))
})