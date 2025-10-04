import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { Schema } from '@effect/schema'
import { emptyEquipmentSet, equipPiece } from '../aggregate/equipment-set'
import { EquipmentTagSchema, createEquipmentPiece } from '../aggregate/equipment-piece'
import { analyseEquipmentSet } from './analysis'
import { EquipmentSlotSchema } from '../value_object/slot'
import { EquipmentStatsSchema, EquipmentTierSchema } from '../value_object/item-attributes'
import {
  EquipmentOwnerIdSchema,
  EquipmentSetIdSchema,
  EquipmentIdSchema,
  UnixTimeSchema,
  WeightSchema,
  type UnixTime,
} from '../types/core'

describe('equipment/domain_service/analysis', () => {
  it.effect('produces summary statistics', () =>
    Effect.gen(function* () {
      const id = yield* Schema.decode(EquipmentSetIdSchema)('set_analysis')
      const owner = yield* Schema.decode(EquipmentOwnerIdSchema)('player_analysis')
      const timestamp = yield* Schema.decode(UnixTimeSchema)(0)
      const weightLimit = yield* Schema.decode(WeightSchema)(50)
      const base = emptyEquipmentSet(id, owner, timestamp, weightLimit)

      const piece = yield* createEquipmentPiece({
        id: yield* Schema.decode(EquipmentIdSchema)('helm_iron'),
        name: 'Iron Helmet',
        description: 'Basic protection',
        slot: yield* Schema.decode(EquipmentSlotSchema)('helmet'),
        tier: yield* Schema.decode(EquipmentTierSchema)('rare'),
        stats: yield* Schema.decode(EquipmentStatsSchema)({
          attack: 0,
          defense: 4,
          durability: 150,
          criticalChance: 0,
        }),
        weight: yield* Schema.decode(WeightSchema)(3),
        tags: [yield* Schema.decode(EquipmentTagSchema)('armor:helmet')],
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      const equipped = yield* equipPiece(base, piece, (timestamp + 10) as UnixTime)
      const summary = yield* analyseEquipmentSet(equipped)
      expect(summary.defensiveScore).toBeGreaterThan(0)
      expect(summary.occupiedSlots).toBe(1)
    })
  )
})
