import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import { ParseResult } from '@effect/schema/ParseResult'
import { CraftingDifficulty, CraftingDifficultySchema } from '../aggregate/recipe'

export const create = (value: number): Effect.Effect<CraftingDifficulty, ParseResult.ParseError> =>
  Schema.decodeEffect(CraftingDifficultySchema)(value)

export const toNumber = (value: CraftingDifficulty): number => value
