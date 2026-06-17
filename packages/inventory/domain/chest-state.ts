import type { InventoryItem } from '@ts-minecraft/core'
import { Option } from 'effect'

export type ChestItemStack = {
  readonly itemType: InventoryItem
  readonly count: number
  readonly durability: number | null
}

export type ChestBlockState = {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly slots: ReadonlyArray<Option.Option<ChestItemStack>>
}
