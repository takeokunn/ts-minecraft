/**
 * ECS Component テスト
 *
 * Schema.Struct定義、型安全性、シリアライズ可能性の検証
 */

import { describe, it, expect } from 'vitest'
import { Schema } from '@effect/schema'
import { PositionComponent, VelocityComponent } from '../Component'

describe('ECS Components', () => {
  describe('PositionComponent', () => {
    it('should create valid position component', () => {
      const position = { x: 10, y: 20, z: 30 }
      const result = Schema.decodeUnknownSync(PositionComponent)(position)

      expect(result).toEqual(position)
      expect(result.x).toBe(10)
      expect(result.y).toBe(20)
      expect(result.z).toBe(30)
    })

    it('should be serializable to JSON', () => {
      const position = { x: 1.5, y: -2.3, z: 4.7 }
      const decoded = Schema.decodeUnknownSync(PositionComponent)(position)
      const json = JSON.stringify(decoded)
      const parsed = JSON.parse(json)

      expect(parsed).toEqual(position)
    })

    it('should validate numeric values', () => {
      expect(() => {
        Schema.decodeUnknownSync(PositionComponent)({ x: 'invalid', y: 20, z: 30 })
      }).toThrow()
    })

    it('should require all coordinates', () => {
      expect(() => {
        Schema.decodeUnknownSync(PositionComponent)({ x: 10, y: 20 })
      }).toThrow()
    })
  })

  describe('VelocityComponent', () => {
    it('should create valid velocity component', () => {
      const velocity = { vx: 1.5, vy: -0.5, vz: 2.0 }
      const result = Schema.decodeUnknownSync(VelocityComponent)(velocity)

      expect(result).toEqual(velocity)
      expect(result.vx).toBe(1.5)
      expect(result.vy).toBe(-0.5)
      expect(result.vz).toBe(2.0)
    })

    it('should be serializable to JSON', () => {
      const velocity = { vx: 0.1, vy: 0.2, vz: 0.3 }
      const decoded = Schema.decodeUnknownSync(VelocityComponent)(velocity)
      const json = JSON.stringify(decoded)
      const parsed = JSON.parse(json)

      expect(parsed).toEqual(velocity)
    })

    it('should validate numeric values', () => {
      expect(() => {
        Schema.decodeUnknownSync(VelocityComponent)({ vx: 1, vy: 'invalid', vz: 3 })
      }).toThrow()
    })

    it('should require all velocity components', () => {
      expect(() => {
        Schema.decodeUnknownSync(VelocityComponent)({ vx: 1, vy: 2 })
      }).toThrow()
    })
  })
})
