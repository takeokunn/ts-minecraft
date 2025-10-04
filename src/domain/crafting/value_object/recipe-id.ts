import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import { ParseResult } from '@effect/schema/ParseResult'
import { RecipeId, RecipeIdSchema } from '../types'

export const create = (value: string): Effect.Effect<RecipeId, ParseResult.ParseError> =>
  Schema.decodeEffect(RecipeIdSchema)(value)

export const toString = (value: RecipeId): string => value
