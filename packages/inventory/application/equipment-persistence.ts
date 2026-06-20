import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import type { ArmorSlot } from '../domain/armor.config'
import { type ItemStack, createStack } from '../domain/item-stack'
import type { EquipmentSlots } from './equipment-service-types'

export type EquipmentSaveData = {
  readonly HELMET: InventoryItem | null
  readonly CHESTPLATE: InventoryItem | null
  readonly LEGGINGS: InventoryItem | null
  readonly BOOTS: InventoryItem | null
}

export const emptyEquipmentSlots = (): EquipmentSlots => ({
  HELMET: Option.none(),
  CHESTPLATE: Option.none(),
  LEGGINGS: Option.none(),
  BOOTS: Option.none(),
})

const savedItemFor = (slots: EquipmentSlots, slot: ArmorSlot): InventoryItem | undefined =>
  Option.getOrUndefined(slots[slot])?.itemType

export const serializeEquipmentSlots = (slots: EquipmentSlots): EquipmentSaveData => {
  return {
    HELMET: savedItemFor(slots, 'HELMET') ?? null,
    CHESTPLATE: savedItemFor(slots, 'CHESTPLATE') ?? null,
    LEGGINGS: savedItemFor(slots, 'LEGGINGS') ?? null,
    BOOTS: savedItemFor(slots, 'BOOTS') ?? null,
  }
}

const savedStackFor = (saved: EquipmentSaveData, slot: ArmorSlot): Option.Option<ItemStack> => {
  const item = saved[slot]
  return item === null ? Option.none() : Option.some(createStack(item, 1))
}

export const deserializeEquipmentSlots = (saved: EquipmentSaveData): EquipmentSlots => ({
  HELMET: savedStackFor(saved, 'HELMET'),
  CHESTPLATE: savedStackFor(saved, 'CHESTPLATE'),
  LEGGINGS: savedStackFor(saved, 'LEGGINGS'),
  BOOTS: savedStackFor(saved, 'BOOTS'),
})
