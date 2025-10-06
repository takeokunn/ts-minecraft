import { Schema } from '@effect/schema'
import { ParseResult } from '@effect/schema/ParseResult'
import { Effect } from 'effect'
import { SuccessRate, SuccessRateSchema } from '../aggregate'

export const create = (value: number): Effect.Effect<SuccessRate, ParseResult.ParseError> =>
  Schema.decodeEffect(SuccessRateSchema)(value)

export const toNumber = (value: SuccessRate): number => value
