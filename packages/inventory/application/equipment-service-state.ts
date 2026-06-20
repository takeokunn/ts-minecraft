import { Array as Arr, Option, identity } from 'effect'
import { getArmorSlot, computeTotalArmorPoints } from '../domain/armor'
import { ARMOR_SLOTS, type ArmorSlot } from '../domain/armor.config'
import {
  computeTotalProtectionReduction,
  computeTotalProjectileProtectionReduction,
  computeTotalBlastProtectionReduction,
} from '../domain/armor-protection'
import { ItemStack, damageStack, repairStackWithMendingXP } from '../domain/item-stack'
import type { EquipmentSlots } from './equipment-service-types'

const wornStacks = (slots: EquipmentSlots): ReadonlyArray<ItemStack> =>
  Arr.filterMap(
    ARMOR_SLOTS.map((slot) => slots[slot]),
    identity,
  )

export const equipArmorItem = (slots: EquipmentSlots, stack: ItemStack): readonly [boolean, EquipmentSlots] => {
  const armorSlot = Option.getOrNull(getArmorSlot(stack.itemType))
  if (armorSlot === null) return [false, slots]
  return [true, { ...slots, [armorSlot]: Option.some(stack) }]
}

const asSingleArmorStack = (stack: ItemStack): ItemStack =>
  stack.count === 1
    ? stack
    : new ItemStack({
        itemType: stack.itemType,
        count: 1,
        durability: stack.durability,
        enchantments: stack.enchantments,
      })

export const equipArmorItemIfSlotEmpty = (slots: EquipmentSlots, stack: ItemStack): readonly [boolean, EquipmentSlots] => {
  const armorSlot = Option.getOrNull(getArmorSlot(stack.itemType))
  if (armorSlot === null) return [false, slots]
  if (Option.isSome(slots[armorSlot])) return [false, slots]
  return [true, { ...slots, [armorSlot]: Option.some(asSingleArmorStack(stack)) }]
}

export const unequipArmorSlot = (slots: EquipmentSlots, slot: ArmorSlot): readonly [Option.Option<ItemStack>, EquipmentSlots] => [
  slots[slot],
  { ...slots, [slot]: Option.none<ItemStack>() },
]

export const computeEquipmentTotalArmorPoints = (slots: EquipmentSlots): number =>
  computeTotalArmorPoints(wornStacks(slots).map((s) => s.itemType))

export const computeEquipmentTotalProtectionReduction = (slots: EquipmentSlots): number =>
  computeTotalProtectionReduction(wornStacks(slots))

export const computeEquipmentTotalProjectileProtectionReduction = (slots: EquipmentSlots): number =>
  computeTotalProjectileProtectionReduction(wornStacks(slots))

export const computeEquipmentTotalBlastProtectionReduction = (slots: EquipmentSlots): number =>
  computeTotalBlastProtectionReduction(wornStacks(slots))

export const damageArmorSlot = (slots: EquipmentSlots, slot: ArmorSlot, amount = 1): EquipmentSlots => {
  const currentVal = Option.getOrNull(slots[slot])
  if (currentVal === null) return slots
  const next = damageStack(currentVal, amount)
  return { ...slots, [slot]: next }
}

export const repairMendingItemsWithXP = (slots: EquipmentSlots, amount: number): readonly [number, EquipmentSlots] => {
  if (amount <= 0) return [amount, slots]
  const wholeXP = Math.floor(amount)
  const fractionalXP = amount - wholeXP
  let remainingXP = wholeXP
  let nextSlots = slots

  for (const slot of ARMOR_SLOTS) {
    if (remainingXP <= 0) break
    const stack = Option.getOrNull(nextSlots[slot])
    if (stack === null) continue
    const repaired = repairStackWithMendingXP(stack, remainingXP)
    if (repaired.xpUsed <= 0) continue
    remainingXP -= repaired.xpUsed
    nextSlots = { ...nextSlots, [slot]: Option.some(repaired.stack) }
  }

  return [remainingXP + fractionalXP, nextSlots]
}
