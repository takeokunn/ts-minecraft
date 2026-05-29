import type { InventoryItem } from '@ts-minecraft/kernel'

export type EntityDrop = {
  readonly blockType: InventoryItem
  readonly count: number
}
