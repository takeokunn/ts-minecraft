import { describe, it, assert, expect } from '@effect/vitest'
import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import * as fc from 'effect/FastCheck'
import { Effect } from 'effect'
import { Collider, Position } from '../components'
import {
  areAABBsIntersecting,
  createAABB,
  fromCenterAndSize,
  getIntersectionDepth,
  toChunkIndex,
  AABBSchema,
  type AABB,
} from '../geometry'
import {
  Vector3Float,
  toFloat,
  toInt,
  Vector3Int,
  Vector3FloatSchema,
  Vector3IntSchema,
} from '../common'
import { CHUNK_SIZE, PLAYER_COLLIDER } from '../world-constants'
import { testReversibility } from '@test/test-utils'

// Arbitrary for a Vector3 with only non-negative, non-NaN floats
const PositiveVector3FloatArbitrary = fc.tuple(
  fc.float({ min: 0, noNaN: true }),
  fc.float({ min: 0, noNaN: true }),
  fc.float({ min: 0, noNaN: true }),
).map(
  ([x, y, z]) => [toFloat(x), toFloat(y), toFloat(z)] as Vector3Float,
)

// Arbitrary for a valid AABB where min <= max and no NaN
const AABBArbitrary = fc.record({
  minX: fc.float({ noNaN: true }),
  minY: fc.float({ noNaN: true }),
  minZ: fc.float({ noNaN: true }),
}).chain(min => fc.record({
  minX: fc.constant(toFloat(min.minX)),
  minY: fc.constant(toFloat(min.minY)),
  minZ: fc.constant(toFloat(min.minZ)),
  maxX: fc.float({ min: Math.fround(min.minX), noNaN: true }).map(toFloat),
  maxY: fc.float({ min: Math.fround(min.minY), noNaN: true }).map(toFloat),
  maxZ: fc.float({ min: Math.fround(min.minZ), noNaN: true }).map(toFloat),
})).map(S.decodeUnknownSync(AABBSchema))

const PositionArbitrary = Arbitrary.make(Position).filter(p => !Number.isNaN(p.x) && !Number.isNaN(p.y) && !Number.isNaN(p.z))
const ColliderArbitrary = Arbitrary.make(Collider).filter(c => !Number.isNaN(c.width) && !Number.isNaN(c.height) && !Number.isNaN(c.depth) && c.width >= 0 && c.height >= 0 && c.depth >= 0)
const Vector3IntArbitrary = Arbitrary.make(Vector3IntSchema)
const Vector3FloatArbitrary = Arbitrary.make(Vector3FloatSchema).filter(([x, y, z]) => !Number.isNaN(x) && !Number.isNaN(y) && !Number.isNaN(z))

describe('Geometry', () => {
  describe('toChunkIndex', () => {
    it.effect('should convert a 3D position to a 1D index', () =>
      Effect.sync(() => {
        const position: Vector3Int = [toInt(1), toInt(2), toInt(3)]
        const [x, y, z] = position
        const expected = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE
        assert.strictEqual(toChunkIndex(position), expected)
      }))

    it.effect('should always produce a valid index based on its formula', () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(Vector3IntArbitrary, async (pos) => {
            const [x, y, z] = pos
            const index = toChunkIndex(pos)
            const expected = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE
            assert.strictEqual(index, expected)
          }),
        ),
      ),
    )
  })

  describe('AABB', () => {
    testReversibility('AABBSchema', AABBSchema)

    describe('fromCenterAndSize', () => {
      it.effect('should create a correct AABB from center and size', () =>
        Effect.sync(() => {
          const center: Vector3Float = [toFloat(10), toFloat(20), toFloat(30)]
          const size: Vector3Float = [toFloat(2), toFloat(4), toFloat(6)]
          const aabb = fromCenterAndSize(center, size)
          const expected: AABB = {
            minX: toFloat(9),
            minY: toFloat(18),
            minZ: toFloat(27),
            maxX: toFloat(11),
            maxY: toFloat(22),
            maxZ: toFloat(33),
          }
          assert.deepStrictEqual(aabb, expected)
        }))

      it.effect('should create an AABB where max >= min', () =>
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(Vector3FloatArbitrary, PositiveVector3FloatArbitrary, async (center, size) => {
              const aabb = fromCenterAndSize(center, size)
              assert.isAtLeast(aabb.maxX, aabb.minX)
              assert.isAtLeast(aabb.maxY, aabb.minY)
              assert.isAtLeast(aabb.maxZ, aabb.minZ)
            }),
          ),
        ),
      )
    })

    describe('createAABB', () => {
      it.effect('should create a correct AABB', () =>
        Effect.sync(() => {
          const position: Position = { x: toFloat(0.5), y: toFloat(0), z: toFloat(0.5) }
          const collider: Collider = PLAYER_COLLIDER
          const aabb = createAABB(position, collider)
          const expected = {
            minX: toFloat(position.x - collider.width / 2),
            minY: position.y,
            minZ: toFloat(position.z - collider.depth / 2),
            maxX: toFloat(position.x + collider.width / 2),
            maxY: toFloat(position.y + collider.height),
            maxZ: toFloat(position.z + collider.depth / 2),
          }
          assert.deepStrictEqual(aabb, expected)
        }))

      it.effect('should create a valid AABB from any position and collider', () =>
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(PositionArbitrary, ColliderArbitrary, async (position, collider) => {
              const aabb = createAABB(position, collider)
              const expected = {
                minX: toFloat(position.x - collider.width / 2),
                minY: position.y,
                minZ: toFloat(position.z - collider.depth / 2),
                maxX: toFloat(position.x + collider.width / 2),
                maxY: toFloat(position.y + collider.height),
                maxZ: toFloat(position.z + collider.depth / 2),
              }
              assert.deepStrictEqual(aabb, expected)
            }),
          ),
        ),
      )
    })

    describe('areAABBsIntersecting', () => {
      it.effect('should correctly detect intersections', () =>
        Effect.sync(() => {
          const a: AABB = {
            minX: toFloat(0),
            minY: toFloat(0),
            minZ: toFloat(0),
            maxX: toFloat(1),
            maxY: toFloat(1),
            maxZ: toFloat(1),
          }
          const b: AABB = { ...a, minX: toFloat(0.5) }
          const c: AABB = { ...a, minX: toFloat(2) }
          assert.isTrue(areAABBsIntersecting(a, b))
          assert.isFalse(areAABBsIntersecting(a, c))
        }))

      it.effect('an AABB should always intersect with itself', () =>
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(AABBArbitrary, async (aabb) => {
              assert.isTrue(areAABBsIntersecting(aabb, aabb))
            }),
          ),
        ),
      )
    })

    describe('getIntersectionDepth', () => {
      it.effect('should return zero vector for non-intersecting AABBs', () =>
        Effect.sync(() => {
          const a: AABB = {
            minX: toFloat(0),
            minY: toFloat(0),
            minZ: toFloat(0),
            maxX: toFloat(1),
            maxY: toFloat(1),
            maxZ: toFloat(1),
          }
          const b: AABB = { ...a, minX: toFloat(a.maxX + 1) }
          const expected: Vector3Float = [toFloat(0), toFloat(0), toFloat(0)]
          assert.deepStrictEqual(getIntersectionDepth(a, b), expected)
        }))

      it.effect('should calculate correct depth for partially intersecting AABBs', () =>
        Effect.sync(() => {
          const a: AABB = { minX: toFloat(0), minY: toFloat(0), minZ: toFloat(0), maxX: toFloat(2), maxY: toFloat(2), maxZ: toFloat(2) }
          const b: AABB = { minX: toFloat(1), minY: toFloat(1), minZ: toFloat(1), maxX: toFloat(3), maxY: toFloat(3), maxZ: toFloat(3) }
          const depth = getIntersectionDepth(a, b)
          expect(depth).toEqual([toFloat(-1), toFloat(0), toFloat(0)])
        }))

      it.effect('should calculate correct depth when one AABB contains another', () =>
        Effect.sync(() => {
          const a: AABB = { minX: toFloat(0), minY: toFloat(0), minZ: toFloat(0), maxX: toFloat(4), maxY: toFloat(4), maxZ: toFloat(4) }
          const b: AABB = { minX: toFloat(1), minY: toFloat(1), minZ: toFloat(1), maxX: toFloat(2), maxY: toFloat(2), maxZ: toFloat(2) }
          const depth = getIntersectionDepth(a, b)
          expect(depth).toEqual([toFloat(2), toFloat(0), toFloat(0)])
        }))

      it.effect('should return zero vector for non-intersecting AABBs (PBT)', () =>
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(AABBArbitrary, AABBArbitrary, async (a, b) => {
              if (!areAABBsIntersecting(a, b)) {
                const depth = getIntersectionDepth(a, b)
                assert.deepStrictEqual(depth, [toFloat(0), toFloat(0), toFloat(0)])
              }
            }),
          ),
        ),
      )

      it.effect('should not crash for intersecting AABBs (PBT)', () =>
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(AABBArbitrary, AABBArbitrary, async (a, b) => {
              if (areAABBsIntersecting(a, b)) {
                const depth = getIntersectionDepth(a, b)
                assert.isDefined(depth)
              }
            }),
          ),
        ),
      )
    })
  })
})