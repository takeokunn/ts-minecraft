import { Brand, Data, Effect, Either, Match, pipe } from 'effect'

export type DomainRange = Readonly<{ readonly min: number; readonly max: number }>

export const DomainConstants: Readonly<{
  readonly growthStage: DomainRange
  readonly moistureLevel: DomainRange
  readonly soilQuality: DomainRange
  readonly breedingFactor: DomainRange
}> = {
  growthStage: { min: 0, max: 15 },
  moistureLevel: { min: 0, max: 7 },
  soilQuality: { min: 0, max: 100 },
  breedingFactor: { min: 0, max: 1 },
}

export type DomainError = Data.TaggedEnum<{
  ValidationError: { readonly field: string; readonly message: string }
  OutOfRange: { readonly field: string; readonly range: DomainRange; readonly actual: number }
  SchemaViolation: { readonly field: string; readonly message: string }
  InvariantViolation: { readonly description: string }
}>

export const DomainError = Data.taggedEnum<DomainError>()

export const { ValidationError, OutOfRange, SchemaViolation, InvariantViolation } = DomainError

const identifierPattern = /^[A-Za-z0-9_-]+$/

export type Identifier = string & Brand.Brand<'Identifier'>

const IdentifierBrand = Brand.nominal<Identifier>()

export const makeIdentifier = (value: string): Effect.Effect<Identifier, DomainError> =>
  Effect.gen(function* () {
    const trimmed = value.trim()

    yield* pipe(
      trimmed !== value,
      Effect.when({
        onTrue: () =>
          Effect.fail(
            ValidationError({ field: 'identifier', message: 'identifier must not contain surrounding whitespace' })
          ),
        onFalse: () => Effect.void,
      })
    )

    yield* pipe(
      trimmed.length < 3,
      Effect.when({
        onTrue: () => Effect.fail(ValidationError({ field: 'identifier', message: 'length must be >= 3' })),
        onFalse: () => Effect.void,
      })
    )

    yield* pipe(
      trimmed.length > 64,
      Effect.when({
        onTrue: () => Effect.fail(ValidationError({ field: 'identifier', message: 'length must be <= 64' })),
        onFalse: () => Effect.void,
      })
    )

    yield* pipe(
      !identifierPattern.test(trimmed),
      Effect.when({
        onTrue: () =>
          Effect.fail(ValidationError({ field: 'identifier', message: 'allowed characters are [A-Za-z0-9_-]' })),
        onFalse: () => Effect.void,
      })
    )

    return IdentifierBrand(trimmed)
  })

export const makeIdentifierEither = (value: string): Effect.Effect<Either.Either<Identifier, DomainError>, never> =>
  Effect.either(makeIdentifier(value))

export const makeBoundedNumber = (params: {
  readonly field: string
  readonly range: DomainRange
  readonly value: number
}): Effect.Effect<number, DomainError> =>
  Effect.gen(function* () {
    yield* pipe(
      !Number.isFinite(params.value),
      Effect.when({
        onTrue: () => Effect.fail(ValidationError({ field: params.field, message: `${params.field} must be finite` })),
        onFalse: () => Effect.void,
      })
    )

    const clamped = params.value
    yield* pipe(
      clamped < params.range.min || clamped > params.range.max,
      Effect.when({
        onTrue: () => Effect.fail(OutOfRange({ field: params.field, range: params.range, actual: clamped })),
        onFalse: () => Effect.void,
      })
    )

    return clamped
  })

export const makeBoundedNumberEither = (params: {
  readonly field: string
  readonly range: DomainRange
  readonly value: number
}): Effect.Effect<Either.Either<number, DomainError>, never> => Effect.either(makeBoundedNumber(params))

export type DomainInvariant<T> = Readonly<{
  readonly description: string
  readonly verify: (input: T) => Effect.Effect<T, DomainError>
}>

export const enforceInvariant = <T>(invariant: DomainInvariant<T>, value: T): Effect.Effect<T, DomainError> =>
  invariant.verify(value)

export const combineInvariants = <T>(invariants: ReadonlyArray<DomainInvariant<T>>): DomainInvariant<T> => ({
  description: invariants.map((item) => item.description).join(' & '),
  verify: (value) =>
    pipe(
      invariants,
      Effect.forEach((invariant) => invariant.verify(value), { discard: true }),
      Effect.map(() => value)
    ),
})

export const ensurePositive = (field: string): DomainInvariant<number> => ({
  description: `${field} must be positive`,
  verify: (value) =>
    pipe(
      Effect.succeed(value),
      Effect.filterOrFail(
        (candidate) => candidate > 0,
        () => ValidationError({ field, message: `${field} must be positive` })
      )
    ),
})

export const ensureWithinRange = (field: string, range: DomainRange): DomainInvariant<number> => ({
  description: `${field} within range`,
  verify: (value) =>
    pipe(
      Effect.succeed(value),
      Effect.filterOrFail(
        (candidate) => candidate >= range.min && candidate <= range.max,
        (candidate) => OutOfRange({ field, range, actual: candidate })
      )
    ),
})

export const matchDomainError = <A>(
  error: DomainError,
  on: {
    readonly validation: (payload: DomainError['ValidationError']) => A
    readonly outOfRange: (payload: DomainError['OutOfRange']) => A
    readonly schema: (payload: DomainError['SchemaViolation']) => A
    readonly invariant: (payload: DomainError['InvariantViolation']) => A
  }
): A =>
  pipe(
    Match.value(error),
    Match.when({ _tag: 'ValidationError' }, (value) => on.validation(value)),
    Match.when({ _tag: 'OutOfRange' }, (value) => on.outOfRange(value)),
    Match.when({ _tag: 'SchemaViolation' }, (value) => on.schema(value)),
    Match.when({ _tag: 'InvariantViolation' }, (value) => on.invariant(value)),
    Match.orElse(() => on.validation({ field: 'unknown', message: 'unknown domain error' }))
  )
