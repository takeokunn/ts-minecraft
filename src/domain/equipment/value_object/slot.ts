import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import type { EquipmentDomainError } from '../types/core'
import { makeRequirementViolation } from '../types/core'

export type EquipmentSlotLiteral =
  | 'main_hand'
  | 'off_hand'
  | 'helmet'
  | 'chestplate'
  | 'leggings'
  | 'boots'
  | 'ring'
  | 'necklace'
  | 'gloves'
  | 'belt'

export const equipmentSlotLiterals: ReadonlyArray<EquipmentSlotLiteral> = [
  'main_hand',
  'off_hand',
  'helmet',
  'chestplate',
  'leggings',
  'boots',
  'ring',
  'necklace',
  'gloves',
  'belt',
]

export const EquipmentSlotSchema = Schema.Literal(...equipmentSlotLiterals).pipe(
  Schema.brand('EquipmentSlot'),
  Schema.annotations({ description: 'Slot identifier determining where an equipment piece is equipped.' })
)

export type EquipmentSlot = Schema.Schema.Type<typeof EquipmentSlotSchema>

const decodeSlot = Schema.decodeUnknownSync(EquipmentSlotSchema)
const encodeSlot = Schema.encodeSync(EquipmentSlotSchema)

export const allSlots: ReadonlyArray<EquipmentSlot> = equipmentSlotLiterals.map((literal) => decodeSlot(literal))

export type SlotCategory =
  | { readonly _tag: 'Hand'; readonly dominance: 'main' | 'off' }
  | { readonly _tag: 'Armor'; readonly bodyPart: 'head' | 'chest' | 'legs' | 'feet' }
  | { readonly _tag: 'Accessory'; readonly type: 'ring' | 'necklace' | 'gloves' | 'belt' }

const slotCategoryTable: Record<EquipmentSlotLiteral, SlotCategory> = {
  main_hand: { _tag: 'Hand', dominance: 'main' },
  off_hand: { _tag: 'Hand', dominance: 'off' },
  helmet: { _tag: 'Armor', bodyPart: 'head' },
  chestplate: { _tag: 'Armor', bodyPart: 'chest' },
  leggings: { _tag: 'Armor', bodyPart: 'legs' },
  boots: { _tag: 'Armor', bodyPart: 'feet' },
  ring: { _tag: 'Accessory', type: 'ring' },
  necklace: { _tag: 'Accessory', type: 'necklace' },
  gloves: { _tag: 'Accessory', type: 'gloves' },
  belt: { _tag: 'Accessory', type: 'belt' },
}

const toLiteral = (slot: EquipmentSlot): EquipmentSlotLiteral => encodeSlot(slot)

export const getSlotCategory = (slot: EquipmentSlot): Effect.Effect<SlotCategory> =>
  Effect.succeed(slotCategoryTable[toLiteral(slot)])

export const ensureSlotAllowed = (
  slot: EquipmentSlot,
  tag: string
): Effect.Effect<EquipmentSlot, EquipmentDomainError> => {
  const literal = toLiteral(slot)
  const category = slotCategoryTable[literal]
  const ok = (() => {
    if (category._tag === 'Hand') {
      return tag.startsWith('weapon') || tag.startsWith('tool')
    }
    if (category._tag === 'Armor') {
      return tag.startsWith('armor')
    }
    return tag.startsWith('accessory') || tag.startsWith('trinket')
  })()

  return ok
    ? Effect.succeed(slot)
    : Effect.fail(
        makeRequirementViolation({
          requirement: `${category._tag.toLowerCase()}-slot-tag`,
          detail: `tag ${tag} is incompatible with ${literal}`,
        })
      )
}
