/**
 * ECS Component テスト
 *
 * Schema.Struct定義、型安全性、シリアライズ可能性の検証
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Schema , Effect} from 'effect'
import { PositionComponent, VelocityComponent } from '../Component'

describe('ECS Components', () => {
  describe('PositionComponent', () => {
  it.effect('should create valid position component', () => Effect.gen(function* () {
    const position = { x: 10, y: 20, z: 30 }
    const result = Schema.decodeUnknownSync(PositionComponent)(position)
    expect(result).toEqual(position)
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
    expect(result.z).toBe(30)
})
),
  Effect.gen(function* () {
        const position = { x: 1.5, y: -2.3, z: 4.7 }
        const decoded = Schema.decodeUnknownSync(PositionComponent)(position)
        const json = JSON.stringify(decoded)
        const parsed = JSON.parse(json)
        expect(parsed).toEqual(position)

      })
    it.effect('should validate numeric values', () => Effect.gen(function* () {
    expect(() => {
    Schema.decodeUnknownSync(PositionComponent)({ x: 'invalid', y: 20, z: 30
    )
    }).toThrow()
    it.effect('should require all coordinates', () => Effect.gen(function* () {
    expect(() => {
    Schema.decodeUnknownSync(PositionComponent)({ x: 10, y: 20
    )
    }).toThrow()
    describe('VelocityComponent', () => {
    it.effect('should create valid velocity component', () => Effect.gen(function* () {
    const velocity = { vx: 1.5, vy: -0.5, vz: 2.0 }
    const result = Schema.decodeUnknownSync(VelocityComponent)(velocity)
    expect(result).toEqual(velocity)
    expect(result.vx).toBe(1.5)
    expect(result.vy).toBe(-0.5)
    expect(result.vz).toBe(2.0)
})
),
  Effect.gen(function* () {
        const velocity = { vx: 0.1, vy: 0.2, vz: 0.3 }
        const decoded = Schema.decodeUnknownSync(VelocityComponent)(velocity)
        const json = JSON.stringify(decoded)
        const parsed = JSON.parse(json)
        expect(parsed).toEqual(velocity)

      })
    it.effect('should validate numeric values', () => Effect.gen(function* () {
    expect(() => {
    Schema.decodeUnknownSync(VelocityComponent)({ vx: 1, vy: 'invalid', vz: 3
  })
).toThrow()
    })

    it.effect('should require all velocity components', () => Effect.gen(function* () {
    expect(() => {
    Schema.decodeUnknownSync(VelocityComponent)({ vx: 1, vy: 2
  })
).toThrow()
    })
  })
})
