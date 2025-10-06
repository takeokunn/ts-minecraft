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
  totalArmor += equipment.helmet ? 2 : 0
  totalArmor += equipment.chestplate ? 6 : 0
  totalArmor += equipment.leggings ? 5 : 0
  totalArmor += equipment.boots ? 1 : 0

  return Math.min(20, totalArmor) // Max armor is 20
}
