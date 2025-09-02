import { Effect, Option, Ref } from 'effect'
import { describe, expect } from 'vitest'
import { test } from '@effect/vitest'
import { createArchetype } from '../archetypes'
import { createQuery } from '../query'
import { TargetNone } from '../components'
import * as World from '../world'
import { WorldContext } from '@/runtime/context'

const playerArchetypeEffect = createArchetype({
  type: 'player',
  pos: { x: 0, y: 80, z: 0 },
})

describe('world', () => {
  test('should create a world', () => {
    const world = World.createInitialWorld()
    expect(world).toBeDefined()
  })

  test('should add an archetype', () =>
    Effect.gen(function* (_) {
      const playerArchetype = yield* _(playerArchetypeEffect)
      const entityId = yield* _(World.addArchetype(playerArchetype))
      const position = yield* _(World.getComponent(entityId, 'position'))
      expect(position).toEqual({ x: 0, y: 80, z: 0 })
    }).pipe(Effect.provide(World.worldLayer)))

  test('should update a component', () =>
    Effect.gen(function* (_) {
      const playerArchetype = yield* _(playerArchetypeEffect)
      const entityId = yield* _(World.addArchetype(playerArchetype))
      yield* _(World.updateComponent(entityId, 'position', { x: 1, y: 2, z: 3 }))
      const position = yield* _(World.getComponent(entityId, 'position'))
      expect(position).toEqual({ x: 1, y: 2, z: 3 })
    }).pipe(Effect.provide(World.worldLayer)))

  test('should query entities with single component', () =>
    Effect.gen(function* (_) {
      const playerArchetype = yield* _(playerArchetypeEffect)
      const entityId = yield* _(World.addArchetype(playerArchetype))
      const testQuery = createQuery('test', ['position'])
      const results = yield* _(World.query(testQuery))
      expect(results).toEqual([{ entityId, position: { x: 0, y: 80, z: 0 } }])
    }).pipe(Effect.provide(World.worldLayer)))

  test('should query entities with multiple components', () =>
    Effect.gen(function* (_) {
      const playerArchetype = yield* _(playerArchetypeEffect)
      const entityId = yield* _(World.addArchetype(playerArchetype))
      const testQuery = createQuery('test', ['position', 'velocity'])
      const results = yield* _(World.query(testQuery))
      expect(results).toEqual([
        {
          entityId,
          position: { x: 0, y: 80, z: 0 },
          velocity: { dx: 0, dy: 0, dz: 0 },
        },
      ])
    }).pipe(Effect.provide(World.worldLayer)))

  test('should query entities with SoA', () =>
    Effect.gen(function* (_) {
      const playerArchetype = yield* _(playerArchetypeEffect)
      const entityId = yield* _(World.addArchetype(playerArchetype))
      const testQuery = createQuery('test', ['position', 'velocity'])
      const results = yield* _(World.querySoA(testQuery))
      expect(results.entities).toEqual([entityId])
      expect(results.position).toEqual({
        x: [0],
        y: [80],
        z: [0],
      })
      expect(results.velocity).toEqual({
        dx: [0],
        dy: [0],
        dz: [0],
      })
    }).pipe(Effect.provide(World.worldLayer)))

  test('should get an optional component', () =>
    Effect.gen(function* (_) {
      const entityId = yield* _(World.addArchetype({}))
      const target = yield* _(World.getComponentOption(entityId, 'target'))
      expect(Option.isNone(target)).toBe(true)

      const targetNone = new TargetNone({ _tag: 'none' })
      yield* _(World.updateComponent(entityId, 'target', targetNone))
      const target2 = yield* _(World.getComponentOption(entityId, 'target'))
      expect(Option.isSome(target2)).toBe(true)
      if (Option.isSome(target2)) {
        const expectedTargetNone = new TargetNone({ _tag: 'none' })
        expect(target2.value).toEqual(expectedTargetNone)
      }
    }).pipe(Effect.provide(World.worldLayer)))

  test('should record block placements', () =>
    Effect.gen(function* (_) {
      yield* _(
        World.recordBlockPlacement({
          position: [1, 2, 3],
          blockType: 'stone',
        }),
      )
      const worldContext = yield* _(WorldContext)
      const worldState = yield* _(Ref.get(worldContext.world))
      expect(worldState.globalState.editedBlocks.placed['1,2,3']).toEqual({
        position: { x: 1, y: 2, z: 3 },
        blockType: 'stone',
      })
    }).pipe(Effect.provide(World.worldLayer)))
})
