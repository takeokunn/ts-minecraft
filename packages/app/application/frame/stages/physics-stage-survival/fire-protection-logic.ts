import { enchantmentsOf, getFireProtectionReduction } from '@ts-minecraft/inventory'
import type { EquipmentSlots } from '@ts-minecraft/inventory/application/equipment-service-types'

const ARMOR_SLOTS: Array<keyof EquipmentSlots> = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS']

export const resolveTotalFireProtectionReduction = (armorSlots: EquipmentSlots): number => {
  let totalReduction = 0

  for (const slot of ARMOR_SLOTS) {
    for (const enchantment of enchantmentsOf(armorSlots[slot])) {
      if (enchantment.type === 'FIRE_PROTECTION') {
        totalReduction += getFireProtectionReduction(enchantment.level)
        break
      }
    }
  }

  return Math.min(0.64, totalReduction)
}
