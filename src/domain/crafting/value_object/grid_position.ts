import { ParseResult } from '@effect/schema/ParseResult'
import { Effect, Schema } from 'effect'
import { GridCoordinateSchema } from '../types'

export interface GridPosition {
  readonly x: number
  readonly y: number
}

export const create = (x: number, y: number): Effect.Effect<GridPosition, ParseResult.ParseError> =>
  Schema.decode(GridCoordinateSchema)({ x, y })
