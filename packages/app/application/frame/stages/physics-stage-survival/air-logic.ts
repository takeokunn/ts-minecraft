import { Option } from 'effect'
import { MAX_AIR_SECS } from '@ts-minecraft/entity/domain/environment-hazard.config'
import { getRespirationBonusSecs } from '@ts-minecraft/inventory/domain/enchantment'
import type { Enchantment } from '@ts-minecraft/inventory/domain/enchantment.types'
import { enchantmentsOf, type ItemStack } from '@ts-minecraft/inventory/domain/item-stack'

export const resolveEffectiveMaxAirSecs = (helmetOpt: Option.Option<ItemStack>): number => {
  let respirationEnchantment: Enchantment | null = null
  for (const enchantment of enchantmentsOf(helmetOpt)) {
    if (enchantment.type === 'RESPIRATION') {
      respirationEnchantment = enchantment
      break
    }
  }
  return respirationEnchantment ? MAX_AIR_SECS + getRespirationBonusSecs(respirationEnchantment.level) : MAX_AIR_SECS
}

export const resolveAirState = (
  airSecs: number,
  headSubmerged: boolean,
  deltaTime: number,
  effectiveMaxAirSecs: number,
): { readonly airSecs: number; readonly airBubbles: number } => {
  const nextAirSecs = headSubmerged ? Math.max(0, airSecs - deltaTime) : effectiveMaxAirSecs
  return {
    airSecs: nextAirSecs,
    airBubbles: headSubmerged ? Math.max(0, Math.ceil((nextAirSecs / effectiveMaxAirSecs) * 10)) : 10,
  }
}
