import { ParseResult } from '@effect/schema/ParseResult'
import { Effect, Schema } from 'effect'
import { IngredientQuantity, IngredientQuantitySchema } from '../types'

export const create = (value: number): Effect.Effect<IngredientQuantity, ParseResult.ParseError> =>
  Schema.decode(IngredientQuantitySchema)(value)

export const toNumber = (value: IngredientQuantity): number => value
