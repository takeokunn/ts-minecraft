import { Brand, Schema } from 'effect'
import { CoordinateTransform, GridCoordinate, SlotPattern, SlotPosition, SlotSection, TransformResult } from './types'

/**
 * SlotPosition Brand型用Schema
 */
export const SlotPositionSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 35),
  Schema.fromBrand(Brand.nominal<SlotPosition>())
)

/**
 * GridCoordinate Brand型用Schema
 */
export const GridCoordinateSchema = Schema.Struct({
  row: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 3) // 0-3行（ホットバー + インベントリ3行）
  ),
  column: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 8) // 0-8列（9列）
  ),
}).pipe(Schema.fromBrand(Brand.nominal<GridCoordinate>()))

/**
 * SlotSection ADT用Schema
 */
export const SlotSectionSchema: Schema.Schema<SlotSection> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Hotbar'),
    startIndex: Schema.Literal(0),
    endIndex: Schema.Literal(8),
    priority: Schema.Literal('highest'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('MainInventory'),
    startIndex: Schema.Literal(9),
    endIndex: Schema.Literal(35),
    priority: Schema.Literal('normal'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('ArmorSlots'),
    helmet: Schema.Literal(36),
    chestplate: Schema.Literal(37),
    leggings: Schema.Literal(38),
    boots: Schema.Literal(39),
  }),
  Schema.Struct({
    _tag: Schema.Literal('OffhandSlot'),
    index: Schema.Literal(40),
  }),
  Schema.Struct({
    _tag: Schema.Literal('CraftingGrid'),
    startIndex: Schema.Literal(1),
    endIndex: Schema.Literal(4),
    gridSize: Schema.Literal('2x2'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('CraftingResult'),
    index: Schema.Literal(0),
  })
)

/**
 * CoordinateTransform ADT用Schema
 */
export const CoordinateTransformSchema: Schema.Schema<CoordinateTransform> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('PositionToGrid'),
    position: SlotPositionSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('GridToPosition'),
    grid: GridCoordinateSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('HotbarToPosition'),
    hotbarIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 8)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('PositionToHotbar'),
    position: SlotPositionSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('ArmorSlotToPosition'),
    armorType: Schema.Union(
      Schema.Literal('helmet'),
      Schema.Literal('chestplate'),
      Schema.Literal('leggings'),
      Schema.Literal('boots')
    ),
  }),
  Schema.Struct({
    _tag: Schema.Literal('PositionToArmorSlot'),
    position: SlotPositionSchema,
  })
)

/**
 * TransformResult ADT用Schema
 */
export const TransformResultSchema: Schema.Schema<TransformResult> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Success'),
    result: Schema.Unknown,
  }),
  Schema.Struct({
    _tag: Schema.Literal('OutOfRange'),
    input: Schema.Number,
    validRange: Schema.Struct({
      min: Schema.Number,
      max: Schema.Number,
    }),
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidSection'),
    section: Schema.String.pipe(Schema.nonEmptyString()),
    reason: Schema.String.pipe(Schema.nonEmptyString()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('UnsupportedTransform'),
    from: Schema.String.pipe(Schema.nonEmptyString()),
    to: Schema.String.pipe(Schema.nonEmptyString()),
  })
)

/**
 * SlotPattern ADT用Schema
 */
export const SlotPatternSchema: Schema.Schema<SlotPattern> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Standard'),
    rows: Schema.Literal(3),
    columns: Schema.Literal(9),
    hotbar: Schema.Literal(true),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Compact'),
    rows: Schema.Literal(2),
    columns: Schema.Literal(9),
    hotbar: Schema.Literal(true),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Wide'),
    rows: Schema.Literal(1),
    columns: Schema.Literal(9),
    hotbar: Schema.Literal(false),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Creative'),
    unlimited: Schema.Literal(true),
    searchable: Schema.Literal(true),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Crafting'),
    gridSize: Schema.Union(Schema.Literal('2x2'), Schema.Literal('3x3')),
    hasResult: Schema.Literal(true),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Furnace'),
    input: SlotPositionSchema,
    fuel: SlotPositionSchema,
    output: SlotPositionSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Anvil'),
    left: SlotPositionSchema,
    right: SlotPositionSchema,
    result: SlotPositionSchema,
  })
)

/**
 * SlotRange用Schema
 */
export const SlotRangeSchema = Schema.Struct({
  start: SlotPositionSchema,
  end: SlotPositionSchema,
  length: Schema.Number.pipe(Schema.int(), Schema.positive()),
  section: SlotSectionSchema,
}).pipe(
  Schema.filter(
    (range) => {
      return (
        (range.end as number) >= (range.start as number) &&
        (range.end as number) - (range.start as number) + 1 === range.length
      )
    },
    {
      message: () => 'SlotRange end must be >= start and length must match the range size',
    }
  )
)

/**
 * CoordinateConfig用Schema
 */
export const CoordinateConfigSchema = Schema.Struct({
  gridWidth: Schema.Number.pipe(Schema.int(), Schema.between(1, 9)),
  gridHeight: Schema.Number.pipe(Schema.int(), Schema.between(1, 6)),
  hotbarSize: Schema.Number.pipe(Schema.int(), Schema.between(1, 9)),
  totalSlots: Schema.Number.pipe(Schema.int(), Schema.between(1, 54)),
  hasArmorSlots: Schema.Boolean,
  hasOffhandSlot: Schema.Boolean,
  hasCraftingGrid: Schema.Boolean,
})

/**
 * AdjacentSlots用Schema
 */
export const AdjacentSlotsSchema = Schema.Struct({
  above: Schema.optional(SlotPositionSchema),
  below: Schema.optional(SlotPositionSchema),
  left: Schema.optional(SlotPositionSchema),
  right: Schema.optional(SlotPositionSchema),
  diagonal: Schema.optional(
    Schema.Struct({
      topLeft: Schema.optional(SlotPositionSchema),
      topRight: Schema.optional(SlotPositionSchema),
      bottomLeft: Schema.optional(SlotPositionSchema),
      bottomRight: Schema.optional(SlotPositionSchema),
    })
  ),
})

/**
 * 特定スロット位置用Schema
 */
export const SpecificSlotSchemas = {
  // ホットバースロット（0-8）
  hotbarSlot: Schema.Number.pipe(Schema.int(), Schema.between(0, 8), Schema.fromBrand(Brand.nominal<SlotPosition>())),

  // メインインベントリスロット（9-35）
  mainInventorySlot: Schema.Number.pipe(
    Schema.int(),
    Schema.between(9, 35),
    Schema.fromBrand(Brand.nominal<SlotPosition>())
  ),

  // 防具スロット（36-39）
  armorSlot: Schema.Number.pipe(Schema.int(), Schema.between(36, 39), Schema.fromBrand(Brand.nominal<SlotPosition>())),

  // オフハンドスロット（40）
  offhandSlot: Schema.Literal(40).pipe(Schema.fromBrand(Brand.nominal<SlotPosition>())),

  // クラフトグリッドスロット（1-4）
  craftingSlot: Schema.Number.pipe(Schema.int(), Schema.between(1, 4), Schema.fromBrand(Brand.nominal<SlotPosition>())),

  // クラフト結果スロット（0）
  craftingResultSlot: Schema.Literal(0).pipe(Schema.fromBrand(Brand.nominal<SlotPosition>())),
} as const

/**
 * グリッド操作用Schema
 */
export const GridOperationSchemas = {
  // 行インデックス（0-3）
  rowIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 3)),

  // 列インデックス（0-8）
  columnIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 8)),

  // グリッドサイズ
  gridSize: Schema.Struct({
    width: Schema.Number.pipe(Schema.int(), Schema.between(1, 9)),
    height: Schema.Number.pipe(Schema.int(), Schema.between(1, 6)),
  }),
} as const
