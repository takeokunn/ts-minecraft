import type { EquipmentSet } from '@domain/equipment/aggregate'
import { equipPiece, unequipSlot } from '@domain/equipment/aggregate'
import { EquipmentRepositoryTag, type EquipmentRepository } from '@domain/equipment/repository'
import type { EquipmentSetId } from '@domain/equipment/types'
import { makeNotFound } from '@domain/equipment/types'
import { Effect, Layer, Ref } from 'effect'

export const InMemoryEquipmentRepository = Layer.scoped(
  EquipmentRepositoryTag,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(new Map<EquipmentSetId, EquipmentSet>())

    const load: EquipmentRepository['load'] = (id) =>
      Ref.get(stateRef).pipe(
        Effect.flatMap((state) => (state.get(id) ? Effect.succeed(state.get(id)!) : Effect.fail(makeNotFound({ id }))))
      )

    const save: EquipmentRepository['save'] = (set) => Ref.update(stateRef, (state) => new Map(state).set(set.id, set))

    const listForOwner: EquipmentRepository['listForOwner'] = (ownerId) =>
      Ref.get(stateRef).pipe(Effect.map((state) => Array.from(state.values()).filter((set) => set.ownerId === ownerId)))

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
