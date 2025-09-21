import { describe, it, expect } from 'vitest'
import { Schema } from '@effect/schema'
import { Option } from 'effect'
import {
  ChunkPositionSchema,
  type ChunkPosition,
  chunkToBlockCoords,
  blockToChunkCoords,
  chunkPositionToId,
  chunkIdToPosition,
  chunkPositionEquals,
  chunkPositionDistance,
} from '../ChunkPosition.js'

describe('ChunkPosition', () => {
  describe('ChunkPositionSchema', () => {
    it('should validate valid chunk positions', () => {
      const validPositions = [
        { x: 0, z: 0 },
        { x: 10, z: -5 },
        { x: -100, z: 200 },
        { x: 999999, z: -999999 },
      ]

      validPositions.forEach((pos) => {
        expect(() => Schema.decodeUnknownSync(ChunkPositionSchema)(pos)).not.toThrow()
      })
    })

    it('should reject invalid chunk positions', () => {
      const invalidPositions = [
        { x: 'invalid', z: 0 },
        { x: 0, z: 'invalid' },
        { x: 0 }, // missing z
        { z: 0 }, // missing x
        null,
        undefined,
        {},
      ]

      invalidPositions.forEach((pos) => {
        expect(() => Schema.decodeUnknownSync(ChunkPositionSchema)(pos)).toThrow()
      })
    })

    it('should handle floating point numbers by accepting them', () => {
      const floatPositions = [
        { x: 1.5, z: 2.7 },
        { x: -3.14, z: 0.0 },
      ]

      floatPositions.forEach((pos) => {
        expect(() => Schema.decodeUnknownSync(ChunkPositionSchema)(pos)).not.toThrow()
      })
    })
  })

  describe('chunkToBlockCoords', () => {
    it('should convert chunk coordinates to block coordinates correctly', () => {
      const testCases: Array<[ChunkPosition, { startX: number; startZ: number }]> = [
        [
          { x: 0, z: 0 },
          { startX: 0, startZ: 0 },
        ],
        [
          { x: 1, z: 1 },
          { startX: 16, startZ: 16 },
        ],
        [
          { x: -1, z: -1 },
          { startX: -16, startZ: -16 },
        ],
        [
          { x: 10, z: -5 },
          { startX: 160, startZ: -80 },
        ],
        [
          { x: -100, z: 200 },
          { startX: -1600, startZ: 3200 },
        ],
      ]

      testCases.forEach(([chunkPos, expected]) => {
        const result = chunkToBlockCoords(chunkPos)
        expect(result).toEqual(expected)
      })
    })

    it('should handle edge cases', () => {
      const edgeCases: Array<[ChunkPosition, { startX: number; startZ: number }]> = [
        [
          { x: Number.MAX_SAFE_INTEGER, z: 0 },
          { startX: Number.MAX_SAFE_INTEGER * 16, startZ: 0 },
        ],
        [
          { x: Number.MIN_SAFE_INTEGER, z: 0 },
          { startX: Number.MIN_SAFE_INTEGER * 16, startZ: 0 },
        ],
      ]

      edgeCases.forEach(([chunkPos, expected]) => {
        const result = chunkToBlockCoords(chunkPos)
        expect(result).toEqual(expected)
      })
    })
  })

  describe('blockToChunkCoords', () => {
    it('should convert block coordinates to chunk coordinates correctly', () => {
      const testCases: Array<[number, number, ChunkPosition]> = [
        [0, 0, { x: 0, z: 0 }],
        [15, 15, { x: 0, z: 0 }], // still in chunk 0,0
        [16, 16, { x: 1, z: 1 }],
        [-1, -1, { x: -1, z: -1 }],
        [-16, -16, { x: -1, z: -1 }],
        [160, -80, { x: 10, z: -5 }],
        [159, -81, { x: 9, z: -6 }],
      ]

      testCases.forEach(([blockX, blockZ, expected]) => {
        const result = blockToChunkCoords(blockX, blockZ)
        expect(result).toEqual(expected)
      })
    })

    it('should handle negative coordinates correctly', () => {
      // Negative block coordinates should floor correctly
      expect(blockToChunkCoords(-1, 0)).toEqual({ x: -1, z: 0 })
      expect(blockToChunkCoords(-15, -15)).toEqual({ x: -1, z: -1 })
      expect(blockToChunkCoords(-16, -16)).toEqual({ x: -1, z: -1 })
      expect(blockToChunkCoords(-17, -17)).toEqual({ x: -2, z: -2 })
    })

    it('should be inverse of chunkToBlockCoords', () => {
      const chunkPositions: ChunkPosition[] = [
        { x: 0, z: 0 },
        { x: 5, z: -3 },
        { x: -10, z: 15 },
        { x: 100, z: -200 },
      ]

      chunkPositions.forEach((originalChunk) => {
        const { startX, startZ } = chunkToBlockCoords(originalChunk)
        const convertedBack = blockToChunkCoords(startX, startZ)
        expect(convertedBack).toEqual(originalChunk)
      })
    })
  })

  describe('chunkPositionToId', () => {
    it('should generate unique IDs for chunk positions', () => {
      const testCases: Array<[ChunkPosition, string]> = [
        [{ x: 0, z: 0 }, 'chunk_0_0'],
        [{ x: 1, z: -1 }, 'chunk_1_-1'],
        [{ x: -5, z: 10 }, 'chunk_-5_10'],
        [{ x: 999, z: -999 }, 'chunk_999_-999'],
      ]

      testCases.forEach(([pos, expectedId]) => {
        const result = chunkPositionToId(pos)
        expect(result).toBe(expectedId)
      })
    })

    it('should generate different IDs for different positions', () => {
      const positions: ChunkPosition[] = [
        { x: 0, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 0 },
        { x: -1, z: -1 },
      ]

      const ids = positions.map(chunkPositionToId)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('chunkIdToPosition', () => {
    it('should parse valid chunk IDs correctly', () => {
      const testCases: Array<[string, ChunkPosition]> = [
        ['chunk_0_0', { x: 0, z: 0 }],
        ['chunk_1_-1', { x: 1, z: -1 }],
        ['chunk_-5_10', { x: -5, z: 10 }],
        ['chunk_999_-999', { x: 999, z: -999 }],
        ['chunk_12345_-67890', { x: 12345, z: -67890 }],
      ]

      testCases.forEach(([id, expectedPos]) => {
        const result = chunkIdToPosition(id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value).toEqual(expectedPos)
        }
      })
    })

    it('should return None for invalid chunk IDs', () => {
      const invalidIds = [
        'invalid',
        'chunk_0',
        'chunk_0_0_0',
        'chunk_a_b',
        'chunk__0',
        'chunk_0_',
        'notachunk_0_0',
        '',
        'chunk_0.5_1',
        'chunk_1_2_extra',
      ]

      invalidIds.forEach((id) => {
        const result = chunkIdToPosition(id)
        expect(Option.isNone(result)).toBe(true)
      })
    })

    it('should be inverse of chunkPositionToId', () => {
      const positions: ChunkPosition[] = [
        { x: 0, z: 0 },
        { x: 42, z: -13 },
        { x: -100, z: 200 },
        { x: 999999, z: -999999 },
      ]

      positions.forEach((originalPos) => {
        const id = chunkPositionToId(originalPos)
        const convertedBack = chunkIdToPosition(id)
        expect(Option.isSome(convertedBack)).toBe(true)
        if (Option.isSome(convertedBack)) {
          expect(convertedBack.value).toEqual(originalPos)
        }
      })
    })
  })

  describe('chunkPositionEquals', () => {
    it('should return true for equal positions', () => {
      const testCases: Array<[ChunkPosition, ChunkPosition]> = [
        [
          { x: 0, z: 0 },
          { x: 0, z: 0 },
        ],
        [
          { x: 5, z: -3 },
          { x: 5, z: -3 },
        ],
        [
          { x: -100, z: 200 },
          { x: -100, z: 200 },
        ],
      ]

      testCases.forEach(([pos1, pos2]) => {
        expect(chunkPositionEquals(pos1, pos2)).toBe(true)
        expect(chunkPositionEquals(pos2, pos1)).toBe(true) // commutative
      })
    })

    it('should return false for different positions', () => {
      const testCases: Array<[ChunkPosition, ChunkPosition]> = [
        [
          { x: 0, z: 0 },
          { x: 0, z: 1 },
        ],
        [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
        ],
        [
          { x: 5, z: -3 },
          { x: -5, z: 3 },
        ],
        [
          { x: 100, z: 200 },
          { x: 200, z: 100 },
        ],
      ]

      testCases.forEach(([pos1, pos2]) => {
        expect(chunkPositionEquals(pos1, pos2)).toBe(false)
        expect(chunkPositionEquals(pos2, pos1)).toBe(false) // commutative
      })
    })

    it('should be reflexive', () => {
      const positions: ChunkPosition[] = [
        { x: 0, z: 0 },
        { x: 42, z: -13 },
        { x: -999, z: 999 },
      ]

      positions.forEach((pos) => {
        expect(chunkPositionEquals(pos, pos)).toBe(true)
      })
    })
  })

  describe('chunkPositionDistance', () => {
    it('should calculate Manhattan distance correctly', () => {
      const testCases: Array<[ChunkPosition, ChunkPosition, number]> = [
        [{ x: 0, z: 0 }, { x: 0, z: 0 }, 0],
        [{ x: 0, z: 0 }, { x: 1, z: 0 }, 1],
        [{ x: 0, z: 0 }, { x: 0, z: 1 }, 1],
        [{ x: 0, z: 0 }, { x: 1, z: 1 }, 2],
        [{ x: 0, z: 0 }, { x: 3, z: 4 }, 7],
        [{ x: 5, z: 5 }, { x: 2, z: 1 }, 7], // |5-2| + |5-1| = 3 + 4 = 7
        [{ x: -5, z: -5 }, { x: 5, z: 5 }, 20], // |-5-5| + |-5-5| = 10 + 10 = 20
      ]

      testCases.forEach(([pos1, pos2, expectedDistance]) => {
        const result = chunkPositionDistance(pos1, pos2)
        expect(result).toBe(expectedDistance)
      })
    })

    it('should be commutative', () => {
      const testCases: Array<[ChunkPosition, ChunkPosition]> = [
        [
          { x: 0, z: 0 },
          { x: 5, z: 3 },
        ],
        [
          { x: -10, z: 15 },
          { x: 20, z: -5 },
        ],
        [
          { x: 100, z: -200 },
          { x: -300, z: 400 },
        ],
      ]

      testCases.forEach(([pos1, pos2]) => {
        const distance1 = chunkPositionDistance(pos1, pos2)
        const distance2 = chunkPositionDistance(pos2, pos1)
        expect(distance1).toBe(distance2)
      })
    })

    it('should return 0 for identical positions', () => {
      const positions: ChunkPosition[] = [
        { x: 0, z: 0 },
        { x: 42, z: -13 },
        { x: -999, z: 999 },
      ]

      positions.forEach((pos) => {
        expect(chunkPositionDistance(pos, pos)).toBe(0)
      })
    })

    it('should always return non-negative values', () => {
      const testCases: Array<[ChunkPosition, ChunkPosition]> = [
        [
          { x: 0, z: 0 },
          { x: -5, z: -3 },
        ],
        [
          { x: -10, z: -15 },
          { x: 20, z: 5 },
        ],
        [
          { x: 100, z: -200 },
          { x: -300, z: 400 },
        ],
      ]

      testCases.forEach(([pos1, pos2]) => {
        const distance = chunkPositionDistance(pos1, pos2)
        expect(distance).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('performance', () => {
    it('should handle coordinate conversions efficiently', () => {
      const iterations = 10000
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        const chunkPos = { x: i % 1000, z: (i * 2) % 1000 }
        const blockCoords = chunkToBlockCoords(chunkPos)
        const backToChunk = blockToChunkCoords(blockCoords.startX, blockCoords.startZ)
        const id = chunkPositionToId(backToChunk)
        const backToPos = chunkIdToPosition(id)

        // Verify round-trip consistency
        expect(Option.isSome(backToPos)).toBe(true)
        if (Option.isSome(backToPos)) {
          expect(backToPos.value).toEqual(chunkPos)
        }
      }

      const end = performance.now()
      const timePerOperation = (end - start) / iterations

      // Should be very fast (less than 0.1ms per operation)
      expect(timePerOperation).toBeLessThan(0.1)
    })
  })
})
