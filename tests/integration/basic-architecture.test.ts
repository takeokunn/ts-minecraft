/**
 * Basic Architecture Test
 *
 * Simple test to validate the DDD architecture is functional.
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'

describe('Basic Architecture Test', () => {
  it('should import Effect library correctly', () => {
    expect(Effect).toBeDefined()
    expect(typeof Effect.succeed).toBe('function')
    expect(typeof Effect.gen).toBe('function')
  })

  it('should run simple Effect operations', async () => {
    const simpleEffect = Effect.succeed(42)
    const result = await Effect.runPromise(simpleEffect)
    expect(result).toBe(42)
  })

  it('should compose Effects', async () => {
    const composedEffect = Effect.gen(function* () {
      const value1 = yield* Effect.succeed(10)
      const value2 = yield* Effect.succeed(20)
      return value1 + value2
    })

    const result = await Effect.runPromise(composedEffect)
    expect(result).toBe(30)
  })

  it('should handle Effect errors', async () => {
    const errorEffect = Effect.fail('Test Error')

    try {
      await Effect.runPromise(errorEffect)
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error.message).toBe('Test Error')
    }
  })

  it('should validate that DDD directories exist', () => {
    // This test validates the directory structure exists
    const fs = require('fs')
    const path = require('path')

    const srcPath = path.join(process.cwd(), 'src')
    const domainPath = path.join(srcPath, 'domain')
    const applicationPath = path.join(srcPath, 'application')
    const infrastructurePath = path.join(srcPath, 'infrastructure')

    expect(fs.existsSync(srcPath)).toBe(true)
    expect(fs.existsSync(domainPath)).toBe(true)
    expect(fs.existsSync(applicationPath)).toBe(true)
    expect(fs.existsSync(infrastructurePath)).toBe(true)
  })
})
