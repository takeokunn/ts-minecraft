/**
 * Entity Tests
 * 
 * Example test structure for domain entities using Effect-TS testing patterns
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { Entity } from '@domain/entities'

describe('Entity Domain Logic', () => {
  describe('entity creation', () => {
    it('should create entity with valid ID', async () => {
      const entityId = Entity.generateId()
      
      const result = await Effect.runPromise(entityId)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should generate unique entity IDs', async () => {
      const id1 = await Effect.runPromise(Entity.generateId())
      const id2 = await Effect.runPromise(Entity.generateId())
      
      expect(id1).not.toBe(id2)
    })
  })

  describe('entity validation', () => {
    it('should validate entity structure', async () => {
      const validEntity = {
        id: 'entity-123',
        components: new Set(['position', 'render']),
        archetype: 'position|render',
        generation: 1,
        createdAt: new Date(),
        lastModified: new Date()
      }

      const result = Entity.validate(validEntity)
      const isValid = await Effect.runPromise(result)
      
      expect(isValid).toBe(true)
    })

    it('should reject invalid entity structure', async () => {
      const invalidEntity = {
        id: '',  // Invalid empty ID
        components: new Set(),
        archetype: '',
        generation: -1,  // Invalid negative generation
        createdAt: new Date(),
        lastModified: new Date()
      }

      const result = await Effect.runPromise(Effect.either(Entity.validate(invalidEntity)))
      
      expect(result._tag).toBe('Left')
    })
  })

  describe('entity operations', () => {
    it('should compare entities for equality', () => {
      const entity1 = {
        id: 'entity-123',
        components: new Set(['position']),
        archetype: 'position',
        generation: 1,
        createdAt: new Date('2024-01-01'),
        lastModified: new Date('2024-01-01')
      }

      const entity2 = {
        id: 'entity-123',
        components: new Set(['position']),
        archetype: 'position',
        generation: 1,
        createdAt: new Date('2024-01-01'),
        lastModified: new Date('2024-01-01')
      }

      expect(Entity.equals(entity1, entity2)).toBe(true)
    })
  })
})