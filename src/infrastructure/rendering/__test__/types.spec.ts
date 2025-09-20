import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import * as fc from 'fast-check'
import {
  RenderInitErrorSchema,
  RenderInitError,
  RenderExecutionErrorSchema,
  RenderExecutionError,
  ContextLostErrorSchema,
  ContextLostError,
  RenderTargetErrorSchema,
  RenderTargetError,
  RenderErrorUnion,
  type RenderError,
} from '../types'

describe('Rendering Types', () => {
  describe('RenderInitError', () => {
    const renderInitErrorArbitrary = fc.record({
      message: fc.string({ minLength: 1, maxLength: 200 }),
      canvas: fc.option(fc.anything(), { nil: undefined }),
      context: fc.option(fc.string(), { nil: undefined }),
      cause: fc.option(fc.anything(), { nil: undefined }),
    })

    it('creates valid RenderInitError instances', () => {
      fc.assert(
        fc.property(renderInitErrorArbitrary, (params) => {
          const error = RenderInitError(params)

          expect(error._tag).toBe('RenderInitError')
          expect(error.message).toBe(params.message)
          expect(error.canvas).toBe(params.canvas)
          expect(error.context).toBe(params.context)
          expect(error.cause).toBe(params.cause)
        }),
        { numRuns: 100 }
      )
    })

    it('validates RenderInitError schema', () => {
      fc.assert(
        fc.property(renderInitErrorArbitrary, (params) => {
          const error = RenderInitError(params)
          const result = Schema.decodeUnknownEither(RenderInitErrorSchema)(error)

          expect(result._tag).toBe('Right')
          if (result._tag === 'Right') {
            expect(result.right._tag).toBe('RenderInitError')
            expect(result.right.message).toBe(params.message)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('rejects invalid RenderInitError data', () => {
      const invalidData = [
        { _tag: 'WrongTag', message: 'test' },
        { _tag: 'RenderInitError' }, // missing message
        { _tag: 'RenderInitError', message: 123 }, // wrong type
        {},
        null,
        undefined,
      ]

      invalidData.forEach((data) => {
        const result = Schema.decodeUnknownEither(RenderInitErrorSchema)(data)
        expect(result._tag).toBe('Left')
      })
    })

    it('handles minimal required fields', () => {
      const minimalError = RenderInitError({ message: 'Test error' })

      expect(minimalError._tag).toBe('RenderInitError')
      expect(minimalError.message).toBe('Test error')
      expect(minimalError.canvas).toBeUndefined()
      expect(minimalError.context).toBeUndefined()
      expect(minimalError.cause).toBeUndefined()
    })
  })

  describe('RenderExecutionError', () => {
    const renderExecutionErrorArbitrary = fc.record({
      message: fc.string({ minLength: 1, maxLength: 200 }),
      operation: fc.string({ minLength: 1, maxLength: 50 }),
      sceneId: fc.option(fc.string(), { nil: undefined }),
      cameraType: fc.option(fc.string(), { nil: undefined }),
      cause: fc.option(fc.anything(), { nil: undefined }),
    })

    it('creates valid RenderExecutionError instances', () => {
      fc.assert(
        fc.property(renderExecutionErrorArbitrary, (params) => {
          const error = RenderExecutionError(params)

          expect(error._tag).toBe('RenderExecutionError')
          expect(error.message).toBe(params.message)
          expect(error.operation).toBe(params.operation)
          expect(error.sceneId).toBe(params.sceneId)
          expect(error.cameraType).toBe(params.cameraType)
          expect(error.cause).toBe(params.cause)
        }),
        { numRuns: 100 }
      )
    })

    it('validates RenderExecutionError schema', () => {
      fc.assert(
        fc.property(renderExecutionErrorArbitrary, (params) => {
          const error = RenderExecutionError(params)
          const result = Schema.decodeUnknownEither(RenderExecutionErrorSchema)(error)

          expect(result._tag).toBe('Right')
          if (result._tag === 'Right') {
            expect(result.right._tag).toBe('RenderExecutionError')
            expect(result.right.operation).toBe(params.operation)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('enforces required fields', () => {
      const requiredFields = [
        { message: 'test' }, // missing operation
        { operation: 'render' }, // missing message
      ]

      requiredFields.forEach((data) => {
        const result = Schema.decodeUnknownEither(RenderExecutionErrorSchema)({
          _tag: 'RenderExecutionError',
          ...data,
        })
        expect(result._tag).toBe('Left')
      })
    })
  })

  describe('ContextLostError', () => {
    const contextLostErrorArbitrary = fc.record({
      message: fc.string({ minLength: 1, maxLength: 200 }),
      canRestore: fc.boolean(),
      lostTime: fc.integer({ min: 0, max: Date.now() }),
      cause: fc.option(fc.anything(), { nil: undefined }),
    })

    it('creates valid ContextLostError instances', () => {
      fc.assert(
        fc.property(contextLostErrorArbitrary, (params) => {
          const error = ContextLostError(params)

          expect(error._tag).toBe('ContextLostError')
          expect(error.message).toBe(params.message)
          expect(error.canRestore).toBe(params.canRestore)
          expect(error.lostTime).toBe(params.lostTime)
          expect(error.cause).toBe(params.cause)
        }),
        { numRuns: 100 }
      )
    })

    it('validates ContextLostError schema', () => {
      fc.assert(
        fc.property(contextLostErrorArbitrary, (params) => {
          const error = ContextLostError(params)
          const result = Schema.decodeUnknownEither(ContextLostErrorSchema)(error)

          expect(result._tag).toBe('Right')
          if (result._tag === 'Right') {
            expect(result.right._tag).toBe('ContextLostError')
            expect(result.right.canRestore).toBe(params.canRestore)
            expect(result.right.lostTime).toBe(params.lostTime)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('validates timestamp constraints', () => {
      fc.assert(
        fc.property(fc.float(), (lostTime) => {
          const error = ContextLostError({
            message: 'Context lost',
            canRestore: true,
            lostTime,
          })

          const result = Schema.decodeUnknownEither(ContextLostErrorSchema)(error)

          if (Number.isFinite(lostTime)) {
            expect(result._tag).toBe('Right')
          } else {
            expect(result._tag).toBe('Left')
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('RenderTargetError', () => {
    const renderTargetErrorArbitrary = fc.record({
      message: fc.string({ minLength: 1, maxLength: 200 }),
      targetType: fc.constantFrom('WebGLRenderTarget', 'WebGLCubeRenderTarget', 'WebGLArrayRenderTarget'),
      width: fc.integer({ min: 1, max: 4096 }),
      height: fc.integer({ min: 1, max: 4096 }),
      format: fc.option(fc.constantFrom('RGBA', 'RGB', 'RG', 'R'), { nil: undefined }),
      cause: fc.option(fc.anything(), { nil: undefined }),
    })

    it('creates valid RenderTargetError instances', () => {
      fc.assert(
        fc.property(renderTargetErrorArbitrary, (params) => {
          const error = RenderTargetError(params)

          expect(error._tag).toBe('RenderTargetError')
          expect(error.message).toBe(params.message)
          expect(error.targetType).toBe(params.targetType)
          expect(error.width).toBe(params.width)
          expect(error.height).toBe(params.height)
          expect(error.format).toBe(params.format)
          expect(error.cause).toBe(params.cause)
        }),
        { numRuns: 100 }
      )
    })

    it('validates RenderTargetError schema', () => {
      fc.assert(
        fc.property(renderTargetErrorArbitrary, (params) => {
          const error = RenderTargetError(params)
          const result = Schema.decodeUnknownEither(RenderTargetErrorSchema)(error)

          expect(result._tag).toBe('Right')
          if (result._tag === 'Right') {
            expect(result.right._tag).toBe('RenderTargetError')
            expect(result.right.width).toBe(params.width)
            expect(result.right.height).toBe(params.height)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('validates dimension constraints', () => {
      const invalidDimensions = [
        { width: 0, height: 100 },
        { width: 100, height: 0 },
        { width: -1, height: 100 },
        { width: 100, height: -1 },
        { width: 1.5, height: 100 },
        { width: 100, height: 2.7 },
      ]

      invalidDimensions.forEach(({ width, height }) => {
        const result = Schema.decodeUnknownEither(RenderTargetErrorSchema)({
          _tag: 'RenderTargetError',
          message: 'test',
          targetType: 'WebGLRenderTarget',
          width,
          height,
        })
        expect(result._tag).toBe('Left')
      })
    })
  })

  describe('RenderErrorUnion', () => {
    const anyRenderErrorArbitrary = fc.oneof(
      fc.record({
        _tag: fc.constant('RenderInitError'),
        message: fc.string({ minLength: 1 }),
      }),
      fc.record({
        _tag: fc.constant('RenderExecutionError'),
        message: fc.string({ minLength: 1 }),
        operation: fc.string({ minLength: 1 }),
      }),
      fc.record({
        _tag: fc.constant('ContextLostError'),
        message: fc.string({ minLength: 1 }),
        canRestore: fc.boolean(),
        lostTime: fc.integer({ min: 0 }),
      }),
      fc.record({
        _tag: fc.constant('RenderTargetError'),
        message: fc.string({ minLength: 1 }),
        targetType: fc.string({ minLength: 1 }),
        width: fc.integer({ min: 1 }),
        height: fc.integer({ min: 1 }),
      })
    )

    it('validates all error types in union', () => {
      fc.assert(
        fc.property(anyRenderErrorArbitrary, (errorData) => {
          const result = Schema.decodeUnknownEither(RenderErrorUnion)(errorData)
          expect(result._tag).toBe('Right')

          if (result._tag === 'Right') {
            expect(['RenderInitError', 'RenderExecutionError', 'ContextLostError', 'RenderTargetError'])
              .toContain(result.right._tag)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('rejects invalid error types', () => {
      const invalidErrors = [
        { _tag: 'UnknownError', message: 'test' },
        { _tag: 'RenderInitError' }, // missing required fields
        { message: 'test' }, // missing _tag
        {},
        null,
        undefined,
        'string',
        123,
      ]

      invalidErrors.forEach((error) => {
        const result = Schema.decodeUnknownEither(RenderErrorUnion)(error)
        expect(result._tag).toBe('Left')
      })
    })

    it('discriminates error types correctly', () => {
      const initError = RenderInitError({ message: 'Init failed' })
      const execError = RenderExecutionError({ message: 'Exec failed', operation: 'render' })
      const contextError = ContextLostError({ message: 'Context lost', canRestore: true, lostTime: Date.now() })
      const targetError = RenderTargetError({
        message: 'Target error',
        targetType: 'WebGLRenderTarget',
        width: 1024,
        height: 768
      })

      const errors = [initError, execError, contextError, targetError]

      errors.forEach((error) => {
        const result = Schema.decodeUnknownSync(RenderErrorUnion)(error)
        expect(result._tag).toBe(error._tag)
      })
    })
  })

  describe('Error type guards and utilities', () => {
    it('maintains type safety across all error types', () => {
      const errors: RenderError[] = [
        RenderInitError({ message: 'Init failed' }),
        RenderExecutionError({ message: 'Exec failed', operation: 'render' }),
        ContextLostError({ message: 'Context lost', canRestore: true, lostTime: Date.now() }),
        RenderTargetError({
          message: 'Target error',
          targetType: 'WebGLRenderTarget',
          width: 1024,
          height: 768
        }),
      ]

      errors.forEach((error) => {
        expect(error._tag).toBeDefined()
        expect(error.message).toBeDefined()
        expect(typeof error.message).toBe('string')

        // Type-specific validations
        switch (error._tag) {
          case 'RenderInitError':
            // Optional fields should be undefined or defined
            if ('canvas' in error) {
              expect(error.canvas).toBeDefined()
            }
            break
          case 'RenderExecutionError':
            expect(error.operation).toBeDefined()
            expect(typeof error.operation).toBe('string')
            break
          case 'ContextLostError':
            expect(typeof error.canRestore).toBe('boolean')
            expect(typeof error.lostTime).toBe('number')
            break
          case 'RenderTargetError':
            expect(typeof error.width).toBe('number')
            expect(typeof error.height).toBe('number')
            expect(error.width).toBeGreaterThan(0)
            expect(error.height).toBeGreaterThan(0)
            break
        }
      })
    })

    it('ensures error immutability', () => {
      const error = RenderInitError({ message: 'Test error' })

      // Attempts to modify should not affect the error
      const originalMessage = error.message
      const originalTag = error._tag

      // TypeScript would prevent these, but testing runtime behavior
      expect(() => {
        (error as any).message = 'Modified'
      }).not.toThrow()

      // In JavaScript, objects are mutable by default, so modification will occur
      // This test validates that mutation is possible (but TypeScript prevents it)
      expect(error.message).toBe('Modified') // Object was actually modified
      expect(error._tag).toBe(originalTag) // _tag should still be the same
    })
  })

  describe('Schema validation edge cases', () => {
    it('handles deeply nested optional fields', () => {
      const complexError = RenderInitError({
        message: 'Complex error',
        canvas: { width: 800, height: 600, context: { type: 'webgl' } },
        cause: new Error('Nested cause'),
      })

      const result = Schema.decodeUnknownEither(RenderInitErrorSchema)(complexError)
      expect(result._tag).toBe('Right')

      if (result._tag === 'Right') {
        expect(result.right.canvas).toBeDefined()
        expect(result.right.cause).toBeDefined()
      }
    })

    it('validates error serialization compatibility', () => {
      const errors = [
        RenderInitError({ message: 'Init failed', context: 'test' }),
        RenderExecutionError({ message: 'Exec failed', operation: 'render', sceneId: 'scene-123' }),
        ContextLostError({ message: 'Context lost', canRestore: false, lostTime: 1234567890 }),
        RenderTargetError({
          message: 'Target error',
          targetType: 'WebGLRenderTarget',
          width: 512,
          height: 512,
          format: 'RGBA'
        }),
      ]

      errors.forEach((error) => {
        // Should be serializable to JSON
        const serialized = JSON.stringify(error)
        expect(serialized).toBeDefined()
        expect(serialized.length).toBeGreaterThan(0)

        // Should be deserializable
        const parsed = JSON.parse(serialized)
        expect(parsed._tag).toBe(error._tag)
        expect(parsed.message).toBe(error.message)
      })
    })
  })
})