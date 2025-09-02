import { Effect, Option, Ref } from 'effect'
import { describe, expect } from 'vitest'
import { test } from '@effect/vitest'
import { createArchetype } from '../archetypes'
import { createTargetNone } from '../components'
import * as World from '../world'
import { WorldContext } from '@/runtime/context'

const Player = createArchetype({
  type: 'player',
  pos: { x: 0, y: 80, z: 0 },
})

describe('world', () => {
  test('should create a world', () => {
    const world = World.createInitialWorld()
    expect(world).toBeDefined()
  })

  test('should add an archetype', () =>
    Effect.gen(function* ($) {
      const entityId = yield* $(World.addArchetype(Player))
      const position = yield* $(World.getComponent(entityId, 'position'))
      expect(position).toEqual({ x: 0, y: 80, z: 0 })
    }).pipe(Effect.provide(World.worldLayer)))

  test('should update a component', () =>
    Effect.gen(function* ($) {
      const entityId = yield* $(World.addArchetype(Player))
      yield* $(World.updateComponent(entityId, 'position', { x: 1, y: 2, z: 3 }))
      const position = yield* $(World.getComponent(entityId, 'position'))
      expect(position).toEqual({ x: 1, y: 2, z: 3 })
    }).pipe(Effect.provide(World.worldLayer)))

  test('should query entities', () =>
    Effect.gen(function* ($) {
      const entityId = yield* $(World.addArchetype(Player))
      const results = yield* $(World.query({ name: 'test', components: ['position'] }))
      expect(results).toEqual([{ entityId, position: { x: 0, y: 80, z: 0 } }])
    }).pipe(Effect.provide(World.worldLayer)))

  test('should get an optional component', () =>
    Effect.gen(function* ($) {
      const entityId = yield* $(World.addArchetype({}))
      const target = yield* $(World.getComponentOption(entityId, 'target'))
      expect(Option.isNone(target)).toBe(true)

      yield* $(World.updateComponent(entityId, 'target', createTargetNone()))
      const target2 = yield* $(World.getComponentOption(entityId, 'target'))
      expect(Option.isSome(target2)).toBe(true)
      if (Option.isSome(target2)) {
        expect(target2.value).toEqual(createTargetNone())
      }
    }).pipe(Effect.provide(World.worldLayer)))

  test('should record block placements', () =>
    Effect.gen(function* ($) {
      yield* $(
        World.recordBlockPlacement({
          position: { x: 1, y: 2, z: 3 },
          blockType: 'stone',
        }),
      )
      const worldContext = yield* $(WorldContext)
      const worldState = yield* $(Ref.get(worldContext.world))
      expect(worldState.globalState.editedBlocks.placed['1,2,3']).toEqual({
        position: { x: 1, y: 2, z: 3 },
        blockType: 'stone',
      })
    }).pipe(Effect.provide(World.worldLayer)))
})