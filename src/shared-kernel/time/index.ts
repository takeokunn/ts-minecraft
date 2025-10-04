import { Clock, Context, Duration, Effect, Layer, Schema, pipe } from 'effect'
import type { ParseError } from '@effect/schema/ParseResult'
import * as TestClock from 'effect/TestClock'
import { createBranded, InferBranded, toRuntimeError } from '../primitives/index'

const NonNegativeNumberSchema = Schema.Number.pipe(
  Schema.finite(),
  Schema.nonNegative()
)

const MillisecondsFactory = createBranded({
  name: 'Milliseconds',
  schema: NonNegativeNumberSchema,
  description: 'Duration measured in milliseconds',
})

const SecondsFactory = createBranded({
  name: 'Seconds',
  schema: NonNegativeNumberSchema,
  description: 'Duration measured in seconds',
})

const TimestampFactory = createBranded({
  name: 'Timestamp',
  schema: NonNegativeNumberSchema,
  description: 'Unix epoch timestamp in milliseconds',
})

export type Milliseconds = InferBranded<typeof MillisecondsFactory>
export type Seconds = InferBranded<typeof SecondsFactory>
export type Timestamp = InferBranded<typeof TimestampFactory>

const parseMilliseconds = (value: number) =>
  pipe(MillisecondsFactory.decode(value), Effect.mapError(toRuntimeError))

const parseMillisecondsSync = (value: number): Milliseconds => {
  try {
    return MillisecondsFactory.decodeSync(value)
  } catch (error) {
    return handleParseSyncError(error, 'Milliseconds')
  }
}

const parseSeconds = (value: number) =>
  pipe(SecondsFactory.decode(value), Effect.mapError(toRuntimeError))

const parseSecondsSync = (value: number): Seconds => {
  try {
    return SecondsFactory.decodeSync(value)
  } catch (error) {
    return handleParseSyncError(error, 'Seconds')
  }
}

const parseTimestamp = (value: number) =>
  pipe(TimestampFactory.decode(value), Effect.mapError(toRuntimeError))

const parseTimestampSync = (value: number): Timestamp => {
  try {
    return TimestampFactory.decodeSync(value)
  } catch (error) {
    return handleParseSyncError(error, 'Timestamp')
  }
}

const handleParseSyncError = (error: unknown, label: string): never => {
  if (isParseError(error)) {
    throw toRuntimeError(error)
  }
  throw new Error(`${label} parse failure: ${String(error)}`)
}

const isParseError = (error: unknown): error is ParseError =>
  typeof error === 'object' && error !== null && '_tag' in error

const toTimestampOrDie = (value: number) =>
  pipe(parseTimestamp(value), Effect.orDieWith((err) => err))

export interface TimeService {
  readonly now: Effect.Effect<Timestamp, never, Clock>
  readonly sleep: (duration: Milliseconds) => Effect.Effect<void, never, Clock>
  readonly fromDate: (date: Date) => Effect.Effect<Timestamp, Error>
  readonly toDate: (timestamp: Timestamp) => Date
  readonly durationBetween: (
    later: Timestamp,
    earlier: Timestamp
  ) => Effect.Effect<Milliseconds, Error>
  readonly addDuration: (
    timestamp: Timestamp,
    duration: Milliseconds
  ) => Effect.Effect<Timestamp, Error>
  readonly toSeconds: (duration: Milliseconds) => Effect.Effect<Seconds, Error>
  readonly fromSeconds: (seconds: Seconds) => Effect.Effect<Milliseconds, Error>
  readonly measure: <R, E, A>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<Readonly<{ duration: Milliseconds; value: A }>, E | Error, R | Clock>
}

export const TimeServiceTag = Context.GenericTag<TimeService>(
  '@shared-kernel/time/TimeService'
)

const sleep = (duration: Milliseconds) =>
  Effect.sleep(Duration.millis(Number(duration)))

const fromDate = (date: Date) => parseTimestamp(date.getTime())

const toDate = (timestamp: Timestamp) => new Date(Number(timestamp))

const durationBetween = (later: Timestamp, earlier: Timestamp) => {
  const diff = Number(later) - Number(earlier)
  if (diff < 0) {
    return Effect.fail(new Error('later timestamp must not be earlier than the reference point'))
  }
  return parseMilliseconds(diff)
}

const addDuration = (timestamp: Timestamp, duration: Milliseconds) =>
  parseTimestamp(Number(timestamp) + Number(duration))

const toSeconds = (duration: Milliseconds) =>
  parseSeconds(Number(duration) / 1000)

const fromSeconds = (seconds: Seconds) =>
  parseMilliseconds(Number(seconds) * 1000)

const createService = (deps: {
  readonly now: TimeService['now']
  readonly sleep: TimeService['sleep']
}): TimeService => ({
  now: deps.now,
  sleep: deps.sleep,
  fromDate,
  toDate,
  durationBetween,
  addDuration,
  toSeconds,
  fromSeconds,
  measure: <R, E, A>(effect: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const start = yield* deps.now
      const value = yield* effect
      const end = yield* deps.now
      const duration = yield* durationBetween(end, start)
      return {
        duration,
        value,
      } as const
    }),
})

const liveNow: TimeService['now'] = pipe(
  Clock.currentTimeMillis,
  Effect.flatMap(toTimestampOrDie)
)

export const TimeLive = Layer.succeed(
  TimeServiceTag,
  createService({
    now: liveNow,
    sleep,
  })
)

const testNow: TimeService['now'] = pipe(
  TestClock.currentTimeMillis,
  Effect.flatMap(toTimestampOrDie)
)

const testSleep: TimeService['sleep'] = (duration) =>
  TestClock.sleep(Duration.millis(Number(duration)))

export const TimeTestLayer = Layer.succeed(
  TimeServiceTag,
  createService({
    now: testNow,
    sleep: testSleep,
  })
)

export const Milliseconds = {
  parse: parseMilliseconds,
  parseSync: parseMillisecondsSync,
}

export const Seconds = {
  parse: parseSeconds,
  parseSync: parseSecondsSync,
}

export const Timestamp = {
  parse: parseTimestamp,
  parseSync: parseTimestampSync,
}
