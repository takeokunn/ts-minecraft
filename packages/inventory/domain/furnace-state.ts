import type { InventoryItem, RecipeId } from '@ts-minecraft/core'
import { HashMap, Option } from 'effect'

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

export type FurnaceState = {
  readonly furnaces: HashMap.HashMap<string, FurnaceBlockState>
  readonly selectedFurnacePosition: { readonly x: number; readonly y: number; readonly z: number } | null
}
