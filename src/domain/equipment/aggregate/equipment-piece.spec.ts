import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { Schema } from '@effect/schema'
import {
  EquipmentDescriptionSchema,
  EquipmentIdSchema,
  EquipmentNameSchema,
  UnixTimeSchema,
  WeightSchema,
} from '../types/core'
import { EquipmentStatsSchema, EquipmentTierSchema } from '../value_object/item-attributes'
import { EquipmentSlotSchema } from '../value_object/slot'
import {
  EquipmentTagSchema,
  assignBonusStats,
  createEquipmentPiece,
  ensureFitsSlot,
  promoteTier,
  withUpdatedTimestamp,
} from './equipment-piece'

const basePieceEffect = Effect.gen(function* () {
  const id = yield* Schema.decodeUnknown(EquipmentIdSchema)('sword_iron')
  const name = yield* Schema.decodeUnknown(EquipmentNameSchema)('Iron Sword')
  const description = yield* Schema.decodeUnknown(EquipmentDescriptionSchema)('Iron Sword for testing')
  const slot = yield* Schema.decodeUnknown(EquipmentSlotSchema)('main_hand')
  const tier = yield* Schema.decodeUnknown(EquipmentTierSchema)('common')
  const stats = yield* Schema.decodeUnknown(EquipmentStatsSchema)({
    attack: 6,
    defense: 0,
    durability: 250,
    criticalChance: 0.1,
  })
  const weight = yield* Schema.decodeUnknown(WeightSchema)(5)
  const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(0)
  const tag = yield* Schema.decodeUnknown(EquipmentTagSchema)('weapon:sword')
  return {
    id,
    name,
    description,
    slot,
    tier,
    stats,
    weight,
    tags: [tag],
    createdAt: timestamp,
    updatedAt: timestamp,
  } as const
})

describe('equipment/aggregate/equipment_piece', () => {
  it.effect('creates equipment piece from components', () =>
    Effect.gen(function* () {
      const base = yield* basePieceEffect
      const piece = yield* createEquipmentPiece({ ...base })
      expect(piece.id).toBe(base.id)
    })
  )

  it.effect('assigns bonus stats immutably', () =>
    Effect.gen(function* () {
      const base = yield* basePieceEffect
      const piece = yield* createEquipmentPiece({ ...base })
      const bonus = yield* Schema.decodeUnknown(EquipmentStatsSchema)({
        attack: 2,
        defense: 1,
        durability: 10,
        criticalChance: 0,
      })
      const boosted = assignBonusStats(piece, bonus)
      expect(boosted.stats.attack).toBe(piece.stats.attack + 2)
    })
  )

  it.effect('promotes tier and adjusts weight', () =>
    Effect.gen(function* () {
      const base = yield* basePieceEffect
      const piece = yield* createEquipmentPiece({ ...base })
      const nextTier = yield* Schema.decodeUnknown(EquipmentTierSchema)('legendary')
      const promoted = promoteTier(piece, nextTier)
      expect(promoted.tier).toBe(nextTier)
      expect(promoted.weight).toBeLessThan(piece.weight)
    })
  )

  it.effect('ensures slot compatibility', () =>
    Effect.gen(function* () {
      const base = yield* basePieceEffect
      const piece = yield* createEquipmentPiece({ ...base })
      yield* ensureFitsSlot(piece, piece.slot)
      const helmet = yield* Schema.decodeUnknown(EquipmentSlotSchema)('helmet')
      const exit = yield* Effect.either(ensureFitsSlot(piece, helmet))
      expect(exit._tag).toBe('Left')
    })
  )

  it.effect('updates timestamp immutably', () =>
    Effect.gen(function* () {
      const base = yield* basePieceEffect
      const piece = yield* createEquipmentPiece({ ...base })
      const next = withUpdatedTimestamp(piece, yield* Schema.decodeUnknown(UnixTimeSchema)(10))
      expect(next.updatedAt).toBe(10)
      expect(piece.updatedAt).toBe(0)
    })
  )
})
