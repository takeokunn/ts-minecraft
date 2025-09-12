/**
 * Unit tests for error handling utilities
 * Tests Effect-TS Data.Case-based error implementation
 */

import { describe, it, expect } from 'vitest'
import * as Effect from 'effect/Effect'
import { 
  SystemError,
  EntityError,
  ValidationError,
  ErrorHandlers,
  type ErrorHandlingContext 
} from '@shared/utils/error'

describe('Error Handling Utilities', () => {
  describe('Error Types', () => {
    it('should create SystemError with correct tag', () => {
      const error = SystemError({
        message: 'System failure',
        cause: new Error('Root cause')
      })

      expect(error._tag).toBe('SystemError')
      expect(error.message).toBe('System failure')
      expect(error.cause).toBeInstanceOf(Error)
    })

    it('should create EntityError with correct tag', () => {
      const error = EntityError({
        message: 'Entity not found',
        entityId: 'player-123',
        cause: 'Database connection lost'
      })

      expect(error._tag).toBe('EntityError')
      expect(error.message).toBe('Entity not found')
      expect(error.entityId).toBe('player-123')
    })

    it('should create ValidationError with correct tag', () => {
      const error = ValidationError({
        message: 'Validation failed',
        field: 'email',
        component: 'UserForm',
        metadata: { value: 'invalid-email' }
      })

      expect(error._tag).toBe('ValidationError')
      expect(error.message).toBe('Validation failed')
      expect(error.field).toBe('email')
      expect(error.component).toBe('UserForm')
      expect(error.metadata).toEqual({ value: 'invalid-email' })
    })
  })

  describe('ErrorHandlers', () => {
    describe('ignore handler', () => {
      it('should ignore any error', async () => {
        const handler = ErrorHandlers.ignore<Error>()
        const error = new Error('Test error')
        const context: ErrorHandlingContext = { component: 'TestComponent' }

        const result = await Effect.runPromise(handler.handle(error, context))
        expect(result).toBeUndefined()
      })

      it('should handle errors of any type', () => {
        const handler = ErrorHandlers.ignore<string>()
        expect(handler.canHandle('any error')).toBe(true)
        expect(handler.canHandle(new Error())).toBe(true)
        expect(handler.canHandle(42)).toBe(true)
      })
    })

    describe('fallback handler', () => {
      it('should return fallback value on error', async () => {
        const handler = ErrorHandlers.fallback<Error, string>('default value')
        const error = new Error('Test error')

        const result = await Effect.runPromise(handler.handle(error))
        expect(result).toBe('default value')
      })

      it('should validate fallback value', async () => {
        const complexFallback = { status: 'error', data: null }
        const handler = ErrorHandlers.fallback<Error, typeof complexFallback>(complexFallback)
        const error = new Error('Test error')

        const result = await Effect.runPromise(handler.handle(error))
        expect(result).toEqual(complexFallback)
      })
    })

    describe('recover handler', () => {
      it('should use recovery function to handle errors', async () => {
        const recoveryFn = (error: Error, context?: ErrorHandlingContext) => {
          return `Recovered from: ${error.message} in ${context?.component || 'unknown'}`
        }
        
        const handler = ErrorHandlers.recover<Error, string>(recoveryFn)
        const error = new Error('Test error')
        const context: ErrorHandlingContext = { component: 'TestComponent' }

        const result = await Effect.runPromise(handler.handle(error, context))
        expect(result).toBe('Recovered from: Test error in TestComponent')
      })

      it('should handle recovery function failures', async () => {
        const failingRecoveryFn = () => {
          throw new Error('Recovery failed')
        }
        
        const handler = ErrorHandlers.recover<Error, string>(failingRecoveryFn)
        const error = new Error('Test error')

        const result = await Effect.runPromiseExit(handler.handle(error))
        expect(Effect.isFailure(result)).toBe(true)
      })
    })
  })

  describe('Error Validation', () => {
    it('should validate error objects correctly', async () => {
      const errors = [
        new Error('Standard error'),
        'String error',
        { _tag: 'CustomError', message: 'Tagged error' },
        SystemError({ message: 'System error' })
      ]

      // This tests the internal validation logic
      // Since validateError is not exported, we test it indirectly through handlers
      for (const error of errors) {
        const handler = ErrorHandlers.log<typeof error>('TestComponent')
        const result = await Effect.runPromiseExit(handler.handle(error))
        expect(Effect.isSuccess(result)).toBe(true)
      }
    })

    it('should handle metadata validation', async () => {
      const context: ErrorHandlingContext = {
        component: 'TestComponent',
        metadata: {
          userId: 123,
          action: 'create',
          timestamp: new Date().toISOString(),
          nested: { deep: { value: 'test' } }
        }
      }

      const handler = ErrorHandlers.log<Error>()
      const error = new Error('Test error')

      const result = await Effect.runPromiseExit(handler.handle(error, context))
      expect(Effect.isSuccess(result)).toBe(true)
    })
  })

  describe('Error Context Handling', () => {
    it('should handle minimal context', async () => {
      const context: ErrorHandlingContext = {
        component: 'MinimalComponent'
      }

      const handler = ErrorHandlers.fallback<Error, string>('fallback')
      const error = new Error('Test error')

      const result = await Effect.runPromise(handler.handle(error, context))
      expect(result).toBe('fallback')
    })

    it('should handle complete context', async () => {
      const context: ErrorHandlingContext = {
        component: 'CompleteComponent',
        operation: 'test-operation',
        retryCount: 2,
        maxRetries: 3,
        fallbackValue: 'context fallback',
        metadata: {
          feature: 'error-handling',
          version: '1.0.0'
        }
      }

      const handler = ErrorHandlers.fallback<Error, string>('handler fallback')
      const error = new Error('Test error')

      const result = await Effect.runPromise(handler.handle(error, context))
      expect(result).toBe('handler fallback')
    })

    it('should handle null and undefined context gracefully', async () => {
      const handler = ErrorHandlers.fallback<Error, string>('fallback')
      const error = new Error('Test error')

      const result1 = await Effect.runPromise(handler.handle(error, undefined))
      const result2 = await Effect.runPromise(handler.handle(error, null as any))
      
      expect(result1).toBe('fallback')
      expect(result2).toBe('fallback')
    })
  })

  describe('Type Safety', () => {
    it('should maintain type safety with specific error types', () => {
      const systemHandler = ErrorHandlers.fallback<SystemError, number>(0)
      const entityHandler = ErrorHandlers.fallback<EntityError, string>('not found')
      const validationHandler = ErrorHandlers.fallback<ValidationError, boolean>(false)

      expect(systemHandler.canHandle(SystemError({ message: 'test' }))).toBe(true)
      expect(entityHandler.canHandle(EntityError({ message: 'test', entityId: '123' }))).toBe(true)
      expect(validationHandler.canHandle(ValidationError({ message: 'test' }))).toBe(true)
    })

    it('should work with generic error types', () => {
      const genericHandler = ErrorHandlers.fallback<any, string>('generic fallback')
      
      expect(genericHandler.canHandle('string error')).toBe(true)
      expect(genericHandler.canHandle(new Error())).toBe(true)
      expect(genericHandler.canHandle({ custom: 'error' })).toBe(true)
      expect(genericHandler.canHandle(123)).toBe(true)
    })
  })
})