import { Schema } from 'effect'
import { BlockTypeSchema } from '@/domain/block'

export class RecipeIngredient extends Schema.Class<RecipeIngredient>('RecipeIngredient')({
  blockType: BlockTypeSchema,
  count: Schema.Number.pipe(Schema.between(1, 64)),
}) {}

export class Recipe extends Schema.Class<Recipe>('Recipe')({
  id: Schema.String,
  ingredients: Schema.Array(RecipeIngredient).pipe(Schema.minItems(1)),
  output: Schema.Struct({
    blockType: BlockTypeSchema,
    count: Schema.Number.pipe(Schema.between(1, 64)),
  }),
}) {}
