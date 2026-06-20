import { Option } from 'effect'
import { getBlastProtectionReduction, getProtectionDamageReduction, getProjectileProtectionReduction } from './enchantment'
import { findStackEnchantment, type ItemStack } from './item-stack'
import type { EnchantmentLevel, EnchantmentType } from './enchantment.types'

type ReductionFn = (level: EnchantmentLevel) => number

const totalProtectionFor = (
  worn: ReadonlyArray<ItemStack>,
  enchantmentType: EnchantmentType,
  reductionForLevel: ReductionFn,
): number => {
  const total = worn.reduce((sum, stack) => {
    const enchantment = Option.getOrNull(findStackEnchantment(stack, enchantmentType))
    return enchantment === null ? sum : sum + reductionForLevel(enchantment.level)
  }, 0)
  return Math.min(total, 0.64)
}

export const computeTotalProtectionReduction = (worn: ReadonlyArray<ItemStack>): number =>
  totalProtectionFor(worn, 'PROTECTION', getProtectionDamageReduction)

export const computeTotalProjectileProtectionReduction = (worn: ReadonlyArray<ItemStack>): number =>
  totalProtectionFor(worn, 'PROJECTILE_PROTECTION', getProjectileProtectionReduction)

export const computeTotalBlastProtectionReduction = (worn: ReadonlyArray<ItemStack>): number =>
  totalProtectionFor(worn, 'BLAST_PROTECTION', getBlastProtectionReduction)
