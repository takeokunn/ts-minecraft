import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import type {
  EquipmentDomainError,
  EquipmentOwnerId,
  EquipmentSetId,
  EquipmentSetVersion,
  UnixTime,
  WeightKg,
} from '../types/core'
import {
  EquipmentOwnerIdSchema,
  EquipmentSetIdSchema,
  EquipmentSetVersionSchema,
  UnixTimeSchema,
  WeightSchema,
  makeRequirementViolation,
  makeSchemaViolation,
} from '../types/core'
import { ensureWeightWithinLimit } from '../value_object/item_attributes'
import { equipmentSlotLiterals, type EquipmentSlot, type EquipmentSlotLiteral } from '../value_object/slot'
import { EquipmentPieceSchema, ensureFitsSlot, withUpdatedTimestamp, type EquipmentPiece } from './equipment_piece'

const optionalPiece = Schema.optional(EquipmentPieceSchema)

const SlotsSchema = Schema.Struct({
  main_hand: optionalPiece,
  off_hand: optionalPiece,
  helmet: optionalPiece,
  chestplate: optionalPiece,
  leggings: optionalPiece,
  boots: optionalPiece,
  ring: optionalPiece,
  necklace: optionalPiece,
  gloves: optionalPiece,
  belt: optionalPiece,
})

export type Slots = Schema.Schema.Type<typeof SlotsSchema>

const decodeSlotsSync = Schema.decodeUnknownSync(SlotsSchema)

export const EquipmentSetSchema = Schema.Struct({
  id: EquipmentSetIdSchema,
  ownerId: EquipmentOwnerIdSchema,
  slots: SlotsSchema,
  weightLimit: WeightSchema,
  carriedWeight: WeightSchema,
  version: EquipmentSetVersionSchema,
  createdAt: UnixTimeSchema,
  updatedAt: UnixTimeSchema,
})
export type EquipmentSet = Schema.Schema.Type<typeof EquipmentSetSchema>

const decodeSet = Schema.decodeUnknown(EquipmentSetSchema)
const decodeSetSync = Schema.decodeUnknownSync(EquipmentSetSchema)

const emptySlots = (): Slots =>
  decodeSlotsSync({
    main_hand: undefined,
    off_hand: undefined,
    helmet: undefined,
    chestplate: undefined,
    leggings: undefined,
    boots: undefined,
    ring: undefined,
    necklace: undefined,
    gloves: undefined,
    belt: undefined,
  })

const setError = (message: string): EquipmentDomainError => makeSchemaViolation({ field: 'EquipmentSet', message })

const slotKey = (slot: EquipmentSlot): EquipmentSlotLiteral => slot as unknown as EquipmentSlotLiteral

const computeWeight = (slots: Slots): WeightKg =>
  equipmentSlotLiterals.reduce<WeightKg>((total, literal) => {
    const piece = slots[literal]
    return piece ? ((total + piece.weight) as WeightKg) : total
  }, 0 as WeightKg)

export interface EquipmentSetComponents {
  readonly id: EquipmentSetId
  readonly ownerId: EquipmentOwnerId
  readonly weightLimit: WeightKg
  readonly createdAt: UnixTime
  readonly updatedAt: UnixTime
  readonly version?: EquipmentSetVersion
  readonly slots?: Slots
}

export const createEquipmentSet = (
  components: EquipmentSetComponents
): Effect.Effect<EquipmentSet, EquipmentDomainError> =>
  Effect.gen(function* () {
    const slots = components.slots ?? emptySlots()
    const carriedWeight = computeWeight(slots)
    yield* ensureWeightWithinLimit(components.weightLimit, carriedWeight)

    return yield* decodeSet({
      id: components.id,
      ownerId: components.ownerId,
      slots,
      weightLimit: components.weightLimit,
      carriedWeight,
      version: components.version ?? (1 as EquipmentSetVersion),
      createdAt: components.createdAt,
      updatedAt: components.updatedAt,
    }).pipe(Effect.mapError(() => setError('invalid equipment set components')))
  })

const slotOccupied = (set: EquipmentSet, slot: EquipmentSlot): boolean => set.slots[slotKey(slot)] !== undefined

const buildSlots = (base: Slots, updates: Record<EquipmentSlotLiteral, EquipmentPiece | undefined>): Slots =>
  decodeSlotsSync({ ...base, ...updates })

export const equipPiece = (
  set: EquipmentSet,
  piece: EquipmentPiece,
  timestamp: UnixTime
): Effect.Effect<EquipmentSet, EquipmentDomainError> =>
  Effect.gen(function* () {
    if (slotOccupied(set, piece.slot)) {
      return yield* Effect.fail(
        makeRequirementViolation({
          requirement: 'slot-empty',
          detail: `slot ${piece.slot} already occupied`,
        })
      )
    }

    yield* ensureFitsSlot(piece, piece.slot)

    const literal = slotKey(piece.slot)
    const slots = buildSlots(set.slots, {
      [literal]: withUpdatedTimestamp(piece, timestamp),
    } as Record<EquipmentSlotLiteral, EquipmentPiece | undefined>)
    const carriedWeight = computeWeight(slots)
    yield* ensureWeightWithinLimit(set.weightLimit, carriedWeight)

    return decodeSetSync({
      ...set,
      slots,
      carriedWeight,
      updatedAt: timestamp,
    })
  })

export const unequipSlot = (set: EquipmentSet, slot: EquipmentSlot, timestamp: UnixTime): EquipmentSet => {
  const literal = slotKey(slot)
  const slots = buildSlots(set.slots, {
    [literal]: undefined,
  } as Record<EquipmentSlotLiteral, EquipmentPiece | undefined>)
  const carriedWeight = computeWeight(slots)
  return decodeSetSync({
    ...set,
    slots,
    carriedWeight,
    updatedAt: timestamp,
  })
}

export const findPiece = (set: EquipmentSet, slot: EquipmentSlot): EquipmentPiece | undefined =>
  set.slots[slotKey(slot)]

export const carriedWeightPercentage = (set: EquipmentSet): number =>
  set.carriedWeight === 0 ? 0 : (set.carriedWeight / set.weightLimit) * 100

export const updatePieces = (set: EquipmentSet, updater: (piece: EquipmentPiece) => EquipmentPiece): EquipmentSet => {
  const entries = Object.fromEntries(
    equipmentSlotLiterals.map((literal) => {
      const piece = set.slots[literal]
      return [literal, piece ? updater(piece) : undefined]
    })
  ) as Record<EquipmentSlotLiteral, EquipmentPiece | undefined>
  const slots = buildSlots(set.slots, entries)
  const carriedWeight = computeWeight(slots)
  return decodeSetSync({
    ...set,
    slots,
    carriedWeight,
  })
}

export const emptyEquipmentSet = (
  id: EquipmentSetId,
  ownerId: EquipmentOwnerId,
  timestamp: UnixTime,
  weightLimit: WeightKg
): EquipmentSet =>
  decodeSetSync({
    id,
    ownerId,
    slots: emptySlots(),
    weightLimit,
    carriedWeight: 0,
    version: 1 as EquipmentSetVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
