import { Schema } from '@effect/schema'
import { Brand } from 'effect'

/**
 * Recipe System Core Types
 *
 * ブランド型とスキーマによる型安全なレシピシステム基盤
 */

// ===== Brand Types =====

export type RecipeId = string & Brand.Brand<'RecipeId'>
export const RecipeId = Brand.nominal<RecipeId>()

export type ItemStackCount = number & Brand.Brand<'ItemStackCount'>
export const ItemStackCount = Brand.nominal<ItemStackCount>()

export type GridWidth = number & Brand.Brand<'GridWidth'>
export const GridWidth = Brand.nominal<GridWidth>()

export type GridHeight = number & Brand.Brand<'GridHeight'>
export const GridHeight = Brand.nominal<GridHeight>()

// ===== Schema Definitions =====

export const RecipeIdSchema = Schema.String.pipe(Schema.minLength(1), Schema.brand('RecipeId'))

export const ItemStackCountSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.lessThanOrEqualTo(64),
  Schema.brand('ItemStackCount')
)

export const GridWidthSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.lessThanOrEqualTo(3),
  Schema.brand('GridWidth')
)

export const GridHeightSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.lessThanOrEqualTo(3),
  Schema.brand('GridHeight')
)

// ===== Item Matcher =====

export const ExactItemMatcher = Schema.Struct({
  _tag: Schema.Literal('exact'),
  itemId: Schema.String,
})

export const TagItemMatcher = Schema.Struct({
  _tag: Schema.Literal('tag'),
  tag: Schema.String,
})

export const CustomItemMatcher = Schema.Struct({
  _tag: Schema.Literal('custom'),
  predicate: Schema.Any, // Functions are complex to schema-encode
})

export const ItemMatcher = Schema.Union(ExactItemMatcher, TagItemMatcher, CustomItemMatcher)

export type ExactItemMatcher = Schema.Schema.Type<typeof ExactItemMatcher>
export type TagItemMatcher = Schema.Schema.Type<typeof TagItemMatcher>
export type CustomItemMatcher = Schema.Schema.Type<typeof CustomItemMatcher>
export type ItemMatcher = Schema.Schema.Type<typeof ItemMatcher>

// ===== Recipe Categories =====

export const RecipeCategory = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('crafting'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('smelting'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('smithing'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('stonecutting'),
  })
)

export type RecipeCategory = Schema.Schema.Type<typeof RecipeCategory>

// ===== Item Stack for Crafting =====

export const CraftingItemStack = Schema.Struct({
  itemId: Schema.String,
  count: ItemStackCountSchema,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export type CraftingItemStack = Schema.Schema.Type<typeof CraftingItemStack>

// ===== Recipe Pattern =====

export const RecipePattern = Schema.Array(Schema.Array(Schema.NullOr(Schema.String)))

export type RecipePattern = Schema.Schema.Type<typeof RecipePattern>

// ===== Crafting Recipe =====

export const ShapedRecipe = Schema.Struct({
  _tag: Schema.Literal('shaped'),
  id: RecipeIdSchema,
  pattern: RecipePattern,
  ingredients: Schema.Record({ key: Schema.String, value: ItemMatcher }),
  result: CraftingItemStack,
  category: RecipeCategory,
})

export const ShapelessRecipe = Schema.Struct({
  _tag: Schema.Literal('shapeless'),
  id: RecipeIdSchema,
  ingredients: Schema.Array(ItemMatcher),
  result: CraftingItemStack,
  category: RecipeCategory,
})

export const CraftingRecipe = Schema.Union(ShapedRecipe, ShapelessRecipe)

export type ShapedRecipe = Schema.Schema.Type<typeof ShapedRecipe>
export type ShapelessRecipe = Schema.Schema.Type<typeof ShapelessRecipe>
export type CraftingRecipe = Schema.Schema.Type<typeof CraftingRecipe>

// ===== Crafting Grid =====

export const CraftingGrid = Schema.Struct({
  _tag: Schema.Literal('CraftingGrid'),
  width: GridWidthSchema,
  height: GridHeightSchema,
  slots: Schema.Array(Schema.Array(Schema.NullOr(CraftingItemStack))),
})

export type CraftingGrid = Schema.Schema.Type<typeof CraftingGrid>

// ===== Recipe Errors =====

export class DuplicateRecipeError extends Schema.TaggedError<DuplicateRecipeError>()('DuplicateRecipeError', {
  recipeId: RecipeIdSchema,
}) {}

export class InvalidRecipeError extends Schema.TaggedError<InvalidRecipeError>()('InvalidRecipeError', {
  recipeId: RecipeIdSchema,
  reason: Schema.String,
}) {}

export class RecipeNotFoundError extends Schema.TaggedError<RecipeNotFoundError>()('RecipeNotFoundError', {
  recipeId: RecipeIdSchema,
}) {}

export class PatternMismatchError extends Schema.TaggedError<PatternMismatchError>()('PatternMismatchError', {
  recipeId: RecipeIdSchema,
  gridPattern: Schema.String,
  expectedPattern: Schema.String,
}) {}

// ===== Recipe Validation Result =====

export const RecipeValidationResult = Schema.Struct({
  _tag: Schema.Literal('RecipeValidationResult'),
  isValid: Schema.Boolean,
  errors: Schema.Array(Schema.Union(InvalidRecipeError, PatternMismatchError)),
})

export type RecipeValidationResult = Schema.Schema.Type<typeof RecipeValidationResult>

// ===== Crafting Result =====

export const CraftingResult = Schema.Struct({
  _tag: Schema.Literal('CraftingResult'),
  success: Schema.Boolean,
  result: Schema.optional(CraftingItemStack),
  consumedItems: Schema.Array(CraftingItemStack),
  remainingGrid: CraftingGrid,
  usedRecipe: Schema.optional(CraftingRecipe),
})

export type CraftingResult = Schema.Schema.Type<typeof CraftingResult>

// ===== Type Guards and Utilities =====

export const isShapedRecipe = (recipe: CraftingRecipe): recipe is ShapedRecipe => recipe._tag === 'shaped'

export const isShapelessRecipe = (recipe: CraftingRecipe): recipe is ShapelessRecipe => recipe._tag === 'shapeless'

export const isExactItemMatcher = (matcher: ItemMatcher): matcher is ExactItemMatcher => matcher._tag === 'exact'

export const isTagItemMatcher = (matcher: ItemMatcher): matcher is TagItemMatcher => matcher._tag === 'tag'

export const isCustomItemMatcher = (matcher: ItemMatcher): matcher is CustomItemMatcher => matcher._tag === 'custom'

export const createEmptyCraftingGrid = (width: GridWidth, height: GridHeight): CraftingGrid => ({
  _tag: 'CraftingGrid',
  width,
  height,
  slots: Array.from({ length: height }, () => Array.from({ length: width }, () => null)),
})
