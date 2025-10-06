import { ParseResult } from '@effect/schema/ParseResult'
import { Effect, Schema } from 'effect'
import { SuccessRate, SuccessRateSchema } from '../aggregate'

export const create = (value: number): Effect.Effect<SuccessRate, ParseResult.ParseError> =>
  Schema.decode(SuccessRateSchema)(value)

export const toNumber = (value: SuccessRate): number => value
