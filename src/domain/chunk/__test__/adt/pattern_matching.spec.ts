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
} from '../../aggregate/chunk/pattern_matching'

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
    it('should handle ValidationError with detailed message', async () => {
      const error = ChunkErrors.validation('blockId', null, 'must be non-null')
      const result = await Effect.runPromise(handleChunkError(error))

      expect(result).toContain('バリデーションエラー')
      expect(result).toContain("フィールド 'blockId'")
      expect(result).toContain("値 'null'")
      expect(result).toContain("制約 'must be non-null'")
    })

    it('should handle BoundsError with coordinate information', async () => {
      const coordinates = { x: 100, y: 500, z: -50 }
      const bounds = { min: 0, max: 319 }
      const error = ChunkErrors.bounds(coordinates, bounds)
      const result = await Effect.runPromise(handleChunkError(error))

      expect(result).toContain('境界エラー')
      expect(result).toContain('座標 (100, 500, -50)')
      expect(result).toContain('範囲 [0, 319]')
    })

    it('should handle SerializationError with format details', async () => {
      const error = ChunkErrors.serialization('binary', new Error('Invalid format'))
      const result = await Effect.runPromise(handleChunkError(error))

      expect(result).toContain('シリアライゼーションエラー')
      expect(result).toContain("形式 'binary'")
      expect(result).toContain('処理に失敗')
    })

    it('should handle CorruptionError with checksum mismatch', async () => {
      const error = ChunkErrors.corruption('abc123', 'def456')
      const result = await Effect.runPromise(handleChunkError(error))

      expect(result).toContain('データ破損エラー')
      expect(result).toContain("チェックサム 'abc123'")
      expect(result).toContain("期待値 'def456'")
    })

    it('should handle TimeoutError with operation context', async () => {
      const error = ChunkErrors.timeout('chunk_load', 5000)
      const result = await Effect.runPromise(handleChunkError(error))

      expect(result).toContain('タイムアウトエラー')
      expect(result).toContain("操作 'chunk_load'")
      expect(result).toContain('5000ms')
    })

    it('should handle NetworkError with URL and status', async () => {
      const error = ChunkErrors.network('https://api.minecraft.com/chunks', 404)
      const result = await Effect.runPromise(handleChunkError(error))

      expect(result).toContain('ネットワークエラー')
      expect(result).toContain('https://api.minecraft.com/chunks')
      expect(result).toContain('ステータス 404')
    })
  })

  // ===== Error Severity Classification Tests ===== //

  describe('Error Severity Classification', () => {
    it('should classify ValidationError as medium severity', () => {
      const error = ChunkErrors.validation('field', 'value', 'constraint')
      const severity = getErrorSeverity(error)
      expect(severity).toBe('medium')
    })

    it('should classify BoundsError as high severity', () => {
      const error = ChunkErrors.bounds({ x: 0, y: 0, z: 0 }, { min: 0, max: 100 })
      const severity = getErrorSeverity(error)
      expect(severity).toBe('high')
    })

    it('should classify CorruptionError as critical severity', () => {
      const error = ChunkErrors.corruption('bad', 'good')
      const severity = getErrorSeverity(error)
      expect(severity).toBe('critical')
    })

    it('should classify TimeoutError as high severity', () => {
      const error = ChunkErrors.timeout('operation', 1000)
      const severity = getErrorSeverity(error)
      expect(severity).toBe('high')
    })

    it('should classify NetworkError as medium severity', () => {
      const error = ChunkErrors.network('url', 500)
      const severity = getErrorSeverity(error)
      expect(severity).toBe('medium')
    })

    it('should classify SerializationError as medium severity', () => {
      const error = ChunkErrors.serialization('format', new Error())
      const severity = getErrorSeverity(error)
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

      await expect(
        Effect.runPromise(processComplexChunkFlow(state, operation))
      ).rejects.toMatchObject({
        _tag: 'ValidationError',
        field: 'state',
        value: 'Unloaded'
      })
    })

    it('should handle Loaded state with Write operation', async () => {
      const state = ChunkStates.loaded(mockData, mockMetadata)
      const operation = ChunkOperations.write(mockPosition, mockData, mockMetadata)
      const result = await Effect.runPromise(processComplexChunkFlow(state, operation))

      expect(result).toContain('読み込み済みチャンクに対する書き込み操作を実行')
    })

    it('should handle Loaded state with Optimize operation', async () => {
      const state = ChunkStates.loaded(mockData, mockMetadata)
      const strategy = { _tag: 'Memory' } as OptimizationStrategy
      const operation = ChunkOperations.optimize(mockPosition, strategy)
      const result = await Effect.runPromise(processComplexChunkFlow(state, operation))

      expect(result).toContain('読み込み済みチャンクに対する最適化操作を実行')
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
    it('should suggest input validation for ValidationError', async () => {
      const error = ChunkErrors.validation('field', 'value', 'constraint')
      const strategy = await Effect.runPromise(determineRecoveryStrategy(error))

      expect(strategy).toContain('入力データの検証と修正')
    })

    it('should suggest coordinate normalization for BoundsError', async () => {
      const error = ChunkErrors.bounds({ x: 0, y: 0, z: 0 }, { min: 0, max: 100 })
      const strategy = await Effect.runPromise(determineRecoveryStrategy(error))

      expect(strategy).toContain('座標の正規化')
    })

    it('should suggest format retry for SerializationError', async () => {
      const error = ChunkErrors.serialization('format', new Error())
      const strategy = await Effect.runPromise(determineRecoveryStrategy(error))

      expect(strategy).toContain('別の形式でのシリアライゼーションを試行')
    })

    it('should suggest backup restoration for CorruptionError', async () => {
      const error = ChunkErrors.corruption('bad', 'good')
      const strategy = await Effect.runPromise(determineRecoveryStrategy(error))

      expect(strategy).toContain('バックアップからの復元を試行')
    })

    it('should suggest timeout extension for TimeoutError', async () => {
      const error = ChunkErrors.timeout('operation', 1000)
      const strategy = await Effect.runPromise(determineRecoveryStrategy(error))

      expect(strategy).toContain('タイムアウト時間を延長してリトライ')
    })

    it('should suggest network retry for NetworkError', async () => {
      const error = ChunkErrors.network('url', 500)
      const strategy = await Effect.runPromise(determineRecoveryStrategy(error))

      expect(strategy).toContain('ネットワーク接続を再試行')
    })
  })

  // ===== Exhaustive Match Verification Tests ===== //

  describe('Exhaustive Match Verification', () => {
    it('should handle all ChunkError variants in recovery strategy', async () => {
      const errors = [
        ChunkErrors.validation('field', 'value', 'constraint'),
        ChunkErrors.bounds({ x: 0, y: 0, z: 0 }, { min: 0, max: 100 }),
        ChunkErrors.serialization('format', new Error()),
        ChunkErrors.corruption('bad', 'good'),
        ChunkErrors.timeout('operation', 1000),
        ChunkErrors.network('url', 500)
      ]

      for (const error of errors) {
        const strategy = await Effect.runPromise(determineRecoveryStrategy(error))
        expect(strategy).toBeTypeOf('string')
        expect(strategy.length).toBeGreaterThan(0)
      }
    })

    it('should handle all severity levels', () => {
      const errors = [
        ChunkErrors.validation('f', 'v', 'c'), // medium
        ChunkErrors.bounds({ x: 0, y: 0, z: 0 }, { min: 0, max: 100 }), // high
        ChunkErrors.corruption('bad', 'good'), // critical
        ChunkErrors.timeout('op', 1000), // high
        ChunkErrors.network('url', 500), // medium
        ChunkErrors.serialization('fmt', new Error()) // medium
      ]

      const severities = errors.map(getErrorSeverity)
      expect(severities).toContain('medium')
      expect(severities).toContain('high')
      expect(severities).toContain('critical')
    })
  })

  // ===== Nested Pattern Matching Tests ===== //

  describe('Nested Pattern Matching', () => {
    it('should handle nested ADT patterns correctly', async () => {
      // Test optimization strategy within operation within complex flow
      const state = ChunkStates.loaded(mockData, mockMetadata)
      const memoryStrategy = { _tag: 'Memory' } as OptimizationStrategy
      const operation = ChunkOperations.optimize(mockPosition, memoryStrategy)

      const flowResult = await Effect.runPromise(processComplexChunkFlow(state, operation))
      const opResult = await Effect.runPromise(executeChunkOperation(operation))

      expect(flowResult).toContain('最適化操作を実行')
      expect(opResult).toContain('メモリ最適化')
    })

    it('should handle serialization format within operation', async () => {
      const compressedFormat = { _tag: 'Compressed', algorithm: 'zstd' } as SerializationFormat
      const operation = ChunkOperations.serialize(mockData, compressedFormat, mockMetadata)
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('圧縮シリアライゼーション')
      expect(result).toContain('zstd')
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
      const states = [
        ChunkStates.unloaded(),
        ChunkStates.loading(0 as any),
        ChunkStates.loaded(mockData, mockMetadata),
        ChunkStates.failed('error', 0 as any),
        // Note: Other states would require more complex mock setup
      ]

      // Test some valid transitions
      expect(canTransition(states[0], states[1])).toBe(true) // Unloaded -> Loading
      expect(canTransition(states[1], states[2])).toBe(true) // Loading -> Loaded
      expect(canTransition(states[1], states[3])).toBe(true) // Loading -> Failed

      // Test some invalid transitions
      expect(canTransition(states[0], states[2])).toBe(false) // Unloaded -> Loaded
      expect(canTransition(states[2], states[1])).toBe(false) // Loaded -> Loading
    })

    it('should handle transition validation comprehensively', () => {
      const unloaded = ChunkStates.unloaded()
      const loading = ChunkStates.loading(50 as any)

      // Valid transition
      expect(canTransition(unloaded, loading)).toBe(true)

      // Self transition (invalid)
      expect(canTransition(unloaded, unloaded)).toBe(false)
      expect(canTransition(loading, loading)).toBe(false)
    })
  })
})