import { Schema } from '@effect/schema'
import { ParseResult } from '@effect/schema/ParseResult'
import { Effect } from 'effect'
import { GridCoordinateSchema } from '../types'

export interface GridPosition {
  readonly x: number
  readonly y: number
}

export const create = (x: number, y: number): Effect.Effect<GridPosition, ParseResult.ParseError> =>
  Schema.decodeEffect(GridCoordinateSchema)({ x, y })
