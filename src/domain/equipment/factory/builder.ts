import { Effect, Ref } from 'effect'
import { Schema } from '@effect/schema'
import {
  EquipmentIdSchema,
  EquipmentNameSchema,
  EquipmentOwnerIdSchema,
  EquipmentSetIdSchema,
  UnixTimeSchema,
  WeightSchema,
} from '../types/core'
import { EquipmentSlotSchema } from '../value_object/slot'
import { EquipmentStatsSchema, EquipmentTierSchema } from '../value_object/item-attributes'
import { createEquipmentPiece } from '../aggregate/equipment-piece'
import { emptyEquipmentSet } from '../aggregate/equipment-set'

export interface EquipmentBuilderState {
  readonly nextId: number
}

export const EquipmentBuilder = Effect.gen(function* () {
  const state = yield* Ref.make<EquipmentBuilderState>({ nextId: 1 })

  const generateId = (prefix: string) =>
    Ref.modify(state, (current) => {
      const id = `${prefix}_${current.nextId.toString().padStart(3, '0')}`
      return [id, { nextId: current.nextId + 1 }]
    })

  const createDefaultPiece = () =>
    Effect.gen(function* () {
      const id = yield* Schema.decodeUnknown(EquipmentIdSchema)(yield* generateId('piece'))
      const name = yield* Schema.decodeUnknown(EquipmentNameSchema)('Generated Equipment')
      const slot = yield* Schema.decodeUnknown(EquipmentSlotSchema)('main_hand')
      const tier = yield* Schema.decodeUnknown(EquipmentTierSchema)('common')
      const stats = yield* Schema.decodeUnknown(EquipmentStatsSchema)({
        attack: 5,
        defense: 0,
        durability: 100,
        criticalChance: 0.05,
      })
      const weight = yield* Schema.decodeUnknown(WeightSchema)(4)
      const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(Date.now())
      return yield* createEquipmentPiece({
        id,
        name,
        slot,
        tier,
        stats,
        weight,
        tags: ['weapon:generated'],
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    })

  const createDefaultSet = (owner: string) =>
    Effect.gen(function* () {
      const id = yield* Schema.decodeUnknown(EquipmentSetIdSchema)(yield* generateId('set'))
      const ownerId = yield* Schema.decodeUnknown(EquipmentOwnerIdSchema)(owner)
      const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(Date.now())
      const weightLimit = yield* Schema.decodeUnknown(WeightSchema)(100)
      return emptyEquipmentSet(id, ownerId, timestamp, weightLimit)
    })

  return {
    createDefaultPiece,
    createDefaultSet,
  }
})

export type EquipmentBuilder = Effect.Effect.Success<typeof EquipmentBuilder>
