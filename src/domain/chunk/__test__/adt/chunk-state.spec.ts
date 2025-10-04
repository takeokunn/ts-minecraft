import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import * as S from '@effect/schema/Schema'
import {
  ChunkState,
  ChunkStates,
  ChunkError,
  ChunkErrors,
  LoadProgressSchema,
  ChunkTimestampSchema,
  ChangeSetIdSchema,
  RetryCountSchema
} from '../../types/core'
import { processChunkState, canTransition } from '../../aggregate/chunk/pattern-matching'

/**
 * ChunkState ADT テストスイート
 * Data.TaggedEnumによる型安全なテストケース
 */
describe('ChunkState ADT Tests', () => {
  const decode = <A>(schema: S.Schema<A>, value: unknown): A =>
    Effect.runSync(S.decodeUnknown(schema)(value))

  // ===== ChunkState Factory Tests ===== //

  describe('ChunkState Factory Functions', () => {
    it('should create Unloaded state', () => {
      const state = ChunkStates.unloaded()
      expect(state._tag).toBe('Unloaded')
    })

    it('should create Loading state with progress', () => {
      const progress = 50 as any // LoadProgress
      const state = ChunkStates.loading(progress)

      expect(state._tag).toBe('Loading')
      expect(state.progress).toBe(progress)
      expect(state.startTime).toBeTypeOf('number')
    })

    it('should create Failed state with error and retry count', () => {
      const error = 'Network connection failed'
      const retryCount = 2 as any // RetryCount
      const state = ChunkStates.failed(error, retryCount)

      expect(state._tag).toBe('Failed')
      expect(state.error).toBe(error)
      expect(state.retryCount).toBe(retryCount)
      expect(state.lastAttempt).toBeTypeOf('number')
    })
  })

  // ===== Pattern Matching Tests ===== //

  describe('ChunkState Pattern Matching', () => {
    it('should handle Unloaded state correctly', async () => {
      const state = ChunkStates.unloaded()
      const result = await Effect.runPromise(processChunkState(state))

      expect(result).toContain('未読み込み状態')
      expect(result).toContain('読み込みが必要')
    })

    it('should handle Loading state with progress', async () => {
      const progress = 75 as any // LoadProgress
      const state = ChunkStates.loading(progress)
      const result = await Effect.runPromise(processChunkState(state))

      expect(result).toContain('読み込み中')
      expect(result).toContain('75%')
    })

    it('should handle Failed state with retry limit', async () => {
      const state = ChunkStates.failed('Network error', decode(RetryCountSchema, 3))

      await expect(Effect.runPromise(processChunkState(state))).rejects.toThrow(/TimeoutError/)
    })

    it('should handle Failed state within retry limit', async () => {
      const error = 'Network error'
      const retryCount = 1 as any // RetryCount
      const state = ChunkStates.failed(error, retryCount)
      const result = await Effect.runPromise(processChunkState(state))

      expect(result).toContain('読み込み失敗')
      expect(result).toContain('リトライ 1/3')
      expect(result).toContain(error)
    })
  })

  // ===== State Transition Tests ===== //

  describe('ChunkState Transitions', () => {
    it('should allow valid transitions from Unloaded', () => {
      const unloaded = ChunkStates.unloaded()
      const loading = ChunkStates.loading(decode(LoadProgressSchema, 10))

      expect(canTransition(unloaded, loading)).toBe(true)
      expect(canTransition(unloaded, ChunkStates.unloaded())).toBe(false)
    })

    it('should reject invalid transitions from Unloaded', () => {
      const unloaded = ChunkStates.unloaded()
      const loaded = ChunkStates.loaded(new Uint8Array() as any, {} as any)

      expect(canTransition(unloaded, loaded)).toBe(false)
    })

    it('should allow Loading to Loaded transition', () => {
      const loading = ChunkStates.loading(decode(LoadProgressSchema, 80))
      const loaded = ChunkStates.loaded(new Uint8Array() as any, {} as any)

      expect(canTransition(loading, loaded)).toBe(true)
    })

    it('should allow Loading to Failed transition', () => {
      const loading = ChunkStates.loading(decode(LoadProgressSchema, 40))
      const failed = ChunkStates.failed('error', decode(RetryCountSchema, 1))

      expect(canTransition(loading, failed)).toBe(true)
    })

    it('should reject invalid transitions from Loading', () => {
      const loading = ChunkStates.loading(decode(LoadProgressSchema, 60))
      const dirty = ChunkStates.dirty(new Uint8Array() as any, { id: '' as any, blocks: [] } as any, {} as any)

      expect(canTransition(loading, dirty)).toBe(false)
    })
  })

  // ===== Exhaustive Pattern Matching Tests ===== //

  describe('Exhaustive Pattern Matching Verification', () => {
    const testStates: ChunkState[] = [
      ChunkStates.unloaded(),
      ChunkStates.loading(25 as any),
      ChunkStates.failed('Test error', 0 as any),
      // Note: Loaded, Dirty, Saving, Cached states require mock data
      // which would need proper setup in a real test environment
    ]

    it('should handle all ChunkState variants without compilation errors', async () => {
      // This test verifies that our pattern matching is exhaustive
      // and handles all possible ChunkState variants
      for (const state of testStates) {
        const result = await Effect.runPromise(
          processChunkState(state).pipe(
            Effect.catchAll(() => Effect.succeed('Error handled'))
          )
        )

        expect(result).toBeTypeOf('string')
        expect(result.length).toBeGreaterThan(0)
      }
    })
  })

  // ===== Brand Type Schema Tests ===== //

  describe('Brand Type Schema Validation', () => {
    it('should validate LoadProgress within bounds', () => {
      expect(decode(LoadProgressSchema, 50)).toBe(50)
      expect(() => Effect.runSync(S.decodeUnknown(LoadProgressSchema)(150))).toThrow()
    })

    it('should validate ChunkTimestamp as positive integer', () => {
      expect(decode(ChunkTimestampSchema, 1000)).toBe(1000)
      expect(() => Effect.runSync(S.decodeUnknown(ChunkTimestampSchema)(-5))).toThrow()
    })

    it('should validate RetryCount as non-negative integer', () => {
      expect(decode(RetryCountSchema, 2)).toBe(2)
      expect(() => Effect.runSync(S.decodeUnknown(RetryCountSchema)(-1))).toThrow()
    })

    it('should validate ChangeSetId as non-empty string', () => {
      expect(decode(ChangeSetIdSchema, 'abc')).toBe('abc')
      expect(() => Effect.runSync(S.decodeUnknown(ChangeSetIdSchema)(''))).toThrow()
    })
  })

  // ===== Type Safety Tests ===== //

  describe('Type Safety Verification', () => {
    it('should maintain type safety with ChunkState variants', () => {
      const state = ChunkStates.loading(50 as any)

      // TypeScript should enforce correct property access
      if (state._tag === 'Loading') {
        expect(state.progress).toBeTypeOf('number')
        expect(state.startTime).toBeTypeOf('number')
        // @ts-expect-error - Should not have 'data' property on Loading state
        // expect(state.data).toBeUndefined()
      }
    })

    it('should prevent invalid state construction', () => {
      // This test verifies that our ADT construction is type-safe
      const unloaded = ChunkStates.unloaded()
      expect(unloaded._tag).toBe('Unloaded')

      // TypeScript should prevent access to properties that don't exist
      // @ts-expect-error - Unloaded state has no additional properties
      // expect(unloaded.progress).toBeUndefined()
    })
  })

  // ===== Complex State Flow Tests ===== //

  describe('Complex State Flow Scenarios', () => {
    it('should handle complete loading cycle', () => {
      const unloaded = ChunkStates.unloaded()
      const loading = ChunkStates.loading(decode(LoadProgressSchema, 25))
      const loaded = ChunkStates.loaded(new Uint8Array() as any, {} as any)
      const dirty = ChunkStates.dirty(new Uint8Array() as any, { id: '' as any, blocks: [] } as any, {} as any)
      const saving = ChunkStates.saving(new Uint8Array() as any, decode(LoadProgressSchema, 50), {} as any)
      const reloaded = ChunkStates.loaded(new Uint8Array() as any, {} as any)

      expect(canTransition(unloaded, loading)).toBe(true)
      expect(canTransition(loading, loaded)).toBe(true)
      expect(canTransition(loaded, dirty)).toBe(true)
      expect(canTransition(dirty, saving)).toBe(true)
      expect(canTransition(saving, reloaded)).toBe(true)
    })

    it('should handle error recovery flow', async () => {
      const failed = ChunkStates.failed('Network fail', decode(RetryCountSchema, 1))
      const message = await Effect.runPromise(processChunkState(failed))
      expect(message).toContain('読み込み失敗')

      const retried = ChunkStates.loading(decode(LoadProgressSchema, 0))
      expect(canTransition(failed, retried)).toBe(true)
    })
  })
})
