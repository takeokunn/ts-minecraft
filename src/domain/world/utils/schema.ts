import { Schema } from 'effect'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const uuid = () => Schema.pattern(UUID_REGEX)

export const taggedUnion = <Members extends ReadonlyArray<Schema.Schema<any>> | Record<string, Schema.Schema<any>>>(
  _tag: string,
  members: Members
) => {
  if (Array.isArray(members)) {
    return Schema.Union(...members)
  }

  return Schema.Union(...Object.values(members))
}
