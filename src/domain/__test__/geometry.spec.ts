import { describe, it, assert } from '@effect/vitest'
import * as S from 'effect/Schema'
import { Collider, Position } from '../components'
import { areAABBsIntersecting, createAABB, getIntersectionDepth, toChunkIndex, AABB as AABBSchema } from '../geometry'
import { Vector3, toFloat, toInt, Vector3Int } from '../common'
import { CHUNK_SIZE } from '../world-constants'
import { PLAYER_COLLIDER } from '../world-constants'
import { AABB } from '../types'

describe('Geometry', () => {
  describe('toChunkIndex', () => {
    it('should convert a 3D position to a 1D index', () => {
      const position: Vector3Int = [toInt(1), toInt(2), toInt(3)]
      const [x, y, z] = position
      const expected = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE
      assert.strictEqual(toChunkIndex(position), expected)
    })
  })

  describe('AABB', () => {
    const aabbValue: AABB = {
      minX: toFloat(0),
      minY: toFloat(0),
      minZ: toFloat(0),
      maxX: toFloat(1),
      maxY: toFloat(1),
      maxZ: toFloat(1),
    }

    it('AABB schema should be reversible', () => {
      const encode = S.encodeSync(AABBSchema)
      const decode = S.decodeSync(AABBSchema)
      const decoded = decode(encode(aabbValue))
      assert.deepStrictEqual(decoded, aabbValue)
    })

    it('createAABB should create a correct AABB', () => {
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
    })

    it('areAABBsIntersecting should correctly detect intersections', () => {
      const a: AABB = { ...aabbValue }
      const b: AABB = { ...aabbValue, minX: toFloat(0.5) }
      const c: AABB = { ...aabbValue, minX: toFloat(2) }
      assert.isTrue(areAABBsIntersecting(a, b))
      assert.isFalse(areAABBsIntersecting(a, c))
    })

    it('getIntersectionDepth should return zero vector for non-intersecting AABBs', () => {
      const a: AABB = { ...aabbValue }
      const b: AABB = { ...aabbValue, minX: toFloat(a.maxX + 1) }
      const expected: Vector3 = [toFloat(0), toFloat(0), toFloat(0)]
      assert.deepStrictEqual(getIntersectionDepth(a, b), expected)
    })
  })
})
