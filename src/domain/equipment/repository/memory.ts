import { Context, Effect, Layer, Ref } from 'effect'
import type { EquipmentSetId, EquipmentOwnerId, UnixTime } from '../types/core'
import type { NotFound } from '../types/core'
import { makeNotFound } from '../types/core'
import type { EquipmentPiece } from '../aggregate/equipment_piece'
import type { EquipmentSet } from '../aggregate/equipment_set'
import { equipPiece, unequipSlot } from '../aggregate/equipment_set'
import type { EquipmentSlot } from '../value_object/slot'

export interface EquipmentRepository {
  readonly load: (id: EquipmentSetId) => Effect.Effect<EquipmentSet, NotFound>
  readonly save: (set: EquipmentSet) => Effect.Effect<void>
  readonly listForOwner: (ownerId: EquipmentOwnerId) => Effect.Effect<ReadonlyArray<EquipmentSet>>
  readonly equip: (id: EquipmentSetId, piece: EquipmentPiece, timestamp: UnixTime) => Effect.Effect<EquipmentSet, NotFound>
  readonly unequip: (id: EquipmentSetId, slot: EquipmentSlot, timestamp: UnixTime) => Effect.Effect<EquipmentSet, NotFound>
}

export const EquipmentRepositoryTag = Context.Tag<EquipmentRepository>(
  '@domain/equipment/EquipmentRepository'
)

export const InMemoryEquipmentRepository = Layer.scoped(
  EquipmentRepositoryTag,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(new Map<EquipmentSetId, EquipmentSet>())

    const load: EquipmentRepository['load'] = (id) =>
      Ref.get(stateRef).pipe(
        Effect.flatMap((state) => state.get(id) ? Effect.succeed(state.get(id)!) : Effect.fail(makeNotFound({ id })))
      )

    const save: EquipmentRepository['save'] = (set) =>
      Ref.update(stateRef, (state) => new Map(state).set(set.id, set))

    const listForOwner: EquipmentRepository['listForOwner'] = (ownerId) =>
      Ref.get(stateRef).pipe(
        Effect.map((state) =>
          Array.from(state.values()).filter((set) => set.ownerId === ownerId)
        )
      )

    const equip: EquipmentRepository['equip'] = (id, piece, timestamp) =>
      Effect.gen(function* () {
        const set = yield* load(id)
        const updated = yield* equipPiece(set, piece, timestamp)
        yield* save(updated)
        return updated
      })

    const unequip: EquipmentRepository['unequip'] = (id, slot, timestamp) =>
      Effect.gen(function* () {
        const set = yield* load(id)
        const updated = unequipSlot(set, slot, timestamp)
        yield* save(updated)
        return updated
      })

    return {
      load,
      save,
      listForOwner,
      equip,
      unequip,
    }
  })
)
