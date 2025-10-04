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
export type BootstrapConfigInput = Schema.Schema.From<typeof BootstrapConfigSchema>

const decodeBootstrapConfig = Schema.decode(BootstrapConfigSchema)
const decodeBootstrapConfigSync = Schema.decodeSync(BootstrapConfigSchema)

export const bootstrapConfig = (
  input: BootstrapConfigInput
): Effect.Effect<BootstrapConfig> => decodeBootstrapConfig(input)

const bootstrapDefaultsInput: BootstrapConfigInput = {
  debug: false,
  fps: 60,
  memoryLimit: 2048,
}

export const BootstrapConfigDefaults: BootstrapConfig = decodeBootstrapConfigSync(
  bootstrapDefaultsInput
)

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
export type BootstrapConfigSnapshotInput = Schema.Schema.From<typeof BootstrapConfigSnapshotSchema>

const decodeSnapshot = Schema.decode(BootstrapConfigSnapshotSchema)

export const bootstrapConfigSnapshot = (
  input: BootstrapConfigSnapshotInput
): Effect.Effect<BootstrapConfigSnapshot> => decodeSnapshot(input)

export const materializeConfigSnapshot = (
  config: BootstrapConfig,
  loadedAt: EpochMilliseconds
): BootstrapConfigSnapshot => ({
  config,
  loadedAt,
})
