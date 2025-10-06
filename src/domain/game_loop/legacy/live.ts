import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as SynchronizedRef from 'effect/SynchronizedRef'

import {
  DefaultGameLoopConfig,
  FrameCount,
  FrameCountSchema,
  FrameDuration,
  FrameDurationSchema,
  FrameId,
  FrameIdSchema,
  FramesPerSecond,
  GameLoopConfig,
  GameLoopState,
  GameLoopStateSchema,
  PerformanceMetrics,
  Timestamp,
  currentTimestamp,
  effectFromEither,
  fpsToNumber,
  frameCountToNumber,
  frameDurationToNumber,
  makeConfig,
  makeFps,
  makeFrameCount,
  makeFrameDuration,
  makeFrameId,
  makeFrameInfo,
  makeTimestamp,
  reconcileFrameTiming,
} from '../types'
import {
  InitializationError,
  RuntimeCallbackError,
  StateTransitionError,
  toPerformanceError,
  toRuntimeCallbackError,
  toStateTransitionError,
} from '../types'
import type { FrameCallback, FrameCallbackContext, FrameCallbackRegistration, GameLoopService } from './index'
import { GameLoopService as GameLoopServiceTag } from './index'

interface InternalState {
  readonly config: GameLoopConfig
  readonly status: GameLoopState
  readonly frameCount: FrameCount
  readonly lastTimestamp: Option.Option<Timestamp>
  readonly lastFrameId: FrameId
  readonly lastDelta: FrameDuration
  readonly currentFps: FramesPerSecond
  readonly droppedFrames: number
  readonly callbacks: ReadonlyArray<FrameCallback>
}

const idleState = Schema.decodeSync(GameLoopStateSchema)('idle')
const runningState = Schema.decodeSync(GameLoopStateSchema)('running')
const pausedState = Schema.decodeSync(GameLoopStateSchema)('paused')
const stoppedState = Schema.decodeSync(GameLoopStateSchema)('stopped')

const zeroFrameCount = Schema.decodeSync(FrameCountSchema)(0)
const zeroDelta = Schema.decodeSync(FrameDurationSchema)(0)
const zeroFrameId = Schema.decodeSync(FrameIdSchema)('frame_0')

const deriveMetrics = (state: InternalState): PerformanceMetrics => ({
  averageFps: state.currentFps,
  minimumFps: state.currentFps,
  maximumFps: state.currentFps,
  droppedFrames: state.droppedFrames,
})

const parseErrorToInitialization = (error: Schema.ParseError): InitializationError =>
  InitializationError({ reason: Schema.formatError(error) })

const parseErrorToRuntime = (id: string, error: Schema.ParseError, at: Timestamp): RuntimeCallbackError =>
  toRuntimeCallbackError({
    callbackId: id,
    causeMessage: Schema.formatError(error),
    occurredAt: at,
  })

const computeSkipped = (config: GameLoopConfig, delta: FrameDuration): boolean =>
  pipe(
    frameDurationToNumber(delta) > (1000 / fpsToNumber(config.targetFps)) * (config.maxFrameSkip + 1),
    Match.value,
    Match.when(true, () => true),
    Match.orElse(() => false)
  )

const bumpDropped = (current: number, skipped: boolean): number =>
  pipe(
    skipped,
    Match.value,
    Match.when(true, () => current + 1),
    Match.orElse(() => current)
  )

const observedFpsFromDelta = (delta: FrameDuration): Either.Either<Schema.ParseError, FramesPerSecond> =>
  makeFps(1000 / Math.max(1, frameDurationToNumber(delta)))

const advanceFrameCount = (count: FrameCount): Either.Either<Schema.ParseError, FrameCount> =>
  makeFrameCount(frameCountToNumber(count) + 1)

const makeFrameIdentifier = (count: FrameCount): Either.Either<Schema.ParseError, FrameId> =>
  makeFrameId(frameCountToNumber(count))

export const GameLoopServiceLive: Layer.Layer<GameLoopService> = Layer.scoped(
  GameLoopServiceTag,
  Effect.gen(function* () {
    const initialState: InternalState = {
      config: DefaultGameLoopConfig,
      status: idleState,
      frameCount: zeroFrameCount,
      lastTimestamp: Option.none(),
      lastFrameId: zeroFrameId,
      lastDelta: zeroDelta,
      currentFps: DefaultGameLoopConfig.targetFps,
      droppedFrames: 0,
      callbacks: [],
    }

    const stateRef = yield* SynchronizedRef.make(initialState)

    const updateState = (mutate: (current: InternalState) => InternalState): Effect.Effect<void> =>
      SynchronizedRef.update(stateRef, mutate)

    const ensureState = <A>(
      expected: ReadonlyArray<GameLoopState>,
      whenValid: (current: InternalState) => Effect.Effect<A, never>,
      onInvalid: (current: InternalState) => Effect.Effect<A, StateTransitionError>
    ): Effect.Effect<A, StateTransitionError> =>
      Effect.flatMap(SynchronizedRef.get(stateRef), (current) =>
        pipe(
          Match.value(expected.some((state) => state === current.status)),
          Match.when(true, () => whenValid(current)),
          Match.orElse(() => onInvalid(current))
        )
      )

    const service: GameLoopService = {
      configure: (input) =>
        pipe(
          makeConfig(input),
          effectFromEither,
          Effect.mapError(parseErrorToInitialization),
          Effect.tap((config) =>
            updateState((state) => ({
              ...state,
              config,
            }))
          )
        ),

      initialize: Effect.flatMap(
        updateState(() => initialState),
        () => Effect.succeed(idleState)
      ),

      start: ensureState(
        [idleState, stoppedState],
        (current) =>
          updateState((state) => ({
            ...state,
            status: runningState,
            frameCount: current.status === runningState ? state.frameCount : zeroFrameCount,
            lastTimestamp: Option.none(),
            lastDelta: zeroDelta,
            currentFps: state.config.targetFps,
          })).pipe(Effect.as(runningState)),
        (current) =>
          Effect.fail(
            toStateTransitionError({
              from: current.status,
              to: 'running',
              message: 'ゲームループの開始条件を満たしていません',
            })
          )
      ),

      pause: ensureState(
        [runningState],
        () =>
          updateState((state) => ({
            ...state,
            status: pausedState,
          })).pipe(Effect.as(pausedState)),
        (current) =>
          Effect.fail(
            toStateTransitionError({
              from: current.status,
              to: 'paused',
              message: 'pause は running 状態のみ許可されています',
            })
          )
      ),

      resume: ensureState(
        [pausedState],
        () =>
          updateState((state) => ({
            ...state,
            status: runningState,
          })).pipe(Effect.as(runningState)),
        (current) =>
          Effect.fail(
            toStateTransitionError({
              from: current.status,
              to: 'running',
              message: 'resume は paused 状態のみ許可されています',
            })
          )
      ),

      stop: ensureState(
        [runningState, pausedState],
        () =>
          updateState((state) => ({
            ...state,
            status: stoppedState,
            callbacks: [],
          })).pipe(Effect.as(stoppedState)),
        (current) =>
          Effect.fail(
            toStateTransitionError({
              from: current.status,
              to: 'stopped',
              message: 'stop は running もしくは paused 状態が必要です',
            })
          )
      ),

      state: Effect.map(SynchronizedRef.get(stateRef), (state) => state.status),

      metrics: Effect.map(SynchronizedRef.get(stateRef), deriveMetrics),

      fps: Effect.map(SynchronizedRef.get(stateRef), (state) => state.currentFps),

      frameCount: Effect.map(SynchronizedRef.get(stateRef), (state) => state.frameCount),

      lastFrameId: Effect.map(SynchronizedRef.get(stateRef), (state) => state.lastFrameId),

      delta: Effect.map(SynchronizedRef.get(stateRef), (state) => state.lastDelta),

      registerFrameCallback: (callback) =>
        SynchronizedRef.update(stateRef, (state) => ({
          ...state,
          callbacks: [...state.callbacks, callback],
        })).pipe(
          Effect.as<FrameCallbackRegistration>({
            unregister: SynchronizedRef.update(stateRef, (state) => ({
              ...state,
              callbacks: state.callbacks.filter((existing) => existing !== callback),
            })),
          })
        ),

      nextFrame: (timestampInput) =>
        Effect.gen(function* () {
          const now = yield* pipe(
            Option.fromNullable(timestampInput),
            Option.match({
              onNone: () => currentTimestamp,
              onSome: (value) =>
                Effect.flatMap(currentTimestamp, (clockNow) =>
                  pipe(
                    makeTimestamp(value),
                    effectFromEither,
                    Effect.mapError((error) => parseErrorToRuntime('timestamp-parse', error, clockNow))
                  )
                ),
            })
          )

          const frameComputation = yield* SynchronizedRef.modifyEffect(stateRef, (state) =>
            Effect.gen(function* () {
              const statusCheck = pipe(
                state.status === runningState,
                Match.value,
                Match.when(true, () => Either.right(state)),
                Match.orElse(() =>
                  Either.left(
                    toRuntimeCallbackError({
                      callbackId: 'frame-execution',
                      causeMessage: 'running 状態でのみ nextFrame を呼び出せます',
                      occurredAt: now,
                    })
                  )
                )
              )

              const runnable = yield* effectFromEither(statusCheck)

              const baselineDelta = 1000 / fpsToNumber(runnable.config.targetFps)
              const delta = yield* Option.match(runnable.lastTimestamp, {
                onNone: () =>
                  pipe(
                    makeFrameDuration(baselineDelta),
                    effectFromEither,
                    Effect.mapError((error) => parseErrorToRuntime('frame-delta', error, now))
                  ),
                onSome: (previous) =>
                  pipe(
                    reconcileFrameTiming(runnable.config.targetFps, previous, now),
                    effectFromEither,
                    Effect.mapError(() =>
                      toPerformanceError({
                        metric: 'fps',
                        target: runnable.config.targetFps,
                        observed: runnable.currentFps,
                      })
                    )
                  ),
              })

              const nextFrameCount = yield* pipe(
                advanceFrameCount(runnable.frameCount),
                effectFromEither,
                Effect.mapError((error) => parseErrorToRuntime('frame-count', error, now))
              )

              const frameId = yield* pipe(
                makeFrameIdentifier(nextFrameCount),
                effectFromEither,
                Effect.mapError((error) => parseErrorToRuntime('frame-id', error, now))
              )

              const observedFps = yield* pipe(
                observedFpsFromDelta(delta),
                effectFromEither,
                Effect.mapError((error) => parseErrorToRuntime('fps-derivation', error, now))
              )

              const skipped = computeSkipped(runnable.config, delta)

              const frameInfo = yield* pipe(
                makeFrameInfo({
                  frameId,
                  frameCount: nextFrameCount,
                  timestamp: now,
                  delta,
                  fps: observedFps,
                  skipped,
                }),
                effectFromEither,
                Effect.mapError((error) => parseErrorToRuntime('frame-info', error, now))
              )

              const updatedState: InternalState = {
                ...runnable,
                frameCount: nextFrameCount,
                lastTimestamp: Option.some(now),
                lastFrameId: frameId,
                lastDelta: delta,
                currentFps: observedFps,
                droppedFrames: bumpDropped(runnable.droppedFrames, skipped),
              }

              const context: FrameCallbackContext = {
                state: updatedState.status,
                metrics: deriveMetrics(updatedState),
              }

              return [{ info: frameInfo, callbacks: updatedState.callbacks, context }, updatedState] as const
            })
          )

          yield* Effect.forEach(frameComputation.callbacks, (callback) =>
            callback(frameComputation.info, frameComputation.context)
          )

          return frameComputation.info
        }),
    }

    return GameLoopServiceTag.of(service)
  })
)
