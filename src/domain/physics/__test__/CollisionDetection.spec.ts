import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Match, pipe } from 'effect'
import { it as effectIt } from '@effect/vitest'
import { CollisionDetection } from '../CollisionDetection'
import type { AABB } from '../types'
import type { BlockTypeId } from '../../../shared/types/branded'

describe('CollisionDetection', () => {
  const createAABB = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): AABB =>
    ({
      _tag: 'AABB' as const,
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    }) as AABB

  describe('intersectsAABB', () => {
    it.effect('should detect overlapping AABBs', () =>
      Effect.gen(function* () {
        const box1 = createAABB(0, 0, 0, 2, 2, 2)
        const box2 = createAABB(1, 1, 1, 3, 3, 3)

        expect(CollisionDetection.intersectsAABB(box1, box2)).toBe(true)
      })
    )

    it.effect('should detect non-overlapping AABBs', () =>
      Effect.gen(function* () {
        const box1 = createAABB(0, 0, 0, 1, 1, 1)
        const box2 = createAABB(2, 2, 2, 3, 3, 3)

        expect(CollisionDetection.intersectsAABB(box1, box2)).toBe(false)
      })
    )

    it.effect('should detect touching AABBs as intersecting', () =>
      Effect.gen(function* () {
        const box1 = createAABB(0, 0, 0, 1, 1, 1)
        const box2 = createAABB(1, 0, 0, 2, 1, 1)

        expect(CollisionDetection.intersectsAABB(box1, box2)).toBe(true)
      })
    )

    it.effect('should handle AABBs with negative coordinates', () =>
      Effect.gen(function* () {
        const box1 = createAABB(-2, -2, -2, 0, 0, 0)
        const box2 = createAABB(-1, -1, -1, 1, 1, 1)

        expect(CollisionDetection.intersectsAABB(box1, box2)).toBe(true)
      })
    )
  })

  describe('translateAABB', () => {
    it.effect('should translate AABB by offset', () =>
      Effect.gen(function* () {
        const box = createAABB(0, 0, 0, 1, 1, 1)
        const offset = { x: 5, y: 3, z: -2 }

        const translated = CollisionDetection.translateAABB(box, offset)

        expect(translated.min).toEqual({ x: 5, y: 3, z: -2 })
        expect(translated.max).toEqual({ x: 6, y: 4, z: -1 })
        expect(translated._tag).toBe('AABB')
      })
    )
  })

  describe('getNearbyBlockAABBs', () => {
    it.effect('should return blocks within radius', () =>
      Effect.gen(function* () {
        const position = { x: 5.5, y: 10.5, z: 5.5 }
        const radius = 1

        const blocks = CollisionDetection.getNearbyBlockAABBs(position, radius)

        // 半径1で3x3x3 = 27ブロック
        expect(blocks.length).toBeGreaterThan(0)

        // 各ブロックが正しいAABBを持つ
        blocks.forEach((block) => {
          expect(block.aabb.max.x - block.aabb.min.x).toBe(1)
          expect(block.aabb.max.y - block.aabb.min.y).toBe(1)
          expect(block.aabb.max.z - block.aabb.min.z).toBe(1)
        })
      })
    )
  })

  describe('detectCollision', () => {
    const mockGetBlockAt = (pos: { x: number; y: number; z: number }): BlockTypeId | null => {
      // Y=0に床を配置
      if (pos.y === 0) return 1 as BlockTypeId
      // X=5に壁を配置
      if (pos.x === 5) return 1 as BlockTypeId
      return null
    }

    effectIt.effect('should detect ground collision', () =>
      Effect.gen(function* () {
        const position = { x: 2, y: 2, z: 2 }
        const velocity = { x: 0, y: -60, z: 0 } // 落下中
        const entityBox = createAABB(-0.3, 0, -0.3, 0.3, 1.8, 0.3)

        const result = yield* CollisionDetection.detectCollision(position, velocity, entityBox, mockGetBlockAt)

        // 地面に衝突して停止
        expect(result.isGrounded).toBe(true)
        expect(result.velocity.y).toBe(0)
        expect(result.collidedAxes.y).toBe(true)
      })
    )

    effectIt.effect('should detect wall collision', () =>
      Effect.gen(function* () {
        const position = { x: 4, y: 2, z: 2 }
        const velocity = { x: 60, y: 0, z: 0 } // 右に移動
        const entityBox = createAABB(-0.3, 0, -0.3, 0.3, 1.8, 0.3)

        const result = yield* CollisionDetection.detectCollision(position, velocity, entityBox, mockGetBlockAt)

        // 壁に衝突して停止
        expect(result.velocity.x).toBe(0)
        expect(result.collidedAxes.x).toBe(true)
      })
    )

    // TODO: Fix step climbing test - needs better test setup
    // effectIt.effect('should handle step climbing', () =>
    //   Effect.gen(function* () {
    //     const mockGetBlockWithStep = (pos: { x: number; y: number; z: number }): BlockTypeId | null => {
    //       // Y=0に床、Y=1, X=3に段差
    //       yield* pipe(pos.y === 0, Match.value, Match.when(true, () => Effect.succeed( 1 as BlockTypeId)), Match.when(false, () => Effect.succeed(undefined)), Match.exhaustive)
    //       yield* pipe(pos.y === 1 && pos.x === 3, Match.value, Match.when(true, () => Effect.succeed( 1 as BlockTypeId)), Match.when(false, () => Effect.succeed(undefined)), Match.exhaustive)
    //       return null
    //     }

    //     const position = { x: 2.5, y: 1, z: 2 }
    //     const velocity = { x: 30, y: 0, z: 0 }
    //     const entityBox = createAABB(-0.3, 0, -0.3, 0.3, 1.8, 0.3)

    //     const result = yield* CollisionDetection.detectCollision(
    //       position,
    //       velocity,
    //       entityBox,
    //       mockGetBlockWithStep
    //     )

    //     // 0.5ブロック分上昇（階段を登る）
    //     expect(result.position.y).toBeGreaterThan(position.y)
    //   })
    // )
  })

  describe('raycast', () => {
    const mockGetBlockAt = (pos: { x: number; y: number; z: number }): BlockTypeId | null => {
      // X=10に壁を配置
      return pipe(
        Math.floor(pos.x) === 10,
        Match.value,
        Match.when(true, () => 1 as BlockTypeId),
        Match.when(false, () => null),
        Match.exhaustive
      )
    }

    effectIt.effect('should detect hit on block', () =>
      Effect.gen(function* () {
        const origin = { x: 0, y: 5, z: 5 }
        const direction = { x: 1, y: 0, z: 0 } // 右向き
        const maxDistance = 20

        const result = yield* CollisionDetection.raycast(origin, direction, maxDistance, mockGetBlockAt)

        expect(result.hit).toBe(true)
        expect(result.position?.x).toBe(10)
        expect(result.blockType).toBe(1)
      })
    )

    effectIt.effect('should return no hit when no blocks in range', () =>
      Effect.gen(function* () {
        const origin = { x: 0, y: 5, z: 5 }
        const direction = { x: -1, y: 0, z: 0 } // 左向き（壁と反対）
        const maxDistance = 5

        const result = yield* CollisionDetection.raycast(origin, direction, maxDistance, mockGetBlockAt)

        expect(result.hit).toBe(false)
        expect(result.position).toBeUndefined()
        expect(result.blockType).toBeUndefined()
      })
    )
  })
})
