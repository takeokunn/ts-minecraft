import { Schema } from '@effect/schema'
import { Effect } from 'effect'

export const EpochMillisecondsSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand('EpochMilliseconds'),
  Schema.annotations({
    title: 'EpochMilliseconds',
    description: 'Unix epoch milliseconds represented as a non-negative integer',
  })
)

export type EpochMilliseconds = Schema.Schema.Type<typeof EpochMillisecondsSchema>

const decodeEpochMilliseconds = Schema.decodeUnknown(EpochMillisecondsSchema)

export const epochMilliseconds = (value: number): Effect.Effect<EpochMilliseconds> =>
  decodeEpochMilliseconds(value)

export const unsafeEpochMilliseconds = (value: number): EpochMilliseconds =>
  Schema.decodeUnknownSync(EpochMillisecondsSchema)(value)

const epochZero: EpochMilliseconds = unsafeEpochMilliseconds(0)

export const reviveEpochZero = (): EpochMilliseconds => epochZero

export const DebugModeSchema = Schema.Boolean.pipe(
  Schema.brand('DebugMode'),
  Schema.annotations({
    title: 'DebugMode',
    description: 'Feature flag indicating whether debug instrumentation is enabled',
  })
)

export type DebugMode = Schema.Schema.Type<typeof DebugModeSchema>

export const FramesPerSecondSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.filter((input): input is number => input >= 1 && input <= 120, {
    message: () => 'Frames per second must be between 1 and 120',
  }),
  Schema.brand('FramesPerSecond'),
  Schema.annotations({
    title: 'FramesPerSecond',
    description: 'Target frames per second for the main loop',
    examples: [60, 90, 120],
  })
)

export type FramesPerSecond = Schema.Schema.Type<typeof FramesPerSecondSchema>

export const MemoryMegabytesSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.filter((input): input is number => input >= 1 && input <= 2048, {
    message: () => 'Memory limit must be between 1 and 2048 MB',
  }),
  Schema.brand('MemoryMegabytes'),
  Schema.annotations({
    title: 'MemoryMegabytes',
    description: 'Maximum memory footprint (in MB) granted to the runtime',
    examples: [2048, 4096],
  })
)

export type MemoryMegabytes = Schema.Schema.Type<typeof MemoryMegabytesSchema>
