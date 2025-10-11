import type { EquipmentDomainError, WeightKg } from '@domain/equipment/types'
import { makeRequirementViolation, WeightSchema } from '@domain/equipment/types'
import * as Schema from '@effect/schema/Schema'
import { Effect } from 'effect'

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

type EquipmentTierLiteral = Schema.Schema.Input<typeof EquipmentTierSchema>

const tierMultipliers: Record<EquipmentTierLiteral, number> = {
  common: 1,
  rare: 0.95,
  epic: 0.9,
  legendary: 0.85,
}

const toLiteral = (tier: EquipmentTier): EquipmentTierLiteral => tier as EquipmentTierLiteral
const toWeight = (value: number): WeightKg => value as WeightKg

const getTierMultiplier = (tier: EquipmentTier): number => tierMultipliers[toLiteral(tier)]

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

export const applyTierWeight = (tier: EquipmentTier, weight: WeightKg): WeightKg =>
  toWeight(Number(weight) * getTierMultiplier(tier))

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
