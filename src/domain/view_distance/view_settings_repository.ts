import { Effect, Ref } from 'effect'
import { pipe } from 'effect/Function'
import {
  InvalidConfigurationError,
  ViewControlConfig,
  ViewControlConfigSchema,
  ViewDistanceError,
} from './types.js'
import * as Schema from '@effect/schema/Schema'
import * as TreeFormatter from '@effect/schema/TreeFormatter'

export interface ViewSettingsRepository {
  readonly load: () => Effect.Effect<ViewControlConfig, ViewDistanceError>
  readonly save: (config: ViewControlConfig) => Effect.Effect<ViewControlConfig, ViewDistanceError>
  readonly history: () => Effect.Effect<readonly ViewControlConfig[], never>
}

interface SettingsState {
  readonly current: ViewControlConfig
  readonly history: readonly ViewControlConfig[]
}

const validateConfig = (
  config: ViewControlConfig
): Effect.Effect<ViewControlConfig, ViewDistanceError> =>
  pipe(
    Schema.decodeUnknown(ViewControlConfigSchema)(config),
    Effect.mapError((error) =>
      InvalidConfigurationError({ issues: TreeFormatter.formatErrorSync(error).split('\n') })
    )
  )

export const createViewSettingsRepository = (
  initialConfig: ViewControlConfig
): Effect.Effect<ViewSettingsRepository, ViewDistanceError> =>
  Effect.gen(function* () {
    const initial = yield* validateConfig(initialConfig)
    const state = yield* Ref.make<SettingsState>({ current: initial, history: [initial] })

    const load = (): Effect.Effect<ViewControlConfig, ViewDistanceError> =>
      Ref.get(state).pipe(Effect.map((snapshot) => snapshot.current))

    const save = (
      config: ViewControlConfig
    ): Effect.Effect<ViewControlConfig, ViewDistanceError> =>
      pipe(
        validateConfig(config),
        Effect.flatMap((validated) =>
          Ref.updateAndGet(state, (snapshot) => ({
            current: validated,
            history: [...snapshot.history, validated],
          }))
        ),
        Effect.map((snapshot) => snapshot.current)
      )

    const history = (): Effect.Effect<readonly ViewControlConfig[], never> =>
      Ref.get(state).pipe(Effect.map((snapshot) => snapshot.history))

    return { load, save, history }
  })
