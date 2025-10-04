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
export type EpochMillisecondsInput = Schema.Schema.From<typeof EpochMillisecondsSchema>

const decodeEpochMilliseconds = Schema.decode(EpochMillisecondsSchema)
const decodeEpochMillisecondsSync = Schema.decodeSync(EpochMillisecondsSchema)

export const epochMilliseconds = (value: EpochMillisecondsInput): Effect.Effect<EpochMilliseconds> =>
  decodeEpochMilliseconds(value)

export const unsafeEpochMilliseconds = (value: EpochMillisecondsInput): EpochMilliseconds =>
  decodeEpochMillisecondsSync(value)

const epochZero: EpochMilliseconds = decodeEpochMillisecondsSync(0)

export const reviveEpochZero = (): EpochMilliseconds => epochZero

export const DebugModeSchema = Schema.Boolean.pipe(
  Schema.brand('DebugMode'),
  Schema.annotations({
    title: 'DebugMode',
    description: 'Feature flag indicating whether debug instrumentation is enabled',
  })
)

export type DebugMode = Schema.Schema.Type<typeof DebugModeSchema>
export type DebugModeInput = Schema.Schema.From<typeof DebugModeSchema>

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
export type FramesPerSecondInput = Schema.Schema.From<typeof FramesPerSecondSchema>

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
export type MemoryMegabytesInput = Schema.Schema.From<typeof MemoryMegabytesSchema>
