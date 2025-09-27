import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import { Gravity } from '../Gravity'
import { PHYSICS_CONSTANTS } from '../types'

describe('Gravity System', () => {
  describe('apply', () => {
    it.effect('should apply gravity to velocity', () =>
      Effect.gen(function* () {
        const initialVelocity = { x: 0, y: 0, z: 0 }
        const deltaTime = 1 / 60 // 60 FPS

        const result = yield* Gravity.apply(initialVelocity, deltaTime, false)

        // 重力により Y速度が減少するはず
        expect(result.y).toBeLessThan(0)
        expect(result.y).toBeCloseTo(-PHYSICS_CONSTANTS.GRAVITY * deltaTime, 5)
        expect(result.x).toBe(0)
        expect(result.z).toBe(0)
      })
    )

    it.effect('should respect terminal velocity', () =>
      Effect.gen(function* () {
        const fallingVelocity = { x: 0, y: -100, z: 0 } // 既に高速で落下
        const deltaTime = 1 / 60

        const result = yield* Gravity.apply(fallingVelocity, deltaTime, false)

        // 終端速度を超えないはず
        expect(result.y).toBeGreaterThanOrEqual(-PHYSICS_CONSTANTS.TERMINAL_VELOCITY)
      })
    )

    it.effect('should apply reduced gravity in fluids', () =>
      Effect.gen(function* () {
        const velocity = { x: 0, y: 0, z: 0 }
        const deltaTime = 1 / 60

        const normalResult = yield* Gravity.apply(velocity, deltaTime, false)
        const fluidResult = yield* Gravity.apply(velocity, deltaTime, true)

        // 流体内では重力が40%に減少
        expect(Math.abs(fluidResult.y)).toBeLessThan(Math.abs(normalResult.y))
        expect(Math.abs(fluidResult.y)).toBeCloseTo(Math.abs(normalResult.y) * 0.4, 5)
      })
    )
  })

  describe('calculateJumpVelocity', () => {
    it.effect('should calculate correct jump velocity for target height', () =>
      Effect.gen(function* () {
        // 1.25ブロックジャンプ（Minecraftのデフォルト）
        const jumpHeight = 1.25
        const jumpVelocity = Gravity.calculateJumpVelocity(jumpHeight)

        // v = √(2gh)の物理公式で検証
        const expectedVelocity = Math.sqrt(2 * PHYSICS_CONSTANTS.GRAVITY * jumpHeight)
        expect(jumpVelocity).toBeCloseTo(expectedVelocity, 5)
      })
    )

    it.effect('should scale with jump height', () =>
      Effect.gen(function* () {
        const velocity1 = Gravity.calculateJumpVelocity(1)
        const velocity2 = Gravity.calculateJumpVelocity(4)

        // 高いジャンプほど初速度が大きい
        expect(velocity2).toBeGreaterThan(velocity1)
        // √4 = 2倍の関係
        expect(velocity2).toBeCloseTo(velocity1 * 2, 5)
      })
    )
  })

  describe('calculateFallDamage', () => {
    it.effect('should not cause damage for falls under 3 blocks', () =>
      Effect.gen(function* () {
        expect(Gravity.calculateFallDamage(0)).toBe(0)
        expect(Gravity.calculateFallDamage(1)).toBe(0)
        expect(Gravity.calculateFallDamage(2)).toBe(0)
        expect(Gravity.calculateFallDamage(3)).toBe(0)
      })
    )

    it.effect('should calculate damage for falls over 3 blocks', () =>
      Effect.gen(function* () {
        expect(Gravity.calculateFallDamage(4)).toBe(0.5) // 1ハート
        expect(Gravity.calculateFallDamage(5)).toBe(1.0) // 2ハート
        expect(Gravity.calculateFallDamage(10)).toBe(3.5) // 7ハート
        expect(Gravity.calculateFallDamage(23)).toBe(10) // 20ハート（致死）
      })
    )
  })

  describe('applyAirResistance', () => {
    it.effect('should reduce horizontal velocity', () =>
      Effect.gen(function* () {
        const velocity = { x: 10, y: -5, z: 8 }

        const result = yield* Gravity.applyAirResistance(velocity)

        // X/Z軸に空気抵抗を適用
        expect(result.x).toBeCloseTo(velocity.x * PHYSICS_CONSTANTS.AIR_RESISTANCE, 5)
        expect(result.z).toBeCloseTo(velocity.z * PHYSICS_CONSTANTS.AIR_RESISTANCE, 5)
        // Y軸は変更なし
        expect(result.y).toBe(velocity.y)
      })
    )

    it.effect('should not affect vertical velocity', () =>
      Effect.gen(function* () {
        const velocity = { x: 0, y: -50, z: 0 }

        const result = yield* Gravity.applyAirResistance(velocity)

        // Y軸は重力で制御するため空気抵抗なし
        expect(result.y).toBe(velocity.y)
      })
    )
  })
})
