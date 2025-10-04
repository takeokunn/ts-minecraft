import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { Schema } from '@effect/schema'
import {
  EquipmentStatsSchema,
  EquipmentTierSchema,
  applyTierWeight,
  ensureWeightWithinLimit,
  mergeStats,
  parseWeight,
} from './item-attributes'

describe('equipment/value_object/item_attributes', () => {
  it.effect('decodes stats', () =>
    Effect.gen(function* () {
      const stats = yield* Schema.decode(EquipmentStatsSchema)({
        attack: 10,
        defense: 5,
        durability: 250,
        criticalChance: 0.15,
      })
      expect(stats.attack).toBe(10)
    })
  )

  it('merges stats arrays', () => {
    const left = Schema.decodeSync(EquipmentStatsSchema)({
      attack: 5,
      defense: 5,
      durability: 100,
      criticalChance: 0.1,
    })
    const right = Schema.decodeSync(EquipmentStatsSchema)({
      attack: 2,
      defense: 1,
      durability: 50,
      criticalChance: 0.05,
    })
    const total = mergeStats([left, right])
    expect(total.attack).toBe(7)
  })

  it.effect('applies tier multiplier to weight', () =>
    Effect.gen(function* () {
      const weight = yield* parseWeight(10)
      const tier = yield* Schema.decode(EquipmentTierSchema)('legendary')
      expect(applyTierWeight(tier, weight)).toBeCloseTo(8.5)
    })
  )

  it.effect('enforces weight limits', () =>
    Effect.gen(function* () {
      yield* ensureWeightWithinLimit(15, 10)
      const exit = yield* Effect.either(ensureWeightWithinLimit(5, 10))
      expect(exit._tag).toBe('Left')
    })
  )
})
