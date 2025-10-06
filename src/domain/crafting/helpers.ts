/**
 * Crafting Helper Functions
 *
 * クラフティング関連のユーティリティ関数を提供します。
 */

import { Array, Effect, Option, pipe } from 'effect'
import type { CraftingGrid, CraftingItemStack, GridCoordinate, GridHeight, GridSlot, GridWidth } from './types/index'

/**
 * グリッドスロット列を2次元配列に変換（純粋関数）
 */
export const gridToMatrix = (grid: CraftingGrid): ReadonlyArray<ReadonlyArray<Option.Option<CraftingItemStack>>> => {
  const height = Number(grid.height)
  const width = Number(grid.width)
  return pipe(
    Array.range(0, height - 1),
    Array.map((row) =>
      pipe(
        Array.range(0, width - 1),
        Array.map((column) =>
          pipe(
            grid.slots,
            Array.findFirst((slot) => slot.coordinate.x === column && slot.coordinate.y === row),
            Option.flatMap((slot) => (slot._tag === 'OccupiedSlot' ? Option.some(slot.stack) : Option.none()))
          )
        )
      )
    )
  )
}

/**
 * 空のグリッドを生成
 */
export const buildEmptyGrid = (width: GridWidth, height: GridHeight): Effect.Effect<CraftingGrid, never> => {
  const size = { width: Number(width), height: Number(height) }
  return Effect.succeed({
    width,
    height,
    slots: pipe(
      Array.range(0, size.height - 1),
      Array.flatMap((y) =>
        pipe(
          Array.range(0, size.width - 1),
          Array.map((x) => ({
            _tag: 'EmptySlot' as const,
            coordinate: { x, y },
          }))
        )
      )
    ),
  })
}

/**
 * 指定座標のスロットを取得
 */
export const slotAt = (grid: CraftingGrid, coordinate: GridCoordinate): Option.Option<GridSlot> =>
  pipe(
    grid.slots,
    Array.findFirst((slot) => slot.coordinate.x === coordinate.x && slot.coordinate.y === coordinate.y)
  )

/**
 * スロットを置換
 */
export const replaceSlot = (grid: CraftingGrid, slot: GridSlot): CraftingGrid => ({
  ...grid,
  slots: pipe(
    grid.slots,
    Array.map((existing) =>
      existing.coordinate.x === slot.coordinate.x && existing.coordinate.y === slot.coordinate.y ? slot : existing
    )
  ),
})
