import { Schema } from '@effect/schema'
import { ParseResult } from '@effect/schema/ParseResult'
import { Effect } from 'effect'
import { CraftingTime, CraftingTimeSchema } from '../aggregate'

export const create = (value: number): Effect.Effect<CraftingTime, ParseResult.ParseError> =>
  Schema.decodeEffect(CraftingTimeSchema)(value)

export const toMilliseconds = (value: CraftingTime): number => value
