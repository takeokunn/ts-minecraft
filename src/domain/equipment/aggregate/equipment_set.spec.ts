import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import {
  EquipmentDescriptionSchema,
  EquipmentIdSchema,
  EquipmentNameSchema,
  EquipmentOwnerIdSchema,
  EquipmentSetIdSchema,
  UnixTimeSchema,
  WeightSchema,
  type UnixTime,
} from '../types/core'
import { EquipmentStatsSchema, EquipmentTierSchema } from '../value_object/item_attributes'
import { EquipmentSlotSchema, equipmentSlotLiterals, type EquipmentSlotLiteral } from '../value_object/slot'
import { EquipmentTagSchema, createEquipmentPiece } from './equipment_piece'
import { createEquipmentSet, emptyEquipmentSet, equipPiece, unequipSlot, updatePieces } from './equipment_set'

describe('equipment/aggregate/equipment_set', () => {
  const baseSetEffect = Effect.gen(function* () {
    const id = yield* Schema.decodeUnknown(EquipmentSetIdSchema)('set_001')
    const owner = yield* Schema.decodeUnknown(EquipmentOwnerIdSchema)('player_demo')
    const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(0)
    return { id, owner, timestamp } as const
  })

  const pieceEffect = Effect.gen(function* () {
    const id = yield* Schema.decodeUnknown(EquipmentIdSchema)('piece_iron_sword')
    const name = yield* Schema.decodeUnknown(EquipmentNameSchema)('Iron Sword')
    const description = yield* Schema.decodeUnknown(EquipmentDescriptionSchema)('Iron Sword description')
    const slot = yield* Schema.decodeUnknown(EquipmentSlotSchema)('main_hand')
    const tier = yield* Schema.decodeUnknown(EquipmentTierSchema)('common')
    const stats = yield* Schema.decodeUnknown(EquipmentStatsSchema)({
      attack: 6,
      defense: 0,
      durability: 200,
      criticalChance: 0.05,
    })
    const weight = yield* Schema.decodeUnknown(WeightSchema)(6)
    const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(0)
    const tag = yield* Schema.decodeUnknown(EquipmentTagSchema)('weapon:sword')
    return yield* createEquipmentPiece({
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
    })
  })

  it.effect('creates equipment set from components', () =>
    Effect.gen(function* () {
      const { id, owner, timestamp } = yield* baseSetEffect
      const weightLimit = yield* Schema.decodeUnknown(WeightSchema)(100)
      const set = yield* createEquipmentSet({
        id,
        ownerId: owner,
        weightLimit,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      expect(set.ownerId).toBe(owner)
      expect(Object.keys(set.slots)).toHaveLength(equipmentSlotLiterals.length)
    })
  )

  it.effect('equips and unequips pieces respecting weight limit', () =>
    Effect.gen(function* () {
      const { id, owner, timestamp } = yield* baseSetEffect
      const weightLimit = yield* Schema.decodeUnknown(WeightSchema)(10)
      const set = yield* createEquipmentSet({
        id,
        ownerId: owner,
        weightLimit,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      const piece = yield* pieceEffect
      const equipped = yield* equipPiece(set, piece, (timestamp + 10) as UnixTime)
      expect(equipped.slots[piece.slot as EquipmentSlotLiteral]?.id).toBe(piece.id)
      const unequipped = unequipSlot(equipped, piece.slot, (timestamp + 20) as UnixTime)
      expect(unequipped.slots[piece.slot as EquipmentSlotLiteral]).toBeUndefined()
    })
  )

  it.effect('updatePieces maps over equipped items', () =>
    Effect.gen(function* () {
      const { id, owner, timestamp } = yield* baseSetEffect
      const weightLimit = yield* Schema.decodeUnknown(WeightSchema)(50)
      const set = emptyEquipmentSet(id, owner, timestamp, weightLimit)
      const piece = yield* pieceEffect
      const equipped = yield* equipPiece(set, piece, (timestamp + 1) as UnixTime)
      const updated = updatePieces(equipped, (item) => ({
        ...item,
        stats: {
          ...item.stats,
          attack: item.stats.attack + 1,
        },
      }))
      const literal = piece.slot as EquipmentSlotLiteral
      expect(updated.slots[literal]?.stats.attack).toBe((equipped.slots[literal]?.stats.attack ?? 0) + 1)
    })
  )
})
