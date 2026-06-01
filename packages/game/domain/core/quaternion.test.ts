import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { identity, QuaternionSchema } from './quaternion'

describe('domain/core/quaternion', () => {
  describe('identity', () => {
    it('represents the no-rotation quaternion', () => {
      expect(identity).toEqual({ x: 0, y: 0, z: 0, w: 1 })
    })

    it('w component is 1 (no rotation)', () => {
      expect(identity.w).toBe(1)
    })

    it('xyz components are all 0 (no rotation axis)', () => {
      expect(identity.x).toBe(0)
      expect(identity.y).toBe(0)
      expect(identity.z).toBe(0)
    })
  })

  describe('QuaternionSchema (re-export)', () => {
    it('accepts a valid unit quaternion', () => {
      const result = Schema.decodeUnknownSync(QuaternionSchema)({ x: 0, y: 0, z: 0, w: 1 })
      expect(result).toEqual({ x: 0, y: 0, z: 0, w: 1 })
    })

    it('accepts the identity quaternion directly', () => {
      const result = Schema.decodeUnknownSync(QuaternionSchema)(identity)
      expect((result as typeof identity).w).toBe(1)
    })
  })
})
