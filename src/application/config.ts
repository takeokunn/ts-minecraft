import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Effect, Option, Schema } from 'effect'
import * as Either from 'effect/Either'
import { ConfigurationValidationError, JsonValue, createErrorContext } from './errors'
import {
  DebugConfigSchema,
  GameApplicationConfig as GameApplicationConfigSchema,
  GameLoopConfigSchema,
  InputConfigSchema,
  PerformanceConfigSchema,
  RenderingConfigSchema,
  type GameApplicationConfig,
  type GameApplicationConfigInput,
} from './types'

const RenderingConfigPatch = Schema.partial(RenderingConfigSchema)
const GameLoopConfigPatch = Schema.partial(GameLoopConfigSchema)
const InputConfigPatch = Schema.partial(InputConfigSchema)
const PerformanceConfigPatch = Schema.partial(PerformanceConfigSchema)
const DebugConfigPatch = Schema.partial(DebugConfigSchema)

export const GameApplicationConfigPatch = Schema.Struct({
  rendering: Schema.optional(RenderingConfigPatch),
  gameLoop: Schema.optional(GameLoopConfigPatch),
  input: Schema.optional(InputConfigPatch),
  performance: Schema.optional(PerformanceConfigPatch),
  debug: Schema.optional(DebugConfigPatch),
})

export type GameApplicationConfigPatch = Schema.Schema.Type<typeof GameApplicationConfigPatch>
export type GameApplicationConfigPatchInput = Schema.Schema.Input<typeof GameApplicationConfigPatch>

const decodeJsonValue = Schema.decodeUnknownSync(JsonValue)
const encodeConfigSync = Schema.encodeSync(GameApplicationConfigSchema)
const decodeConfigEither = Schema.decodeUnknownEither(GameApplicationConfigSchema)
const decodePatchEither = Schema.decodeUnknownEither(GameApplicationConfigPatch)

const formatParseError = (error: Schema.DecodeUnknownError): string => TreeFormatter.formatErrorSync(error)

type DecodeError = Schema.DecodeUnknownError

type FailureParams = {
  readonly operation: string
  readonly field: string
  readonly candidate: unknown
  readonly cause: DecodeError
}

const toJsonValue = (input: unknown): JsonValue => {
  const serialized = JSON.stringify(input)
  const materialized = serialized === undefined ? null : JSON.parse(serialized)
  return decodeJsonValue(materialized)
}

const configurationFailure = ({
  operation,
  field,
  candidate,
  cause,
}: FailureParams): Effect.Effect<never, ConfigurationValidationError> =>
  Effect.gen(function* () {
    const message = formatParseError(cause)
    const context = yield* createErrorContext({
      system: 'GameApplication',
      operation,
      details: [
        {
          key: 'reason',
          value: toJsonValue(message),
        },
      ],
    })
    const error = new ConfigurationValidationError({
      context,
      field,
      value: toJsonValue(candidate),
      constraint: message,
    })
    return yield* Effect.fail(error)
  })

const validatePatch = (
  patch: GameApplicationConfigPatchInput
): Effect.Effect<GameApplicationConfigPatch, ConfigurationValidationError> =>
  Either.match(decodePatchEither(patch), {
    onLeft: (error) =>
      configurationFailure({
        operation: 'mergeConfigPatch',
        field: 'configPatch',
        candidate: patch,
        cause: error,
      }),
    onRight: (value) => Effect.succeed(value),
  })

const mergeInput = (
  base: GameApplicationConfigInput,
  patch: GameApplicationConfigPatch
): GameApplicationConfigInput => ({
  rendering: {
    targetFps: patch.rendering?.targetFps ?? base.rendering.targetFps,
    enableVSync: patch.rendering?.enableVSync ?? base.rendering.enableVSync,
    antialiasing: patch.rendering?.antialiasing ?? base.rendering.antialiasing,
    shadowMapping: patch.rendering?.shadowMapping ?? base.rendering.shadowMapping,
    webgl2: patch.rendering?.webgl2 ?? base.rendering.webgl2,
  },
  gameLoop: {
    updateInterval: patch.gameLoop?.updateInterval ?? base.gameLoop.updateInterval,
    maxDeltaTime: patch.gameLoop?.maxDeltaTime ?? base.gameLoop.maxDeltaTime,
    enableFixedTimeStep: patch.gameLoop?.enableFixedTimeStep ?? base.gameLoop.enableFixedTimeStep,
    fixedTimeStep: patch.gameLoop?.fixedTimeStep ?? base.gameLoop.fixedTimeStep,
  },
  input: {
    mouseSensitivity: patch.input?.mouseSensitivity ?? base.input.mouseSensitivity,
    keyRepeatDelay: patch.input?.keyRepeatDelay ?? base.input.keyRepeatDelay,
    enableGamepad: patch.input?.enableGamepad ?? base.input.enableGamepad,
  },
  performance: {
    enableMetrics: patch.performance?.enableMetrics ?? base.performance.enableMetrics,
    memoryLimit: patch.performance?.memoryLimit ?? base.performance.memoryLimit,
    gcThreshold: patch.performance?.gcThreshold ?? base.performance.gcThreshold,
  },
  debug: {
    enableLogging: patch.debug?.enableLogging ?? base.debug.enableLogging,
    logLevel: patch.debug?.logLevel ?? base.debug.logLevel,
    showPerformanceStats: patch.debug?.showPerformanceStats ?? base.debug.showPerformanceStats,
    enableHotReload: patch.debug?.enableHotReload ?? base.debug.enableHotReload,
  },
})

export const mergeConfig = (
  base: GameApplicationConfig,
  patch: Option.Option<GameApplicationConfigPatchInput>
): Effect.Effect<GameApplicationConfig, ConfigurationValidationError> =>
  Option.match(patch, {
    onNone: () => Effect.succeed(base),
    onSome: (patchInput) =>
      Effect.gen(function* () {
        const validatedPatch = yield* validatePatch(patchInput)
        const baseInput = encodeConfigSync(base)
        const candidate = mergeInput(baseInput, validatedPatch)
        const decoded = decodeConfigEither(candidate)
        return yield* Either.match(decoded, {
          onLeft: (error) =>
            configurationFailure({
              operation: 'mergeConfig',
              field: 'config',
              candidate,
              cause: error,
            }),
          onRight: (config) => Effect.succeed(config),
        })
      }),
  })
