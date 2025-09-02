import * as Arb from 'effect/Arbitrary'
import { fc, test } from '@fast-check/vitest'
import { describe, expect } from 'vitest'
import { ArchetypeBuilderSchema, createArchetype, hasComponents, type Archetype, type ArchetypeBuilder } from '../archetypes'
import { type ComponentName, componentNames, Position, Velocity } from '../components'

const archetypeBuilderArb: fc.Arbitrary<ArchetypeBuilder> = Arb.make(ArchetypeBuilderSchema)

const componentKeyArb: fc.Arbitrary<ComponentName> = fc.constantFrom(...componentNames)

const getArchetypeKeys = (archetype: Archetype): ReadonlyArray<ComponentName> => {
  return Object.keys(archetype) as ReadonlyArray<ComponentName>
}

describe('createArchetype', () => {
  test.prop([archetypeBuilderArb])('should create archetypes with the correct components', (builder) => {
    const archetype = createArchetype(builder)

    switch (builder.type) {
      case 'player': {
        const expectedComponents: ReadonlyArray<ComponentName> = ['player', 'position', 'velocity', 'gravity', 'cameraState', 'inputState', 'collider', 'hotbar', 'target']
        expect(getArchetypeKeys(archetype)).toEqual(expect.arrayContaining([...expectedComponents]))
        if (hasComponents(archetype, ['position'])) {
          expect(archetype.position).toEqual(builder.pos)
        }
        break
      }
      case 'block': {
        const expectedComponents: ReadonlyArray<ComponentName> = ['position', 'renderable', 'collider', 'terrainBlock']
        expect(getArchetypeKeys(archetype)).toEqual(expect.arrayContaining([...expectedComponents]))
        if (hasComponents(archetype, ['position', 'renderable'])) {
          expect(archetype.position).toEqual(builder.pos)
          expect(archetype.renderable.blockType).toBe(builder.blockType)
        }
        break
      }
      case 'camera': {
        const expectedComponents: ReadonlyArray<ComponentName> = ['camera', 'position']
        expect(getArchetypeKeys(archetype)).toEqual(expect.arrayContaining([...expectedComponents]))
        if (hasComponents(archetype, ['position'])) {
          expect(archetype.position).toEqual(builder.pos)
        }
        break
      }
      case 'targetBlock': {
        const expectedComponents: ReadonlyArray<ComponentName> = ['position', 'targetBlock']
        expect(getArchetypeKeys(archetype)).toEqual(expect.arrayContaining([...expectedComponents]))
        if (hasComponents(archetype, ['position'])) {
          expect(archetype.position).toEqual(builder.pos)
        }
        break
      }
      case 'chunk': {
        const expectedComponents: ReadonlyArray<ComponentName> = ['chunk']
        expect(getArchetypeKeys(archetype)).toEqual(expect.arrayContaining([...expectedComponents]))
        if (hasComponents(archetype, ['chunk'])) {
          expect(archetype.chunk.chunkX).toBe(builder.chunkX)
          expect(archetype.chunk.chunkZ).toBe(builder.chunkZ)
        }
        break
      }
    }
  })
})

const createDefaultArchetype = (): Archetype => ({
  position: new Position({ x: 0, y: 0, z: 0 }),
  velocity: new Velocity({ dx: 0, dy: 0, dz: 0 }),
})

const archetypeArb: fc.Arbitrary<Archetype> = fc.uniqueArray(componentKeyArb).map((keys) => {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const archetype: any = {}
  for (const key of keys) {
    // This is a simplified mock component creation for testing `hasComponents`.
    // A more robust implementation would use arbitraries for each component.
    if (key === 'position') {
      archetype[key] = new Position({ x: 0, y: 0, z: 0 })
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      ;(archetype as any)[key] = {}
    }
  }
  return archetype as Archetype
})

describe('hasComponents', () => {
  test.prop([archetypeArb])('should return true if archetype has all specified components', (archetype) => {
    const components = Object.keys(archetype) as ComponentName[]
    expect(hasComponents(archetype, components)).toBe(true)
  })

  test.prop([fc.constant(createDefaultArchetype()), fc.uniqueArray(componentKeyArb, { minLength: 1 })])(
    'should return false if archetype is missing some components',
    (archetype, requiredKeys) => {
      const presentKeys = Object.keys(archetype)
      const isMissing = requiredKeys.some((key) => !presentKeys.includes(key))
      fc.pre(isMissing)

      expect(hasComponents(archetype, requiredKeys)).toBe(false)
    },
  )

  test('should work as a type guard', () => {
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
  })

  test('should return true for an empty component list', () => {
    const archetype = createArchetype({
      type: 'player',
      pos: new Position({ x: 0, y: 0, z: 0 }),
    })
    expect(hasComponents(archetype, [])).toBe(true)
  })
})
