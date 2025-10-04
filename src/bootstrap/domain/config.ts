import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import {
  DebugModeSchema,
  FramesPerSecondSchema,
  MemoryMegabytesSchema,
  EpochMillisecondsSchema,
  EpochMilliseconds,
} from './value'

export const BootstrapConfigSchema = Schema.Struct({
  debug: DebugModeSchema,
  fps: FramesPerSecondSchema,
  memoryLimit: MemoryMegabytesSchema,
}).pipe(
  Schema.annotations({
    title: 'BootstrapConfig',
    description: 'Strongly typed configuration consumed by the bootstrap layer',
  })
)

export type BootstrapConfig = Schema.Schema.Type<typeof BootstrapConfigSchema>

const decodeBootstrapConfig = Schema.decodeUnknown(BootstrapConfigSchema)

export const bootstrapConfig = (input: unknown): Effect.Effect<BootstrapConfig> =>
  decodeBootstrapConfig(input)

const bootstrapDefaultsInput = {
  debug: false,
  fps: 60,
  memoryLimit: 2048,
}

export const BootstrapConfigDefaults: BootstrapConfig = Schema.decodeUnknownSync(
  BootstrapConfigSchema
)(bootstrapDefaultsInput)

export const BootstrapConfigSnapshotSchema = Schema.Struct({
  config: BootstrapConfigSchema,
  loadedAt: EpochMillisecondsSchema,
}).pipe(
  Schema.annotations({
    title: 'BootstrapConfigSnapshot',
    description: 'Configuration value and the instant it was materialized',
  })
)

export type BootstrapConfigSnapshot = Schema.Schema.Type<typeof BootstrapConfigSnapshotSchema>

const decodeSnapshot = Schema.decodeUnknown(BootstrapConfigSnapshotSchema)

export const bootstrapConfigSnapshot = (
  input: unknown
): Effect.Effect<BootstrapConfigSnapshot> => decodeSnapshot(input)

export const materializeConfigSnapshot = (
  config: BootstrapConfig,
  loadedAt: EpochMilliseconds
): BootstrapConfigSnapshot => ({
  config,
  loadedAt,
})
