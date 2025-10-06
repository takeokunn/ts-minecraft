import { Schema } from '@effect/schema'
import { ParseResult } from '@effect/schema/ParseResult'
import { Effect } from 'effect'
import { CraftingDifficulty, CraftingDifficultySchema } from '../aggregate'

export const create = (value: number): Effect.Effect<CraftingDifficulty, ParseResult.ParseError> =>
  Schema.decodeEffect(CraftingDifficultySchema)(value)

export const toNumber = (value: CraftingDifficulty): number => value
