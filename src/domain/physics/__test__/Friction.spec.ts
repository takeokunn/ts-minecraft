import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { Friction } from '../Friction'
import { BLOCK_FRICTION } from '../types'
import type { BlockTypeId } from '../../../shared/types/branded'

describe('Friction System', () => {
  describe('getFrictionCoefficient', () => {
    it.effect('should return correct friction for known blocks', () =>
      Effect.gen(function* () {
        expect(Friction.getFrictionCoefficient(1 as BlockTypeId)).toBe(0.6) // Stone
        expect(Friction.getFrictionCoefficient(79 as BlockTypeId)).toBe(0.98) // Ice
        expect(Friction.getFrictionCoefficient(174 as BlockTypeId)).toBe(0.98) // Packed ice
      })
    )

    it.effect('should return default friction for unknown blocks', () =>
      Effect.gen(function* () {
        expect(Friction.getFrictionCoefficient(999 as BlockTypeId)).toBe(BLOCK_FRICTION[0])
      })
    )
  })

  describe('applyGroundFriction', () => {
    it.effect('should apply friction when grounded', () =>
      Effect.gen(function* () {
        const velocity = { x: 10, y: 0, z: 8 }
        const blockType = 1 as BlockTypeId // Stone

        const result = yield* Friction.applyGroundFriction(velocity, true, blockType)

        // 摩擦により水平速度が減少
        expect(result.x).toBeLessThan(velocity.x)
        expect(result.z).toBeLessThan(velocity.z)
        expect(result.x).toBeCloseTo(velocity.x * 0.6, 5)
        expect(result.z).toBeCloseTo(velocity.z * 0.6, 5)
        // Y軸は変更なし
        expect(result.y).toBe(velocity.y)
      })
    )

    it.effect('should not apply friction when airborne', () =>
      Effect.gen(function* () {
        const velocity = { x: 10, y: -5, z: 8 }
        const blockType = 1 as BlockTypeId

        const result = yield* Friction.applyGroundFriction(velocity, false, blockType)

        // 空中では摩擦なし
        expect(result).toEqual(velocity)
      })
    )

    it.effect('should apply ice friction correctly', () =>
      Effect.gen(function* () {
        const velocity = { x: 10, y: 0, z: 10 }
        const iceBlock = 79 as BlockTypeId

        const result = yield* Friction.applyGroundFriction(velocity, true, iceBlock)

        // 氷の上では摩擦が非常に小さい（0.98）
        expect(result.x).toBeCloseTo(velocity.x * 0.98, 5)
        expect(result.z).toBeCloseTo(velocity.z * 0.98, 5)
      })
    )
  })

  describe('applyMovementFriction', () => {
    it.effect('should apply normal movement on ground', () =>
      Effect.gen(function* () {
        const velocity = { x: 0, y: 0, z: 0 }
        const inputVelocity = { x: 5, y: 0, z: 3 }
        const blockType = 1 as BlockTypeId

        const result = yield* Friction.applyMovementFriction(velocity, inputVelocity, true, blockType)

        // 通常の地面では入力速度がそのまま適用
        expect(result.x).toBe(inputVelocity.x)
        expect(result.z).toBe(inputVelocity.z)
      })
    )

    it.effect('should apply reduced control in air', () =>
      Effect.gen(function* () {
        const velocity = { x: 10, y: -5, z: 10 }
        const inputVelocity = { x: 5, y: 0, z: 5 }
        const blockType = 1 as BlockTypeId

        const result = yield* Friction.applyMovementFriction(velocity, inputVelocity, false, blockType)

        // 空中では制御が20%に減少
        expect(result.x).toBeCloseTo(velocity.x + inputVelocity.x * 0.2, 5)
        expect(result.z).toBeCloseTo(velocity.z + inputVelocity.z * 0.2, 5)
      })
    )

    it.effect('should apply ice skating effect', () =>
      Effect.gen(function* () {
        const velocity = { x: 10, y: 0, z: 10 }
        const inputVelocity = { x: 5, y: 0, z: 5 }
        const iceBlock = 79 as BlockTypeId

        const result = yield* Friction.applyMovementFriction(velocity, inputVelocity, true, iceBlock)

        // 氷の上では慣性が強く、新しい入力の影響が小さい
        expect(result.x).toBeCloseTo(velocity.x * 0.98 + inputVelocity.x * 0.1, 5)
        expect(result.z).toBeCloseTo(velocity.z * 0.98 + inputVelocity.z * 0.1, 5)
      })
    )
  })

  describe('applySneakFriction', () => {
    it.effect('should reduce velocity when sneaking on ground', () =>
      Effect.gen(function* () {
        const velocity = { x: 5, y: 0, z: 5 }

        const result = yield* Friction.applySneakFriction(velocity, true)

        // スニーク時は速度が30%に減少
        expect(result.x).toBeCloseTo(velocity.x * 0.3, 5)
        expect(result.z).toBeCloseTo(velocity.z * 0.3, 5)
        expect(result.y).toBe(velocity.y)
      })
    )

    it.effect('should not affect velocity when sneaking in air', () =>
      Effect.gen(function* () {
        const velocity = { x: 5, y: -10, z: 5 }

        const result = yield* Friction.applySneakFriction(velocity, false)

        // 空中ではスニークの効果なし
        expect(result).toEqual(velocity)
      })
    )
  })

  describe('clampVelocity', () => {
    it.effect('should not affect velocity below max speed', () =>
      Effect.gen(function* () {
        const velocity = { x: 3, y: -5, z: 4 } // 水平速度 = 5
        const maxSpeed = 10

        const result = Friction.clampVelocity(velocity, maxSpeed)

        expect(result).toEqual(velocity)
      })
    )

    it.effect('should clamp velocity above max speed', () =>
      Effect.gen(function* () {
        const velocity = { x: 10, y: -5, z: 10 } // 水平速度 = √200 ≈ 14.14
        const maxSpeed = 10

        const result = Friction.clampVelocity(velocity, maxSpeed)

        // 水平速度が制限される
        const resultSpeed = Math.sqrt(result.x * result.x + result.z * result.z)
        expect(resultSpeed).toBeCloseTo(maxSpeed, 5)
        // Y軸は変更なし
        expect(result.y).toBe(velocity.y)
      })
    )
  })

  describe('applyDeadZone', () => {
    it.effect('should zero out tiny velocities', () =>
      Effect.gen(function* () {
        const velocity = { x: 0.0005, y: -0.0001, z: 0.0008 }

        const result = Friction.applyDeadZone(velocity, 0.001)

        expect(result.x).toBe(0)
        expect(result.y).toBe(0)
        expect(result.z).toBe(0)
      })
    )

    it.effect('should preserve significant velocities', () =>
      Effect.gen(function* () {
        const velocity = { x: 0.1, y: -0.5, z: 0.002 }

        const result = Friction.applyDeadZone(velocity, 0.001)

        expect(result.x).toBe(velocity.x)
        expect(result.y).toBe(velocity.y)
        expect(result.z).toBeCloseTo(velocity.z, 5)
      })
    )
  })
})
