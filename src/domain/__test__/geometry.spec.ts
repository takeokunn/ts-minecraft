import { describe, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { Position, Collider } from '../components'
import { createAABB, areAABBsIntersecting, getIntersectionDepth } from '../geometry'

const positionArb = fc.record({
  x: fc.double({ noNaN: true }).filter((v) => Number.isFinite(v)),
  y: fc.double({ noNaN: true }).filter((v) => Number.isFinite(v)),
  z: fc.double({ noNaN: true }).filter((v) => Number.isFinite(v)),
})

const colliderArb = fc.record({
  width: fc.double({ noNaN: true, min: 0 }).filter((v) => Number.isFinite(v)),
  height: fc.double({ noNaN: true, min: 0 }).filter((v) => Number.isFinite(v)),
  depth: fc.double({ noNaN: true, min: 0 }).filter((v) => Number.isFinite(v)),
})

describe('geometry', () => {
  describe('createAABB', () => {
    test.prop([positionArb, colliderArb])('should create an AABB with correct dimensions', (pos, col) => {
      const position = new Position(pos)
      const collider = new Collider(col)
      const aabb = createAABB(position, collider)

      expect(aabb.minX).toBeCloseTo(position.x - collider.width / 2)
      expect(aabb.minY).toBeCloseTo(position.y)
      expect(aabb.minZ).toBeCloseTo(position.z - collider.depth / 2)
      expect(aabb.maxX).toBeCloseTo(position.x + collider.width / 2)
      expect(aabb.maxY).toBeCloseTo(position.y + collider.height)
      expect(aabb.maxZ).toBeCloseTo(position.z + collider.depth / 2)
    })
  })

  describe('areAABBsIntersecting', () => {
    test('should return true for overlapping AABBs', () => {
      const aabb1 = { minX: 0, minY: 0, minZ: 0, maxX: 2, maxY: 2, maxZ: 2 }
      const aabb2 = { minX: 1, minY: 1, minZ: 1, maxX: 3, maxY: 3, maxZ: 3 }
      expect(areAABBsIntersecting(aabb1, aabb2)).toBe(true)
    })

    test('should return false for non-overlapping AABBs', () => {
      const aabb1 = { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }
      const aabb2 = { minX: 2, minY: 2, minZ: 2, maxX: 3, maxY: 3, maxZ: 3 }
      expect(areAABBsIntersecting(aabb1, aabb2)).toBe(false)
    })

    test('should return true for touching AABBs', () => {
      const aabb1 = { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }
      const aabb2 = { minX: 1, minY: 1, minZ: 1, maxX: 2, maxY: 2, maxZ: 2 }
      expect(areAABBsIntersecting(aabb1, aabb2)).toBe(true)
    })

    test.prop([positionArb, colliderArb])('an AABB should always intersect with itself', (pos, col) => {
      const position = new Position(pos)
      const collider = new Collider(col)
      const aabb = createAABB(position, collider)
      expect(areAABBsIntersecting(aabb, aabb)).toBe(true)
    })
  })

  describe('getIntersectionDepth', () => {
    test('should return [0, 0, 0] for non-overlapping AABBs', () => {
      const aabb1 = { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }
      const aabb2 = { minX: 2, minY: 2, minZ: 2, maxX: 3, maxY: 3, maxZ: 3 }
      const mtv = getIntersectionDepth(aabb1, aabb2)
      expect(mtv[0]).toBeCloseTo(0)
      expect(mtv[1]).toBeCloseTo(0)
      expect(mtv[2]).toBeCloseTo(0)
    })

    test('should return correct MTV for X-axis overlap', () => {
      const aabb1 = { minX: 0, minY: 0, minZ: 0, maxX: 2, maxY: 2, maxZ: 2 }
      const aabb2 = { minX: 1, minY: 0, minZ: 0, maxX: 3, maxY: 2, maxZ: 2 }
      // overlap is 1 on X. a.maxX - b.minX = 1. sign -1. MTV is [-1, 0, 0]
      expect(getIntersectionDepth(aabb1, aabb2)[0]).toBeCloseTo(-1)
    })

    test('should return correct MTV for Y-axis overlap', () => {
      const aabb1 = { minX: 0, minY: 0, minZ: 0, maxX: 2, maxY: 2, maxZ: 2 }
      const aabb2 = { minX: 0, minY: 1, minZ: 0, maxX: 2, maxY: 3, maxZ: 2 }
      // overlap is 1 on Y. a.maxY - b.minY = 1. sign -1. MTV is [0, -1, 0]
      expect(getIntersectionDepth(aabb1, aabb2)[1]).toBeCloseTo(-1)
    })

    test('should return correct MTV for Z-axis overlap', () => {
      const aabb1 = { minX: 0, minY: 0, minZ: 0, maxX: 2, maxY: 2, maxZ: 2 }
      const aabb2 = { minX: 0, minY: 0, minZ: 1, maxX: 2, maxY: 2, maxZ: 3 }
      // overlap is 1 on Z. a.maxZ - b.minZ = 1. sign -1. MTV is [0, 0, -1]
      expect(getIntersectionDepth(aabb1, aabb2)[2]).toBeCloseTo(-1)
    })

    test('should return the minimum translation vector', () => {
      const aabb1 = { minX: 0, minY: 0, minZ: 0, maxX: 2, maxY: 2, maxZ: 2 }
      const aabb2 = { minX: 1.9, minY: 1, minZ: 1, maxX: 3, maxY: 3, maxZ: 3 }
      // x overlap = 0.1, y overlap = 1, z overlap = 1
      // min overlap is on x-axis
      const mtv = getIntersectionDepth(aabb1, aabb2)
      expect(mtv[0]).toBeCloseTo(-0.1)
      expect(mtv[1]).toBeCloseTo(0)
      expect(mtv[2]).toBeCloseTo(0)
    })
  })
})
