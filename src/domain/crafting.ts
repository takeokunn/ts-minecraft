import { Schema } from 'effect'
import { BlockTypeSchema } from '@/domain/block'
import { RecipeIdSchema } from '@/shared/kernel'

export const CraftingStationSchema = Schema.Literal('inventory', 'crafting_table')
export type CraftingStation = Schema.Schema.Type<typeof CraftingStationSchema>

export class RecipeIngredient extends Schema.Class<RecipeIngredient>('RecipeIngredient')({
  blockType: BlockTypeSchema,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
}) {}

export class Recipe extends Schema.Class<Recipe>('Recipe')({
  id: RecipeIdSchema,
  station: CraftingStationSchema,
  ingredients: Schema.Array(RecipeIngredient).pipe(Schema.minItems(1)),
  output: Schema.Struct({
    blockType: BlockTypeSchema,
    count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  }),
}) {}
