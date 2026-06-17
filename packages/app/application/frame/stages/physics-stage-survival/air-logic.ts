import { Option } from 'effect'
import { MAX_AIR_SECS } from '@ts-minecraft/entity'
import { enchantmentsOf, getRespirationBonusSecs, type ItemStack } from '@ts-minecraft/inventory'

export const resolveEffectiveMaxAirSecs = (helmetOpt: Option.Option<ItemStack>): number => {
  let respirationEnchantment = null
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
