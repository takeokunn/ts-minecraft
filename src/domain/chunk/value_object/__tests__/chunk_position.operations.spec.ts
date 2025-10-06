import { describe, expect, it } from '@effect/vitest'
import { Effect, Option, Schema } from 'effect'
import * as ReadonlyArray from 'effect/Array'
import * as fc from 'effect/FastCheck'
import {
  calculateChebyshevDistance,
  calculateChunkDistance,
  calculateManhattanDistance,
  createChunkPosition,
  createChunkPositionSync,
  getChunksInCircle,
  getChunksInRectangle,
  getNeighborChunks,
  isChunkPositionEqual,
  isWithinBounds,
  sortChunksByDistance,
} from '../chunk_position/operations'
import { ChunkPositionSchema } from '../chunk_position/types'

const effectProperty = <T>(
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => Effect.Effect<void>
): fc.AsyncProperty<[T]> => fc.asyncProperty(arbitrary, (value) => Effect.runPromise(predicate(value)).then(() => true))

const chunkCoordinate = fc.integer({ min: -1_000, max: 1_000 })

const chunkPositionArbitrary = fc
  .record({
    x: chunkCoordinate,
    z: chunkCoordinate,
  })
  .map((candidate) => Schema.decodeUnknownSync(ChunkPositionSchema)(candidate))

describe('chunk/value_object/chunk_position/operations', () => {
  it.effect('calculateManhattanDistance and calculateChebyshevDistance respect bounds', () =>
    Effect.gen(function* () {
      const origin = yield* createChunkPosition(0, 0)
      const destination = yield* createChunkPosition(4, -3)

      const manhattan = calculateManhattanDistance(origin, destination)
      const chebyshev = calculateChebyshevDistance(origin, destination)

      expect(manhattan).toBeGreaterThanOrEqual(chebyshev)
      expect(manhattan).toBe(7)
      expect(chebyshev).toBe(4)
    })
  )

  it.effect('getNeighborChunks excludes the origin and returns symmetric positions', () =>
    Effect.gen(function* () {
      const origin = yield* createChunkPosition(10, 10)
      const neighbors = getNeighborChunks(origin, 1)

      expect(neighbors.length).toBe(8)
      expect(neighbors).not.toContainEqual(origin)

      const opposite = createChunkPositionSync(11, 11)
      expect(neighbors).toContainEqual(opposite)
    })
  )

  it('getChunksInRectangle yields inclusive ranges', async () => {
    await fc.assert(
      effectProperty(
        fc.record({
          minX: chunkCoordinate,
          minZ: chunkCoordinate,
          width: fc.integer({ min: 0, max: 16 }),
          height: fc.integer({ min: 0, max: 16 }),
        }),
        ({ minX, minZ, width, height }) =>
          Effect.sync(() => {
            const maxX = minX + width
            const maxZ = minZ + height
            const positions = getChunksInRectangle(minX, minZ, maxX, maxZ)

            expect(positions.length).toBe((width + 1) * (height + 1))
            expect(positions[0]).toStrictEqual(createChunkPositionSync(minX, minZ))
            expect(ReadonlyArray.last(positions)).toStrictEqual(Option.some(createChunkPositionSync(maxX, maxZ)))
          })
      ),
      { numRuns: 100 }
    )
  })

  it('getChunksInCircle stays within radius', async () => {
    await fc.assert(
      effectProperty(
        fc.record({
          center: chunkPositionArbitrary,
          radius: fc.integer({ min: 1, max: 8 }),
        }),
        ({ center, radius }) =>
          Effect.sync(() => {
            const radiusSquared = radius * radius
            const positions = getChunksInCircle(center, radius)

            for (const position of positions) {
              const euclidean = calculateChunkDistance(center, position)
              expect(euclidean * euclidean).toBeLessThanOrEqual(radiusSquared)
            }
          })
      ),
      { numRuns: 100 }
    )
  })

  it('sortChunksByDistance orders monotonically increasing distance', async () => {
    await fc.assert(
      effectProperty(
        fc.record({
          reference: chunkPositionArbitrary,
          points: fc.array(chunkPositionArbitrary, { minLength: 1, maxLength: 32 }),
        }),
        ({ reference, points }) =>
          Effect.sync(() => {
            const sorted = sortChunksByDistance(points, reference)
            const distances = sorted.map((position) => calculateChunkDistance(position, reference))
            for (let index = 1; index < distances.length; index += 1) {
              expect(distances[index]).toBeGreaterThanOrEqual(distances[index - 1]!)
            }
          })
      ),
      { numRuns: 100 }
    )
  })

  it.effect('isChunkPositionEqual and isWithinBounds behave consistently', () =>
    Effect.gen(function* () {
      const position = yield* createChunkPosition(5, -5)
      expect(isChunkPositionEqual(position, createChunkPositionSync(5, -5))).toBe(true)
      expect(isChunkPositionEqual(position, createChunkPositionSync(4, -5))).toBe(false)

      expect(isWithinBounds(position, 0, -10, 10, 0)).toBe(true)
      expect(isWithinBounds(position, 6, -10, 10, 0)).toBe(false)
    })
  )
})
