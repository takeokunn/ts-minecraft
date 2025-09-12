import * as S from 'effect/Schema'
import { Effect, pipe } from 'effect'
import type { ParseResult } from 'effect/ParseResult'

export const EntityId = pipe(S.String, S.brand('EntityId'))
export type EntityId = S.Schema.Type<typeof EntityId>

export const makeEntityId = (): Effect.Effect<EntityId, ParseResult.ParseError> =>
  pipe(
    crypto.randomUUID(),
    S.decode(EntityId)
  )

export const fromString = (value: unknown): Effect.Effect<EntityId, ParseResult.ParseError> =>
  pipe(
    value,
    S.decode(EntityId)
  )
