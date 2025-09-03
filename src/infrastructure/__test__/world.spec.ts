import { Effect, Option } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import * as S from 'effect/Schema'
import { createArchetype } from '@/domain/archetypes'
import { createQuery } from '@/domain/query'
import { Position } from '@/domain/components'
import { WorldLive } from '@/infrastructure/world'
import { World } from '@/runtime/services'
import { Float } from '@/domain/common'

const createPlayerArchetype = createArchetype({
  type: 'player',
  pos: S.decodeSync(Position)({ x: 0, y: 80, z: 0 }),
})

describe('World', () => {
  it.effect('should add an archetype and retrieve a component', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = yield* _(createPlayerArchetype)
      const entityId = yield* _(world.addArchetype(playerArchetype))
      const positionOpt = yield* _(world.getComponent(entityId, 'position'))

      assert.isTrue(Option.isSome(positionOpt))
      const position = Option.getOrThrow(positionOpt)
      assert.strictEqual(position.x, 0)
      assert.strictEqual(position.y, 80)
      assert.strictEqual(position.z, 0)
    }).pipe(Effect.provide(WorldLive)))

  it.effect('should update a component', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = yield* _(createPlayerArchetype)
      const entityId = yield* _(world.addArchetype(playerArchetype))

      yield* _(world.updateComponent(entityId, 'position', S.decodeSync(Position)({ x: 1, y: 2, z: 3 })))

      const position = yield* _(world.getComponentUnsafe(entityId, 'position'))
      assert.strictEqual(position.x, 1)
      assert.strictEqual(position.y, 2)
      assert.strictEqual(position.z, 3)
    }).pipe(Effect.provide(WorldLive)))
})

describe('World Queries', () => {
  it.effect('should return entities that match a query', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = yield* _(createPlayerArchetype)
      const entityId = yield* _(world.addArchetype(playerArchetype))

      const query = createQuery('testQuery', ['position', 'velocity'])
      const results = yield* _(world.query(query))

      assert.lengthOf(results, 1)
      assert.strictEqual(results[0][0], entityId)
      const pos = S.decodeSync(Position)({ x: 0, y: 80, z: 0 })
      assert.deepStrictEqual(results[0][1][0], pos)
      assert.deepStrictEqual(results[0][1][1], { dx: 0, dy: 0, dz: 0 })
    }).pipe(Effect.provide(WorldLive)))

  it.effect('should not return entities that do not match a query', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = yield* _(createPlayerArchetype)
      yield* _(world.addArchetype(playerArchetype))

      const query = createQuery('testQuery', ['position', 'velocity', 'renderable'])
      const results = yield* _(world.query(query))

      assert.lengthOf(results, 0)
    }).pipe(Effect.provide(WorldLive)))
})