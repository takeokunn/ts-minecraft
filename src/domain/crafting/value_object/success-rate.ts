import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import { ParseResult } from '@effect/schema/ParseResult'
import { SuccessRate, SuccessRateSchema } from '../aggregate/recipe'

export const create = (value: number): Effect.Effect<SuccessRate, ParseResult.ParseError> =>
  Schema.decodeEffect(SuccessRateSchema)(value)

export const toNumber = (value: SuccessRate): number => value
