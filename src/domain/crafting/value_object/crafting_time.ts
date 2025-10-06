import { ParseResult } from '@effect/schema/ParseResult'
import { Effect, Schema } from 'effect'
import { CraftingTime, CraftingTimeSchema } from '../aggregate'

export const create = (value: number): Effect.Effect<CraftingTime, ParseResult.ParseError> =>
  Schema.decode(CraftingTimeSchema)(value)

export const toMilliseconds = (value: CraftingTime): number => value
