import { Schema } from 'effect'

// ─── Enchantment types (vanilla subset) ────────────────────────────────────

export const EnchantmentTypeSchema = Schema.Literal(
  'SHARPNESS', 'SMITE', 'BANE_OF_ARTHROPODS', 'KNOCKBACK',
  'PROTECTION', 'PROJECTILE_PROTECTION', 'FIRE_PROTECTION', 'BLAST_PROTECTION',
  'FEATHER_FALLING', 'RESPIRATION',
  'EFFICIENCY', 'FORTUNE', 'SILK_TOUCH', 'UNBREAKING', 'LOOTING',
  'INFINITY', 'POWER', 'PUNCH',
  'LURE', 'LUCK_OF_THE_SEA',
)
export type EnchantmentType = Schema.Schema.Type<typeof EnchantmentTypeSchema>

export const EnchantmentLevelSchema = Schema.Literal(1, 2, 3, 4, 5)
export type EnchantmentLevel = Schema.Schema.Type<typeof EnchantmentLevelSchema>

export const EnchantmentSchema = Schema.Struct({
  type: EnchantmentTypeSchema,
  level: EnchantmentLevelSchema,
})
export type Enchantment = Schema.Schema.Type<typeof EnchantmentSchema>
