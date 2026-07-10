import { Option } from 'effect'
import type { InventorySlot } from '@ts-minecraft/inventory/application/inventory-service'
import { removeFromStack } from '@ts-minecraft/inventory/domain/item-stack'
import { matchesShapedGrid, type CraftingGrid } from '@ts-minecraft/inventory/domain/shaped-crafting'
import type { Recipe } from '@ts-minecraft/inventory/domain/crafting'

// Interactive 3×3 crafting grid state helpers. The grid cells hold real
// ItemStacks (moved in/out with the inventory cursor); crafting consumes one
// item from every occupied cell, vanilla-style.

export const CRAFTING_GRID_CELLS = 9

// Vanilla hand crafting is a 2×2 grid; only the top-left 2×2 of the 3×3 layout
// (indices 0,1,3,4) accepts items without a nearby crafting table.
export const HAND_CRAFTING_CELLS: ReadonlySet<number> = new Set([0, 1, 3, 4])

export const isCraftCellUsable = (cellIndex: number, hasTableAccess: boolean): boolean =>
  hasTableAccess || HAND_CRAFTING_CELLS.has(cellIndex)

export const emptyCraftingGridCells = (): ReadonlyArray<InventorySlot> =>
  Array.from({ length: CRAFTING_GRID_CELLS }, () => Option.none())

// Project the cell stacks down to the shape-matching representation.
export const toCraftingGrid = (cells: ReadonlyArray<InventorySlot>): CraftingGrid =>
  cells.map((cell) => {
    const stack = Option.getOrNull(cell)
    return stack === null ? null : stack.itemType
  })

// First shaped recipe whose pattern matches the grid contents. Station
// gating: crafting_table recipes need a nearby table; furnace/brewing shaped
// recipes (none today) never match the hand grid.
export const findShapedGridMatch = (
  recipes: ReadonlyArray<Recipe>,
  cells: ReadonlyArray<InventorySlot>,
  hasTableAccess: boolean,
): Recipe | null => {
  const grid = toCraftingGrid(cells)
  if (grid.every((cell) => cell === null)) return null
  for (const recipe of recipes) {
    if (recipe.shaped === undefined) continue
    if (recipe.station === 'furnace' || recipe.station === 'brewing_stand') continue
    if (recipe.station === 'crafting_table' && !hasTableAccess) continue
    if (matchesShapedGrid(recipe.shaped, grid)) return recipe
  }
  return null
}

// One craft consumes a single item from every occupied cell.
export const consumeCraftingGridCells = (
  cells: ReadonlyArray<InventorySlot>,
): ReadonlyArray<InventorySlot> =>
  cells.map((cell) =>
    Option.flatMap(cell, (stack) => removeFromStack(stack, 1)),
  )
