import type { EquipmentDomainError } from '@domain/equipment/types'
import { makeRequirementViolation } from '@domain/equipment/types'
import { Effect, Match, Schema } from 'effect'

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

const toSlot = (literal: EquipmentSlotLiteral): EquipmentSlot => literal as EquipmentSlot

export const allSlots: ReadonlyArray<EquipmentSlot> = equipmentSlotLiterals.map(toSlot)

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

const toLiteral = (slot: EquipmentSlot): EquipmentSlotLiteral => slot as EquipmentSlotLiteral

export const getSlotCategory = (slot: EquipmentSlot): Effect.Effect<SlotCategory> =>
  Effect.succeed(slotCategoryTable[toLiteral(slot)])

export const ensureSlotAllowed = (
  slot: EquipmentSlot,
  tag: string
): Effect.Effect<EquipmentSlot, EquipmentDomainError> => {
  const literal = toLiteral(slot)
  const category = slotCategoryTable[literal]
  const ok = Match.value(category).pipe(
    Match.tag('Hand', () => tag.startsWith('weapon') || tag.startsWith('tool')),
    Match.tag('Armor', () => tag.startsWith('armor')),
    Match.tag('Accessory', () => tag.startsWith('accessory') || tag.startsWith('trinket')),
    Match.exhaustive
  )

  return ok
    ? Effect.succeed(slot)
    : Effect.fail(
        makeRequirementViolation({
          requirement: `${category._tag.toLowerCase()}-slot-tag`,
          detail: `tag ${tag} is incompatible with ${literal}`,
        })
      )
}
