import { Effect, Either, Schema } from 'effect'

export const decodeEffect = <I, A>(schema: Schema.Schema<I, A>, input: I): Effect.Effect<A, Schema.ParseError> =>
  Schema.decode(schema)(input)

export const decodeEither = <I, A>(schema: Schema.Schema<I, A>, input: I): Either.Either<Schema.ParseError, A> =>
  Schema.validateEither(schema)(input)
