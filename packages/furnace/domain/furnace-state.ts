import type { InventoryItem, RecipeId } from '@ts-minecraft/kernel'
import { Option } from 'effect'

export type FurnaceItemStack = {
  readonly itemType: InventoryItem
  readonly count: number
}

export type FurnaceBlockState = {
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly input: Option.Option<FurnaceItemStack>
  readonly fuel: Option.Option<FurnaceItemStack>
  readonly output: Option.Option<FurnaceItemStack>
  readonly activeRecipeId: Option.Option<RecipeId>
  readonly progressSecs: number
}
