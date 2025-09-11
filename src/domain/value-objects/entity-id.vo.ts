import * as S from 'effect/Schema'
import { pipe } from 'effect'

export const EntityId = pipe(S.String, S.uuid, S.brand('EntityId'))
export type EntityId = S.Schema.Type<typeof EntityId>

export const makeEntityId = () =>
  S.decodeSync(EntityId)(crypto.randomUUID())