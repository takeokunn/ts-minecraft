import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import { ParseResult } from '@effect/schema/ParseResult'
import { IngredientQuantity, IngredientQuantitySchema } from '../types'

export const create = (value: number): Effect.Effect<IngredientQuantity, ParseResult.ParseError> =>
  Schema.decodeEffect(IngredientQuantitySchema)(value)

export const toNumber = (value: IngredientQuantity): number => value
