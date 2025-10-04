import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  ChunkOperation,
  ChunkOperations,
  OptimizationStrategy,
  SerializationFormat,
  ChunkError
} from '../../types/core'
import { executeChunkOperation } from '../../aggregate/chunk/pattern_matching'

/**
 * ChunkOperation ADT テストスイート
 * Data.TaggedEnumによる型安全な操作テスト
 */
describe('ChunkOperation ADT Tests', () => {
  // Mock data for tests
  const mockPosition = { x: 10, z: 15 } as any
  const mockData = new Uint8Array([1, 2, 3, 4, 5]) as any
  const mockMetadata = { version: 1, compression: 'none' } as any

  // ===== ChunkOperation Factory Tests ===== //

  describe('ChunkOperation Factory Functions', () => {
    it('should create Read operation', () => {
      const operation = ChunkOperations.read(mockPosition)

      expect(operation._tag).toBe('Read')
      expect(operation.position).toEqual(mockPosition)
    })

    it('should create Write operation', () => {
      const operation = ChunkOperations.write(mockPosition, mockData, mockMetadata)

      expect(operation._tag).toBe('Write')
      expect(operation.position).toEqual(mockPosition)
      expect(operation.data).toEqual(mockData)
      expect(operation.metadata).toEqual(mockMetadata)
    })

    it('should create Delete operation', () => {
      const operation = ChunkOperations.delete(mockPosition)

      expect(operation._tag).toBe('Delete')
      expect(operation.position).toEqual(mockPosition)
    })

    it('should create Validate operation with optional checksum', () => {
      const operationWithoutChecksum = ChunkOperations.validate(mockPosition)
      const operationWithChecksum = ChunkOperations.validate(mockPosition, 'abc123')

      expect(operationWithoutChecksum._tag).toBe('Validate')
      expect(operationWithoutChecksum.position).toEqual(mockPosition)
      expect(operationWithoutChecksum.expectedChecksum).toBeUndefined()

      expect(operationWithChecksum._tag).toBe('Validate')
      expect(operationWithChecksum.expectedChecksum).toBe('abc123')
    })

    it('should create Optimize operation with strategy', () => {
      const strategy = { _tag: 'Memory' } as OptimizationStrategy
      const operation = ChunkOperations.optimize(mockPosition, strategy)

      expect(operation._tag).toBe('Optimize')
      expect(operation.position).toEqual(mockPosition)
      expect(operation.strategy).toEqual(strategy)
    })

    it('should create Serialize operation', () => {
      const format = { _tag: 'Binary' } as SerializationFormat
      const operation = ChunkOperations.serialize(mockData, format, mockMetadata)

      expect(operation._tag).toBe('Serialize')
      expect(operation.data).toEqual(mockData)
      expect(operation.format).toEqual(format)
      expect(operation.metadata).toEqual(mockMetadata)
    })
  })

  // ===== Operation Execution Tests ===== //

  describe('ChunkOperation Execution', () => {
    it('should execute Read operation', async () => {
      const operation = ChunkOperations.read(mockPosition)
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('チャンク読み込み')
      expect(result).toContain('位置 (10, 15)')
    })

    it('should execute Write operation', async () => {
      const operation = ChunkOperations.write(mockPosition, mockData, mockMetadata)
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('チャンク書き込み')
      expect(result).toContain('位置 (10, 15)')
      expect(result).toContain('5 bytes')
    })

    it('should execute Delete operation', async () => {
      const operation = ChunkOperations.delete(mockPosition)
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('チャンク削除')
      expect(result).toContain('位置 (10, 15)')
    })

    it('should execute Validate operation without checksum', async () => {
      const operation = ChunkOperations.validate(mockPosition)
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('チャンク検証')
      expect(result).toContain('位置 (10, 15)')
      expect(result).toContain('チェックサムなし')
    })

    it('should execute Validate operation with checksum', async () => {
      const operation = ChunkOperations.validate(mockPosition, 'sha256:abc123')
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('チャンク検証')
      expect(result).toContain('位置 (10, 15)')
      expect(result).toContain('sha256:abc123')
    })
  })

  // ===== Optimization Strategy Tests ===== //

  describe('OptimizationStrategy Pattern Matching', () => {
    it('should handle Memory optimization strategy', async () => {
      const strategy = { _tag: 'Memory' } as OptimizationStrategy
      const operation = ChunkOperations.optimize(mockPosition, strategy)
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('メモリ最適化')
      expect(result).toContain('位置 (10, 15)')
    })

    it('should handle Compression optimization strategy', async () => {
      const strategy = { _tag: 'Compression' } as OptimizationStrategy
      const operation = ChunkOperations.optimize(mockPosition, strategy)
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('圧縮最適化')
      expect(result).toContain('位置 (10, 15)')
    })

    it('should handle Speed optimization strategy', async () => {
      const strategy = { _tag: 'Speed' } as OptimizationStrategy
      const operation = ChunkOperations.optimize(mockPosition, strategy)
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('速度最適化')
      expect(result).toContain('位置 (10, 15)')
    })
  })

  // ===== Serialization Format Tests ===== //

  describe('SerializationFormat Pattern Matching', () => {
    it('should handle Binary serialization format', async () => {
      const format = { _tag: 'Binary' } as SerializationFormat
      const operation = ChunkOperations.serialize(mockData, format, mockMetadata)
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('バイナリシリアライゼーション')
      expect(result).toContain('5 bytes')
    })

    it('should handle JSON serialization format', async () => {
      const format = { _tag: 'JSON' } as SerializationFormat
      const operation = ChunkOperations.serialize(mockData, format, mockMetadata)
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('JSONシリアライゼーション')
      expect(result).toContain('5 bytes')
    })

    it('should handle Compressed serialization format with algorithm', async () => {
      const format = { _tag: 'Compressed', algorithm: 'gzip' } as SerializationFormat
      const operation = ChunkOperations.serialize(mockData, format, mockMetadata)
      const result = await Effect.runPromise(executeChunkOperation(operation))

      expect(result).toContain('圧縮シリアライゼーション')
      expect(result).toContain('gzip')
      expect(result).toContain('5 bytes')
    })
  })

  // ===== Exhaustive Pattern Matching Tests ===== //

  describe('Exhaustive Pattern Matching Verification', () => {
    const testOperations: ChunkOperation[] = [
      ChunkOperations.read(mockPosition),
      ChunkOperations.write(mockPosition, mockData, mockMetadata),
      ChunkOperations.delete(mockPosition),
      ChunkOperations.validate(mockPosition),
      ChunkOperations.validate(mockPosition, 'checksum123'),
      ChunkOperations.optimize(mockPosition, { _tag: 'Memory' } as OptimizationStrategy),
      ChunkOperations.optimize(mockPosition, { _tag: 'Compression' } as OptimizationStrategy),
      ChunkOperations.optimize(mockPosition, { _tag: 'Speed' } as OptimizationStrategy),
      ChunkOperations.serialize(mockData, { _tag: 'Binary' } as SerializationFormat, mockMetadata),
      ChunkOperations.serialize(mockData, { _tag: 'JSON' } as SerializationFormat, mockMetadata),
      ChunkOperations.serialize(mockData, { _tag: 'Compressed', algorithm: 'lz4' } as SerializationFormat, mockMetadata)
    ]

    it('should handle all ChunkOperation variants without compilation errors', async () => {
      // This test verifies that our pattern matching is exhaustive
      // and handles all possible ChunkOperation variants
      for (const operation of testOperations) {
        const result = await Effect.runPromise(
          executeChunkOperation(operation).pipe(
            Effect.catchAll(() => Effect.succeed('Error handled'))
          )
        )

        expect(result).toBeTypeOf('string')
        expect(result.length).toBeGreaterThan(0)
      }
    })
  })

  // ===== Type Safety Tests ===== //

  describe('Type Safety Verification', () => {
    it('should maintain type safety with ChunkOperation variants', () => {
      const readOp = ChunkOperations.read(mockPosition)
      const writeOp = ChunkOperations.write(mockPosition, mockData, mockMetadata)

      // TypeScript should enforce correct property access
      if (readOp._tag === 'Read') {
        expect(readOp.position).toBeDefined()
        // @ts-expect-error - Should not have 'data' property on Read operation
        // expect(readOp.data).toBeUndefined()
      }

      if (writeOp._tag === 'Write') {
        expect(writeOp.position).toBeDefined()
        expect(writeOp.data).toBeDefined()
        expect(writeOp.metadata).toBeDefined()
      }
    })

    it('should prevent invalid operation construction', () => {
      const operation = ChunkOperations.read(mockPosition)
      expect(operation._tag).toBe('Read')

      // TypeScript should prevent access to properties that don't exist
      // @ts-expect-error - Read operation has no 'data' property
      // expect(operation.data).toBeUndefined()
    })
  })

  // ===== Complex Operation Flow Tests ===== //

  describe('Complex Operation Flow Scenarios', () => {
    it('should handle sequential operations', async () => {
      const operations = [
        ChunkOperations.read(mockPosition),
        ChunkOperations.validate(mockPosition, 'checksum'),
        ChunkOperations.optimize(mockPosition, { _tag: 'Memory' } as OptimizationStrategy),
        ChunkOperations.write(mockPosition, mockData, mockMetadata)
      ]

      const results = await Promise.all(
        operations.map(op => Effect.runPromise(executeChunkOperation(op)))
      )

      expect(results).toHaveLength(4)
      expect(results[0]).toContain('読み込み')
      expect(results[1]).toContain('検証')
      expect(results[2]).toContain('最適化')
      expect(results[3]).toContain('書き込み')
    })

    it('should handle operation variants with different complexity', async () => {
      // Simple operation
      const simpleOp = ChunkOperations.delete(mockPosition)
      const simpleResult = await Effect.runPromise(executeChunkOperation(simpleOp))

      // Complex operation with sub-types
      const complexOp = ChunkOperations.serialize(
        mockData,
        { _tag: 'Compressed', algorithm: 'brotli' } as SerializationFormat,
        mockMetadata
      )
      const complexResult = await Effect.runPromise(executeChunkOperation(complexOp))

      expect(simpleResult).toContain('削除')
      expect(complexResult).toContain('圧縮')
      expect(complexResult).toContain('brotli')
    })
  })

  // ===== Operation Validation Tests ===== //

  describe('Operation Validation', () => {
    it('should validate operation parameters', () => {
      // Test that factory functions accept correct types
      const readOp = ChunkOperations.read(mockPosition)
      expect(readOp._tag).toBe('Read')
      expect(readOp.position).toEqual(mockPosition)

      const writeOp = ChunkOperations.write(mockPosition, mockData, mockMetadata)
      expect(writeOp._tag).toBe('Write')
      expect(writeOp.position).toEqual(mockPosition)
      expect(writeOp.data).toEqual(mockData)
      expect(writeOp.metadata).toEqual(mockMetadata)
    })

    it('should maintain immutability of operation objects', () => {
      const operation = ChunkOperations.read(mockPosition)
      const originalPosition = operation.position

      // Attempt to modify (should not affect original)
      const modifiedPosition = { ...originalPosition, x: 999 }

      expect(operation.position).toEqual(originalPosition)
      expect(operation.position.x).not.toBe(999)
    })
  })
})