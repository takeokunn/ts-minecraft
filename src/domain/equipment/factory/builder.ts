import {
  EquipmentIdSchema,
  EquipmentNameSchema,
  EquipmentOwnerIdSchema,
  EquipmentSetIdSchema,
  UnixTimeSchema,
  WeightSchema,
} from '@domain/equipment/types'
import { Clock, Effect, Ref, Schema } from 'effect'
import { createEquipmentPiece, emptyEquipmentSet } from '../aggregate'
import { EquipmentSlotSchema, EquipmentStatsSchema, EquipmentTierSchema } from '../value_object'

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
      const timestampMs = yield* Clock.currentTimeMillis
      const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(timestampMs)
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
      const timestampMs = yield* Clock.currentTimeMillis
      const timestamp = yield* Schema.decodeUnknown(UnixTimeSchema)(timestampMs)
      const weightLimit = yield* Schema.decodeUnknown(WeightSchema)(100)
      return emptyEquipmentSet(id, ownerId, timestamp, weightLimit)
    })

  return {
    createDefaultPiece,
    createDefaultSet,
  }
})

export type EquipmentBuilder = Effect.Effect.Success<typeof EquipmentBuilder>
