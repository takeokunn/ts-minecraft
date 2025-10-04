import type { ComponentTypeName } from '@domain/entities/types'
import { Schema } from '@effect/schema'
import { Effect } from 'effect'

/**
 * コンポーネント定義
 */
export interface ComponentDefinition<A> {
  readonly type: ComponentTypeName
  readonly schema: Schema.Schema<A>
  readonly description: string
  readonly guard: (input: unknown) => input is A
  readonly validate: (input: unknown) => Effect.Effect<A, Schema.DecodeUnknownError>
  readonly encode: (input: A) => Effect.Effect<unknown, never, never>
}

/**
 * コンポーネント定義ファクトリ
 */
export const makeComponentDefinition = <A>({
  type,
  schema,
  description,
}: {
  readonly type: ComponentTypeName
  readonly schema: Schema.Schema<A>
  readonly description: string
}): ComponentDefinition<A> => {
  const guard = Schema.is(schema)
  const decode = Schema.decodeUnknown(schema)
  const encode = Schema.encode(schema)

  return {
    type,
    schema,
    description,
    guard,
    validate: decode,
    encode,
  }
}
