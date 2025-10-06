import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { provideLayers } from '../../../testing/effect'
import { EquipmentTagSchema, createEquipmentPiece } from '../aggregate/equipment_piece'
import { emptyEquipmentSet } from '../aggregate/equipment_set'
import {
  EquipmentIdSchema,
  EquipmentOwnerIdSchema,
  EquipmentSetIdSchema,
  UnixTimeSchema,
  WeightSchema,
  type UnixTime,
} from '@domain/equipment/types/core'
import { EquipmentStatsSchema, EquipmentTierSchema } from '../value_object/item_attributes'
import { EquipmentSlotSchema, type EquipmentSlotLiteral } from '../value_object/slot'
import { EquipmentRepositoryTag, InMemoryEquipmentRepository } from './memory'

const makeTestPiece = Effect.gen(function* () {
  const id = yield* Schema.decodeUnknown(EquipmentIdSchema)('sword_test')
  const slot = yield* Schema.decodeUnknown(EquipmentSlotSchema)('main_hand')
  const tier = yield* Schema.decodeUnknown(EquipmentTierSchema)('rare')
  const stats = yield* Schema.decodeUnknown(EquipmentStatsSchema)({
    attack: 8,
    defense: 0,
    durability: 300,
    criticalChance: 0.15,
  })
  const weight = yield* Schema.decodeUnknown(WeightSchema)(8)
  const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(0)
  const tag = yield* Schema.decodeUnknown(EquipmentTagSchema)('weapon:sword')
  return yield* createEquipmentPiece({
    id,
    name: 'Test Sword',
    slot,
    tier,
    stats,
    weight,
    tags: [tag],
    createdAt: timestamp,
    updatedAt: timestamp,
  })
})

describe('equipment/repository/memory', () => {
  it.effect('persists equipment sets in memory', () =>
    provideLayers(
      Effect.gen(function* () {
        const repo = yield* EquipmentRepositoryTag
        const id = yield* Schema.decodeUnknown(EquipmentSetIdSchema)('set_01')
        const owner = yield* Schema.decodeUnknown(EquipmentOwnerIdSchema)('player_repo')
        const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(0)
        const weightLimit = yield* Schema.decodeUnknown(WeightSchema)(100)
        const set = emptyEquipmentSet(id, owner, timestamp, weightLimit)
        yield* repo.save(set)
        const loaded = yield* repo.load(id)
        expect(loaded.id).toBe(id)
      }),
      InMemoryEquipmentRepository
    )
  )

  it.effect('equips piece through repository API', () =>
    provideLayers(
      Effect.gen(function* () {
        const repo = yield* EquipmentRepositoryTag
        const id = yield* Schema.decodeUnknown(EquipmentSetIdSchema)('set_02')
        const owner = yield* Schema.decodeUnknown(EquipmentOwnerIdSchema)('player_repo')
        const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(0)
        const weightLimit = yield* Schema.decodeUnknown(WeightSchema)(100)
        const set = emptyEquipmentSet(id, owner, timestamp, weightLimit)
        yield* repo.save(set)
        const piece = yield* makeTestPiece
        const updated = yield* repo.equip(id, piece, (timestamp + 1) as UnixTime)
        expect(updated.slots[piece.slot as EquipmentSlotLiteral]?.id).toBe(piece.id)
      }),
      InMemoryEquipmentRepository
    )
  )
})
