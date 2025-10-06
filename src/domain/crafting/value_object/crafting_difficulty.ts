import { ParseResult } from '@effect/schema/ParseResult'
import { Effect, Schema } from 'effect'
import { CraftingDifficulty, CraftingDifficultySchema } from '../aggregate'

export const create = (value: number): Effect.Effect<CraftingDifficulty, ParseResult.ParseError> =>
  Schema.decode(CraftingDifficultySchema)(value)

export const toNumber = (value: CraftingDifficulty): number => value
