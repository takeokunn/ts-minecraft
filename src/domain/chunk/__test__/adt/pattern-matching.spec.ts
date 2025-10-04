import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  ChunkState,
  ChunkStates,
  ChunkOperation,
  ChunkOperations,
  ChunkError,
  ChunkErrors,
  OptimizationStrategy,
  SerializationFormat
} from '../../types/core'
import {
  processChunkState,
  canTransition,
  executeChunkOperation,
  handleChunkError,
  getErrorSeverity,
  processComplexChunkFlow,
  determineRecoveryStrategy
} from '../../aggregate/chunk/pattern-matching'

/**
 * Pattern Matching ADT テストスイート
 * Match.typeとMatch.whenによる完全なパターンマッチングテスト
 */
describe('Pattern Matching ADT Tests', () => {
  // Mock data
  const mockPosition = { x: 5, z: 10 } as any
  const mockData = new Uint8Array([10, 20, 30]) as any
  const mockMetadata = { version: 2, checksum: 'test123' } as any

  // ===== ChunkError Pattern Matching Tests ===== //

  describe('ChunkError Pattern Matching', () => {
    it('should handle ValidationError with detailed message', () => {
      const error = ChunkErrors.validation('height', -1, '>= 0')
      const message = Effect.runSync(handleChunkError(error))
      expect(message).toContain('バリデーションエラー')
      expect(message).toContain('height')
    })

    it('should handle BoundsError with coordinate information', () => {
      const error = ChunkErrors.bounds({ x: 20, y: 5, z: -3 }, { min: 0, max: 10 })
      const message = Effect.runSync(handleChunkError(error))
      expect(message).toContain('境界エラー')
      expect(message).toContain('20')
    })

    it('should handle SerializationError with format details', () => {
      const error = ChunkErrors.serialization('json', new Error('invalid'))
      const message = Effect.runSync(handleChunkError(error))
      expect(message).toContain('シリアライゼーションエラー')
      expect(message).toContain('json')
    })

    it('should handle CorruptionError with checksum mismatch', () => {
      const error = ChunkErrors.corruption('abc', 'xyz')
      const message = Effect.runSync(handleChunkError(error))
      expect(message).toContain('データ破損')
      expect(message).toContain('abc')
    })

    it('should handle TimeoutError with operation context', () => {
      const error = ChunkErrors.timeout('chunk_write', 5000)
      const message = Effect.runSync(handleChunkError(error))
      expect(message).toContain('タイムアウトエラー')
      expect(message).toContain('5000')
    })

    it('should handle NetworkError with URL and status', () => {
      const error = ChunkErrors.network('https://example.com', 503)
      const message = Effect.runSync(handleChunkError(error))
      expect(message).toContain('ネットワークエラー')
      expect(message).toContain('503')
    })
  })

  // ===== Error Severity Classification Tests ===== //

  describe('Error Severity Classification', () => {
    it('should classify ValidationError as medium severity', () => {
      const severity = getErrorSeverity(ChunkErrors.validation('f', 'v', 'c'))
      expect(severity).toBe('medium')
    })

    it('should classify BoundsError as high severity', () => {
      const severity = getErrorSeverity(ChunkErrors.bounds({ x: 0, y: 0, z: 0 }, { min: 0, max: 5 }))
      expect(severity).toBe('high')
    })

    it('should classify CorruptionError as critical severity', () => {
      const severity = getErrorSeverity(ChunkErrors.corruption('a', 'b'))
      expect(severity).toBe('critical')
    })

    it('should classify TimeoutError as high severity', () => {
      const severity = getErrorSeverity(ChunkErrors.timeout('op', 1000))
      expect(severity).toBe('high')
    })

    it('should classify NetworkError as medium severity', () => {
      const severity = getErrorSeverity(ChunkErrors.network('url', 500))
      expect(severity).toBe('medium')
    })

    it('should classify SerializationError as medium severity', () => {
      const severity = getErrorSeverity(ChunkErrors.serialization('binary', new Error('fail')))
      expect(severity).toBe('medium')
    })
  })

  // ===== Complex Flow Pattern Matching Tests ===== //

  describe('Complex Flow Pattern Matching', () => {
    it('should handle Unloaded state with Read operation', async () => {
      const state = ChunkStates.unloaded()
      const operation = ChunkOperations.read(mockPosition)
      const result = await Effect.runPromise(processComplexChunkFlow(state, operation))

      expect(result).toContain('未読み込みチャンクに対する読み込み操作を開始')
    })

    it('should reject Unloaded state with Write operation', async () => {
      const state = ChunkStates.unloaded()
      const operation = ChunkOperations.write(mockPosition, mockData, mockMetadata)

      await expect(Effect.runPromise(processComplexChunkFlow(state, operation))).rejects.toThrow(
        /読み込み済み/
      )
    })

    it('should handle Loaded state with Write operation', async () => {
      const state = ChunkStates.loaded(mockData, Date.now() as any, mockMetadata)
      const operation = ChunkOperations.write(mockPosition, mockData, mockMetadata)

      const message = await Effect.runPromise(processComplexChunkFlow(state, operation))
      expect(message).toContain('書き込み操作')
    })

    it('should handle Loaded state with Optimize operation', async () => {
      const state = ChunkStates.loaded(mockData, Date.now() as any, mockMetadata)
      const operation = ChunkOperations.optimize(mockPosition, OptimizationStrategy.Speed())

      const message = await Effect.runPromise(processComplexChunkFlow(state, operation))
      expect(message).toContain('最適化操作')
    })

    it('should handle other state-operation combinations', async () => {
      const state = ChunkStates.loading(50 as any)
      const operation = ChunkOperations.delete(mockPosition)
      const result = await Effect.runPromise(processComplexChunkFlow(state, operation))

      expect(result).toContain('状態 Loading で操作 Delete を処理')
    })
  })

  // ===== Recovery Strategy Tests ===== //

  describe('Recovery Strategy Determination', () => {
    it('should suggest input validation for ValidationError', () => {
      const message = Effect.runSync(
        determineRecoveryStrategy(ChunkErrors.validation('field', 'value', 'rule'))
      )
      expect(message).toContain('入力')
    })

    it('should suggest coordinate normalization for BoundsError', () => {
      const message = Effect.runSync(
        determineRecoveryStrategy(ChunkErrors.bounds({ x: 0, y: 0, z: 0 }, { min: 0, max: 10 }))
      )
      expect(message).toContain('正規化')
    })

    it('should suggest format retry for SerializationError', () => {
      const message = Effect.runSync(
        determineRecoveryStrategy(ChunkErrors.serialization('json', new Error('fail')))
      )
      expect(message).toContain('別の形式')
    })

    it('should suggest backup restoration for CorruptionError', () => {
      const message = Effect.runSync(
        determineRecoveryStrategy(ChunkErrors.corruption('abc', 'xyz'))
      )
      expect(message).toContain('バックアップ')
    })

    it('should suggest timeout extension for TimeoutError', () => {
      const message = Effect.runSync(
        determineRecoveryStrategy(ChunkErrors.timeout('op', 1000))
      )
      expect(message).toContain('タイムアウト')
    })

    it('should suggest network retry for NetworkError', () => {
      const message = Effect.runSync(
        determineRecoveryStrategy(ChunkErrors.network('url', 500))
      )
      expect(message).toContain('ネットワーク')
    })
  })

  // ===== Exhaustive Match Verification Tests ===== //

  describe('Exhaustive Match Verification', () => {
    it('should handle all ChunkError variants in recovery strategy', () => {
      const errors = [
        ChunkErrors.validation('f', 'v', 'c'),
        ChunkErrors.bounds({ x: 1, y: 2, z: 3 }, { min: 0, max: 5 }),
        ChunkErrors.serialization('json', new Error('x')),
        ChunkErrors.corruption('a', 'b'),
        ChunkErrors.timeout('op', 10),
        ChunkErrors.network('url', 400),
      ]

      errors.forEach((error) => {
        const message = Effect.runSync(determineRecoveryStrategy(error))
        expect(typeof message).toBe('string')
        expect(message.length).toBeGreaterThan(0)
      })
    })

    it('should handle all severity levels', () => {
      const severities = new Set([
        getErrorSeverity(ChunkErrors.validation('f', 'v', 'c')),
        getErrorSeverity(ChunkErrors.bounds({ x: 0, y: 0, z: 0 }, { min: 0, max: 5 })),
        getErrorSeverity(ChunkErrors.corruption('a', 'b')),
        getErrorSeverity(ChunkErrors.timeout('op', 10)),
        getErrorSeverity(ChunkErrors.network('url', 500)),
        getErrorSeverity(ChunkErrors.serialization('json', new Error('fail'))),
      ])

      expect(severities).toEqual(new Set(['medium', 'high', 'critical']))
    })
  })

  // ===== Nested Pattern Matching Tests ===== //

  describe('Nested Pattern Matching', () => {
    it('should handle nested ADT patterns correctly', async () => {
      const state = ChunkStates.loaded(mockData, Date.now() as any, mockMetadata)
      const operation = ChunkOperations.optimize(mockPosition, OptimizationStrategy.Memory())

      const message = await Effect.runPromise(processComplexChunkFlow(state, operation))
      expect(message).toContain('最適化')
    })

    it('should handle serialization format within operation', async () => {
      const operation = ChunkOperations.serialize(mockData, SerializationFormat.Compressed({ algorithm: 'zlib' }), mockMetadata)
      const message = await Effect.runPromise(executeChunkOperation(operation))
      expect(message).toContain('zlib')
    })
  })

  // ===== Type Safety in Pattern Matching Tests ===== //

  describe('Type Safety in Pattern Matching', () => {
    it('should maintain type safety across pattern matches', () => {
      const error = ChunkErrors.validation('test', 123, 'string')

      // Type narrowing should work correctly
      expect(error._tag).toBe('ValidationError')
      if (error._tag === 'ValidationError') {
        expect(error.field).toBe('test')
        expect(error.value).toBe(123)
        expect(error.constraint).toBe('string')
      }
    })

    it('should prevent access to wrong properties', () => {
      const validationError = ChunkErrors.validation('f', 'v', 'c')
      const boundsError = ChunkErrors.bounds({ x: 0, y: 0, z: 0 }, { min: 0, max: 100 })

      expect(validationError._tag).toBe('ValidationError')
      expect(boundsError._tag).toBe('BoundsError')

      // TypeScript should prevent this at compile time
      if (validationError._tag === 'ValidationError') {
        expect(validationError.field).toBeDefined()
        // @ts-expect-error - ValidationError doesn't have coordinates
        // expect(validationError.coordinates).toBeUndefined()
      }
    })
  })

  // ===== State Transition Validation Tests ===== //

  describe('State Transition Validation', () => {
    it('should validate all possible state transitions', () => {
      const unloaded = ChunkStates.unloaded()
      const loading = ChunkStates.loading(10 as any)
      const loaded = ChunkStates.loaded(mockData, Date.now() as any, mockMetadata)

      expect(canTransition(unloaded, loading)).toBe(true)
      expect(canTransition(loading, loaded)).toBe(true)
      expect(canTransition(loaded, ChunkStates.dirty({ blocks: [] } as any))).toBe(true)
      expect(canTransition(loaded, unloaded)).toBe(false)
    })

    it('should handle transition validation comprehensively', () => {
      const failed = ChunkStates.failed('error', 2 as any)
      const saving = ChunkStates.saving(mockData, 50 as any, mockMetadata)
      const cached = ChunkStates.cached(mockData, mockMetadata)

      expect(canTransition(failed, ChunkStates.loading(0 as any))).toBe(true)
      expect(canTransition(saving, cached)).toBe(false)
      expect(canTransition(cached, ChunkStates.loaded(mockData, Date.now() as any, mockMetadata))).toBe(true)
      expect(canTransition(cached, ChunkStates.unloaded())).toBe(false)
    })
  })
})
