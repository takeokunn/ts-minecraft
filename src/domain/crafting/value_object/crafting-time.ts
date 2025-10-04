import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import { ParseResult } from '@effect/schema/ParseResult'
import { CraftingTime, CraftingTimeSchema } from '../aggregate/recipe'

export const create = (value: number): Effect.Effect<CraftingTime, ParseResult.ParseError> =>
  Schema.decodeEffect(CraftingTimeSchema)(value)

export const toMilliseconds = (value: CraftingTime): number => value
