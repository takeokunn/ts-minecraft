import { Schema } from '@effect/schema'
import { ItemStack } from '../inventory/Inventory'

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

// 空の装備セットを作成
export const createEmptyEquipment = (): Equipment => ({
  helmet: null,
  chestplate: null,
  leggings: null,
  boots: null,
  mainHand: null,
  offHand: null,
})

// アーマー値計算
export const calculateArmorValue = (equipment: Equipment): number => {
  let totalArmor = 0

  // 各装備部位のアーマー値を加算（簡略化）
  // 実際のゲームではアイテムIDに基づいて値を決定
  if (equipment.helmet) totalArmor += 2
  if (equipment.chestplate) totalArmor += 6
  if (equipment.leggings) totalArmor += 5
  if (equipment.boots) totalArmor += 1

  return Math.min(20, totalArmor) // Max armor is 20
}
