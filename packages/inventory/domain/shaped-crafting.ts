import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'

// Shaped 3x3 crafting. A shaped recipe is a pattern of rows ('AB ' style)
// plus a key mapping pattern characters to items. Matching is translation-
// invariant (the shape may sit anywhere in the grid) and mirror-tolerant
// (vanilla accepts horizontally mirrored placements for tools).

export type ShapedRecipeDefinition = {
  // 1-3 rows of 1-3 chars; ' ' = empty cell.
  readonly pattern: ReadonlyArray<string>
  readonly key: Readonly<Record<string, InventoryItem>>
}

// A 3x3 crafting grid in row-major order; null = empty cell.
export type CraftingGrid = ReadonlyArray<InventoryItem | null>

export const GRID_SIZE = 3

type NormalizedShape = ReadonlyArray<ReadonlyArray<InventoryItem | null>>

// Trim empty outer rows/columns so translation does not affect equality.
const normalize = (cells: ReadonlyArray<ReadonlyArray<InventoryItem | null>>): NormalizedShape => {
  let minRow = cells.length
  let maxRow = -1
  let minCol = cells[0]?.length ?? 0
  let maxCol = -1
  for (let row = 0; row < cells.length; row++) {
    for (let col = 0; col < cells[row]!.length; col++) {
      if (cells[row]![col] !== null) {
        if (row < minRow) minRow = row
        if (row > maxRow) maxRow = row
        if (col < minCol) minCol = col
        if (col > maxCol) maxCol = col
      }
    }
  }
  if (maxRow === -1) return []
  const out: Array<ReadonlyArray<InventoryItem | null>> = []
  for (let row = minRow; row <= maxRow; row++) {
    out.push(cells[row]!.slice(minCol, maxCol + 1))
  }
  return out
}

const mirror = (shape: NormalizedShape): NormalizedShape =>
  shape.map((row) => [...row].reverse())

const shapesEqual = (a: NormalizedShape, b: NormalizedShape): boolean => {
  if (a.length !== b.length) return false
  for (let row = 0; row < a.length; row++) {
    if (a[row]!.length !== b[row]!.length) return false
    for (let col = 0; col < a[row]!.length; col++) {
      if (a[row]![col] !== b[row]![col]) return false
    }
  }
  return true
}

// Resolve a shaped definition into its normalized item shape, or none when a
// pattern references an unknown key character (a data error worth surfacing
// in tests rather than silently matching nothing).
export const resolveShapedDefinition = (
  definition: ShapedRecipeDefinition,
): Option.Option<NormalizedShape> => {
  const cells: Array<Array<InventoryItem | null>> = []
  for (const row of definition.pattern) {
    const outRow: Array<InventoryItem | null> = []
    for (const char of row) {
      if (char === ' ') {
        outRow.push(null)
        continue
      }
      const item = definition.key[char]
      if (item === undefined) return Option.none()
      outRow.push(item)
    }
    cells.push(outRow)
  }
  return Option.some(normalize(cells))
}

// Does the 3x3 grid contain exactly this shape (any translation; mirrored
// placements accepted)?
export const matchesShapedGrid = (
  definition: ShapedRecipeDefinition,
  grid: CraftingGrid,
): boolean => {
  const shapeOpt = resolveShapedDefinition(definition)
  if (Option.isNone(shapeOpt)) return false
  const shape = shapeOpt.value

  const gridCells: Array<Array<InventoryItem | null>> = []
  for (let row = 0; row < GRID_SIZE; row++) {
    const outRow: Array<InventoryItem | null> = []
    for (let col = 0; col < GRID_SIZE; col++) {
      outRow.push(grid[row * GRID_SIZE + col] ?? null)
    }
    gridCells.push(outRow)
  }
  const placed = normalize(gridCells)
  if (placed.length === 0) return shape.length === 0
  return shapesEqual(placed, shape) || shapesEqual(placed, mirror(shape))
}

// Ingredient counts a shaped definition consumes — lets the shaped layer
// reuse the existing count-based inventory consumption.
export const shapedIngredientCounts = (
  definition: ShapedRecipeDefinition,
): ReadonlyArray<{ readonly itemType: InventoryItem; readonly count: number }> => {
  const counts = new Map<InventoryItem, number>()
  for (const row of definition.pattern) {
    for (const char of row) {
      if (char === ' ') continue
      const item = definition.key[char]
      if (item === undefined) continue
      counts.set(item, (counts.get(item) ?? 0) + 1)
    }
  }
  return [...counts.entries()].map(([itemType, count]) => ({ itemType, count }))
}
