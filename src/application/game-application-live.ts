import { Clock, Effect, Layer, Schema } from 'effect'
import * as Option from 'effect/Option'
import * as SynchronizedRef from 'effect/SynchronizedRef'
import { mergeConfig } from './config'
import { GameApplicationInitError, GameApplicationRuntimeError, GameApplicationStateError } from './errors'
import { GameApplication } from './game-application'
import { guardLifecycleTransition } from './lifecycle'
import { applyConfig, computeHealth, createInitialState, synchronizeLifecycle, tickState, withStartTime } from './state'
import { ApplicationLifecycleState, DEFAULT_GAME_APPLICATION_CONFIG, GameApplicationState, Milliseconds } from './types'

const defaultTickDelta = Schema.decodeSync(Milliseconds)(16)

type LifecycleTransitionPlan = {
  readonly guard: ApplicationLifecycleState
  readonly target: ApplicationLifecycleState
}

type GameApplicationStateRef = SynchronizedRef.SynchronizedRef<GameApplicationState>

const modifyState = <R, E>(
  stateRef: GameApplicationStateRef,
  transform: (state: GameApplicationState) => Effect.Effect<GameApplicationState, E, R>
): Effect.Effect<void, E, R> => SynchronizedRef.updateEffect(stateRef, transform)

const lifecycleTransition = (
  stateRef: GameApplicationStateRef,
  plan: LifecycleTransitionPlan
): Effect.Effect<void, GameApplicationStateError, never> =>
  modifyState(stateRef, (current) =>
    guardLifecycleTransition(current.lifecycle, plan.guard).pipe(
      Effect.map(() => synchronizeLifecycle(synchronizeLifecycle(current, plan.guard), plan.target))
    )
  )

const makeService = (stateRef: GameApplicationStateRef): GameApplication => ({
  initialize: (config): Effect.Effect<void, GameApplicationInitError, never> =>
    modifyState(stateRef, (current) =>
      guardLifecycleTransition(current.lifecycle, 'Initializing').pipe(
        Effect.flatMap(() =>
          mergeConfig(current.config, config).pipe(
            Effect.map((merged) =>
              synchronizeLifecycle(synchronizeLifecycle(createInitialState(merged), 'Initializing'), 'Initialized')
            )
          )
        )
      )
    ),

  start: (): Effect.Effect<void, GameApplicationRuntimeError, never> =>
    modifyState(stateRef, (current) =>
      guardLifecycleTransition(current.lifecycle, 'Starting').pipe(
        Effect.flatMap(() =>
          Clock.currentTimeMillis.pipe(
            Effect.map((timestamp) =>
              synchronizeLifecycle(withStartTime(synchronizeLifecycle(current, 'Starting'), timestamp), 'Running')
            )
          )
        )
      )
    ),

  pause: (): Effect.Effect<void, GameApplicationStateError, never> =>
    lifecycleTransition(stateRef, { guard: 'Pausing', target: 'Paused' }),

  resume: (): Effect.Effect<void, GameApplicationStateError, never> =>
    lifecycleTransition(stateRef, { guard: 'Resuming', target: 'Running' }),

  stop: (): Effect.Effect<void, GameApplicationStateError, never> =>
    lifecycleTransition(stateRef, { guard: 'Stopping', target: 'Stopped' }),

  getState: () => SynchronizedRef.get(stateRef),

  getLifecycleState: () => SynchronizedRef.get(stateRef).pipe(Effect.map((state) => state.lifecycle)),

  tick: (delta): Effect.Effect<void, GameApplicationRuntimeError, never> =>
    SynchronizedRef.update(stateRef, (previous) =>
      tickState(
        previous,
        Option.getOrElse(delta, () => defaultTickDelta)
      )
    ),

  updateConfig: (config): Effect.Effect<void, GameApplicationStateError, never> =>
    modifyState(stateRef, (current) =>
      mergeConfig(current.config, Option.some(config)).pipe(Effect.map((merged) => applyConfig(current, merged)))
    ),

  healthCheck: () => SynchronizedRef.get(stateRef).pipe(Effect.map(computeHealth)),

  reset: (): Effect.Effect<void, never, never> =>
    SynchronizedRef.set(stateRef, createInitialState(DEFAULT_GAME_APPLICATION_CONFIG)),
})

const makeGameApplicationLive = Effect.gen(function* () {
  const initialState = createInitialState(DEFAULT_GAME_APPLICATION_CONFIG)
  const stateRef = yield* SynchronizedRef.make(initialState)
  return GameApplication.of(makeService(stateRef))
})

export const GameApplicationLive = Layer.effect(GameApplication, makeGameApplicationLive)
