import type { ParseError } from '@effect/schema/ParseResult'
import { isParseError } from '@effect/schema/ParseResult'
import type { JsonValue } from '@shared/schema/json'
import { Data, Match, Option, ReadonlyArray, pipe } from 'effect'

interface IdentityShape {
  readonly reason: string
  readonly value: string
}

interface ConstraintShape {
  readonly reason: string
  readonly details: PlayerConstraintDetails
}

interface TransitionShape {
  readonly from: string
  readonly to: string
  readonly trigger: string
  readonly explanation: string
}

interface MissingShape {
  readonly entity: string
  readonly identifier: string
}

interface PersistenceShape {
  readonly operation: string
  readonly cause: Option.Option<PlayerErrorCause>
}

interface ClockShape {
  readonly cause: Option.Option<PlayerErrorCause>
}

/**
 * Playerドメイン共通エラーADT
 */
export const PlayerError = Data.taggedEnum<{
  IdentityViolation: IdentityShape
  ConstraintViolation: ConstraintShape
  InvalidTransition: TransitionShape
  MissingEntity: MissingShape
  PersistenceFailure: PersistenceShape
  ClockFailure: ClockShape
}>()

export type PlayerError = Data.TaggedEnum.Type<typeof PlayerError>

export type PlayerConstraintDetails = ReadonlyMap<string, JsonValue>

export type PlayerErrorCause = ParseError | Error | JsonValue

const isPrimitiveJson = (input: unknown): input is string | number | boolean =>
  typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean'

const isJsonRecord = (input: unknown): input is Record<string, JsonValue | undefined> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

const toJsonValue = (
  value: JsonValue | Record<string, JsonValue> | Array<JsonValue> | Error | string | number | boolean | null | undefined
): JsonValue | undefined => {
  const result = pipe(
    Match.value(value),
    Match.when(
      (candidate): candidate is null => candidate === null,
      () => null
    ),
    Match.when(isPrimitiveJson, (primitive) => primitive as JsonValue),
    Match.when(Array.isArray, (array) =>
      pipe(
        array,
        ReadonlyArray.reduce(Option.some<ReadonlyArray<JsonValue>>([]), (acc, item) =>
          pipe(
            acc,
            Option.flatMap((converted) =>
              pipe(
                toJsonValue(item),
                Option.fromNullable,
                Option.map((jsonItem) => pipe(converted, ReadonlyArray.append(jsonItem)))
              )
            )
          )
        ),
        Option.match({
          onNone: () => undefined,
          onSome: (converted) => converted,
        })
      )
    ),
    Match.when(isJsonRecord, (record) =>
      pipe(
        Object.entries(record),
        ReadonlyArray.reduce(Option.some<Record<string, JsonValue>>({}), (acc, [key, entry]) =>
          pipe(
            acc,
            Option.flatMap((converted) =>
              pipe(
                toJsonValue(entry),
                Option.fromNullable,
                Option.map((jsonEntry) => ({
                  ...converted,
                  [key]: jsonEntry,
                }))
              )
            )
          )
        ),
        Option.match({
          onNone: () => undefined,
          onSome: (converted) => converted,
        })
      )
    ),
    Match.orElse(() => undefined)
  )

  return result
}

export const normalizePlayerErrorCause = (
  value: PlayerErrorCause | JsonValue | Error | string | number | boolean | null | undefined
): PlayerErrorCause | null => {
  const jsonCandidate = toJsonValue(
    value as JsonValue | Record<string, JsonValue> | Array<JsonValue> | string | number | boolean | null | undefined
  )

  return pipe(
    Match.value(value),
    Match.when(
      (candidate): candidate is null | undefined => candidate === null || candidate === undefined,
      () => null
    ),
    Match.when(
      (candidate): candidate is Error => candidate instanceof Error,
      (error) => error
    ),
    Match.when(isParseError, (parseError) => parseError),
    Match.orElse(() => (jsonCandidate !== undefined ? jsonCandidate : String(value)))
  )
}

interface ConstantRangeShape {
  readonly constant: string
  readonly value: number
  readonly requirement: string
}

interface ConstantFiniteShape {
  readonly constant: string
  readonly value: number
}

/**
 * Player定数検証エラーADT
 */
export const PlayerConstantError = Data.taggedEnum<{
  OutOfRange: ConstantRangeShape
  NotFinite: ConstantFiniteShape
}>()

export type PlayerConstantError = Data.TaggedEnum.Type<typeof PlayerConstantError>

/**
 * PlayerErrorビルダー関数
 */
export const PlayerErrorBuilders = {
  identity: (reason: string, value: string) => PlayerError.IdentityViolation({ reason, value }),
  constraint: (reason: string, details: PlayerConstraintDetails) =>
    PlayerError.ConstraintViolation({ reason, details }),
  invalidTransition: (params: TransitionShape) => PlayerError.InvalidTransition(params),
  missing: (entity: string, identifier: string) => PlayerError.MissingEntity({ entity, identifier }),
  persistence: (operation: string, cause?: PlayerErrorCause | null) =>
    PlayerError.PersistenceFailure({ operation, cause: Option.fromNullable(cause ?? null) }),
  clock: (cause?: PlayerErrorCause | null) => PlayerError.ClockFailure({ cause: Option.fromNullable(cause ?? null) }),
}

export const PlayerConstantErrorBuilders = {
  outOfRange: (constant: string, value: number, requirement: string) =>
    PlayerConstantError.OutOfRange({ constant, value, requirement }),
  notFinite: (constant: string, value: number) => PlayerConstantError.NotFinite({ constant, value }),
}
