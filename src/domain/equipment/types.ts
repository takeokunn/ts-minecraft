import { Schema } from '@effect/schema'
import { ItemStack } from '@domain/inventory'

// 装備スロット定義
export const EquipmentSlot = Schema.Literal('helmet', 'chestplate', 'leggings', 'boots', 'mainHand', 'offHand')
export type EquipmentSlot = Schema.Schema.Type<typeof EquipmentSlot>

// 装備スキーマ
export const EquipmentSchema = Schema.Struct({
  helmet: Schema.Union(ItemStack, Schema.Null),
  chestplate: Schema.Union(ItemStack, Schema.Null),
  leggings: Schema.Union(ItemStack, Schema.Null),
  boots: Schema.Union(ItemStack, Schema.Null),
  mainHand: Schema.Union(ItemStack, Schema.Null),
  offHand: Schema.Union(ItemStack, Schema.Null),
})
export type Equipment = Schema.Schema.Type<typeof EquipmentSchema>
