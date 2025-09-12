/**
 * Unified Errors Tests
 * 
 * Example test structure for domain errors using Effect-TS testing patterns
 */

import { describe, it, expect } from 'vitest'
import { Effect, Schema } from 'effect'
import { 
  EntityNotFoundError, 
  ComponentNotFoundError,
  ValidationError,
  getErrorSeverity,
  getRecoveryStrategy,
  isEntityError,
  isComponentError
} from '@domain/errors'

describe('Unified Error System', () => {
  describe('error creation', () => {
    it('should create EntityNotFoundError with required fields', () => {
      const error = EntityNotFoundError({
        message: 'Entity not found',
        entityId: 'entity-123',
        timestamp: Date.now(),
        context: {}
      })
      
      expect(error._tag).toBe('EntityNotFoundError')
      expect(error.message).toBe('Entity not found')
      expect(error.entityId).toBe('entity-123')
    })

    it('should create ComponentNotFoundError with validation', () => {
      const error = ComponentNotFoundError({
        message: 'Component not found',
        entityId: 'entity-123',
        componentName: 'position',
        timestamp: Date.now(),
        context: {}
      })
      
      expect(error._tag).toBe('ComponentNotFoundError')
      expect(error.componentName).toBe('position')
    })

    it('should create ValidationError with constraints', () => {
      const error = ValidationError({
        message: 'Invalid value provided',
        field: 'age',
        value: -1,
        constraint: 'must be positive',
        timestamp: Date.now(),
        context: {}
      })
      
      expect(error._tag).toBe('ValidationError')
      expect(error.field).toBe('age')
      expect(error.value).toBe(-1)
    })
  })

  describe('error classification', () => {
    it('should correctly identify entity errors', () => {
      const entityError = EntityNotFoundError({
        message: 'Entity not found',
        entityId: 'test',
        timestamp: Date.now(),
        context: {}
      })
      
      expect(isEntityError(entityError)).toBe(true)
      expect(isComponentError(entityError)).toBe(false)
    })

    it('should correctly identify component errors', () => {
      const componentError = ComponentNotFoundError({
        message: 'Component not found',
        entityId: 'test',
        componentName: 'position',
        timestamp: Date.now(),
        context: {}
      })
      
      expect(isComponentError(componentError)).toBe(true)
      expect(isEntityError(componentError)).toBe(false)
    })
  })

  describe('error severity and recovery', () => {
    it('should return correct severity for different error types', () => {
      const entityError = EntityNotFoundError({
        message: 'Entity not found',
        entityId: 'test',
        timestamp: Date.now(),
        context: {}
      })
      
      const severity = getErrorSeverity(entityError)
      expect(['low', 'medium', 'high', 'critical']).toContain(severity)
    })

    it('should provide recovery strategies', () => {
      const entityError = EntityNotFoundError({
        message: 'Entity not found',
        entityId: 'test',
        timestamp: Date.now(),
        context: {}
      })
      
      const strategy = getRecoveryStrategy(entityError)
      expect(typeof strategy).toBe('string')
      expect(strategy.length).toBeGreaterThan(0)
    })
  })

  describe('schema validation', () => {
    it('should validate error schema structure', () => {
      const validErrorData = {
        message: 'Test error',
        entityId: 'entity-123',
        timestamp: Date.now(),
        context: {}
      }
      
      const result = Schema.decodeSync(EntityNotFoundError)(validErrorData)
      
      expect(result._tag).toBe('EntityNotFoundError')
      expect(result.message).toBe('Test error')
    })

    it('should fail validation for invalid schema', () => {
      const invalidErrorData = {
        // Missing required 'message' field
        entityId: 'entity-123',
        timestamp: Date.now(),
        context: {}
      }
      
      expect(() => {
        Schema.decodeSync(EntityNotFoundError)(invalidErrorData)
      }).toThrow()
    })
  })

  describe('error context', () => {
    it('should handle optional context fields', () => {
      const errorWithMinimalData = EntityNotFoundError({
        message: 'Minimal error',
        entityId: 'test'
      })
      
      expect(errorWithMinimalData._tag).toBe('EntityNotFoundError')
      expect(errorWithMinimalData.message).toBe('Minimal error')
      expect(errorWithMinimalData.timestamp).toBeUndefined()
      expect(errorWithMinimalData.context).toBeUndefined()
    })

    it('should preserve context metadata', () => {
      const contextData = {
        operation: 'entity_lookup',
        userId: 'user-456'
      }
      
      const error = EntityNotFoundError({
        message: 'Entity not found',
        entityId: 'entity-123',
        context: contextData
      })
      
      expect(error.context).toEqual(contextData)
    })
  })
})