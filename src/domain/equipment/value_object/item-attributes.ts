import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import type { EquipmentDomainError, WeightKg } from '../types/core'
import { makeRequirementViolation, WeightSchema } from '../types/core'

export const EquipmentTierSchema = Schema.Literal('common', 'rare', 'epic', 'legendary').pipe(
  Schema.brand('EquipmentTier')
)
export type EquipmentTier = Schema.Schema.Type<typeof EquipmentTierSchema>

export const EquipmentStatsSchema = Schema.Struct({
  attack: Schema.Number.pipe(Schema.nonNegative()),
  defense: Schema.Number.pipe(Schema.nonNegative()),
  durability: Schema.Number.pipe(Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(10_000)),
  criticalChance: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
})
export type EquipmentStats = Schema.Schema.Type<typeof EquipmentStatsSchema>

const decodeWeight = Schema.decodeUnknownSync(WeightSchema)
const encodeTier = Schema.encodeSync(EquipmentTierSchema)

const getTierMultiplier = (tier: EquipmentTier): number => {
  const literal = encodeTier(tier)
  switch (literal) {
    case 'common':
      return 1
    case 'rare':
      return 0.95
    case 'epic':
      return 0.9
    case 'legendary':
      return 0.85
  }
}

export const mergeStats = (stats: ReadonlyArray<EquipmentStats>): EquipmentStats =>
  stats.reduce<EquipmentStats>(
    (total, current) => ({
      attack: total.attack + current.attack,
      defense: total.defense + current.defense,
      durability: Math.min(total.durability + current.durability, 10_000),
      criticalChance: Math.min(total.criticalChance + current.criticalChance, 1),
    }),
    { attack: 0, defense: 0, durability: 0, criticalChance: 0 }
  )

export const applyTierWeight = (
  tier: EquipmentTier,
  weight: WeightKg
): WeightKg => decodeWeight(Number(weight) * getTierMultiplier(tier))

export const ensureWeightWithinLimit = (
  limit: WeightKg,
  weight: WeightKg
): Effect.Effect<WeightKg, EquipmentDomainError> =>
  Number(weight) <= Number(limit)
    ? Effect.succeed(weight)
    : Effect.fail(
        makeRequirementViolation({
          requirement: 'weight-limit',
          detail: `carried weight ${Number(weight).toFixed(2)} exceeds limit ${Number(limit).toFixed(2)}`,
        })
      )

export const parseWeight = Schema.decodeUnknown(WeightSchema)
