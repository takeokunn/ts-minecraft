/**
 * Validation Result ADT
 *
 * バリデーション結果を表現するTaggedEnum（代数的データ型）。
 * 全てのバリデーションケースを型安全に扱えるようにします。
 */

import { Data } from 'effect'
import type { ItemId } from '../../types'

/**
 * バリデーション結果の代数的データ型
 */
export type ValidationResult = Data.TaggedEnum<{
  /**
   * バリデーション成功
   */
  Valid: {}

  /**
   * スロット数不正
   */
  InvalidSlotCount: {
    readonly detected: number
    readonly expected: number
  }

  /**
   * スタックサイズ不正
   */
  InvalidStackSize: {
    readonly slotIndex: number
    readonly count: number
  }

  /**
   * ホットバー長不正
   */
  InvalidHotbarLength: {
    readonly detected: number
    readonly expected: number
  }

  /**
   * ホットバー重複
   */
  DuplicateHotbarSlot: {
    readonly duplicates: readonly number[]
  }

  /**
   * ホットバー範囲外
   */
  HotbarSlotOutOfBounds: {
    readonly outOfBounds: readonly number[]
  }

  /**
   * 選択スロット不正
   */
  InvalidSelectedSlot: {
    readonly selectedSlot: number
  }

  /**
   * 防具スロット不正
   */
  InvalidArmorSlot: {
    readonly slot: string
    readonly itemId: ItemId
  }

  /**
   * エンチャントレベル不正
   */
  InvalidEnchantmentLevel: {
    readonly slotIndex: number
    readonly enchantmentId: string
    readonly level: number
  }

  /**
   * ダメージ値不正
   */
  InvalidDamageValue: {
    readonly slotIndex: number
    readonly damage: number
  }

  /**
   * 耐久値範囲外
   */
  DurabilityOutOfRange: {
    readonly slotIndex: number
    readonly durability: number
  }
}>

export const ValidationResult = Data.taggedEnum<ValidationResult>()
