import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { ConfigError, InitError } from '../AppError'

describe('AppError Module', () => {
  describe('InitError', () => {
    it('should create InitError with required fields', () => {
      const error = new InitError({
        message: 'Initialization failed',
      })

      expect(error.message).toBe('Initialization failed')
      expect(error._tag).toBe('InitError')
      expect(error.cause).toBeUndefined()
    })

    it('should create InitError with cause', () => {
      const cause = new Error('Root cause')
      const error = new InitError({
        message: 'Initialization failed',
        cause: cause,
      })

      expect(error.message).toBe('Initialization failed')
      expect(error.cause).toBe(cause)
      expect(error._tag).toBe('InitError')
    })

    it('should validate InitError schema', () => {
      const error = new InitError({
        message: 'Test error',
      })

      const isValid = Schema.is(InitError)(error)
      expect(isValid).toBe(true)
    })

    it('should be instanceof InitError', () => {
      const error = new InitError({
        message: 'Test error',
      })

      expect(error instanceof InitError).toBe(true)
      expect(error instanceof Error).toBe(true)
    })

    it('should have proper error properties', () => {
      const error = new InitError({
        message: 'Test error',
      })

      expect(error.name).toBe('InitError')
      expect(error.message).toBe('Test error')
      expect(error.stack).toBeDefined()
    })
  })

  describe('ConfigError', () => {
    it('should create ConfigError with required fields', () => {
      const error = new ConfigError({
        message: 'Config validation failed',
        path: 'config.fps',
      })

      expect(error.message).toBe('Config validation failed')
      expect(error.path).toBe('config.fps')
      expect(error._tag).toBe('ConfigError')
    })

    it('should validate ConfigError schema', () => {
      const error = new ConfigError({
        message: 'Config error',
        path: 'debug',
      })

      const isValid = Schema.is(ConfigError)(error)
      expect(isValid).toBe(true)
    })

    it('should be instanceof ConfigError', () => {
      const error = new ConfigError({
        message: 'Config error',
        path: 'debug',
      })

      expect(error instanceof ConfigError).toBe(true)
      expect(error instanceof Error).toBe(true)
    })

    it('should have proper error properties', () => {
      const error = new ConfigError({
        message: 'Config validation error',
        path: 'memoryLimit',
      })

      expect(error.name).toBe('ConfigError')
      expect(error.message).toBe('Config validation error')
      expect(error.path).toBe('memoryLimit')
      expect(error.stack).toBeDefined()
    })

    it('should handle different path values', () => {
      const paths = ['config.debug', 'fps', 'memoryLimit.max', '']

      paths.forEach((path) => {
        const error = new ConfigError({
          message: 'Error',
          path: path,
        })

        expect(error.path).toBe(path)
        expect(Schema.is(ConfigError)(error)).toBe(true)
      })
    })
  })

  describe('Error Type Guards', () => {
    it('should distinguish between error types', () => {
      const initError = new InitError({ message: 'Init failed' })
      const configError = new ConfigError({ message: 'Config failed', path: 'test' })

      expect(initError instanceof InitError).toBe(true)
      expect(initError instanceof ConfigError).toBe(false)

      expect(configError instanceof ConfigError).toBe(true)
      expect(configError instanceof InitError).toBe(false)
    })

    it('should work with Schema validation', () => {
      const initError = new InitError({ message: 'Init failed' })
      const configError = new ConfigError({ message: 'Config failed', path: 'test' })

      expect(Schema.is(InitError)(initError)).toBe(true)
      expect(Schema.is(InitError)(configError)).toBe(false)

      expect(Schema.is(ConfigError)(configError)).toBe(true)
      expect(Schema.is(ConfigError)(initError)).toBe(false)
    })
  })
})
