import { Schema } from 'effect'
import { InventoryItemSchema, RecipeIdSchema } from '@ts-minecraft/kernel'

export const CraftingStationSchema = Schema.Literal('inventory', 'crafting_table', 'furnace')
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
}) {}
