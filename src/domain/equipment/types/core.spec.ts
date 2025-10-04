import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import {
  EquipmentDescriptionSchema,
  EquipmentIdSchema,
  EquipmentNameSchema,
  EquipmentOwnerIdSchema,
  WeightSchema,
  makeRequirementViolation,
} from './core'

describe('equipment/types/core', () => {
  it.effect('decodes valid identifiers', () =>
    Effect.gen(function* () {
      const id = yield* Schema.decode(EquipmentIdSchema)('sword_iron_01')
      expect(id).toBe('sword_iron_01')
      const owner = yield* Schema.decode(EquipmentOwnerIdSchema)('player_alpha')
      expect(owner).toBe('player_alpha')
      const description = yield* Schema.decode(EquipmentDescriptionSchema)('sturdy sword forged by dwarves')
      expect(description).toContain('dwarves')
    })
  )

  it.effect('rejects invalid equipment name', () =>
    Effect.gen(function* () {
      const exit = yield* Effect.either(Schema.decode(EquipmentNameSchema)(''))
      expect(exit._tag).toBe('Left')
    })
  )

  it.effect('enforces non-negative weight', () =>
    Effect.gen(function* () {
      const weight = yield* Schema.decode(WeightSchema)(12.5)
      expect(weight).toBe(12.5)
      const exit = yield* Effect.either(Schema.decode(WeightSchema)(-1))
      expect(exit._tag).toBe('Left')
    })
  )

  it('provides domain error constructors', () => {
    const error = makeRequirementViolation({
      requirement: 'slot-category',
      detail: 'slot mismatch',
    })
    expect(error._tag).toBe('RequirementViolation')
  })
})
