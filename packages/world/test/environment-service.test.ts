import { EnvironmentLayer } from '@ts-minecraft/world'
import { EnvironmentPort } from '@ts-minecraft/core'
import { Effect } from 'effect'
import { describe, it } from '@effect/vitest'
import { afterEach,beforeEach,expect } from 'vitest'

const runIsLocalhost = Effect.provide(
  Effect.flatMap(EnvironmentPort, (env) => env.isLocalhost),
  EnvironmentLayer,
)

const runPrefersReducedMotion = Effect.provide(
  Effect.flatMap(EnvironmentPort, (env) => env.prefersReducedMotion),
  EnvironmentLayer,
)

const setWindow = (hostname: string): void => {
  Reflect.set(globalThis as object, 'window', { location: { hostname } })
}

const setWindowWithReducedMotion = (matches: boolean): void => {
  Reflect.set(globalThis as object, 'window', {
    location: { hostname: 'example.com' },
    matchMedia: (q: string) => ({ matches: q.includes('reduce') ? matches : false }),
  })
}

const clearWindow = (): void => {
  Reflect.deleteProperty(globalThis as object, 'window')
}

describe('EnvironmentLayer / isLocalhost', () => {
  afterEach(() => {
    clearWindow()
  })

  describe('when window is unavailable (Node test runtime)', () => {
    beforeEach(() => {
      clearWindow()
    })

    it('returns false', async () => {
      const result = await Effect.runPromise(runIsLocalhost)
      expect(result).toBe(false)
    })
  })

  describe('when window is available', () => {
    it('returns true for "localhost"', async () => {
      setWindow('localhost')
      const result = await Effect.runPromise(runIsLocalhost)
      expect(result).toBe(true)
    })

    it('returns true for "127.0.0.1"', async () => {
      setWindow('127.0.0.1')
      const result = await Effect.runPromise(runIsLocalhost)
      expect(result).toBe(true)
    })

    it('returns true for "0.0.0.0"', async () => {
      setWindow('0.0.0.0')
      const result = await Effect.runPromise(runIsLocalhost)
      expect(result).toBe(true)
    })

    it('returns true for "::1"', async () => {
      setWindow('::1')
      const result = await Effect.runPromise(runIsLocalhost)
      expect(result).toBe(true)
    })

    it('returns false for a production hostname', async () => {
      setWindow('example.com')
      const result = await Effect.runPromise(runIsLocalhost)
      expect(result).toBe(false)
    })

    it('returns false for a hostname that only partially matches (e.g. "notlocalhost")', async () => {
      setWindow('notlocalhost')
      const result = await Effect.runPromise(runIsLocalhost)
      expect(result).toBe(false)
    })
  })
})

describe('EnvironmentLayer / prefersReducedMotion', () => {
  afterEach(() => {
    clearWindow()
  })

  it('returns false when window/matchMedia is unavailable', async () => {
    clearWindow()
    expect(await Effect.runPromise(runPrefersReducedMotion)).toBe(false)
  })

  it('returns true when the OS reports prefers-reduced-motion: reduce', async () => {
    setWindowWithReducedMotion(true)
    expect(await Effect.runPromise(runPrefersReducedMotion)).toBe(true)
  })

  it('returns false when the OS does not prefer reduced motion', async () => {
    setWindowWithReducedMotion(false)
    expect(await Effect.runPromise(runPrefersReducedMotion)).toBe(false)
  })
})
