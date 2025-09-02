import * as Arb from 'effect/Arbitrary'
import { test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'
import { ArchetypeBuilderSchema, createArchetype, hasComponents, type Archetype, type ArchetypeBuilder } from '../archetypes'
import { type ComponentName, componentNames, Position, Velocity, type Components } from '../components'
import * as Effect from 'effect/Effect'
import * as fc from 'fast-check'

const archetypeBuilderArb: fc.Arbitrary<ArchetypeBuilder> = Arb.make(ArchetypeBuilderSchema)

const componentKeyArb: fc.Arbitrary<ComponentName> = fc.constantFrom(...componentNames)

const isComponentName = (key: string): key is ComponentName => {
  return (componentNames as ReadonlyArray<string>).includes(key)
}

describe('createArchetype', () => {
  test.prop([archetypeBuilderArb])('should create archetypes with the correct components', async (builder) => {
    await Effect.runPromise(Effect.gen(function*(_) {
      const archetype = createArchetype(builder)
      const archetypeKeys = Object.keys(archetype)

      switch (builder.type) {
        case 'player': {
          const expectedComponents: ReadonlyArray<ComponentName> = ['player', 'position', 'velocity', 'gravity', 'cameraState', 'inputState', 'collider', 'hotbar', 'target']
          expect(archetypeKeys).toEqual(expect.arrayContaining([...expectedComponents]))
          if (hasComponents(archetype, ['position'])) {
            expect(archetype.position).toEqual(builder.pos)
          }
          break
        }
        case 'block': {
          const expectedComponents: ReadonlyArray<ComponentName> = ['position', 'renderable', 'collider', 'terrainBlock']
          expect(archetypeKeys).toEqual(expect.arrayContaining([...expectedComponents]))
          if (hasComponents(archetype, ['position', 'renderable'])) {
            expect(archetype.position).toEqual(builder.pos)
            expect(archetype.renderable.blockType).toBe(builder.blockType)
          }
          break
        }
        case 'camera': {
          const expectedComponents: ReadonlyArray<ComponentName> = ['camera', 'position']
          expect(archetypeKeys).toEqual(expect.arrayContaining([...expectedComponents]))
          if (hasComponents(archetype, ['position'])) {
            expect(archetype.position).toEqual(builder.pos)
          }
          break
        }
        case 'targetBlock': {
          const expectedComponents: ReadonlyArray<ComponentName> = ['position', 'targetBlock']
          expect(archetypeKeys).toEqual(expect.arrayContaining([...expectedComponents]))
          if (hasComponents(archetype, ['position'])) {
            expect(archetype.position).toEqual(builder.pos)
          }
          break
        }
        case 'chunk': {
          const expectedComponents: ReadonlyArray<ComponentName> = ['chunk']
          expect(archetypeKeys).toEqual(expect.arrayContaining([...expectedComponents]))
          if (hasComponents(archetype, ['chunk'])) {
            expect(archetype.chunk.chunkX).toBe(builder.chunkX)
            expect(archetype.chunk.chunkZ).toBe(builder.chunkZ)
          }
          break
        }
      }
    }))
  })
})

const createDefaultArchetype = (): Archetype => ({
  position: new Position({ x: 0, y: 0, z: 0 }),
  velocity: new Velocity({ dx: 0, dy: 0, dz: 0 }),
})

const archetypeArb: fc.Arbitrary<Archetype> = fc.uniqueArray(componentKeyArb).map((keys) => {
  const entries = keys.map((key): [ComponentName, Partial<Components>[ComponentName]] => {
    // This is a simplified mock component creation for testing `hasComponents`.
    // A more robust implementation would use arbitraries for each component.
    if (key === 'position') {
      return [key, new Position({ x: 0, y: 0, z: 0 })]
    }
    if (key === 'velocity') {
      return [key, new Velocity({ dx: 0, dy: 0, dz: 0 })]
    }
    return [key, {}]
  })
  return Object.fromEntries(entries) as Archetype
})

describe('hasComponents', () => {
  test.prop([archetypeArb])('should return true if archetype has all specified components', async (archetype) => {
    await Effect.runPromise(Effect.gen(function*(_) {
      const components = Object.keys(archetype).filter(isComponentName)
      expect(hasComponents(archetype, components)).toBe(true)
    }))
  })

  test.prop([fc.constant(createDefaultArchetype()), fc.uniqueArray(componentKeyArb, { minLength: 1 })])(
    'should return false if archetype is missing some components',
    async (archetype, requiredKeys) => {
      await Effect.runPromise(Effect.gen(function*(_) {
        const presentKeys = Object.keys(archetype)
        const isMissing = requiredKeys.some((key) => !presentKeys.includes(key))
        fc.pre(isMissing)

        expect(hasComponents(archetype, requiredKeys)).toBe(false)
      }))
    },
  )

  test('should work as a type guard', async () => {
    await Effect.runPromise(Effect.gen(function*(_) {
      const archetype = createArchetype({
        type: 'player',
        pos: new Position({ x: 0, y: 0, z: 0 }),
      })

      if (hasComponents(archetype, ['player', 'position', 'velocity'])) {
        expect(archetype.player.isGrounded).toBe(false)
        expect(archetype.position).toEqual(new Position({ x: 0, y: 0, z: 0 }))
        expect(archetype.velocity).toEqual(new Velocity({ dx: 0, dy: 0, dz: 0 }))
      } else {
        // This should not be reached
        expect.fail('Type guard failed')
      }
    }))
  })

  test('should return true for an empty component list', async () => {
    await Effect.runPromise(Effect.gen(function*(_) {
      const archetype = createArchetype({
        type: 'player',
        pos: new Position({ x: 0, y: 0, z: 0 }),
      })
      expect(hasComponents(archetype, [])).toBe(true)
    }))
  })
})