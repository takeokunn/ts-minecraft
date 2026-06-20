import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { HashSet } from 'effect'
import { positionFromKey, positionKey, toBlockPosition } from '@ts-minecraft/entity/domain/redstone/redstone-position-utils';

describe('redstone/redstone-position-utils', () => {
  describe('toBlockPosition', () => {
    it('floors positive float coordinates', () => {
      const result = toBlockPosition({ x: 1.9, y: 2.1, z: 3.7 })
      expect(result).toEqual({ x: 1, y: 2, z: 3 })
    })

    it('floors negative float coordinates (towards negative infinity)', () => {
      const result = toBlockPosition({ x: -0.5, y: 64, z: -0.5 })
      expect(result).toEqual({ x: -1, y: 64, z: -1 })
    })

    it('leaves integer coordinates unchanged', () => {
      const result = toBlockPosition({ x: 5, y: 64, z: -10 })
      expect(result).toEqual({ x: 5, y: 64, z: -10 })
    })
  })

  describe('positionKey + positionFromKey roundtrip', () => {
    it('recovers the same integer coordinates after roundtrip', () => {
      const pos = { x: 10, y: 64, z: -5 }
      const key = positionKey(pos)
      const recovered = positionFromKey(key)
      expect(recovered).toEqual(pos)
    })

    it('recovers coordinates for origin', () => {
      const pos = { x: 0, y: 0, z: 0 }
      const key = positionKey(pos)
      const recovered = positionFromKey(key)
      expect(recovered).toEqual(pos)
    })

    it('recovers coordinates for negative positions', () => {
      const pos = { x: -100, y: 32, z: -200 }
      const key = positionKey(pos)
      const recovered = positionFromKey(key)
      expect(recovered).toEqual(pos)
    })

    it('recovers float input as floored integer coordinates', () => {
      const pos = { x: 3.7, y: 64, z: -2.9 }
      const key = positionKey(pos)
      const recovered = positionFromKey(key)
      expect(recovered).toEqual({ x: 3, y: 64, z: -3 })
    })

    it('distinct positions produce distinct keys', () => {
      const a = positionKey({ x: 0, y: 64, z: 0 })
      const b = positionKey({ x: 1, y: 64, z: 0 })
      const c = positionKey({ x: 0, y: 65, z: 0 })
      const d = positionKey({ x: 0, y: 64, z: 1 })
      const keys = [a, b, c, d]
      const unique = HashSet.fromIterable(keys)
      expect(HashSet.size(unique)).toBe(4)
    })
  })
})
