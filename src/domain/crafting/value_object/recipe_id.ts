import { ParseResult } from '@effect/schema/ParseResult'
import { Effect, Schema } from 'effect'
import { RecipeId, RecipeIdSchema } from '../types'

export const create = (value: string): Effect.Effect<RecipeId, ParseResult.ParseError> =>
  Schema.decode(RecipeIdSchema)(value)

export const toString = (value: RecipeId): string => value
