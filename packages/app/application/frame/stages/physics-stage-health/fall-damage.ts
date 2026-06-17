import { Option } from 'effect'
import { enchantmentsOf, type ItemStack } from '@ts-minecraft/inventory'
import { getFeatherFallingReduction } from '@ts-minecraft/inventory'

export const resolveFallDamage = (rawFallDamage: number, bootsOpt: Option.Option<ItemStack>): number => {
  if (rawFallDamage <= 0) return rawFallDamage

  let featherFalling = null
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
