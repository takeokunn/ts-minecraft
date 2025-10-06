import {
  EquipmentIdSchema,
  EquipmentOwnerIdSchema,
  EquipmentSetIdSchema,
  UnixTimeSchema,
  WeightSchema,
  type UnixTime,
} from '@domain/equipment/types/core'
import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { provideLayers } from '../../../testing/effect'
import { EquipmentTagSchema, createEquipmentPiece } from '../aggregate/equipment_piece'
import { emptyEquipmentSet } from '../aggregate/equipment_set'
import { EquipmentRepositoryTag, InMemoryEquipmentRepository } from '../repository/memory'
import { EquipmentStatsSchema, EquipmentTierSchema } from '../value_object/item_attributes'
import { EquipmentSlotSchema, type EquipmentSlotLiteral } from '../value_object/slot'
import { EquipmentServiceLive, EquipmentServiceTag } from './service'

const buildPiece = Effect.gen(function* () {
  const id = yield* Schema.decodeUnknown(EquipmentIdSchema)('piece_service')
  const slot = yield* Schema.decodeUnknown(EquipmentSlotSchema)('main_hand')
  const tier = yield* Schema.decodeUnknown(EquipmentTierSchema)('epic')
  const stats = yield* Schema.decodeUnknown(EquipmentStatsSchema)({
    attack: 12,
    defense: 2,
    durability: 500,
    criticalChance: 0.25,
  })
  const weight = yield* Schema.decodeUnknown(WeightSchema)(5)
  const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(0)
  const tag = yield* Schema.decodeUnknown(EquipmentTagSchema)('weapon:sword')
  return yield* createEquipmentPiece({
    id,
    name: 'Service Blade',
    slot,
    tier,
    stats,
    weight,
    tags: [tag],
    createdAt: timestamp,
    updatedAt: timestamp,
  })
})

describe('equipment/application_service/service', () => {
  it.effect('equips equipment via service layer', () =>
    provideLayers(
      Effect.gen(function* () {
        const service = yield* EquipmentServiceTag
        const repo = yield* EquipmentRepositoryTag
        const id = yield* Schema.decodeUnknown(EquipmentSetIdSchema)('set_service')
        const owner = yield* Schema.decodeUnknown(EquipmentOwnerIdSchema)('player_service')
        const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(0)
        const weightLimit = yield* Schema.decodeUnknown(WeightSchema)(100)
        const set = emptyEquipmentSet(id, owner, timestamp, weightLimit)
        yield* repo.save(set)
        const piece = yield* buildPiece
        const updated = yield* service.equip(id, piece, (timestamp + 5) as UnixTime)
        expect(updated.slots[piece.slot as EquipmentSlotLiteral]?.id).toBe(piece.id)
      }),
      InMemoryEquipmentRepository,
      EquipmentServiceLive
    )
  )
})
