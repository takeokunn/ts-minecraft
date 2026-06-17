import { Schema } from 'effect'

// ─── Enchantment types (vanilla subset) ────────────────────────────────────

export const ENCHANTMENT_TYPES = [
  'SHARPNESS', 'SMITE', 'BANE_OF_ARTHROPODS', 'KNOCKBACK', 'FIRE_ASPECT',
  'PROTECTION', 'PROJECTILE_PROTECTION', 'FIRE_PROTECTION', 'BLAST_PROTECTION',
  'FEATHER_FALLING', 'RESPIRATION', 'AQUA_AFFINITY', 'DEPTH_STRIDER',
  'EFFICIENCY', 'FORTUNE', 'SILK_TOUCH', 'UNBREAKING', 'MENDING',
  'LOOTING',
  'INFINITY', 'POWER', 'PUNCH',
  'LURE', 'LUCK_OF_THE_SEA',
] as const

export const EnchantmentTypeSchema = Schema.Literal(
  ...ENCHANTMENT_TYPES,
)
export type EnchantmentType = Schema.Schema.Type<typeof EnchantmentTypeSchema>

export const EnchantmentLevelSchema = Schema.Literal(1, 2, 3, 4, 5)
export type EnchantmentLevel = Schema.Schema.Type<typeof EnchantmentLevelSchema>

export const EnchantmentSchema = Schema.Struct({
  type: EnchantmentTypeSchema,
  level: EnchantmentLevelSchema,
})
export type Enchantment = Schema.Schema.Type<typeof EnchantmentSchema>
