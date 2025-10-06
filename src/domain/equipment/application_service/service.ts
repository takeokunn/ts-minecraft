import type { EquipmentOwnerId, EquipmentSetId, UnixTime } from '@domain/equipment/types'
import { Context, Effect, Layer } from 'effect'
import type { EquipmentPiece, EquipmentSet } from '../aggregate'
import { EquipmentRepositoryTag } from '../repository'
import type { EquipmentSlot } from '../value_object'

export interface EquipmentService {
  readonly getSet: (id: EquipmentSetId) => Effect.Effect<EquipmentSet>
  readonly listSets: (ownerId: EquipmentOwnerId) => Effect.Effect<ReadonlyArray<EquipmentSet>>
  readonly equip: (id: EquipmentSetId, piece: EquipmentPiece, timestamp: UnixTime) => Effect.Effect<EquipmentSet>
  readonly unequip: (id: EquipmentSetId, slot: EquipmentSlot, timestamp: UnixTime) => Effect.Effect<EquipmentSet>
}

export const EquipmentServiceTag = Context.Tag<EquipmentService>('@domain/equipment/EquipmentService')

const makeEquipmentService = Effect.gen(function* () {
  const repository = yield* EquipmentRepositoryTag

  const getSet: EquipmentService['getSet'] = (id) => repository.load(id)
  const listSets: EquipmentService['listSets'] = (ownerId) => repository.listForOwner(ownerId)
  const equip: EquipmentService['equip'] = (id, piece, timestamp) => repository.equip(id, piece, timestamp)
  const unequip: EquipmentService['unequip'] = (id, slot, timestamp) => repository.unequip(id, slot, timestamp)

  return { getSet, listSets, equip, unequip }
})

export const EquipmentServiceLive = Layer.effect(EquipmentServiceTag, makeEquipmentService)
