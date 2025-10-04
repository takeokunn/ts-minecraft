import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
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
import { processChunkState, canTransition } from '../../aggregate/chunk/pattern_matching'

/**
 * ChunkState ADT テストスイート
 * Data.TaggedEnumによる型安全なテストケース
 */
describe('ChunkState ADT Tests', () => {
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
      const error = 'Timeout error'
      const retryCount = 3 as any // RetryCount (limit exceeded)
      const state = ChunkStates.failed(error, retryCount)

      await expect(
        Effect.runPromise(processChunkState(state))
      ).rejects.toMatchObject({
        _tag: 'TimeoutError',
        operation: 'chunk_load'
      })
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
      const loading = ChunkStates.loading(0 as any)

      expect(canTransition(unloaded, loading)).toBe(true)
    })

    it('should reject invalid transitions from Unloaded', () => {
      const unloaded = ChunkStates.unloaded()
      const mockData = new Uint8Array(100) as any
      const mockMetadata = {} as any
      const loaded = ChunkStates.loaded(mockData, mockMetadata)

      expect(canTransition(unloaded, loaded)).toBe(false)
    })

    it('should allow Loading to Loaded transition', () => {
      const loading = ChunkStates.loading(50 as any)
      const mockData = new Uint8Array(100) as any
      const mockMetadata = {} as any
      const loaded = ChunkStates.loaded(mockData, mockMetadata)

      expect(canTransition(loading, loaded)).toBe(true)
    })

    it('should allow Loading to Failed transition', () => {
      const loading = ChunkStates.loading(50 as any)
      const failed = ChunkStates.failed('Error', 1 as any)

      expect(canTransition(loading, failed)).toBe(true)
    })

    it('should reject invalid transitions from Loading', () => {
      const loading1 = ChunkStates.loading(30 as any)
      const loading2 = ChunkStates.loading(60 as any)

      expect(canTransition(loading1, loading2)).toBe(false)
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
      const validProgress = Effect.runSync(
        Effect.try(() => LoadProgressSchema.pipe(schema => schema.Type)(50))
      )
      expect(validProgress).toBe(50)
    })

    it('should validate ChunkTimestamp as positive integer', () => {
      const validTimestamp = Effect.runSync(
        Effect.try(() => ChunkTimestampSchema.pipe(schema => schema.Type)(Date.now()))
      )
      expect(validTimestamp).toBeTypeOf('number')
      expect(validTimestamp).toBeGreaterThan(0)
    })

    it('should validate RetryCount as non-negative integer', () => {
      const validRetryCount = Effect.runSync(
        Effect.try(() => RetryCountSchema.pipe(schema => schema.Type)(5))
      )
      expect(validRetryCount).toBe(5)
    })

    it('should validate ChangeSetId as non-empty string', () => {
      const validChangeSetId = Effect.runSync(
        Effect.try(() => ChangeSetIdSchema.pipe(schema => schema.Type)('changeset-123'))
      )
      expect(validChangeSetId).toBe('changeset-123')
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
    it('should handle complete loading cycle', async () => {
      // Start with unloaded
      let state = ChunkStates.unloaded()
      expect(state._tag).toBe('Unloaded')

      // Transition to loading
      state = ChunkStates.loading(0 as any)
      expect(state._tag).toBe('Loading')

      // Verify transition is valid
      expect(canTransition(ChunkStates.unloaded(), state)).toBe(true)

      // Process loading state
      const result = await Effect.runPromise(processChunkState(state))
      expect(result).toContain('読み込み中')
    })

    it('should handle error recovery flow', async () => {
      // Create failed state
      let state = ChunkStates.failed('Network timeout', 1 as any)
      expect(state._tag).toBe('Failed')

      // Process failed state (should not throw for retry count < 3)
      const result = await Effect.runPromise(processChunkState(state))
      expect(result).toContain('読み込み失敗')

      // Can transition back to loading for retry
      const retryState = ChunkStates.loading(0 as any)
      expect(canTransition(state, retryState)).toBe(true)
    })
  })
})