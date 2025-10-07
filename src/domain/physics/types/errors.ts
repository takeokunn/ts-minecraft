import { Data, Match, ParseResult } from 'effect'

/**
 * Physics domain error algebraic data type.
 * The domain relies on strongly typed errors to keep Effect flows precise.
 */
export type PhysicsErrorUnion =
  | {
      readonly _tag: 'SchemaViolation'
      readonly message: string
      readonly issue: ParseResult.ParseIssue
    }
  | {
      readonly _tag: 'ConstraintViolation'
      readonly message: string
    }
  | {
      readonly _tag: 'NotFound'
      readonly entity: string
      readonly reference?: string
    }
  | {
      readonly _tag: 'TemporalAnomaly'
      readonly now: number
      readonly attempted: number
    }
  | {
      readonly _tag: 'InvalidTransition'
      readonly message: string
    }

const Constructors = Data.taggedEnum<PhysicsErrorUnion>()

type SchemaViolation = Extract<PhysicsErrorUnion, { readonly _tag: 'SchemaViolation' }>
type ConstraintViolation = Extract<PhysicsErrorUnion, { readonly _tag: 'ConstraintViolation' }>
type NotFound = Extract<PhysicsErrorUnion, { readonly _tag: 'NotFound' }>
type TemporalAnomaly = Extract<PhysicsErrorUnion, { readonly _tag: 'TemporalAnomaly' }>
type InvalidTransition = Extract<PhysicsErrorUnion, { readonly _tag: 'InvalidTransition' }>

type MatchCases<A> = {
  readonly SchemaViolation: (error: SchemaViolation) => A
  readonly ConstraintViolation: (error: ConstraintViolation) => A
  readonly NotFound: (error: NotFound) => A
  readonly TemporalAnomaly: (error: TemporalAnomaly) => A
  readonly InvalidTransition: (error: InvalidTransition) => A
}

export const PhysicsError = {
  SchemaViolation: Constructors.SchemaViolation,
  ConstraintViolation: Constructors.ConstraintViolation,
  NotFound: Constructors.NotFound,
  TemporalAnomaly: Constructors.TemporalAnomaly,
  InvalidTransition: Constructors.InvalidTransition,
  match<A>(error: PhysicsError, cases: MatchCases<A>): A {
    return Match.value(error).pipe(
      Match.tag('SchemaViolation', cases.SchemaViolation),
      Match.tag('ConstraintViolation', cases.ConstraintViolation),
      Match.tag('NotFound', cases.NotFound),
      Match.tag('TemporalAnomaly', cases.TemporalAnomaly),
      Match.tag('InvalidTransition', cases.InvalidTransition),
      Match.exhaustive
    )
  },
}

export type PhysicsError = ReturnType<(typeof Constructors)[keyof typeof Constructors]>

export const fromParseError = (error: ParseResult.ParseError): PhysicsError =>
  Constructors.SchemaViolation({
    message: ParseResult.TreeFormatter.formatErrorSync(error),
    issue: error.issue,
  })
