import type { EquipmentPiece, EquipmentSet } from '@domain/equipment/aggregate'
import type { EquipmentOwnerId, EquipmentSetId, NotFound, UnixTime } from '@domain/equipment/types'
import type { EquipmentSlot } from '@domain/equipment/value_object'
import { Context, Effect } from 'effect'

/**
 * Equipment Repository Interface
 */
export interface EquipmentRepository {
  readonly load: (id: EquipmentSetId) => Effect.Effect<EquipmentSet, NotFound>
  readonly save: (set: EquipmentSet) => Effect.Effect<void>
  readonly listForOwner: (ownerId: EquipmentOwnerId) => Effect.Effect<ReadonlyArray<EquipmentSet>>
  readonly equip: (
    id: EquipmentSetId,
    piece: EquipmentPiece,
    timestamp: UnixTime
  ) => Effect.Effect<EquipmentSet, NotFound>
  readonly unequip: (
    id: EquipmentSetId,
    slot: EquipmentSlot,
    timestamp: UnixTime
  ) => Effect.Effect<EquipmentSet, NotFound>
}

/**
 * Equipment Repository Tag
 */
export const EquipmentRepositoryTag = Context.GenericTag<EquipmentRepository>('@domain/equipment/EquipmentRepository')
