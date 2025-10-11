import { Effect, Match, pipe, ReadonlyArray, Schema } from 'effect'
import { GridCoordinateSchema, SlotPositionSchema } from './schema'
import {
  AdjacentSlots,
  CoordinateConfig,
  CoordinateTransform,
  GridCoordinate,
  makeUnsafeSlotPosition,
  SlotPattern,
  SlotPosition,
  SlotPositionError,
  SlotRange,
  SlotSection,
  TransformResult,
} from './types'

/**
 * Brand型から数値を安全に抽出するヘルパー関数
 * Schema.make(Schema.Number)を使用してBrand型を数値に変換
 */
const slotPositionToNumber = (value: SlotPosition): number => Schema.make(Schema.Number)(value)

/**
 * SlotPosition ファクトリー関数
 */
export const createSlotPosition = (position: number): Effect.Effect<SlotPosition, SlotPositionError> =>
  pipe(
    Schema.decodeUnknown(SlotPositionSchema)(position),
    Effect.mapError(() =>
      SlotPositionError.PositionOutOfRange({
        position,
        min: 0,
        max: 35,
      })
    )
  )

/**
 * GridCoordinate ファクトリー関数
 */
export const createGridCoordinate = (row: number, column: number): Effect.Effect<GridCoordinate, SlotPositionError> =>
  pipe(
    Schema.decodeUnknown(GridCoordinateSchema)({ row, column }),
    Effect.mapError(() =>
      SlotPositionError.InvalidGridCoordinate({
        row,
        column,
        maxRow: 3,
        maxColumn: 8,
      })
    )
  )

/**
 * スロット位置からグリッド座標に変換
 */
export const positionToGrid = (position: SlotPosition): Effect.Effect<GridCoordinate, SlotPositionError> =>
  Effect.gen(function* () {
    const pos = slotPositionToNumber(position)
    const row = Math.floor(pos / 9)
    const column = pos % 9

    return yield* createGridCoordinate(row, column)
  })

/**
 * グリッド座標からスロット位置に変換
 */
export const gridToPosition = (grid: GridCoordinate): Effect.Effect<SlotPosition, SlotPositionError> =>
  Effect.gen(function* () {
    const position = grid.row * 9 + grid.column

    return yield* createSlotPosition(position)
  })

/**
 * ホットバーインデックスからスロット位置に変換
 */
export const hotbarToPosition = (hotbarIndex: number): Effect.Effect<SlotPosition, SlotPositionError> =>
  Effect.gen(function* () {
    if (hotbarIndex < 0 || hotbarIndex > 8) {
      return yield* Effect.fail(
        SlotPositionError.InvalidHotbarIndex({
          index: hotbarIndex,
          validRange: '0-8',
        })
      )
    }

    return yield* createSlotPosition(hotbarIndex)
  })

/**
 * スロット位置からホットバーインデックスに変換
 */
export const positionToHotbar = (position: SlotPosition): Effect.Effect<number, SlotPositionError> =>
  Effect.gen(function* () {
    const pos = slotPositionToNumber(position)

    if (pos < 0 || pos > 8) {
      return yield* Effect.fail(
        SlotPositionError.SectionMismatch({
          position,
          expectedSection: 'Hotbar',
          actualSection: 'MainInventory',
        })
      )
    }

    return pos
  })

/**
 * 防具スロットタイプからスロット位置に変換
 */
export const armorSlotToPosition = (
  armorType: 'helmet' | 'chestplate' | 'leggings' | 'boots'
): Effect.Effect<SlotPosition, SlotPositionError> =>
  Effect.gen(function* () {
    const armorPositions = {
      helmet: 36,
      chestplate: 37,
      leggings: 38,
      boots: 39,
    }

    const position = armorPositions[armorType]
    return yield* createSlotPosition(position)
  })

/**
 * スロット位置から防具スロットタイプに変換
 */
export const positionToArmorSlot = (
  position: SlotPosition
): Effect.Effect<'helmet' | 'chestplate' | 'leggings' | 'boots', SlotPositionError> =>
  Effect.gen(function* () {
    const pos = slotPositionToNumber(position)
    const armorSlots = {
      36: 'helmet' as const,
      37: 'chestplate' as const,
      38: 'leggings' as const,
      39: 'boots' as const,
    }

    const armorType = armorSlots[pos as 36 | 37 | 38 | 39]
    if (!armorType) {
      return yield* Effect.fail(
        SlotPositionError.InvalidArmorSlot({
          slot: pos.toString(),
          validSlots: ['helmet', 'chestplate', 'leggings', 'boots'],
        })
      )
    }

    return armorType
  })

/**
 * スロット位置が属するセクションを判定
 */
export const getSlotSection = (position: SlotPosition): SlotSection => {
  const pos = slotPositionToNumber(position)

  return pipe(
    pos,
    Match.value,
    Match.when(
      (p) => p >= 0 && p <= 8,
      () =>
        SlotSection.Hotbar({
          startIndex: 0,
          endIndex: 8,
          priority: 'highest',
        })
    ),
    Match.when(
      (p) => p >= 9 && p <= 35,
      () =>
        SlotSection.MainInventory({
          startIndex: 9,
          endIndex: 35,
          priority: 'normal',
        })
    ),
    Match.when(
      (p) => p >= 36 && p <= 39,
      () =>
        SlotSection.ArmorSlots({
          helmet: 36,
          chestplate: 37,
          leggings: 38,
          boots: 39,
        })
    ),
    Match.when(
      (p) => p === 40,
      () =>
        SlotSection.OffhandSlot({
          index: 40,
        })
    ),
    Match.orElse(() =>
      // デフォルトでメインインベントリとして扱う
      SlotSection.MainInventory({
        startIndex: 9,
        endIndex: 35,
        priority: 'normal',
      })
    )
  )
}

/**
 * セクション内のスロット範囲を取得
 */
export const getSlotRange = (section: SlotSection): Effect.Effect<SlotRange, SlotPositionError> =>
  Effect.gen(function* () {
    return pipe(
      section,
      Match.value,
      Match.tag('Hotbar', (hotbar) =>
        Effect.gen(function* () {
          const start = yield* createSlotPosition(hotbar.startIndex)
          const end = yield* createSlotPosition(hotbar.endIndex)
          return {
            start,
            end,
            length: hotbar.endIndex - hotbar.startIndex + 1,
            section,
          }
        })
      ),
      Match.tag('MainInventory', (main) =>
        Effect.gen(function* () {
          const start = yield* createSlotPosition(main.startIndex)
          const end = yield* createSlotPosition(main.endIndex)
          return {
            start,
            end,
            length: main.endIndex - main.startIndex + 1,
            section,
          }
        })
      ),
      Match.tag('ArmorSlots', () =>
        Effect.gen(function* () {
          const start = yield* createSlotPosition(36)
          const end = yield* createSlotPosition(39)
          return {
            start,
            end,
            length: 4,
            section,
          }
        })
      ),
      Match.tag('OffhandSlot', (offhand) =>
        Effect.gen(function* () {
          const position = yield* createSlotPosition(offhand.index)
          return {
            start: position,
            end: position,
            length: 1,
            section,
          }
        })
      ),
      Match.tag('CraftingGrid', (crafting) =>
        Effect.gen(function* () {
          const start = yield* createSlotPosition(crafting.startIndex)
          const end = yield* createSlotPosition(crafting.endIndex)
          return {
            start,
            end,
            length: crafting.endIndex - crafting.startIndex + 1,
            section,
          }
        })
      ),
      Match.tag('CraftingResult', (result) =>
        Effect.gen(function* () {
          const position = yield* createSlotPosition(result.index)
          return {
            start: position,
            end: position,
            length: 1,
            section,
          }
        })
      ),
      Match.exhaustive,
      Effect.flatten
    )
  })

/**
 * 隣接するスロットを取得
 */
export const getAdjacentSlots = (
  position: SlotPosition,
  config?: CoordinateConfig
): Effect.Effect<AdjacentSlots, SlotPositionError> =>
  Effect.gen(function* () {
    const grid = yield* positionToGrid(position)
    const { row, column } = grid

    const adjacent: AdjacentSlots = {}

    // 上のスロット
    if (row > 0) {
      const aboveGrid = yield* createGridCoordinate(row - 1, column)
      adjacent.above = yield* gridToPosition(aboveGrid)
    }

    // 下のスロット
    if (row < 3) {
      const belowGrid = yield* createGridCoordinate(row + 1, column)
      adjacent.below = yield* gridToPosition(belowGrid)
    }

    // 左のスロット
    if (column > 0) {
      const leftGrid = yield* createGridCoordinate(row, column - 1)
      adjacent.left = yield* gridToPosition(leftGrid)
    }

    // 右のスロット
    if (column < 8) {
      const rightGrid = yield* createGridCoordinate(row, column + 1)
      adjacent.right = yield* gridToPosition(rightGrid)
    }

    // 対角線上のスロット
    adjacent.diagonal = {}

    if (row > 0 && column > 0) {
      const topLeftGrid = yield* createGridCoordinate(row - 1, column - 1)
      adjacent.diagonal.topLeft = yield* gridToPosition(topLeftGrid)
    }

    if (row > 0 && column < 8) {
      const topRightGrid = yield* createGridCoordinate(row - 1, column + 1)
      adjacent.diagonal.topRight = yield* gridToPosition(topRightGrid)
    }

    if (row < 3 && column > 0) {
      const bottomLeftGrid = yield* createGridCoordinate(row + 1, column - 1)
      adjacent.diagonal.bottomLeft = yield* gridToPosition(bottomLeftGrid)
    }

    if (row < 3 && column < 8) {
      const bottomRightGrid = yield* createGridCoordinate(row + 1, column + 1)
      adjacent.diagonal.bottomRight = yield* gridToPosition(bottomRightGrid)
    }

    return adjacent
  })

/**
 * スロット位置がホットバーかどうかを判定
 */
export const isHotbarSlot = (position: SlotPosition): boolean => {
  const pos = slotPositionToNumber(position)
  return pos >= 0 && pos <= 8
}

/**
 * スロット位置がメインインベントリかどうかを判定
 */
export const isMainInventorySlot = (position: SlotPosition): boolean => {
  const pos = slotPositionToNumber(position)
  return pos >= 9 && pos <= 35
}

/**
 * スロット位置が防具スロットかどうかを判定
 */
export const isArmorSlot = (position: SlotPosition): boolean => {
  const pos = slotPositionToNumber(position)
  return pos >= 36 && pos <= 39
}

/**
 * スロット位置がオフハンドスロットかどうかを判定
 */
export const isOffhandSlot = (position: SlotPosition): boolean => slotPositionToNumber(position) === 40

/**
 * スロット位置間の距離を計算
 */
export const calculateDistance = (
  position1: SlotPosition,
  position2: SlotPosition
): Effect.Effect<number, SlotPositionError> =>
  Effect.gen(function* () {
    const grid1 = yield* positionToGrid(position1)
    const grid2 = yield* positionToGrid(position2)

    const rowDiff = Math.abs(grid1.row - grid2.row)
    const colDiff = Math.abs(grid1.column - grid2.column)

    // マンハッタン距離
    return rowDiff + colDiff
  })

/**
 * 範囲内のすべてのスロット位置を取得
 */
export const getSlotPositionsInRange = (
  startPosition: SlotPosition,
  endPosition: SlotPosition
): Effect.Effect<readonly SlotPosition[], SlotPositionError> =>
  Effect.gen(function* () {
    const start = slotPositionToNumber(startPosition)
    const end = slotPositionToNumber(endPosition)

    if (start > end) {
      return yield* Effect.fail(
        SlotPositionError.PositionOutOfRange({
          position: start,
          min: 0,
          max: end,
        })
      )
    }

    return yield* pipe(
      ReadonlyArray.range(start, end + 1),
      Effect.forEach((i) => createSlotPosition(i), { concurrency: 4 })
    )
  })

/**
 * スロットパターンから利用可能な位置を取得
 */
export const getAvailablePositions = (
  pattern: SlotPattern
): Effect.Effect<readonly SlotPosition[], SlotPositionError> =>
  pipe(
    pattern,
    Match.value,
    Match.tag('Standard', () => getSlotPositionsInRange(makeUnsafeSlotPosition(0), makeUnsafeSlotPosition(35))),
    Match.tag('Compact', () => getSlotPositionsInRange(makeUnsafeSlotPosition(0), makeUnsafeSlotPosition(26))),
    Match.tag('Wide', () => getSlotPositionsInRange(makeUnsafeSlotPosition(0), makeUnsafeSlotPosition(8))),
    Match.tag('Creative', () => Effect.succeed([])),
    Match.tag('Crafting', (crafting) =>
      pipe(
        crafting.gridSize,
        Match.value,
        Match.when('2x2', () => getSlotPositionsInRange(makeUnsafeSlotPosition(0), makeUnsafeSlotPosition(4))),
        Match.orElse(() => getSlotPositionsInRange(makeUnsafeSlotPosition(0), makeUnsafeSlotPosition(9)))
      )
    ),
    Match.tag('Furnace', (furnace) => Effect.succeed([furnace.input, furnace.fuel, furnace.output])),
    Match.tag('Anvil', (anvil) => Effect.succeed([anvil.left, anvil.right, anvil.result])),
    Match.exhaustive
  )

/**
 * 座標変換を実行
 */
export const executeTransform = (transform: CoordinateTransform): Effect.Effect<TransformResult, SlotPositionError> =>
  pipe(
    transform,
    Match.value,
    Match.tag('PositionToGrid', (t) =>
      Effect.gen(function* () {
        const grid = yield* positionToGrid(t.position)
        return TransformResult.Success({ result: grid })
      })
    ),
    Match.tag('GridToPosition', (t) =>
      Effect.gen(function* () {
        const position = yield* gridToPosition(t.grid)
        return TransformResult.Success({ result: position })
      })
    ),
    Match.tag('HotbarToPosition', (t) =>
      Effect.gen(function* () {
        const position = yield* hotbarToPosition(t.hotbarIndex)
        return TransformResult.Success({ result: position })
      })
    ),
    Match.tag('PositionToHotbar', (t) =>
      Effect.gen(function* () {
        const hotbarIndex = yield* positionToHotbar(t.position)
        return TransformResult.Success({ result: hotbarIndex })
      })
    ),
    Match.tag('ArmorSlotToPosition', (t) =>
      Effect.gen(function* () {
        const position = yield* armorSlotToPosition(t.armorType)
        return TransformResult.Success({ result: position })
      })
    ),
    Match.tag('PositionToArmorSlot', (t) =>
      Effect.gen(function* () {
        const armorType = yield* positionToArmorSlot(t.position)
        return TransformResult.Success({ result: armorType })
      })
    ),
    Match.exhaustive,
    Effect.flatten
  )

/**
 * スロット位置の並び替え（昇順）
 */
export const sortPositions = (positions: readonly SlotPosition[]): readonly SlotPosition[] =>
  [...positions].sort((a, b) => slotPositionToNumber(a) - slotPositionToNumber(b))

/**
 * スロット位置の並び替え（降順）
 */
export const sortPositionsDescending = (positions: readonly SlotPosition[]): readonly SlotPosition[] =>
  [...positions].sort((a, b) => slotPositionToNumber(b) - slotPositionToNumber(a))

/**
 * スロット位置がグリッドの境界にあるかを判定
 */
export const isEdgeSlot = (position: SlotPosition): Effect.Effect<boolean, SlotPositionError> =>
  Effect.gen(function* () {
    const grid = yield* positionToGrid(position)
    const { row, column } = grid

    // グリッドの端（行0、行3、列0、列8）にあるかチェック
    return row === 0 || row === 3 || column === 0 || column === 8
  })

/**
 * スロット位置がグリッドの角にあるかを判定
 */
export const isCornerSlot = (position: SlotPosition): Effect.Effect<boolean, SlotPositionError> =>
  Effect.gen(function* () {
    const grid = yield* positionToGrid(position)
    const { row, column } = grid

    // グリッドの四隅にあるかチェック
    return (
      (row === 0 && column === 0) ||
      (row === 0 && column === 8) ||
      (row === 3 && column === 0) ||
      (row === 3 && column === 8)
    )
  })
