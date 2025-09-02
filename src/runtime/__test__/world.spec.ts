import { Effect, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { Position } from '@/domain/components'
import { toEntityId } from '@/domain/entity'
import { playerQuery } from '@/domain/queries'
import { World, WorldLive } from '../world'

const testLayer = WorldLive

const runTest = <E, A>(effect: Effect.Effect<A, E, World>) => {
  return Effect.runPromise(Effect.provide(effect, testLayer))
}

describe('World Service', () => {
  it('should add an archetype and retrieve its components', () =>
    runTest(
      Effect.gen(function* (_) {
        const world = yield* _(World)
        const archetype = createArchetype({ type: 'player', pos: new Position({ x: 0, y: 0, z: 0 }) })

        const entityId = yield* _(world.addArchetype(archetype))
        const position = yield* _(world.getComponent(entityId, 'position'))

        expect(entityId).toBe(toEntityId(0))
        expect(Option.isSome(position)).toBe(true)
        expect(Option.getOrThrow(position)).toEqual(archetype.position)
      }),
    ))

  it('should remove an entity', () =>
    runTest(
      Effect.gen(function* (_) {
        const world = yield* _(World)
        const archetype = createArchetype({ type: 'player', pos: new Position({ x: 0, y: 0, z: 0 }) })

        const entityId = yield* _(world.addArchetype(archetype))
        yield* _(world.removeEntity(entityId))
        const position = yield* _(world.getComponent(entityId, 'position'))

        expect(Option.isNone(position)).toBe(true)
      }),
    ))

  it('should update a component', () =>
    runTest(
      Effect.gen(function* (_) {
        const world = yield* _(World)
        const archetype = createArchetype({ type: 'player', pos: new Position({ x: 0, y: 0, z: 0 }) })
        const newPosition = new Position({ x: 10, y: 20, z: 30 })

        const entityId = yield* _(world.addArchetype(archetype))
        yield* _(world.updateComponent(entityId, 'position', newPosition))
        const position = yield* _(world.getComponent(entityId, 'position'))

        expect(Option.isSome(position)).toBe(true)
        expect(Option.getOrThrow(position)).toEqual(newPosition)
      }),
    ))

  it('should query entities', () =>
    runTest(
      Effect.gen(function* (_) {
        const world = yield* _(World)
        const playerArchetype = createArchetype({ type: 'player', pos: new Position({ x: 0, y: 0, z: 0 }) })
        const blockArchetype = createArchetype({ type: 'block', pos: new Position({ x: 1, y: 1, z: 1 }), blockType: 'grass' })

        const player1Id = yield* _(world.addArchetype(playerArchetype))
        yield* _(world.addArchetype(blockArchetype))
        const player2Id = yield* _(world.addArchetype(playerArchetype))

        const results = yield* _(world.query(playerQuery))

        expect(results.length).toBe(2)
        const entityIds = results.map((r) => r.entityId)
        expect(entityIds).toContain(player1Id)
        expect(entityIds).toContain(player2Id)
      }),
    ))

  it('should return an empty array when query finds no matches', () =>
    runTest(
      Effect.gen(function* (_) {
        const world = yield* _(World)
        const blockArchetype = createArchetype({ type: 'block', pos: new Position({ x: 1, y: 1, z: 1 }), blockType: 'grass' })
        yield* _(world.addArchetype(blockArchetype))

        const results = yield* _(world.query(playerQuery))
        expect(results.length).toBe(0)
      }),
    ))
})
