import { test } from '@fast-check/vitest'
import * as S from 'effect/Schema'
import { describe, expect } from 'vitest'
import * as fc from 'fast-check'
import * as C from '../common'

const vector3FloatArbitrary = fc.record({
  x: fc.float(),
  y: fc.float(),
  z: fc.float(),
})

const vector3IntArbitrary = fc.record({
  x: fc.integer(),
  y: fc.integer(),
  z: fc.integer(),
})

const schemas = {
  Vector3FloatSchema: { schema: C.Vector3FloatSchema, arbitrary: vector3FloatArbitrary },
  Vector3IntSchema: { schema: C.Vector3IntSchema, arbitrary: vector3IntArbitrary },
}

describe('Common Schemas', () => {
  for (const [name, { schema, arbitrary }] of Object.entries(schemas)) {
    test.prop([arbitrary])(`${name} should be reversible after encoding and decoding`, (value) => {
      const encode = S.encodeSync(schema as S.Schema<typeof value, any>)
      const decode = S.decodeSync(schema as S.Schema<typeof value, any>)
      expect(decode(encode(value))).toEqual(value)
    })
  }
})

