import { Data, ParseResult } from 'effect'

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

export const PhysicsError = {
  SchemaViolation: Constructors.SchemaViolation,
  ConstraintViolation: Constructors.ConstraintViolation,
  NotFound: Constructors.NotFound,
  TemporalAnomaly: Constructors.TemporalAnomaly,
  InvalidTransition: Constructors.InvalidTransition,
  match: Constructors.match,
}

export type PhysicsError = ReturnType<(typeof Constructors)[keyof typeof Constructors]>

export const fromParseError = (error: ParseResult.ParseError): PhysicsError =>
  Constructors.SchemaViolation({
    message: ParseResult.formatErrorSync(error),
    issue: error.issue,
  })
