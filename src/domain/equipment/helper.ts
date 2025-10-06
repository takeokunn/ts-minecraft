import type { Equipment } from '@domain/equipment/types'

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
