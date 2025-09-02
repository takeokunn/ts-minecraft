import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { Collider, Position } from '../components'
import { areAABBsIntersecting, createAABB, getIntersectionDepth, toChunkIndex } from '../geometry'

describe('toChunkIndex', () => {
  it('should convert a 3D position to a 1D index', async () => {
    const position = [1, 2, 3] as const
    const result = await Effect.runPromise(toChunkIndex(position))
    expect(result).toBe(1 + 3 * 10 + 2 * 10 * 10)
  })
})

describe('AABB', () => {
  const position = new Position({ x: 10, y: 20, z: 30 })
  const collider: Collider = { width: 2, height: 4, depth: 6 }

  it('should create an AABB', async () => {
    const aabb = await Effect.runPromise(createAABB(position, collider))
    expect(aabb.minX).toBeCloseTo(position.x - collider.width / 2)
    expect(aabb.minY).toBeCloseTo(position.y)
    expect(aabb.minZ).toBeCloseTo(position.z - collider.depth / 2)
    expect(aabb.maxX).toBeCloseTo(position.x + collider.width / 2)
    expect(aabb.maxY).toBeCloseTo(position.y + collider.height)
    expect(aabb.maxZ).toBeCloseTo(position.z + collider.depth / 2)
  })

  it('should detect intersection', async () => {
    const program = Effect.gen(function* (_) {
      const aabb1 = yield* _(createAABB(position, collider))
      const aabb2 = yield* _(createAABB(new Position({ x: 11, y: 21, z: 31 }), collider))
      const aabb3 = yield* _(createAABB(new Position({ x: 100, y: 200, z: 300 }), collider))

      const result1 = yield* _(areAABBsIntersecting(aabb1, aabb2))
      const result2 = yield* _(areAABBsIntersecting(aabb1, aabb3))
      const result3 = yield* _(areAABBsIntersecting(aabb1, aabb1))

      return { result1, result2, result3 }
    })

    const { result1, result2, result3 } = await Effect.runPromise(program)

    expect(result1).toBe(true)
    expect(result2).toBe(false)
    expect(result3).toBe(true)
  })

  describe('getIntersectionDepth', () => {
    it('should return [0, 0, 0] for non-intersecting AABBs', async () => {
      const program = Effect.gen(function* (_) {
        const aabb1 = yield* _(createAABB(new Position({ x: 0, y: 0, z: 0 }), { width: 1, height: 1, depth: 1 }))
        const aabb2 = yield* _(createAABB(new Position({ x: 2, y: 2, z: 2 }), { width: 1, height: 1, depth: 1 }))
        return yield* _(getIntersectionDepth(aabb1, aabb2))
      })
      const mtv = await Effect.runPromise(program)
      expect(mtv[0]).toBeCloseTo(0)
      expect(mtv[1]).toBeCloseTo(0)
      expect(mtv[2]).toBeCloseTo(0)
    })

    it('should return the correct MTV for intersecting AABBs on X axis', async () => {
      const program = Effect.gen(function* (_) {
        const aabb1 = yield* _(createAABB(new Position({ x: 0, y: 0, z: 0 }), { width: 2, height: 2, depth: 2 }))
        const aabb2 = yield* _(createAABB(new Position({ x: 1, y: 0, z: 0 }), { width: 2, height: 2, depth: 2 }))
        return yield* _(getIntersectionDepth(aabb1, aabb2))
      })
      const mtv = await Effect.runPromise(program)
      expect(mtv[0]).toBeCloseTo(-1)
    })

    it('should return the correct MTV for intersecting AABBs on Y axis', async () => {
      const program = Effect.gen(function* (_) {
        const aabb1 = yield* _(createAABB(new Position({ x: 0, y: 0, z: 0 }), { width: 2, height: 2, depth: 2 }))
        const aabb2 = yield* _(createAABB(new Position({ x: 0, y: 1, z: 0 }), { width: 2, height: 2, depth: 2 }))
        return yield* _(getIntersectionDepth(aabb1, aabb2))
      })
      const mtv = await Effect.runPromise(program)
      expect(mtv[1]).toBeCloseTo(-1)
    })

    it('should return the correct MTV for intersecting AABBs on Z axis', async () => {
      const program = Effect.gen(function* (_) {
        const aabb1 = yield* _(createAABB(new Position({ x: 0, y: 0, z: 0 }), { width: 2, height: 2, depth: 2 }))
        const aabb2 = yield* _(createAABB(new Position({ x: 0, y: 0, z: 1 }), { width: 2, height: 2, depth: 2 }))
        return yield* _(getIntersectionDepth(aabb1, aabb2))
      })
      const mtv = await Effect.runPromise(program)
      expect(mtv[2]).toBeCloseTo(-1)
    })

    it('should return the smallest MTV', async () => {
      const program = Effect.gen(function* (_) {
        const aabb1 = yield* _(createAABB(new Position({ x: 0, y: 0, z: 0 }), { width: 2, height: 2, depth: 2 }))
        const aabb2 = yield* _(createAABB(new Position({ x: 1.9, y: 0, z: 0 }), { width: 2, height: 2, depth: 2 }))
        return yield* _(getIntersectionDepth(aabb1, aabb2))
      })
      const mtv = await Effect.runPromise(program)
      expect(mtv[0]).toBeCloseTo(-0.1)
      expect(mtv[1]).toBeCloseTo(0)
      expect(mtv[2]).toBeCloseTo(0)
    })
  })
})
