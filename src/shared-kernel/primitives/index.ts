import type { ParseError } from '@effect/schema/ParseResult'
import { formatErrorSync } from '@effect/schema/TreeFormatter'
import { Schema } from 'effect'

export type SchemaCarrier = { readonly schema: Schema.Schema<any, any> }

export const createBranded = <Name extends string, A, I>(options: {
  readonly name: Name
  readonly schema: Schema.Schema<A, I>
  readonly description?: string
}) => {
  const schema = options.schema.pipe(
    Schema.brand(options.name),
    Schema.annotations({
      identifier: options.name,
      description: options.description,
    })
  )

  return {
    name: options.name,
    schema,
    decode: Schema.decode(schema),
    decodeSync: Schema.decodeSync(schema),
  }
}

export type InferBranded<T extends SchemaCarrier> = Schema.Schema.Type<T['schema']>
export type InputOf<T extends SchemaCarrier> = Schema.Schema.Input<T['schema']>

export const toRuntimeError = (error: ParseError): Error => new Error(formatErrorSync(error))
