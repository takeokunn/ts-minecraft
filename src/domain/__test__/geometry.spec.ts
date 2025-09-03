import { describe, it, assert, expect, test } from '@effect/vitest'
import { Effect } from 'effect'
import * as Arbitrary from 'effect/Arbitrary'
import * as S from 'effect/Schema'
import { Collider, Position } from '../components'
import { areAABBsIntersecting, createAABB, toChunkIndex } from '../geometry'
import { Vector3 } from '../common'
import { CHUNK_SIZE } from '../world-constants'

describe('toChunkIndex', () => {
  it.effect('should convert a 3D position to a 1D index', () =>
    Effect.sync(() => {
      const position: Vector3 = [1, 2, 3]
      const result = toChunkIndex(position)
      assert.strictEqual(result, 1 + 3 * CHUNK_SIZE + 2 * CHUNK_SIZE * CHUNK_SIZE)
    }),
  )
})

describe('AABB', () => {
  const positionArbitrary = Arbitrary.make(Position)
  const colliderArbitrary = Arbitrary.make(Collider)

  it.prop('should create an AABB', [positionArbitrary, colliderArbitrary], (position, collider) =>
    Effect.gen(function*(_) {
      const aabb = yield* _(createAABB(position, collider))
      assert.closeTo(aabb.minX, position.x - collider.width / 2, 0.0001)
      assert.closeTo(aabb.minY, position.y, 0.0001)
      assert.closeTo(aabb.minZ, position.z - collider.depth / 2, 0.0001)
      assert.closeTo(aabb.maxX, position.x + collider.width / 2, 0.0001)
      assert.closeTo(aabb.maxY, position.y + collider.height, 0.0001)
      assert.closeTo(aabb.maxZ, position.z + collider.depth / 2, 0.0001)
    }),
  )

  it.effect('should detect intersection', () =>
    Effect.gen(function*(_) {
      const position = S.decodeSync(Position)({ x: 10, y: 20, z: 30 })
      const collider = S.decodeSync(Collider)({ width: 2, height: 4, depth: 6 })
      const aabb1 = yield* _(createAABB(position, collider))
      const aabb2 = yield* _(createAABB(S.decodeSync(Position)({ x: 11, y: 21, z: 31 }), collider))
      const aabb3 = yield* _(createAABB(S.decodeSync(Position)({ x: 100, y: 200, z: 300 }), collider))

      const result1 = areAABBsIntersecting(aabb1, aabb2)
      const result2 = areAABBsIntersecting(aabb1, aabb3)
      const result3 = areAABBsIntersecting(aabb1, aabb1)

      assert.isTrue(result1)
      assert.isFalse(result2)
      assert.isTrue(result3)
    }),
  )
})

