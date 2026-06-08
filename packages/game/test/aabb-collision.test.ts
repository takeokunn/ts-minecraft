import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { resolveBlockCollisions } from '@ts-minecraft/game'

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

    it('falling onto a 2-block stack lands on TOP (highest floor wins, not embedded in the upper block)', () => {
      // Solid blocks at by=4 AND by=5 (a 2-tall stack). The player's 1.8-tall
      // bounding box overlaps BOTH while falling. The multi-block Y scan must
      // pick the HIGHEST floor (top of by=5 = 6) so the player ends up standing
      // ON the stack — a single-block resolver would snap to 5 (feet at 5.0),
      // leaving the player embedded inside block by=5.
      const feetY = 4.5
      const centerY = feetY + HALF_H // 5.4 → headY = 6.3, spans by=4 and by=5
      const pos = { x: 0, y: centerY, z: 0 }
      const vel = { x: 0, y: -1, z: 0 }
      const solid = (_bx: number, by: number, _bz: number): boolean => by === 4 || by === 5

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, solid)

      expect(result.isGrounded).toBe(true)
      expect(result.velocity.y).toBe(0)
      // Top of the stack is y=6; feet there, centre at 6 + halfH = 6.9.
      expect(result.position.y).toBeCloseTo(6 + HALF_H, 5)
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

    it('player hitting a wall from the right (vx>0, block at x=4): x clamped, vx=0', () => {
      // Player center x=3.75, halfW=0.3, rightEdge=4.05
      // bxFace=Math.floor(4.05-epsilon)=4. block at bx=4 → solid
      // x = 4 - 0.3 = 3.7, vx=0
      const pos = { x: 3.75, y: 5, z: 0 }
      const vel = { x: 1, y: 0, z: 0 }
      const solid = (bx: number, _by: number, _bz: number): boolean => bx === 4

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, solid)

      expect(result.velocity.x).toBe(0)
      expect(result.position.x).toBeCloseTo(4 - HALF_W, 5)
    })
  })

  describe('Z axis — wall collision', () => {
    it('player moving toward negative Z (vz<0, block at z=1): z pushed out, vz=0', () => {
      // Player center z=2.25, halfW=0.3, frontEdge=1.95
      // bzFace=Math.floor(1.95)=1. block at bz=1 → solid
      // z = 1+1+0.3 = 2.3, vz=0
      const pos = { x: 0, y: 5, z: 2.25 }
      const vel = { x: 0, y: 0, z: -1 }
      const solid = (_bx: number, _by: number, bz: number): boolean => bz === 1

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, solid)

      expect(result.velocity.z).toBe(0)
      expect(result.position.z).toBeCloseTo(1 + 1 + HALF_W, 5)
    })

    it('player moving toward positive Z (vz>0, block at z=4): z clamped, vz=0', () => {
      // Player center z=3.75, halfW=0.3, backEdge=4.05
      // bzFace=Math.floor(4.05-epsilon)=4. block at bz=4 → solid
      // z = 4 - 0.3 = 3.7, vz=0
      const pos = { x: 0, y: 5, z: 3.75 }
      const vel = { x: 0, y: 0, z: 1 }
      const solid = (_bx: number, _by: number, bz: number): boolean => bz === 4

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, solid)

      expect(result.velocity.z).toBe(0)
      expect(result.position.z).toBeCloseTo(4 - HALF_W, 5)
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

  describe('wall collision does not teleport the player vertically (regression: wall-climb)', () => {
    it('walking into a wall keeps the player on the floor (does NOT climb the wall)', () => {
      // Ground at by=9 everywhere; a 4-tall wall column at bx=5 standing on it.
      const FLOOR_BY = 9
      const WALL_BX = 5
      const solid = (bx: number, by: number, _bz: number): boolean =>
        by === FLOOR_BY || (bx === WALL_BX && by > FLOOR_BY && by <= FLOOR_BY + 4)
      // Grounded on the floor (feet slightly penetrating its top); right edge in the wall.
      const feetY = FLOOR_BY + 1 - 0.01 // 9.99
      const pos = { x: 4.75, y: feetY + HALF_H, z: 0 } // right edge x=5.05 penetrates wall [5,6]
      const vel = { x: 1, y: -0.1, z: 0 } // grounded walk into the wall

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, solid)

      // Stays on the floor top (10 + halfH = 10.9) — NOT snapped onto the wall top (~14.9).
      expect(result.position.y).toBeCloseTo(FLOOR_BY + 1 + HALF_H, 5)
      expect(result.isGrounded).toBe(true)
      // Pushed out of the wall horizontally (right edge flush with the wall face).
      expect(result.position.x).toBeCloseTo(WALL_BX - HALF_W, 5)
      expect(result.velocity.x).toBe(0)
    })

    it('jumping into a wall is not snapped downward (ceiling guard)', () => {
      const WALL_BX = 5
      const solid = (bx: number, _by: number, _bz: number): boolean => bx === WALL_BX
      const startY = 20
      const pos = { x: 4.75, y: startY, z: 0 } // right edge penetrates the wall column
      const vel = { x: 1, y: 3, z: 0 } // jumping up + into the wall

      const result = resolveBlockCollisions(pos, vel, HALF_W, HALF_H, solid)

      // Not snapped down: y unchanged, upward velocity preserved (the X phase stops vx).
      expect(result.position.y).toBe(startY)
      expect(result.velocity.y).toBe(3)
      expect(result.velocity.x).toBe(0)
    })
  })
})
