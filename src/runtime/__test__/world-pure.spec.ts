import { describe, it, expect } from 'vitest'
import * as Option from 'effect/Option'
import { createWorld, addArchetype, removeEntity, getComponent, updateComponent, query, querySoA } from '../world-pure'
import { Position, Velocity } from '@/domain/components'
import { createArchetype } from '@/domain/archetypes'
import { toEntityId } from '@/domain/entity'
import { createQuery } from '@/domain/query'

describe('world-pure', () => {
  it('createWorld should return a new world state', () => {
    const world = createWorld()
    expect(world).toBeDefined()
    expect(world.nextEntityId).toBe(0)
    expect(world.entities.size).toBe(0)
    expect(world.archetypes.size).toBe(0)
  })

  it('addArchetype should add an entity and its components', () => {
    const world = createWorld()
    const playerArchetype = createArchetype({
      type: 'player',
      pos: new Position({ x: 0, y: 0, z: 0 }),
    })

    const [entityId, newWorld] = addArchetype(world, playerArchetype)

    expect(entityId).toBe(toEntityId(0))
    expect(newWorld.nextEntityId).toBe(1)
    expect(newWorld.entities.size).toBe(1)
    expect(newWorld.archetypes.size).toBe(1)

    const pos = getComponent(newWorld, entityId, 'position')
    expect(Option.isSome(pos)).toBe(true)
    expect(Option.getOrThrow(pos)).toEqual(new Position({ x: 0, y: 0, z: 0 }))

    const vel = getComponent(newWorld, entityId, 'velocity')
    expect(Option.isSome(vel)).toBe(true)

    const player = getComponent(newWorld, entityId, 'player')
    expect(Option.isSome(player)).toBe(true)
  })

  it('removeEntity should remove an entity and its components', () => {
    let world = createWorld()
    const playerArchetype = createArchetype({
      type: 'player',
      pos: new Position({ x: 0, y: 0, z: 0 }),
    })
    const [entityId, newWorld] = addArchetype(world, playerArchetype)
    world = newWorld

    const updatedWorld = removeEntity(world, entityId)

    expect(updatedWorld.entities.size).toBe(0)
    expect(getComponent(updatedWorld, entityId, 'position')).toEqual(Option.none())
    expect(getComponent(updatedWorld, entityId, 'velocity')).toEqual(Option.none())

    const archetypeKey = [...world.entities.values()][0]
    if (archetypeKey) {
      expect(updatedWorld.archetypes.get(archetypeKey)?.has(entityId)).toBe(false)
    }
  })

  it('removeEntity should return world if entity does not exist', () => {
    const world = createWorld()
    const updatedWorld = removeEntity(world, toEntityId(1))
    expect(updatedWorld).toEqual(world)
  })

  it('updateComponent should update a component for an entity', () => {
    let world = createWorld()
    const playerArchetype = createArchetype({
      type: 'player',
      pos: new Position({ x: 0, y: 0, z: 0 }),
    })
    const [entityId, newWorld] = addArchetype(world, playerArchetype)
    world = newWorld

    const newPosition = new Position({ x: 1, y: 2, z: 3 })
    const updatedWorld = updateComponent(world, entityId, 'position', newPosition)

    const pos = getComponent(updatedWorld, entityId, 'position')
    expect(Option.isSome(pos)).toBe(true)
    expect(Option.getOrThrow(pos)).toEqual(newPosition)
  })

  describe('query', () => {
    it('should return entities that match the query', () => {
      let world = createWorld()
      const playerArchetype = createArchetype({
        type: 'player',
        pos: new Position({ x: 0, y: 0, z: 0 }),
      })
      const [playerEntity, newWorld1] = addArchetype(world, playerArchetype)
      world = newWorld1

      const blockArchetype = createArchetype({
        type: 'block',
        pos: new Position({ x: 1, y: 1, z: 1 }),
        blockType: 'grass',
      })
      const [, newWorld2] = addArchetype(world, blockArchetype)
      world = newWorld2

      const playerQuery = createQuery('playerQuery', ['position', 'velocity', 'player'])
      const results = query(world, playerQuery)

      expect(results.length).toBe(1)
      expect(results[0]?.entityId).toBe(playerEntity)
      expect(results[0]?.position).toBeDefined()
      expect(results[0]?.velocity).toBeDefined()
      expect(results[0]?.player).toBeDefined()
    })

    it('should return empty array if no entities match', () => {
      let world = createWorld()
      const blockArchetype = createArchetype({
        type: 'block',
        pos: new Position({ x: 1, y: 1, z: 1 }),
        blockType: 'grass',
      })
      const [, newWorld] = addArchetype(world, blockArchetype)
      world = newWorld

      const playerQuery = createQuery('playerQuery', ['position', 'velocity', 'player'])
      const results = query(world, playerQuery)

      expect(results.length).toBe(0)
    })
  })

  describe('querySoA', () => {
    it('should return SoA data for entities that match the query', () => {
      let world = createWorld()
      const player1Archetype = createArchetype({
        type: 'player',
        pos: new Position({ x: 1, y: 2, z: 3 }),
      })
      const [player1Id, newWorld1] = addArchetype(world, player1Archetype)
      world = newWorld1
      const p1v = getComponent(world, player1Id, 'velocity')
      world = updateComponent(world, player1Id, 'velocity', new Velocity({ ...Option.getOrThrow(p1v), dx: 10 }))

      const player2Archetype = createArchetype({
        type: 'player',
        pos: new Position({ x: 4, y: 5, z: 6 }),
      })
      const [player2Id, newWorld2] = addArchetype(world, player2Archetype)
      world = newWorld2
      const p2v = getComponent(world, player2Id, 'velocity')
      world = updateComponent(world, player2Id, 'velocity', new Velocity({ ...Option.getOrThrow(p2v), dx: 20 }))

      const playerQuery = createQuery('playerQuery', ['position', 'velocity'])
      const results = querySoA(world, playerQuery)

      expect(results.entities).toHaveLength(2)
      expect(results.entities).toContain(player1Id)
      expect(results.entities).toContain(player2Id)

      const p1Index = results.entities.indexOf(player1Id)
      const p2Index = results.entities.indexOf(player2Id)

      expect(results.position.x[p1Index]).toBe(1)
      expect(results.position.y[p1Index]).toBe(2)
      expect(results.position.z[p1Index]).toBe(3)
      expect(results.velocity.dx[p1Index]).toBe(10)

      expect(results.position.x[p2Index]).toBe(4)
      expect(results.position.y[p2Index]).toBe(5)
      expect(results.position.z[p2Index]).toBe(6)
      expect(results.velocity.dx[p2Index]).toBe(20)
    })
  })
})