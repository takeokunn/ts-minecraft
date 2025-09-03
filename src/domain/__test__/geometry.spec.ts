import { describe, it, assert } from '@effect/vitest'
import { Effect, Gen } from 'effect'
import * as S from 'effect/Schema'
import * as fc from 'effect/FastCheck'
import { Collider, Position } from '../components'
import { areAABBsIntersecting, createAABB, getIntersectionDepth, toChunkIndex, AABB } from '../geometry'
import { Vector3, toFloat } from '../common'
import { CHUNK_SIZE } from '../world-constants'

describe('Geometry', () => {
  describe('toChunkIndex', () => {
    it.effect('should convert a 3D position to a 1D index', () =>
      Gen.flatMap(fc.gen(Vector3), (position) =>
        Effect.sync(() => {
          const [x, y, z] = position
          const expected = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE
          assert.strictEqual(toChunkIndex(position), expected)
        }),
      ))
  })

  describe('AABB', () => {
    it.effect('AABB schema should be reversible', () =>
      Gen.flatMap(fc.gen(AABB), (aabb) =>
        Effect.sync(() => {
          const encode = S.encodeSync(AABB)
          const decode = S.decodeSync(AABB)
          const decoded = decode(encode(aabb))
          assert.deepStrictEqual(decoded, aabb)
        }),
      ))

    it.effect('createAABB should create a correct AABB', () =>
      Gen.flatMap(fc.gen(Position), (position) =>
        Gen.flatMap(fc.gen(Collider), (collider) =>
          Effect.sync(() => {
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
      ))

    it.effect('areAABBsIntersecting should correctly detect intersections', () =>
      Gen.flatMap(fc.gen(AABB), (a) =>
        Gen.flatMap(fc.gen(AABB), (b) =>
          Effect.sync(() => {
            const expected = a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY && a.minZ <= b.maxZ && a.maxZ >= b.minZ
            assert.strictEqual(areAABBsIntersecting(a, b), expected)
          }),
        ),
      ))

    it.effect('getIntersectionDepth should return zero vector for non-intersecting AABBs', () =>
      Gen.flatMap(fc.gen(AABB), (a) =>
        Gen.flatMap(
          fc.gen(AABB).map((b) => ({
            ...b,
            minX: toFloat(a.maxX + 1), // Ensure they don't intersect
          })),
          (b) =>
            Effect.sync(() => {
              assert.deepStrictEqual(getIntersectionDepth(a, b), [toFloat(0), toFloat(0), toFloat(0)])
            }),
        ),
      ))
  })
})
