import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import {
  type DurableItem,
  TOOL_MAX_DURABILITY,
} from './durability.config'

// Items absent from this table are not damageable (blocks, food, ingredients):
// getMaxDurability → none, isDurable → false.
export {
  DURABLE_ITEMS,
  TOOL_MAX_DURABILITY,
  type DurableItem,
} from './durability.config'

export const isDurable = (itemType: InventoryItem): itemType is DurableItem =>
  Object.hasOwn(TOOL_MAX_DURABILITY, itemType)

export const getMaxDurability = (itemType: InventoryItem): Option.Option<number> =>
  isDurable(itemType) ? Option.some(TOOL_MAX_DURABILITY[itemType]) : Option.none()

// Reduces remaining durability by `amount` (default 1 per use), clamped at 0.
export const damageDurability = (current: number, amount: number = 1): number =>
  Math.max(0, current - Math.max(0, amount))

// A tool is broken once its remaining durability reaches 0.
export const isBroken = (remaining: number): boolean => remaining <= 0
