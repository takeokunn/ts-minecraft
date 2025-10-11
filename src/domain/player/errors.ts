import type { ParseError } from '@effect/schema/ParseResult'
import { isParseError } from '@effect/schema/ParseResult'
import { Data, Option } from 'effect'
import type { JsonValue } from '@/shared/schema/json'

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

const toJsonValue = (value: JsonValue | Record<string, JsonValue> | Array<JsonValue> | Error | string | number | boolean | null | undefined): JsonValue | undefined => {
  if (value === null) {
    return null
  }

  const valueType = typeof value

  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return value as JsonValue
  }

  if (Array.isArray(value)) {
    const converted: JsonValue[] = []
    for (const item of value) {
      const jsonItem = toJsonValue(item)
      if (jsonItem === undefined) {
        return undefined
      }
      converted.push(jsonItem)
    }
    return converted
  }

  if (valueType === 'object') {
    const converted: Record<string, JsonValue> = {}
    for (const [key, entry] of Object.entries(value as Record<string, JsonValue | undefined>)) {
      const jsonEntry = toJsonValue(entry)
      if (jsonEntry === undefined) {
        return undefined
      }
      converted[key] = jsonEntry
    }
    return converted
  }

  return undefined
}

export const normalizePlayerErrorCause = (
  value: PlayerErrorCause | JsonValue | Error | string | number | boolean | null | undefined
): PlayerErrorCause | null => {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Error) {
    return value
  }

  if (isParseError(value)) {
    return value
  }

  const json = toJsonValue(value as JsonValue | Record<string, JsonValue> | Array<JsonValue> | string | number | boolean | null)
  if (json !== undefined) {
    return json
  }

  return String(value)
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
  clock: (cause?: PlayerErrorCause | null) =>
    PlayerError.ClockFailure({ cause: Option.fromNullable(cause ?? null) }),
}

export const PlayerConstantErrorBuilders = {
  outOfRange: (constant: string, value: number, requirement: string) =>
    PlayerConstantError.OutOfRange({ constant, value, requirement }),
  notFinite: (constant: string, value: number) => PlayerConstantError.NotFinite({ constant, value }),
}
