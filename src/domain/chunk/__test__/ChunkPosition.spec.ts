import { describe, expect } from 'vitest'
import { Effect } from 'effect'
import { it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import { Option } from 'effect'
import { pipe } from 'effect/Function'
import * as Match from 'effect/Match'
import { BrandedTypes } from '../../../shared/types/branded'
import {
  ChunkPositionSchema,
  type ChunkPosition,
  chunkToBlockCoords,
  blockToChunkCoords,
  chunkPositionToId,
  chunkIdToPosition,
  chunkPositionEquals,
  chunkPositionDistance,
} from '../ChunkPosition'

describe('ChunkPosition', () => {
  describe('ChunkPositionSchema', () => {
    it.effect('should validate valid chunk positions', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should reject invalid chunk positions', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should handle floating point numbers by accepting them', () =>
      Effect.gen(function* () {
        const floatPositions = [
          { x: 1.5, z: 2.7 },
          { x: -3.14, z: 0.0 },
        ]

        floatPositions.forEach((pos) => {
          expect(() => Schema.decodeUnknownSync(ChunkPositionSchema)(pos)).not.toThrow()
        })
      })
    )
  })

  describe('chunkToBlockCoords', () => {
    it.effect('should convert chunk coordinates to block coordinates correctly', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should handle edge cases', () =>
      Effect.gen(function* () {
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
    )
  })

  describe('blockToChunkCoords', () => {
    it.effect('should convert block coordinates to chunk coordinates correctly', () =>
      Effect.gen(function* () {
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
          const result = blockToChunkCoords(
            BrandedTypes.createWorldCoordinate(blockX),
            BrandedTypes.createWorldCoordinate(blockZ)
          )
          expect(result).toEqual(expected)
        })
      })
    )

    it.effect('should handle negative coordinates correctly', () =>
      Effect.gen(function* () {
        // Negative block coordinates should floor correctly
        expect(
          blockToChunkCoords(BrandedTypes.createWorldCoordinate(-1), BrandedTypes.createWorldCoordinate(0))
        ).toEqual({ x: -1, z: 0 })
        expect(
          blockToChunkCoords(BrandedTypes.createWorldCoordinate(-15), BrandedTypes.createWorldCoordinate(-15))
        ).toEqual({ x: -1, z: -1 })
        expect(
          blockToChunkCoords(BrandedTypes.createWorldCoordinate(-16), BrandedTypes.createWorldCoordinate(-16))
        ).toEqual({ x: -1, z: -1 })
        expect(
          blockToChunkCoords(BrandedTypes.createWorldCoordinate(-17), BrandedTypes.createWorldCoordinate(-17))
        ).toEqual({ x: -2, z: -2 })
      })
    )

    it.effect('should be inverse of chunkToBlockCoords', () =>
      Effect.gen(function* () {
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
    )
  })

  describe('chunkPositionToId', () => {
    it.effect('should generate unique IDs for chunk positions', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should generate different IDs for different positions', () =>
      Effect.gen(function* () {
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
    )
  })

  describe('chunkIdToPosition', () => {
    it.effect('should parse valid chunk IDs correctly', () =>
      Effect.gen(function* () {
        const testCases: Array<[string, ChunkPosition]> = [
          ['chunk_0_0', { x: 0, z: 0 }],
          ['chunk_1_-1', { x: 1, z: -1 }],
          ['chunk_-5_10', { x: -5, z: 10 }],
          ['chunk_999_-999', { x: 999, z: -999 }],
          ['chunk_12345_-67890', { x: 12345, z: -67890 }],
        ]

        for (const [id, expectedPos] of testCases) {
          const result = chunkIdToPosition(id)
          expect(Option.isSome(result)).toBe(true)
          yield* pipe(
            result,
            Option.match({
              onSome: (value) => Effect.sync(() => {
                expect(value).toEqual(expectedPos)
              }),
              onNone: () => Effect.succeed(undefined)
            })
          )
        }
      })
    )

    it.effect('should return None for invalid chunk IDs', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should be inverse of chunkPositionToId', () =>
      Effect.gen(function* () {
        const positions: ChunkPosition[] = [
          { x: 0, z: 0 },
          { x: 42, z: -13 },
          { x: -100, z: 200 },
          { x: 999999, z: -999999 },
        ]

        for (const originalPos of positions) {
          const id = chunkPositionToId(originalPos)
          const convertedBack = chunkIdToPosition(id)
          expect(Option.isSome(convertedBack)).toBe(true)
          yield* pipe(
            convertedBack,
            Option.match({
              onSome: (value) => Effect.sync(() => {
                expect(value).toEqual(originalPos)
              }),
              onNone: () => Effect.succeed(undefined)
            })
          )
        }
      })
    )
  })

  describe('chunkPositionEquals', () => {
    it.effect('should return true for equal positions', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should return false for different positions', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should be reflexive', () =>
      Effect.gen(function* () {
        const positions: ChunkPosition[] = [
          { x: 0, z: 0 },
          { x: 42, z: -13 },
          { x: -999, z: 999 },
        ]

        positions.forEach((pos) => {
          expect(chunkPositionEquals(pos, pos)).toBe(true)
        })
      })
    )
  })

  describe('chunkPositionDistance', () => {
    it.effect('should calculate Manhattan distance correctly', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should be commutative', () =>
      Effect.gen(function* () {
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
    )

    it.effect('should return 0 for identical positions', () =>
      Effect.gen(function* () {
        const positions: ChunkPosition[] = [
          { x: 0, z: 0 },
          { x: 42, z: -13 },
          { x: -999, z: 999 },
        ]

        positions.forEach((pos) => {
          expect(chunkPositionDistance(pos, pos)).toBe(0)
        })
      })
    )

    it.effect('should always return non-negative values', () =>
      Effect.gen(function* () {
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
    )
  })
})
