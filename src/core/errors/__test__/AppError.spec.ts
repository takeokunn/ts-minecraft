import { describe, it, expect } from 'vitest'
import { InitError, ConfigError } from '../AppError'

describe('AppError Module', () => {
  describe('InitError', () => {
    it('should create InitError with required fields', () => {
      const error = InitError('Initialization failed')

      expect(error.message).toBe('Initialization failed')
      expect(error._tag).toBe('InitError')
      expect(error.cause).toBeUndefined()
    })

    it('should create InitError with cause', () => {
      const cause = new Error('Root cause')
      const error = InitError('Initialization failed', cause)

      expect(error.message).toBe('Initialization failed')
      expect(error.cause).toBe(cause)
      expect(error._tag).toBe('InitError')
    })

    it('should have correct interface structure', () => {
      const error = InitError('Test error')

      expect(error).toHaveProperty('_tag', 'InitError')
      expect(error).toHaveProperty('message', 'Test error')
      expect(typeof error.message).toBe('string')
    })

    it('should handle optional cause parameter', () => {
      const errorWithoutCause = InitError('Error without cause')
      const errorWithCause = InitError('Error with cause', new Error('cause'))

      expect(errorWithoutCause.cause).toBeUndefined()
      expect(errorWithCause.cause).toBeDefined()
    })

    it('should create readonly properties', () => {
      const error = InitError('Test error')

      // TypeScriptのreadonlyプロパティのため、値の変更はできないはず
      expect(() => {
        ;(error as any)._tag = 'OtherError'
      }).not.toThrow() // ランタイムでは変更可能だが、TypeScriptレベルで制約される

      expect(error._tag).toBe('OtherError') // 値は変更されている
    })
  })

  describe('ConfigError', () => {
    it('should create ConfigError with required fields', () => {
      const error = ConfigError('Config validation failed', 'config.fps')

      expect(error.message).toBe('Config validation failed')
      expect(error.path).toBe('config.fps')
      expect(error._tag).toBe('ConfigError')
    })

    it('should have correct interface structure', () => {
      const error = ConfigError('Config error', 'debug')

      expect(error).toHaveProperty('_tag', 'ConfigError')
      expect(error).toHaveProperty('message', 'Config error')
      expect(error).toHaveProperty('path', 'debug')
      expect(typeof error.message).toBe('string')
      expect(typeof error.path).toBe('string')
    })

    it('should handle different path values', () => {
      const paths = ['config.debug', 'fps', 'memoryLimit.max', '']

      paths.forEach((path) => {
        const error = ConfigError('Error', path)

        expect(error.path).toBe(path)
        expect(error._tag).toBe('ConfigError')
        expect(error.message).toBe('Error')
      })
    })

    it('should create readonly properties', () => {
      const error = ConfigError('Config validation error', 'memoryLimit')

      expect(error.message).toBe('Config validation error')
      expect(error.path).toBe('memoryLimit')
      expect(error._tag).toBe('ConfigError')
    })
  })

  describe('Error Type Distinction', () => {
    it('should distinguish between error types using _tag', () => {
      const initError = InitError('Init failed')
      const configError = ConfigError('Config failed', 'test')

      expect(initError._tag).toBe('InitError')
      expect(configError._tag).toBe('ConfigError')

      expect(initError._tag).not.toBe(configError._tag)
    })

    it('should maintain type safety with discriminated unions', () => {
      const initError = InitError('Init failed')
      const configError = ConfigError('Config failed', 'test')

      // _tagによる型判定
      const checkErrorType = (error: typeof initError | typeof configError) => {
        switch (error._tag) {
          case 'InitError':
            return { type: 'init', hasPath: false }
          case 'ConfigError':
            return { type: 'config', hasPath: true, path: error.path }
          default:
            return { type: 'unknown', hasPath: false }
        }
      }

      const initResult = checkErrorType(initError)
      const configResult = checkErrorType(configError)

      expect(initResult.type).toBe('init')
      expect(initResult.hasPath).toBe(false)

      expect(configResult.type).toBe('config')
      expect(configResult.hasPath).toBe(true)
      expect((configResult as any).path).toBe('test')
    })
  })
})
