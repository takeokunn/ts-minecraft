import type {
  EquipmentDomainError,
  EquipmentOwnerId,
  EquipmentSetId,
  EquipmentSetVersion,
  UnixTime,
  WeightKg,
} from '@domain/equipment/types'
import {
  EquipmentOwnerIdSchema,
  EquipmentSetIdSchema,
  EquipmentSetVersionSchema,
  UnixTimeSchema,
  WeightSchema,
  makeRequirementViolation,
  makeSchemaViolation,
} from '@domain/equipment/types'
import { Effect, Schema } from 'effect'
import {
  ensureWeightWithinLimit,
  equipmentSlotLiterals,
  type EquipmentSlot,
  type EquipmentSlotLiteral,
} from '../value_object'
import { EquipmentPieceSchema, ensureFitsSlot, withUpdatedTimestamp, type EquipmentPiece } from './index'

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
const emptySlots = (): Slots => ({
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

/**
 * EquipmentSlotのTaggedEnum型から_tagプロパティを取得してEquipmentSlotLiteralに変換
 * EquipmentSlotは TaggedEnum 型で { _tag: 'main_hand' | 'off_hand' | ... } の構造
 */
const slotKey = (slot: EquipmentSlot): EquipmentSlotLiteral => slot._tag

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

const buildSlots = (base: Slots, updates: Record<EquipmentSlotLiteral, EquipmentPiece | undefined>): Slots => ({
  ...base,
  ...updates,
})

export const equipPiece = (
  set: EquipmentSet,
  piece: EquipmentPiece,
  timestamp: UnixTime
): Effect.Effect<EquipmentSet, EquipmentDomainError> =>
  Effect.gen(function* () {
    yield* pipe(
      slotOccupied(set, piece.slot),
      Effect.when({
        onTrue: () =>
          Effect.fail(
            makeRequirementViolation({
              requirement: 'slot-empty',
              detail: `slot ${piece.slot} already occupied`,
            })
          ),
        onFalse: () => Effect.void,
      })
    )

    yield* ensureFitsSlot(piece, piece.slot)

    const literal = slotKey(piece.slot)
    const slots = buildSlots(set.slots, {
      [literal]: withUpdatedTimestamp(piece, timestamp),
    } as Record<EquipmentSlotLiteral, EquipmentPiece | undefined>)
    const carriedWeight = computeWeight(slots)
    yield* ensureWeightWithinLimit(set.weightLimit, carriedWeight)

    return {
      ...set,
      slots,
      carriedWeight,
      updatedAt: timestamp,
    } as EquipmentSet
  })

export const unequipSlot = (set: EquipmentSet, slot: EquipmentSlot, timestamp: UnixTime): EquipmentSet => {
  const literal = slotKey(slot)
  const slots = buildSlots(set.slots, {
    [literal]: undefined,
  } as Record<EquipmentSlotLiteral, EquipmentPiece | undefined>)
  const carriedWeight = computeWeight(slots)
  return {
    ...set,
    slots,
    carriedWeight,
    updatedAt: timestamp,
  } as EquipmentSet
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
  return {
    ...set,
    slots,
    carriedWeight,
  } as EquipmentSet
}

export const emptyEquipmentSet = (
  id: EquipmentSetId,
  ownerId: EquipmentOwnerId,
  timestamp: UnixTime,
  weightLimit: WeightKg
): EquipmentSet =>
  ({
    id,
    ownerId,
    slots: emptySlots(),
    weightLimit,
    carriedWeight: 0,
    version: 1 as EquipmentSetVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as EquipmentSet)
