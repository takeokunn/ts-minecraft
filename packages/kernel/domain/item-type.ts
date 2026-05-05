import { Schema } from 'effect'

export const ItemTypeSchema = Schema.Literal(
  'STICKS',
  'COAL',
  'WOODEN_SWORD',
  'WOODEN_PICKAXE',
  'STONE_PICKAXE',
  'RAW_IRON',
  'IRON_INGOT',
  'IRON_PICKAXE',
  'RAW_GOLD',
  'GOLD_INGOT',
  'DIAMOND',
  'REDSTONE_DUST',
  'LAPIS_LAZULI',
  'EMERALD',
  'DIAMOND_PICKAXE'
)
export type ItemType = Schema.Schema.Type<typeof ItemTypeSchema>
