import { Option } from 'effect'
import { getFeatherFallingReduction } from '@ts-minecraft/inventory/domain/enchantment'
import type { Enchantment } from '@ts-minecraft/inventory/domain/enchantment.types'
import { enchantmentsOf, type ItemStack } from '@ts-minecraft/inventory/domain/item-stack'

export const resolveFallDamage = (rawFallDamage: number, bootsOpt: Option.Option<ItemStack>): number => {
  if (rawFallDamage <= 0) return rawFallDamage

  let featherFalling: Enchantment | null = null
  for (const enchantment of enchantmentsOf(bootsOpt)) {
    if (enchantment.type === 'FEATHER_FALLING') {
      featherFalling = enchantment
      break
    }
  }
  return featherFalling
    ? rawFallDamage * (1 - getFeatherFallingReduction(featherFalling.level))
    : rawFallDamage
}
