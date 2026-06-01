import type { InventoryItem } from '@ts-minecraft/core'

export type EntityDrop = {
  readonly blockType: InventoryItem
  readonly count: number
}
