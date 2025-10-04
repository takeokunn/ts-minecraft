import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import {
  PositiveFloatSchema,
  NonNegativeFloatSchema,
  UnitIntervalSchema,
  Vector3Schema,
  AABBSchema,
  parsePositiveFloat,
  parseNonNegativeFloat,
  parseUnitInterval,
  parseVector3,
  parseAABB,
} from '../core'

const expectIssue = async (effect: Effect.Effect<unknown, unknown>) => {
  const exit = await Effect.runPromiseExit(effect)
  expect(exit._tag).toBe('Failure')
}

describe('physics/types/core', () => {
  describe('schema success cases', () => {
    it('PositiveFloatSchema accepts positive numbers', async () => {
      const value = await Effect.runPromise(Schema.decodeUnknown(PositiveFloatSchema)(0.5))
      expect(value).toBeGreaterThan(0)
    })

    it('NonNegativeFloatSchema accepts zero', async () => {
      const value = await Effect.runPromise(Schema.decodeUnknown(NonNegativeFloatSchema)(0))
      expect(value).toBe(0)
    })

    it('UnitIntervalSchema clamps to [0,1]', async () => {
      const value = await Effect.runPromise(Schema.decodeUnknown(UnitIntervalSchema)(1))
      expect(value).toBe(1)
    })

    it('Vector3Schema parses vector shape', async () => {
      const vector = await Effect.runPromise(
        Schema.decodeUnknown(Vector3Schema)({ x: 1, y: 2, z: 3 })
      )
      expect(vector).toStrictEqual({ x: 1, y: 2, z: 3 })
    })

    it('AABBSchema parses bounding box', async () => {
      const box = await Effect.runPromise(
        Schema.decodeUnknown(AABBSchema)({
          min: { x: 0, y: 0, z: 0 },
          max: { x: 1, y: 1, z: 1 },
        })
      )
      expect(box.min.x).toBe(0)
      expect(box.max.y).toBe(1)
    })
  })

  describe('schema failure cases', () => {
    it('PositiveFloatSchema rejects non-positive values', () =>
      expectIssue(Schema.decodeUnknown(PositiveFloatSchema)(0))
    )

    it('NonNegativeFloatSchema rejects negative values', () =>
      expectIssue(Schema.decodeUnknown(NonNegativeFloatSchema)(-0.1))
    )

    it('UnitIntervalSchema rejects out-of-range values', () =>
      expectIssue(Schema.decodeUnknown(UnitIntervalSchema)(1.1))
    )

    it('Vector3Schema rejects missing coordinates', () =>
      expectIssue(Schema.decodeUnknown(Vector3Schema)({ x: 1, y: 2 }))
    )

    it('AABBSchema rejects invalid bounds', () =>
      expectIssue(
        Schema.decodeUnknown(AABBSchema)({
          min: { x: 1, y: 1, z: 1 },
          max: { x: 0, y: 0, z: 0 },
        })
      )
    )
  })

  describe('parse helpers', () => {
    it('parsePositiveFloat returns expected value', async () => {
      const value = await Effect.runPromise(parsePositiveFloat(2))
      expect(value).toBe(2)
    })

    it('parseNonNegativeFloat fails for negative', async () => {
      await expectIssue(parseNonNegativeFloat(-1))
    })

    it('parseUnitInterval returns original value', async () => {
      const value = await Effect.runPromise(parseUnitInterval(0.25))
      expect(value).toBeCloseTo(0.25)
    })

    it('parseVector3 yields vector', async () => {
      const vector = await Effect.runPromise(parseVector3({ x: 3, y: 4, z: 5 }))
      expect(vector.x).toBe(3)
    })

    it('parseAABB fails when max < min', async () => {
      await expectIssue(
        parseAABB({
          min: { x: 1, y: 1, z: 1 },
          max: { x: 0, y: 0, z: 0 },
        })
      )
    })
  })
})
