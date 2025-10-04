import { Schema } from '@effect/schema'
import { ParseResult } from '@effect/schema/ParseResult'
import { Effect } from 'effect'
import { IngredientQuantity, IngredientQuantitySchema } from '../types'

export const create = (value: number): Effect.Effect<IngredientQuantity, ParseResult.ParseError> =>
  Schema.decodeEffect(IngredientQuantitySchema)(value)

export const toNumber = (value: IngredientQuantity): number => value
