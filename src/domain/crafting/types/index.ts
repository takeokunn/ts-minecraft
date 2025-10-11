import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Schema } from 'effect'

/**
 * ### 基本的なブランド型
 *
 * - ItemId: アイテム識別子（共有カーネルから再エクスポート）
 * - ItemTag: アイテムタグ
 * - ItemQuantity: スタックの数量 (1-64)
 */
export { SimpleItemIdSchema as ItemIdSchema, type ItemId } from '../../../shared/entities/item_id'

export const ItemTagSchema = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64), Schema.brand('ItemTag'))
export type ItemTag = Schema.Schema.Type<typeof ItemTagSchema>

export const ItemQuantitySchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(64),
  Schema.brand('ItemQuantity')
)
export type ItemQuantity = Schema.Schema.Type<typeof ItemQuantitySchema>

export const RecipeIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(96),
  Schema.pattern(/^[a-z0-9_:\-]+$/),
  Schema.brand('RecipeId')
)
export type RecipeId = Schema.Schema.Type<typeof RecipeIdSchema>

/**
 * ### アイテムメタデータ
 */
export const ItemMetadataSchema = Schema.Struct({
  displayName: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  lore: Schema.optional(Schema.Array(Schema.String.pipe(Schema.minLength(1))).pipe(Schema.minItems(1))),
  tags: Schema.optional(Schema.Array(ItemTagSchema).pipe(Schema.minItems(1))),
})
export type ItemMetadata = Schema.Schema.Type<typeof ItemMetadataSchema>

/**
 * ### アイテムスタック
 */
export const CraftingItemStackSchema = Schema.Struct({
  itemId: ItemIdSchema,
  quantity: ItemQuantitySchema,
  metadata: Schema.optional(ItemMetadataSchema),
})
export type CraftingItemStack = Schema.Schema.Type<typeof CraftingItemStackSchema>

/**
 * ### グリッド関連のブランド型
 */
export const GridWidthSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(3),
  Schema.brand('GridWidth')
)
export type GridWidth = Schema.Schema.Type<typeof GridWidthSchema>

export const GridHeightSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(3),
  Schema.brand('GridHeight')
)
export type GridHeight = Schema.Schema.Type<typeof GridHeightSchema>

export const GridCoordinateSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(2)),
  y: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(2)),
})
export type GridCoordinate = Schema.Schema.Type<typeof GridCoordinateSchema>

/**
 * ### グリッドスロット (空 or アイテム)
 */
export const EmptySlotSchema = Schema.Struct({ _tag: Schema.Literal('EmptySlot'), coordinate: GridCoordinateSchema })
export type EmptySlot = Schema.Schema.Type<typeof EmptySlotSchema>

export const OccupiedSlotSchema = Schema.Struct({
  _tag: Schema.Literal('OccupiedSlot'),
  coordinate: GridCoordinateSchema,
  stack: CraftingItemStackSchema,
})
export type OccupiedSlot = Schema.Schema.Type<typeof OccupiedSlotSchema>

export const GridSlotSchema = Schema.Union(EmptySlotSchema, OccupiedSlotSchema)
export type GridSlot = Schema.Schema.Type<typeof GridSlotSchema>

/**
 * ### クラフティンググリッド
 */
export const CraftingGridSchema = Schema.Struct({
  width: GridWidthSchema,
  height: GridHeightSchema,
  slots: Schema.Array(GridSlotSchema).pipe(Schema.minItems(1), Schema.maxItems(9)),
})
export type CraftingGrid = Schema.Schema.Type<typeof CraftingGridSchema>

/**
 * ### レシピ定義に使用するブランド型
 */
export const RecipePatternKeySchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(1),
  Schema.pattern(/^[A-Z]$/),
  Schema.brand('RecipePatternKey')
)
export type RecipePatternKey = Schema.Schema.Type<typeof RecipePatternKeySchema>

export const IngredientQuantitySchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(64),
  Schema.brand('IngredientQuantity')
)
export type IngredientQuantity = Schema.Schema.Type<typeof IngredientQuantitySchema>

export const ExactItemMatcherSchema = Schema.Struct({
  _tag: Schema.Literal('exact'),
  item: CraftingItemStackSchema,
})
export type ExactItemMatcher = Schema.Schema.Type<typeof ExactItemMatcherSchema>

export const TagItemMatcherSchema = Schema.Struct({
  _tag: Schema.Literal('tag'),
  tag: ItemTagSchema,
  quantity: IngredientQuantitySchema,
})
export type TagItemMatcher = Schema.Schema.Type<typeof TagItemMatcherSchema>

export const ItemMatcherSchema = Schema.Union(ExactItemMatcherSchema, TagItemMatcherSchema)
export type ItemMatcher = Schema.Schema.Type<typeof ItemMatcherSchema>

export const RecipeIngredientSchema = Schema.Struct({
  key: RecipePatternKeySchema,
  matcher: ItemMatcherSchema,
  quantity: IngredientQuantitySchema,
})
export type RecipeIngredient = Schema.Schema.Type<typeof RecipeIngredientSchema>

export const RecipePatternRowSchema = Schema.Array(Schema.Union(RecipePatternKeySchema, Schema.Null)).pipe(
  Schema.minItems(1),
  Schema.maxItems(3)
)
export type RecipePatternRow = Schema.Schema.Type<typeof RecipePatternRowSchema>

export const RecipePatternSchema = Schema.Array(RecipePatternRowSchema).pipe(Schema.minItems(1), Schema.maxItems(3))
export type RecipePattern = Schema.Schema.Type<typeof RecipePatternSchema>

export const ShapedRecipeSchema = Schema.Struct({
  _tag: Schema.Literal('shaped'),
  id: RecipeIdSchema,
  pattern: RecipePatternSchema,
  ingredients: Schema.Array(RecipeIngredientSchema).pipe(Schema.minItems(1)),
  result: CraftingItemStackSchema,
  description: Schema.optional(Schema.String),
})
export type ShapedRecipe = Schema.Schema.Type<typeof ShapedRecipeSchema>

export const ShapelessRecipeSchema = Schema.Struct({
  _tag: Schema.Literal('shapeless'),
  id: RecipeIdSchema,
  ingredients: Schema.Array(ItemMatcherSchema).pipe(Schema.minItems(1), Schema.maxItems(9)),
  result: CraftingItemStackSchema,
  description: Schema.optional(Schema.String),
})
export type ShapelessRecipe = Schema.Schema.Type<typeof ShapelessRecipeSchema>

export const CraftingRecipeSchema = Schema.Union(ShapedRecipeSchema, ShapelessRecipeSchema)
export type CraftingRecipe = Schema.Schema.Type<typeof CraftingRecipeSchema>

/**
 * ### レシピ検証結果
 */
export const RecipeValidationIssueSchema = Schema.Struct({
  message: Schema.String,
  path: Schema.Array(Schema.String),
})
export type RecipeValidationIssue = Schema.Schema.Type<typeof RecipeValidationIssueSchema>

export const RecipeValidationResultSchema = Schema.Struct({
  valid: Schema.Boolean,
  issues: Schema.Array(RecipeValidationIssueSchema),
})
export type RecipeValidationResult = Schema.Schema.Type<typeof RecipeValidationResultSchema>

/**
 * ### エラー定義
 */
export const InvalidRecipeErrorSchema = Schema.TaggedError('InvalidRecipeError', {
  recipeId: RecipeIdSchema,
  issues: Schema.Array(RecipeValidationIssueSchema),
})

export type InvalidRecipeError = Schema.Schema.Type<typeof InvalidRecipeErrorSchema>

export const InvalidRecipeError = makeErrorFactory(InvalidRecipeErrorSchema)

export const PatternMismatchErrorSchema = Schema.TaggedError('PatternMismatchError', {
  recipeId: RecipeIdSchema,
  reason: Schema.String,
})

export type PatternMismatchError = Schema.Schema.Type<typeof PatternMismatchErrorSchema>

export const PatternMismatchError = makeErrorFactory(PatternMismatchErrorSchema)

/**
 * ### ヘルパー関数
 */
export const decodeItemStack = Schema.decode(CraftingItemStackSchema)
export const decodeRecipe = Schema.decode(CraftingRecipeSchema)
export const decodeGrid = Schema.decode(CraftingGridSchema)

// Grid操作関数を再エクスポート
export { buildEmptyGrid, replaceSlot, slotAt } from '../helpers'
