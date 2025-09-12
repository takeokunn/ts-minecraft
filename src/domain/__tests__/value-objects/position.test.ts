/**
 * Position Value Object Tests
 * 
 * Example test structure for domain value objects using Effect-TS testing patterns
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { Position } from '@domain/value-objects/coordinates'

describe('Position Value Object', () => {
  describe('creation', () => {
    it('should create a valid position with integer coordinates', async () => {
      const result = await Effect.runPromise(
        Position.make({ x: 10, y: 20, z: 30 })
      )
      
      expect(result.x).toBe(10)
      expect(result.y).toBe(20)
      expect(result.z).toBe(30)
    })

    it('should handle floating point coordinates', async () => {
      const result = await Effect.runPromise(
        Position.make({ x: 10.5, y: 20.7, z: -30.2 })
      )
      
      expect(result.x).toBe(10.5)
      expect(result.y).toBe(20.7)
      expect(result.z).toBe(-30.2)
    })

    it('should fail with invalid coordinates', async () => {
      const invalidPosition = Position.make({ x: NaN, y: 20, z: 30 })
      
      const result = await Effect.runPromise(Effect.either(invalidPosition))
      
      expect(result._tag).toBe('Left')
    })
  })

  describe('operations', () => {
    it('should calculate distance between positions', async () => {
      const pos1 = await Effect.runPromise(Position.make({ x: 0, y: 0, z: 0 }))
      const pos2 = await Effect.runPromise(Position.make({ x: 3, y: 4, z: 0 }))
      
      const distance = Position.distance(pos1, pos2)
      expect(distance).toBe(5) // 3-4-5 triangle
    })

    it('should normalize position vectors', async () => {
      const position = await Effect.runPromise(Position.make({ x: 3, y: 4, z: 0 }))
      const normalized = Position.normalize(position)
      
      expect(Math.abs(Position.magnitude(normalized) - 1)).toBeLessThan(0.001)
    })
  })
})