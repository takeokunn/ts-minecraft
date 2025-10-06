import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Data, Effect, Either, Schema } from 'effect'
import { pipe } from 'effect/Function'

const ComponentSchema = Schema.Number.pipe(
  Schema.finite({
    identifier: 'FiniteVectorComponent',
    title: 'FiniteVectorComponent',
    description: '有限実数のみを許容するベクトル成分',
  })
)

export const Vector3Schema = Schema.Struct({
  x: ComponentSchema,
  y: ComponentSchema,
  z: ComponentSchema,
}).pipe(Schema.brand('Vector3'))

export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>

export const Vector3Error = Data.taggedEnum({
  SchemaViolation: Data.struct({ message: Schema.String }),
  ZeroVector: Data.struct({}),
})

export type Vector3Error = typeof Vector3Error.Type

const formatParseError = (error: Schema.ParseError) =>
  pipe(
    Effect.try({
      try: () => TreeFormatter.formatError(error, { includeStackTrace: false }),
      catch: () => 'Vector3を構築できません' as const,
    }),
    Effect.runSync
  )

const toSchemaViolation = (error: Schema.ParseError) =>
  Vector3Error.SchemaViolation({ message: formatParseError(error) })

export const fromNumbers = (x: number, y: number, z: number) =>
  pipe(Schema.decode(Vector3Schema)({ x, y, z }), Effect.mapError(toSchemaViolation))

export const fromNumbersEither = (x: number, y: number, z: number) =>
  pipe(Schema.decodeEither(Vector3Schema)({ x, y, z }), Either.mapLeft(toSchemaViolation))

export const magnitude = (vector: Vector3) => Effect.succeed(Math.hypot(vector.x, vector.y, vector.z))

const ensureNonZeroMagnitude = (length: number) =>
  pipe(
    Effect.succeed(length),
    Effect.filterOrFail(
      (value) => value > 0,
      () => Vector3Error.ZeroVector({})
    )
  )

export const normalize = (vector: Vector3) =>
  pipe(
    magnitude(vector),
    Effect.flatMap(ensureNonZeroMagnitude),
    Effect.map((length) => ({
      x: vector.x / length,
      y: vector.y / length,
      z: vector.z / length,
    })),
    Effect.flatMap((normalized) => Schema.decode(Vector3Schema)(normalized)),
    Effect.mapError(toSchemaViolation)
  )

export const dot = (a: Vector3, b: Vector3) => Effect.succeed(a.x * b.x + a.y * b.y + a.z * b.z)

export const translate = (origin: Vector3, offset: Vector3) =>
  pipe(
    Effect.succeed({
      x: origin.x + offset.x,
      y: origin.y + offset.y,
      z: origin.z + offset.z,
    }),
    Effect.flatMap((value) => Schema.decode(Vector3Schema)(value)),
    Effect.mapError(toSchemaViolation)
  )

export const clamp = (vector: Vector3, min: Vector3, max: Vector3) =>
  pipe(
    Effect.all([
      Effect.succeed(Math.min(Math.max(vector.x, min.x), max.x)),
      Effect.succeed(Math.min(Math.max(vector.y, min.y), max.y)),
      Effect.succeed(Math.min(Math.max(vector.z, min.z), max.z)),
    ]),
    Effect.map(([x, y, z]) => ({ x, y, z })),
    Effect.flatMap((value) => Schema.decode(Vector3Schema)(value)),
    Effect.mapError(toSchemaViolation)
  )
