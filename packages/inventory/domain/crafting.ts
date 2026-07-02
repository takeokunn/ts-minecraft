import { Schema } from 'effect'
import { InventoryItemSchema, RecipeIdSchema } from '@ts-minecraft/core'

export const CraftingStationSchema = Schema.Literal('inventory', 'crafting_table', 'furnace', 'brewing_stand')
export type CraftingStation = Schema.Schema.Type<typeof CraftingStationSchema>

export class RecipeIngredient extends Schema.Class<RecipeIngredient>('RecipeIngredient')({
  itemType: InventoryItemSchema,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
}) {}

export class Recipe extends Schema.Class<Recipe>('Recipe')({
  id: RecipeIdSchema,
  station: CraftingStationSchema,
  ingredients: Schema.Array(RecipeIngredient).pipe(Schema.minItems(1)),
  output: Schema.Struct({
    itemType: InventoryItemSchema,
    count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  }),
  // Optional shaped 3x3 layout (see shaped-crafting.ts): rows of pattern
  // characters plus a char->item key. `ingredients` stays the source of truth
  // for consumption; a consistency test asserts the two agree.
  shaped: Schema.optional(Schema.Struct({
    pattern: Schema.Array(Schema.String),
    key: Schema.Record({ key: Schema.String, value: InventoryItemSchema }),
  })),
}) {}
