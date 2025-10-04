import { Brand, Schema } from 'effect'
import { Slot, SlotConstraint, SlotId, SlotState } from './types'

/**
 * SlotId Brand型用Schema
 */
export const SlotIdSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 35),
  Schema.fromBrand(Brand.nominal<SlotId>())
)

/**
 * SlotState ADT用Schema
 */
export const SlotStateSchema: Schema.Schema<SlotState> = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Empty'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Occupied'),
    itemId: Schema.String.pipe(Schema.nonEmptyString()),
    quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Locked'),
    reason: Schema.String.pipe(Schema.nonEmptyString()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Reserved'),
    reservedBy: Schema.String.pipe(Schema.nonEmptyString()),
    duration: Schema.Number.pipe(Schema.positive()),
  })
)

/**
 * SlotConstraint Brand型用Schema
 */
export const SlotConstraintSchema = Schema.Struct({
  maxStackSize: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  allowedItemTypes: Schema.Array(Schema.String.pipe(Schema.nonEmptyString())),
  isLocked: Schema.Boolean,
  isHotbar: Schema.Boolean,
}).pipe(Schema.fromBrand(Brand.nominal<SlotConstraint>()))

/**
 * スロット位置用Schema
 */
export const SlotPositionSchema = Schema.Struct({
  row: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 3) // 0-3行（ホットバー + インベントリ3行）
  ),
  column: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 8) // 0-8列（9列）
  ),
})

/**
 * Slot Brand型用Schema
 */
export const SlotSchema = Schema.Struct({
  id: SlotIdSchema,
  state: SlotStateSchema,
  constraint: SlotConstraintSchema,
  position: SlotPositionSchema,
}).pipe(
  Schema.filter(
    (slot) => {
      // ホットバースロットの位置制約チェック
      if (slot.constraint.isHotbar && slot.position.row !== 0) {
        return false
      }
      // スロットIDと位置の整合性チェック
      const expectedId = slot.position.row * 9 + slot.position.column
      return slot.id === expectedId
    },
    {
      message: () => 'Slot ID must match position (row * 9 + column) and hotbar slots must be in row 0',
    }
  ),
  Schema.fromBrand(Brand.nominal<Slot>())
)

/**
 * アイテムタイプ制約用Schema
 */
export const ItemTypeSchemas = {
  blockItem: Schema.String.pipe(Schema.pattern(/^minecraft:.*_block$/), Schema.brand('BlockItem')),
  tool: Schema.String.pipe(Schema.pattern(/^minecraft:.*(sword|pickaxe|axe|shovel|hoe)$/), Schema.brand('Tool')),
  food: Schema.String.pipe(
    Schema.pattern(/^minecraft:.*(bread|apple|carrot|potato|beef|pork|chicken|fish)$/),
    Schema.brand('Food')
  ),
  material: Schema.String.pipe(Schema.pattern(/^minecraft:.*(ingot|gem|dust|shard)$/), Schema.brand('Material')),
} as const

/**
 * スタックサイズ制約用Schema
 */
export const StackSizeSchemas = {
  single: Schema.Literal(1),
  small: Schema.Number.pipe(Schema.between(1, 16)),
  medium: Schema.Number.pipe(Schema.between(1, 32)),
  full: Schema.Number.pipe(Schema.between(1, 64)),
} as const
