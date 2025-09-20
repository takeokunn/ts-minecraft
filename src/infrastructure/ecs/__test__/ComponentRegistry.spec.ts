/**
 * ECS Component Registry テスト
 *
 * コンポーネント管理システムの型安全性とシリアライズ対応を検証
 */

import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import { ComponentRegistry, ComponentUnion } from '../ComponentRegistry'

describe('ECS Component Registry', () => {
  describe('ComponentRegistry', () => {
    it('should create empty registry', () => {
      const registry = {}
      const result = Schema.decodeUnknownSync(ComponentRegistry)(registry)

      expect(result).toEqual({})
    })

    it('should create registry with position component', () => {
      const registry = {
        position: { x: 10, y: 20, z: 30 },
      }
      const result = Schema.decodeUnknownSync(ComponentRegistry)(registry)

      expect(result.position).toEqual({ x: 10, y: 20, z: 30 })
      expect(result.velocity).toBeUndefined()
    })

    it('should create registry with velocity component', () => {
      const registry = {
        velocity: { vx: 1.5, vy: -0.5, vz: 2.0 },
      }
      const result = Schema.decodeUnknownSync(ComponentRegistry)(registry)

      expect(result.velocity).toEqual({ vx: 1.5, vy: -0.5, vz: 2.0 })
      expect(result.position).toBeUndefined()
    })

    it('should create registry with both components', () => {
      const registry = {
        position: { x: 10, y: 20, z: 30 },
        velocity: { vx: 1.5, vy: -0.5, vz: 2.0 },
      }
      const result = Schema.decodeUnknownSync(ComponentRegistry)(registry)

      expect(result.position).toEqual({ x: 10, y: 20, z: 30 })
      expect(result.velocity).toEqual({ vx: 1.5, vy: -0.5, vz: 2.0 })
    })

    it('should be serializable to JSON', () => {
      const registry = {
        position: { x: 1.1, y: 2.2, z: 3.3 },
        velocity: { vx: 0.1, vy: 0.2, vz: 0.3 },
      }
      const decoded = Schema.decodeUnknownSync(ComponentRegistry)(registry)
      const json = JSON.stringify(decoded)
      const parsed = JSON.parse(json)

      expect(parsed).toEqual(registry)
    })
  })

  describe('ComponentUnion', () => {
    it('should decode position component', () => {
      const position = { x: 10, y: 20, z: 30 }
      const result = Schema.decodeUnknownSync(ComponentUnion)(position)

      expect(result).toEqual(position)
    })

    it('should decode velocity component', () => {
      const velocity = { vx: 1.5, vy: -0.5, vz: 2.0 }
      const result = Schema.decodeUnknownSync(ComponentUnion)(velocity)

      expect(result).toEqual(velocity)
    })

    it('should reject invalid component', () => {
      expect(() => {
        Schema.decodeUnknownSync(ComponentUnion)({ invalid: 'data' })
      }).toThrow()
    })
  })
})
