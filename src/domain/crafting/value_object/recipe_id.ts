import { Schema } from '@effect/schema'
import { ParseResult } from '@effect/schema/ParseResult'
import { Effect } from 'effect'
import { RecipeId, RecipeIdSchema } from '../types'

export const create = (value: string): Effect.Effect<RecipeId, ParseResult.ParseError> =>
  Schema.decodeEffect(RecipeIdSchema)(value)

export const toString = (value: RecipeId): string => value
