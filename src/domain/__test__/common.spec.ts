import * as S from 'effect/Schema'
import { describe, expect, it } from 'vitest'
import { Vector3FloatSchema, Vector3IntSchema } from '../common'

describe('Common Schemas', () => {
  describe('Vector Schemas', () => {
    it.each([
      { schema: Vector3FloatSchema, value: [1.1, 2.2, 3.3] as const },
      { schema: Vector3IntSchema, value: [1, 2, 3] as const },
    ])('should encode and decode $value', ({ schema, value }) => {
      const encode = S.encodeSync(schema)
      const decode = S.decodeSync(schema)
      const encoded = encode(value)
      const decoded = decode(encoded)
      expect(decoded).toEqual(value)
    })
  })
})