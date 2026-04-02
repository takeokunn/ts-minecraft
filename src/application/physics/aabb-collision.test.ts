import { describe, it, expect } from 'vitest'
import { resolveBlockCollisions } from './aabb-collision'

const HALF_W = 0.3
const HALF_H = 0.9

const noBlocks = (_bx: number, _by: number, _bz: number): boolean => false

describe('resolveBlockCollisions', () => {
  describe('Y axis — grounded', () => {
    it('player standing on a block (center y=5.9, feet=5.0) with vy=0 is grounded, y unchanged', () => {
      // Player center y=5.9, feet=5.9-0.9=5.0 exactly on block top at y=5
      // vy=0 → treated as moving down (vy<=0), so maxFloorY=5+1=6 if feet<blockTop
      // feet=5.0, headY=5.0+1.8=6.8, block at by=5: blockTop=6, blockBot=5
      // headY(6.8)>blockBot(5) && feetY(5.0)<blockTop(6) → overlap → maxFloorY=6
      // y = 6 + 0.9 = 6.9 … that's above initial y=5.9.
      // Actually let's test a player clearly standing: center y=6, feet=5.1
      const pos = { x: 0, y: 6, z: 0 }
      const vel = { x: 0, y: 0, z: 0 }
      const solid = (_bx: number, by: number, _bz: number): boolean => by === 5

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, solid)

      expect(result.isGrounded).toBe(true)
      expect(result.velocity.y).toBe(0)
    })

    it('player falling onto a block: feet at 4.99, vy=-1 → pushed to blockTop+halfH', () => {
      // Block at by=4 (blockTop=5). Player center y=4.99+0.9=5.89, feet=4.99
      // headY=5.89+0.9=6.79, feetY=4.99, by=4: blockTop=5, blockBot=4
      // headY(6.79)>4 && feetY(4.99)<5 → overlap. vy=-1 ≤ 0 → floor. maxFloorY=5
      // y = 5 + 0.9 = 5.9, vy=0, isGrounded=true
      const feetY = 4.99
      const centerY = feetY + HALF_H
      const pos = { x: 0, y: centerY, z: 0 }
      const vel = { x: 0, y: -1, z: 0 }
      const solid = (_bx: number, by: number, _bz: number): boolean => by === 4

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, solid)

      expect(result.isGrounded).toBe(true)
      expect(result.velocity.y).toBe(0)
      expect(result.position.y).toBeCloseTo(5 + HALF_H, 5)
    })

    it('player in air (no block below): not grounded, y unchanged', () => {
      const pos = { x: 0, y: 10, z: 0 }
      const vel = { x: 0, y: -1, z: 0 }

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, noBlocks)

      expect(result.isGrounded).toBe(false)
      expect(result.position.y).toBe(10)
      expect(result.velocity.y).toBe(-1)
    })
  })

  describe('Y axis — ceiling', () => {
    it('player hitting ceiling (vy>0, block above): y pushed down, vy=0, isGrounded=false', () => {
      // Player center y=5, halfH=0.9, headY=5.9
      // Block at by=5: blockTop=6, blockBot=5
      // headY(5.9)>5 && feetY(4.1)<6 → overlap. vy=3>0 → ceiling. minCeilY=5
      // y = 5 - 0.9 = 4.1, vy=0, isGrounded stays false
      const pos = { x: 0, y: 5, z: 0 }
      const vel = { x: 0, y: 3, z: 0 }
      const solid = (_bx: number, by: number, _bz: number): boolean => by === 5

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, solid)

      expect(result.isGrounded).toBe(false)
      expect(result.velocity.y).toBe(0)
      expect(result.position.y).toBeCloseTo(5 - HALF_H, 5)
    })
  })

  describe('X axis — wall collision', () => {
    it('player hitting a wall from the left (vx<0, block at x=3): x pushed to 3+1+halfW, vx=0', () => {
      // Player center x=3.25, halfW=0.3, leftEdge=2.95
      // bxFace=Math.floor(2.95)=2. block at bx=2 → solid
      // x = 2+1+0.3 = 3.3, vx=0
      const pos = { x: 3.25, y: 5, z: 0 }
      const vel = { x: -1, y: 0, z: 0 }
      const solid = (bx: number, _by: number, _bz: number): boolean => bx === 2

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, solid)

      expect(result.velocity.x).toBe(0)
      expect(result.position.x).toBeCloseTo(2 + 1 + HALF_W, 5)
    })
  })

  describe('no blocks — no change', () => {
    it('isBlockSolid returning false for all: no changes, isGrounded=false', () => {
      const pos = { x: 5, y: 10, z: 5 }
      const vel = { x: 1, y: -2, z: 0.5 }

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, noBlocks)

      expect(result.isGrounded).toBe(false)
      expect(result.position.x).toBe(5)
      expect(result.position.y).toBe(10)
      expect(result.position.z).toBe(5)
      expect(result.velocity.x).toBe(1)
      expect(result.velocity.y).toBe(-2)
      expect(result.velocity.z).toBe(0.5)
    })
  })
})
