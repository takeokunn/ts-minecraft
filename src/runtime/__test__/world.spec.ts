import { describe, it, expect } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { World, WorldLive } from '../world'
import { Position } from '@/domain/components'
import { createArchetype } from '@/domain/archetypes'
import { createQuery } from '@/domain/query'

describe('World service', () => {
  it('should add and retrieve an entity', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = createArchetype({
        type: 'player',
        pos: new Position({ x: 1, y: 2, z: 3 }),
      })

      const entityId = yield* _(world.addArchetype(playerArchetype))
      const pos = yield* _(world.getComponent(entityId, 'position'))

      return { pos, expected: playerArchetype.position }
    })

    const testEffect = Effect.provide(program, WorldLive)

    const { pos, expected } = await Effect.runPromise(testEffect)
    expect(Option.isSome(pos)).toBe(true)
    expect(Option.getOrThrow(pos)).toEqual(expected)
  })

  it('should remove an entity', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = createArchetype({
        type: 'player',
        pos: new Position({ x: 1, y: 2, z: 3 }),
      })

      const entityId = yield* _(world.addArchetype(playerArchetype))
      yield* _(world.removeEntity(entityId))
      const pos = yield* _(world.getComponent(entityId, 'position'))
      return pos
    })

    const testEffect = Effect.provide(program, WorldLive)

    const pos = await Effect.runPromise(testEffect)
    expect(Option.isNone(pos)).toBe(true)
  })

  it('should update a component', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = createArchetype({
        type: 'player',
        pos: new Position({ x: 1, y: 2, z: 3 }),
      })
      const newPosition = new Position({ x: 4, y: 5, z: 6 })

      const entityId = yield* _(world.addArchetype(playerArchetype))
      yield* _(world.updateComponent(entityId, 'position', newPosition))
      const pos = yield* _(world.getComponent(entityId, 'position'))
      return { pos, expected: newPosition }
    })

    const testEffect = Effect.provide(program, WorldLive)

    const { pos, expected } = await Effect.runPromise(testEffect)
    expect(Option.isSome(pos)).toBe(true)
    expect(Option.getOrThrow(pos)).toEqual(expected)
  })

  it('should query entities', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const playerArchetype = createArchetype({
        type: 'player',
        pos: new Position({ x: 1, y: 2, z: 3 }),
      })
      const blockArchetype = createArchetype({
        type: 'block',
        pos: new Position({ x: 4, y: 5, z: 6 }),
        blockType: 'grass',
      })

      const playerEntity = yield* _(world.addArchetype(playerArchetype))
      yield* _(world.addArchetype(blockArchetype))

      const playerQuery = createQuery('playerQuery', ['position', 'player'])
      const results = yield* _(world.query(playerQuery))
      return { results, playerEntity }
    })

    const testEffect = Effect.provide(program, WorldLive)

    const { results, playerEntity } = await Effect.runPromise(testEffect)
    expect(results.length).toBe(1)
    expect(results[0].entityId).toBe(playerEntity)
    expect(results[0].position).toBeDefined()
    expect(results[0].player).toBeDefined()
  })

  /*
  it('should query SoA', async () => {
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const player1Archetype = createArchetype({
        type: 'player',
        pos: new Position({ x: 1, y: 2, z: 3 }),
      })
      const player2Archetype = createArchetype({
        type: 'player',
        pos: new Position({ x: 4, y: 5, z: 6 }),
      })

      const p1 = yield* _(world.addArchetype(player1Archetype))
      const p2 = yield* _(world.addArchetype(player2Archetype))

      const playerQuery = createQuery('playerQuery', ['position', 'player'])
      const results = yield* _(world.querySoA(playerQuery))
      return { results, p1, p2 }
    })

    const testEffect = Effect.provide(program, WorldLive)

    const { results, p1, p2 } = await Effect.runPromise(testEffect)
    expect(results.entities).toHaveLength(2)
    expect(results.entities).toContain(p1)
    expect(results.entities).toContain(p2)
    const p1Index = results.entities.indexOf(p1)
    const p2Index = results.entities.indexOf(p2)
    expect(results.position.x[p1Index]).toBe(1)
    expect(results.position.y[p1Index]).toBe(2)
    expect(results.position.z[p1Index]).toBe(3)
    expect(results.position.x[p2Index]).toBe(4)
    expect(results.position.y[p2Index]).toBe(5)
    expect(results.position.z[p2Index]).toBe(6)
  })
  */
})
