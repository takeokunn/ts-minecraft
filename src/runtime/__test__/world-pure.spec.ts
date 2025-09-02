import * as fc from 'fast-check'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Archetype, createArchetype } from '@/domain/archetypes'
import { ComponentName, Components, Position, ComponentSchemas } from '@/domain/components'
import { toEntityId } from '@/domain/entity'
import { playerQuery, playerTargetQuery } from '@/domain/queries'
import * as World from '../world-pure'
import { Option } from 'effect'
import * as S from 'effect/Schema'

// Test-only component without a schema
type NoSchemaComponent = { value: string }
declare module '@/domain/components' {
  interface Components {
    noSchema: NoSchemaComponent
  }
}

// Test-only component with a class schema
class TransformComponent extends S.Class<TransformComponent>()({
  value: S.String,
}) {}

declare module '@/domain/components' {
  interface Components {
    transform: TransformComponent
  }
}


const archetypeGen = fc.constantFrom<Archetype>(
  createArchetype({ type: 'player', pos: new Position({ x: 0, y: 0, z: 0 }) }),
  createArchetype({ type: 'block', pos: new Position({ x: 1, y: 1, z: 1 }), blockType: 'grass' }),
  createArchetype({ type: 'camera', pos: new Position({ x: 0, y: 1, z: 0 }) }),
)

describe('world-pure', () => {
  it('should create an empty world', () => {
    const world = World.createWorld()
    expect(world.nextEntityId).toBe(0)
    expect(world.entities.size).toBe(0)
    expect(world.archetypes.size).toBe(0)
  })

  describe('addArchetype', () => {
    it('should add an entity and its components to the world', () => {
      fc.assert(
        fc.property(archetypeGen, (archetype) => {
          const world = World.createWorld()
          const [entityId, newWorld] = World.addArchetype(world, archetype)

          expect(entityId).toBe(toEntityId(0))
          expect(newWorld.nextEntityId).toBe(1)
          expect(newWorld.entities.size).toBe(1)

          const componentNames = Object.keys(archetype) as ComponentName[]
          for (const componentName of componentNames) {
            const component = World.getComponent(newWorld, entityId, componentName)
            expect(Option.isSome(component)).toBe(true)
            expect(Option.getOrThrow(component)).toEqual(archetype[componentName])
          }
        }),
      )
    })

    it('should correctly update archetype storage', () => {
      const world = World.createWorld()
      const playerArchetype = createArchetype({ type: 'player', pos: new Position({ x: 0, y: 0, z: 0 }) })
      const blockArchetype = createArchetype({ type: 'block', pos: new Position({ x: 1, y: 1, z: 1 }), blockType: 'grass' })

      const [playerEntityId, world2] = World.addArchetype(world, playerArchetype)
      const [blockEntityId, world3] = World.addArchetype(world2, blockArchetype)
      const [player2EntityId, world4] = World.addArchetype(world3, playerArchetype)

      const playerArchetypeKey = Object.keys(playerArchetype).sort().join(',')
      const blockArchetypeKey = Object.keys(blockArchetype).sort().join(',')

      const playerArchetypeEntities = world4.archetypes.get(playerArchetypeKey)
      expect(playerArchetypeEntities).toBeDefined()
      expect(playerArchetypeEntities?.size).toBe(2)
      expect(playerArchetypeEntities).toContain(playerEntityId)
      expect(playerArchetypeEntities).toContain(player2EntityId)

      const blockArchetypeEntities = world4.archetypes.get(blockArchetypeKey)
      expect(blockArchetypeEntities).toBeDefined()
      expect(blockArchetypeEntities?.size).toBe(1)
      // @ts-expect-error
      expect(blockArchetypeEntities).toContain(blockEntityId)
    })
  })

  describe('removeEntity', () => {
    it('should remove an entity and its components from the world', () => {
      fc.assert(
        fc.property(archetypeGen, (archetype) => {
          const world = World.createWorld()
          const [entityId, newWorld] = World.addArchetype(world, archetype)
          const worldAfterRemove = World.removeEntity(newWorld, entityId)

          expect(worldAfterRemove.entities.has(entityId)).toBe(false)
          const componentNames = Object.keys(archetype) as ComponentName[]
          for (const componentName of componentNames) {
            const component = World.getComponent(worldAfterRemove, entityId, componentName)
            expect(Option.isNone(component)).toBe(true)
          }
        }),
      )
    })

    it('should not fail when removing a non-existent entity', () => {
      const world = World.createWorld()
      const worldAfterRemove = World.removeEntity(world, toEntityId(999))
      expect(worldAfterRemove).toEqual(world)
    })
  })

  describe('updateComponent', () => {
    it('should update a component for a given entity', () => {
      const world = World.createWorld()
      const playerArchetype = createArchetype({ type: 'player', pos: new Position({ x: 0, y: 0, z: 0 }) })
      const [entityId, newWorld] = World.addArchetype(world, playerArchetype)

      const newPosition = new Position({ x: 10, y: 20, z: 30 })
      const updatedWorld = World.updateComponent(newWorld, entityId, 'position', newPosition)

      const retrievedPosition = World.getComponent(updatedWorld, entityId, 'position')
      expect(Option.isSome(retrievedPosition)).toBe(true)
      expect(Option.getOrThrow(retrievedPosition)).toEqual(newPosition)

      // Ensure other components are not affected
      const velocity = World.getComponent(updatedWorld, entityId, 'velocity')
      expect(Option.isSome(velocity)).toBe(true)
      expect(Option.getOrThrow(velocity)).toEqual(playerArchetype.velocity)
    })
  })

  describe('query', () => {
    it('should return entities that match the query', () => {
      const world = World.createWorld()
      const playerArchetype = createArchetype({ type: 'player', pos: new Position({ x: 0, y: 0, z: 0 }) })
      const blockArchetype = createArchetype({ type: 'block', pos: new Position({ x: 1, y: 1, z: 1 }), blockType: 'grass' })

      const [, world2] = World.addArchetype(world, playerArchetype)
      const [, world3] = World.addArchetype(world2, blockArchetype)
      const [player2EntityId, world4] = World.addArchetype(world3, playerArchetype)

      const results = World.query(world4, playerQuery)
      expect(results.length).toBe(2)
      const entityIds = results.map((r) => r.entityId)
      expect(entityIds).toContain(toEntityId(0))
      expect(entityIds).toContain(player2EntityId)

      for (const result of results) {
        expect(result.player).toBeDefined()
        expect(result.position).toBeDefined()
        expect(result.velocity).toBeDefined()
      }
    })

    it('should return an empty array if no entities match', () => {
      const world = World.createWorld()
      const blockArchetype = createArchetype({ type: 'block', pos: new Position({ x: 1, y: 1, z: 1 }), blockType: 'grass' })
      const [, newWorld] = World.addArchetype(world, blockArchetype)

      const results = World.query(newWorld, playerQuery)
      expect(results.length).toBe(0)
    })

    it('should not return entities that only partially match the query', () => {
      const world = World.createWorld()
      const playerArchetype = createArchetype({ type: 'player', pos: new Position({ x: 0, y: 0, z: 0 }) })
      // This archetype has position and velocity, but not player, so it shouldn't match playerQuery
      const movingObjectArchetype: Archetype = {
        position: new Position({ x: 1, y: 1, z: 1 }),
        velocity: { dx: 1, dy: 1, dz: 1 },
      }

      const [playerEntityId, world2] = World.addArchetype(world, playerArchetype)
      const [, world3] = World.addArchetype(world2, movingObjectArchetype)

      const results = World.query(world3, playerQuery)
      expect(results.length).toBe(1)
      expect(results[0].entityId).toBe(playerEntityId)
    })
  })

  describe('querySoA', () => {
    it('should return entities in SoA format that match the query', () => {
      const world = World.createWorld()
      const playerArchetype = createArchetype({ type: 'player', pos: new Position({ x: 1, y: 2, z: 3 }) })
      const playerArchetype2 = createArchetype({ type: 'player', pos: new Position({ x: 4, y: 5, z: 6 }) })
      const blockArchetype = createArchetype({ type: 'block', pos: new Position({ x: 7, y: 8, z: 9 }), blockType: 'grass' })

      const [player1Id, world2] = World.addArchetype(world, playerArchetype)
      const [, world3] = World.addArchetype(world2, blockArchetype)
      const [player2Id, world4] = World.addArchetype(world3, playerArchetype2)

      const results = World.querySoA(world4, playerTargetQuery, ComponentSchemas)

      expect(results.entities.length).toBe(2)
      expect(results.entities).toContain(player1Id)
      expect(results.entities).toContain(player2Id)

      // Verify position component SoA
      expect(results.position.x).toEqual([1, 4])
      expect(results.position.y).toEqual([2, 5])
      expect(results.position.z).toEqual([3, 6])

      // Verify player component SoA (boolean)
      expect(results.player.isGrounded).toEqual([false, false])

      // Verify hotbar component SoA (complex object)
      expect(results.hotbar.selectedIndex).toEqual([0, 0])
    })

    it('should return an empty SoA result if no entities match', () => {
      const world = World.createWorld()
      const blockArchetype = createArchetype({ type: 'block', pos: new Position({ x: 1, y: 1, z: 1 }), blockType: 'grass' })
      const [, newWorld] = World.addArchetype(world, blockArchetype)

      const results = World.querySoA(newWorld, playerQuery, ComponentSchemas)
      expect(results.entities.length).toBe(0)
      expect(results.player.isGrounded).toEqual([])
      expect(results.position.x).toEqual([])
      expect(results.position.y).toEqual([])
      expect(results.position.z).toEqual([])
      expect(results.velocity.dx).toEqual([])
    })

    it('should handle components without a schema', () => {
      // Monkey-patch the schema for this test
      ;(ComponentSchemas as any).noSchema = S.Struct({ value: S.String })

      let world = World.createWorld()
      const archetype: Archetype = {
        position: new Position({ x: 1, y: 2, z: 3 }),
        noSchema: { value: 'test' },
      }
      const [entityId, newWorld] = World.addArchetype(world, archetype)
      world = newWorld

      const results = World.querySoA(world, { components: ['position', 'noSchema'] }, ComponentSchemas)
      expect(results.entities).toEqual([entityId])
      expect(results.position.x).toEqual([1])
      expect((results as any).noSchema.value).toEqual(['test'])

      // Clean up the monkey-patch
      delete (ComponentSchemas as any).noSchema
    })

    it('should handle components with a schema that is not a TypeLiteral', () => {
      // Monkey-patch the schema for this test
      ;(ComponentSchemas as any).noSchema = S.string

      let world = World.createWorld()
      const archetype: Archetype = {
        position: new Position({ x: 1, y: 2, z: 3 }),
        noSchema: 'test-string',
      }
      const [entityId, newWorld] = World.addArchetype(world, archetype)
      world = newWorld

      const results = World.querySoA(world, { components: ['position', 'noSchema'] }, ComponentSchemas)
      expect(results.entities).toEqual([entityId])
      expect(results.position.x).toEqual([1])
      expect((results as any).noSchema).toEqual(['test-string'])

      // Clean up the monkey-patch
      delete (ComponentSchemas as any).noSchema
    })

    it('should handle union types correctly', () => {
      const world = World.createWorld()
      const playerArchetype = createArchetype({ type: 'player', pos: new Position({ x: 1, y: 2, z: 3 }) })
      const [_, newWorld] = World.addArchetype(world, playerArchetype)

      const results = World.querySoA(newWorld, playerTargetQuery, ComponentSchemas)
      expect(results.entities.length).toBe(1)
      expect(results.target).toBeDefined()
      const targetSoA = results.target as any
      expect(targetSoA.length).toBe(1)
      expect(targetSoA[0]._tag).toBe('none')
    })

    it('should handle components with a transform schema (S.Class)', () => {
      // Monkey-patch the schema for this test
      ;(ComponentSchemas as any).transform = TransformComponent

      let world = World.createWorld()
      const archetype: Archetype = {
        position: new Position({ x: 1, y: 2, z: 3 }),
        transform: new TransformComponent({ value: 'test' }),
      }
      const [entityId, newWorld] = World.addArchetype(world, archetype)
      world = newWorld

      const results = World.querySoA(world, { components: ['position', 'transform'] }, ComponentSchemas)
      expect(results.entities).toEqual([entityId])
      expect(results.position.x).toEqual([1])
      expect((results as any).transform.value).toEqual(['test'])

      // Clean up the monkey-patch
      delete (ComponentSchemas as any).transform
    })
  })

  describe('PBT for world integrity', () => {
    it('should maintain integrity after a series of random operations', () => {
      const world = World.createWorld()

      const addOp = archetypeGen.map((archetype) => ({ type: 'add' as const, archetype }))
      const removeOp = fc.nat().map((id) => ({ type: 'remove' as const, entityId: toEntityId(id) }))
      const operationGen = fc.oneof(addOp, removeOp)

      fc.assert(
        fc.property(fc.array(operationGen), (operations) => {
          let currentWorld = world
          const existingEntityIds = new Set<number>()
          let nextId = 0

          for (const op of operations) {
            if (op.type === 'add') {
              const [newId, newWorld] = World.addArchetype(currentWorld, op.archetype)
              currentWorld = newWorld
              existingEntityIds.add(nextId)
              expect(newId).toBe(toEntityId(nextId))
              nextId++
            } else if (op.type === 'remove') {
              currentWorld = World.removeEntity(currentWorld, op.entityId)
              existingEntityIds.delete(op.entityId)
            }
          }

          // Final state verification
          expect(currentWorld.entities.size).toBe(existingEntityIds.size)
          for (const id of existingEntityIds) {
            expect(currentWorld.entities.has(toEntityId(id))).toBe(true)
          }
        }),
      )
    })
  })
})