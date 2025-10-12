import { Match, Schema, pipe } from 'effect'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const uuid = () => Schema.pattern(UUID_REGEX)

type AnySchema = Schema.Schema<unknown, unknown, never>

export const taggedUnion = <Members extends ReadonlyArray<AnySchema> | Record<string, AnySchema>>(
  _tag: string,
  members: Members
) =>
  pipe(
    Match.value(members),
    Match.when(Array.isArray, (arrayMembers) => Schema.Union(...arrayMembers)),
    Match.orElse(() => Schema.Union(...Object.values(members)))
  )
