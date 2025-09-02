import { Effect, Option } from 'effect'
import { describe, it, expect } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { playerQuery } from '@/domain/queries'
import * as World from '@/runtime/world-pure'
import { provideTestLayer } from 'test/utils'

describe('World', () => {
  it('should add and retrieve an archetype', async () => {
    const archetype = createArchetype({
      type: 'player',
      pos: { x: 1, y: 2, z: 3 },
    })

    const program = Effect.gen(function* (_) {
      const entityId = yield* _(World.addArchetype(archetype))
      const position = yield* _(World.getComponent(entityId, 'position'))
      const velocity = yield* _(World.getComponent(entityId, 'velocity'))

      expect(position).toEqual(archetype.position)
      expect(velocity).toEqual(archetype.velocity)
    })

    await Effect.runPromise(Effect.provide(program, provideTestLayer()))
  })

  it('should remove an entity', async () => {
    const archetype = createArchetype({
      type: 'player',
      pos: { x: 1, y: 2, z: 3 },
    })

    const program = Effect.gen(function* (_) {
      const entityId = yield* _(World.addArchetype(archetype))
      yield* _(World.removeEntity(entityId))
      const position = yield* _(World.getComponentOption(entityId, 'position'))
      expect(Option.isNone(position)).toBe(true)
    })

    await Effect.runPromise(Effect.provide(program, provideTestLayer()))
  })

  it('should update a component', async () => {
    const archetype = createArchetype({
      type: 'player',
      pos: { x: 1, y: 2, z: 3 },
    })
    const newPosition = { x: 4, y: 5, z: 6 }

    const program = Effect.gen(function* (_) {
      const entityId = yield* _(World.addArchetype(archetype))
      yield* _(World.updateComponent(entityId, 'position', newPosition))
      const position = yield* _(World.getComponent(entityId, 'position'))
      expect(position).toEqual(newPosition)
    })

    await Effect.runPromise(Effect.provide(program, provideTestLayer()))
  })

  it('should query entities', async () => {
    const playerArchetype = createArchetype({
      type: 'player',
      pos: { x: 1, y: 2, z: 3 },
    })
    const blockArchetype = createArchetype({
      type: 'block',
      pos: { x: 4, y: 5, z: 6 },
      blockType: 'dirt',
    })

    const program = Effect.gen(function* (_) {
      const player1Id = yield* _(World.addArchetype(playerArchetype))
      yield* _(World.addArchetype(blockArchetype))
      const player2Id = yield* _(World.addArchetype(playerArchetype))

      const results = yield* _(World.query(playerQuery))
      expect(results.length).toBe(2)
      const entityIds = results.map((r) => r.entityId)
      expect(entityIds).toContain(player1Id)
      expect(entityIds).toContain(player2Id)
    })

    await Effect.runPromise(Effect.provide(program, provideTestLayer()))
  })
})