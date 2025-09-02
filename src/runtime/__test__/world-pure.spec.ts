import { Effect, Option } from 'effect'
import { describe } from 'vitest'
import { it, expect } from '@effect/vitest'
import { createArchetype } from '@/domain/archetypes'
import { playerQuery } from '@/domain/queries'
import * as World from '@/domain/world'
import { provideTestLayer } from 'test/utils'
import { WorldContext } from '@/runtime/context'

describe('World', () => {
  // Helper to provide the test layer to each effect
  const runTest = <E, A>(effect: Effect.Effect<A, E, WorldContext>) => Effect.provide(effect, provideTestLayer())

  it.effect('should add and retrieve an archetype', () =>
    runTest(
      Effect.gen(function* (_) {
        const archetype = createArchetype({
          type: 'player',
          pos: { x: 1, y: 2, z: 3 },
        })

        const entityId = yield* _(World.addArchetype(archetype))
        const position = yield* _(World.getComponent(entityId, 'position'))
        const velocity = yield* _(World.getComponent(entityId, 'velocity'))

        expect(position).toEqual(archetype.position)
        expect(velocity).toEqual(archetype.velocity)
      }),
    ))

  it.effect('should remove an entity', () =>
    runTest(
      Effect.gen(function* (_) {
        const archetype = createArchetype({
          type: 'player',
          pos: { x: 1, y: 2, z: 3 },
        })

        const entityId = yield* _(World.addArchetype(archetype))
        yield* _(World.removeEntity(entityId))
        const position = yield* _(World.getComponentOption(entityId, 'position'))
        expect(Option.isNone(position)).toBe(true)
      }),
    ))

  it.effect('should update a component', () =>
    runTest(
      Effect.gen(function* (_) {
        const archetype = createArchetype({
          type: 'player',
          pos: { x: 1, y: 2, z: 3 },
        })
        const newPosition = { x: 4, y: 5, z: 6 }

        const entityId = yield* _(World.addArchetype(archetype))
        yield* _(World.updateComponent(entityId, 'position', newPosition))
        const position = yield* _(World.getComponent(entityId, 'position'))
        expect(position).toEqual(newPosition)
      }),
    ))

  it.effect('should query entities', () =>
    runTest(
      Effect.gen(function* (_) {
        const playerArchetype = createArchetype({
          type: 'player',
          pos: { x: 1, y: 2, z: 3 },
        })
        const blockArchetype = createArchetype({
          type: 'block',
          pos: { x: 4, y: 5, z: 6 },
          blockType: 'dirt',
        })

        const player1Id = yield* _(World.addArchetype(playerArchetype))
        yield* _(World.addArchetype(blockArchetype))
        const player2Id = yield* _(World.addArchetype(playerArchetype))

        const results = yield* _(World.query(playerQuery))
        expect(results.length).toBe(2)
        const entityIds = results.map((r) => r.entityId)
        expect(entityIds).toContain(player1Id)
        expect(entityIds).toContain(player2Id)
      }),
    ))
})