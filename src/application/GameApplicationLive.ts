import { Schema } from '@effect/schema'
import { Clock, Effect, Layer, Match, Option, Ref, pipe } from 'effect'
import { GameApplication } from './GameApplication'
import {
  ApplicationLifecycleState,
  DEFAULT_GAME_APPLICATION_CONFIG,
  GameApplicationConfig,
  GameApplicationConfigInput,
  GameApplicationState,
  SystemHealthCheck,
  CpuPercentage,
  FramesPerSecond,
  FrameCount,
  MemoryBytes,
  Milliseconds,
  ResourcePercentage,
  SlotCount,
  SystemStatus,
  SystemStatusValues,
  Timestamp,
  HealthStatusValues,
} from './types'
import {
  ConfigurationValidationError,
  GameApplicationInitError,
  GameApplicationRuntimeError,
  GameApplicationStateError,
  InvalidStateTransitionError,
  JsonValue,
  createErrorContext,
} from './errors'

const ensureConfig = Schema.decodeSync(GameApplicationConfig)
const encodeConfig = Schema.encodeSync(GameApplicationConfig)
const ensureState = Schema.decodeSync(GameApplicationState)
const toFramesPerSecond = Schema.decodeSync(FramesPerSecond)
const toFrameCount = Schema.decodeSync(FrameCount)
const toMilliseconds = Schema.decodeSync(Milliseconds)
const toMemoryBytes = Schema.decodeSync(MemoryBytes)
const toCpuPercentage = Schema.decodeSync(CpuPercentage)
const toResourcePercentage = Schema.decodeSync(ResourcePercentage)
const toSlotCount = Schema.decodeSync(SlotCount)
const toTimestamp = Schema.decodeSync(Timestamp)
const toJsonValue = Schema.decodeSync(JsonValue)

const noTransitions: ReadonlyArray<ApplicationLifecycleState> = []

const allowedTransitions: Record<ApplicationLifecycleState, ReadonlyArray<ApplicationLifecycleState>> = {
  Uninitialized: ['Initializing'],
  Initializing: ['Initialized', 'Error'],
  Initialized: ['Starting', 'Error'],
  Starting: ['Running', 'Error'],
  Running: ['Pausing', 'Stopping', 'Error'],
  Pausing: ['Paused', 'Error'],
  Paused: ['Resuming', 'Stopping', 'Error'],
  Resuming: ['Running', 'Error'],
  Stopping: ['Stopped', 'Error'],
  Stopped: ['Initializing'],
  Error: ['Initializing', 'Stopping'],
}

const lifecycleToSystemStatus = (lifecycle: ApplicationLifecycleState): SystemStatus =>
  Match.value(lifecycle).pipe(
    Match.when('Running', () => SystemStatusValues.Running),
    Match.when('Paused', () => SystemStatusValues.Paused),
    Match.when('Pausing', () => SystemStatusValues.Paused),
    Match.when('Initializing', () => SystemStatusValues.Initializing),
    Match.when('Starting', () => SystemStatusValues.Initializing),
    Match.when('Resuming', () => SystemStatusValues.Initializing),
    Match.when('Error', () => SystemStatusValues.Error),
    Match.orElse(() => SystemStatusValues.Idle)
  )

const healthFromStatus = (status: SystemStatus) =>
  Match.value(status).pipe(
    Match.when(SystemStatusValues.Error, () => HealthStatusValues.Unhealthy),
    Match.orElse(() => HealthStatusValues.Healthy)
  )

const mapSystemStatus = (state: GameApplicationState, lifecycle: ApplicationLifecycleState): GameApplicationState['systems'] => {
  const status = lifecycleToSystemStatus(lifecycle)
  return {
    gameLoop: { ...state.systems.gameLoop, status },
    renderer: { ...state.systems.renderer, status },
    scene: { ...state.systems.scene, status },
    input: { ...state.systems.input, status },
    ecs: { ...state.systems.ecs, status },
  }
}

const computeHealth = (state: GameApplicationState): SystemHealthCheck => ({
  gameLoop: {
    status: healthFromStatus(state.systems.gameLoop.status),
    fps: state.systems.gameLoop.currentFps,
    message: undefined,
  },
  renderer: {
    status: healthFromStatus(state.systems.renderer.status),
    memory: state.performance.memoryUsage,
    message: undefined,
  },
  scene: {
    status: healthFromStatus(state.systems.scene.status),
    sceneCount: state.systems.scene.sceneStack.length,
    message: undefined,
  },
  input: {
    status: healthFromStatus(state.systems.input.status),
    message: undefined,
  },
  ecs: {
    status: healthFromStatus(state.systems.ecs.status),
    entityCount: state.systems.ecs.entityCount,
    message: undefined,
  },
})

const createInitialState = (config: GameApplicationConfig): GameApplicationState =>
  ensureState({
    lifecycle: 'Uninitialized',
    startTime: undefined,
    uptime: toMilliseconds(0),
    systems: {
      gameLoop: {
        status: 'idle',
        currentFps: toFramesPerSecond(0),
        targetFps: config.rendering.targetFps,
        frameCount: toFrameCount(0),
        totalTime: toMilliseconds(0),
      },
      renderer: {
        status: 'idle',
        memoryUsage: {
          geometries: toMemoryBytes(0),
          textures: toMemoryBytes(0),
          total: toMemoryBytes(0),
        },
        renderStats: {
          drawCalls: 0,
          triangles: 0,
          frameTime: toMilliseconds(0),
        },
      },
      scene: {
        status: 'idle',
        currentScene: undefined,
        sceneStack: [],
        isTransitioning: false,
        transitionProgress: toResourcePercentage(0),
      },
      input: {
        status: 'idle',
        connectedDevices: {
          keyboard: false,
          mouse: false,
          gamepad: 0,
        },
        activeInputs: toSlotCount(0),
      },
      ecs: {
        status: 'idle',
        entityCount: toSlotCount(0),
        componentCount: toSlotCount(0),
        systemCount: toSlotCount(0),
        activeQueries: toSlotCount(0),
      },
    },
    performance: {
      overallFps: toFramesPerSecond(0),
      memoryUsage: toMemoryBytes(0),
      cpuUsage: toCpuPercentage(0),
      isHealthy: true,
    },
    config,
    lastError: undefined,
  })

const mergeConfig = (
  base: GameApplicationConfig,
  patch: Partial<GameApplicationConfigInput> | undefined
): Effect.Effect<GameApplicationConfig, ConfigurationValidationError> => {
  const candidateInput = encodeConfig(base)
  const candidate = {
    rendering: { ...candidateInput.rendering, ...(patch?.rendering ?? {}) },
    gameLoop: { ...candidateInput.gameLoop, ...(patch?.gameLoop ?? {}) },
    input: { ...candidateInput.input, ...(patch?.input ?? {}) },
    performance: { ...candidateInput.performance, ...(patch?.performance ?? {}) },
    debug: { ...candidateInput.debug, ...(patch?.debug ?? {}) },
  }

  return Effect.try({
    try: () => ensureConfig(candidate),
    catch: (cause) => cause,
  }).pipe(
    Effect.catchAll((cause) =>
      Effect.gen(function* () {
        const context = yield* createErrorContext({
          system: 'GameApplication',
          operation: 'mergeConfig',
          details: [
            { key: 'reason', value: toJsonValue(typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : 'invalid configuration') },
          ],
        })
        const error = ConfigurationValidationError.make({
          context,
          field: 'config',
          value: toJsonValue(candidate),
          constraint: typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : 'Configuration validation failed',
        })
        yield* Effect.fail(error)
      })
    )
  )
}

const currentTimestamp = Clock.currentTimeMillis.pipe(Effect.map(toTimestamp))

const guardTransition = (
  current: ApplicationLifecycleState,
  target: ApplicationLifecycleState
): Effect.Effect<void, InvalidStateTransitionError> =>
  Effect.sync(() => allowedTransitions[current] ?? noTransitions).pipe(
    Effect.flatMap((valid) =>
      Effect.filterOrElse(
        (transitions: ReadonlyArray<ApplicationLifecycleState>) =>
          transitions.some((state) => state === target),
        () => invalidTransition(current, target, valid)
      )(Effect.succeed(valid)).pipe(Effect.asVoid)
    )
  )

const invalidTransition = (
  current: ApplicationLifecycleState,
  target: ApplicationLifecycleState,
  validTransitions: ReadonlyArray<ApplicationLifecycleState>
): Effect.Effect<never, InvalidStateTransitionError> =>
  Effect.gen(function* () {
    const context = yield* createErrorContext({
      system: 'GameApplication',
      operation: 'guardTransition',
      details: [
        { key: 'current', value: toJsonValue(current) },
        { key: 'target', value: toJsonValue(target) },
      ],
    })
    const error = InvalidStateTransitionError.make({
      context,
      currentState: current,
      attemptedState: target,
      validTransitions: [...validTransitions],
    })
    yield* Effect.fail(error)
  })

const syncLifecycle = (
  state: GameApplicationState,
  lifecycle: ApplicationLifecycleState
): GameApplicationState => ({
  ...state,
  lifecycle,
  systems: mapSystemStatus(state, lifecycle),
})

const tickState = (
  state: GameApplicationState,
  delta: Milliseconds
): GameApplicationState =>
  Match.value(state.lifecycle).pipe(
    Match.when('Running', () => {
      const nextFrameCount = toFrameCount(state.systems.gameLoop.frameCount + 1)
      const nextTotalTime = toMilliseconds(state.systems.gameLoop.totalTime + delta)
      const totalSeconds = nextTotalTime / 1000
      const overallFps = Match.value(totalSeconds > 0).pipe(
        Match.when(true, () => toFramesPerSecond(nextFrameCount / totalSeconds)),
        Match.orElse(() => toFramesPerSecond(0))
      )

      return {
        ...state,
        uptime: toMilliseconds(state.uptime + delta),
        systems: {
          ...state.systems,
          gameLoop: {
            ...state.systems.gameLoop,
            status: 'running',
            frameCount: nextFrameCount,
            totalTime: nextTotalTime,
            currentFps: overallFps,
          },
        },
        performance: {
          ...state.performance,
          overallFps,
        },
      }
    }),
    Match.orElse(() => state)
  )

const makeLifecycleUpdater = (
  stateRef: Ref.Ref<GameApplicationState>,
  target: ApplicationLifecycleState
) =>
  Ref.update(stateRef, (current) => syncLifecycle(current, target))

const makeService = (
  stateRef: Ref.Ref<GameApplicationState>
): GameApplication => ({
  initialize: (config): Effect.Effect<void, GameApplicationInitError, never> =>
    Effect.gen(function* () {
      const current = yield* Ref.get(stateRef)
      yield* guardTransition(current.lifecycle, 'Initializing')
      const mergedConfig = yield* mergeConfig(current.config, config)
      const initializingState = syncLifecycle(createInitialState(mergedConfig), 'Initializing')
      yield* Ref.set(stateRef, initializingState)
      yield* makeLifecycleUpdater(stateRef, 'Initialized')
    }),

  start: (): Effect.Effect<void, GameApplicationRuntimeError, never> =>
    Effect.gen(function* () {
      const current = yield* Ref.get(stateRef)
      yield* guardTransition(current.lifecycle, 'Starting')
      const startTime = yield* currentTimestamp
      yield* Ref.update(stateRef, (previous) =>
        syncLifecycle(
          {
            ...previous,
            startTime,
            uptime: toMilliseconds(0),
            systems: mapSystemStatus(previous, 'Starting'),
          },
          'Running'
        )
      )
    }),

  pause: (): Effect.Effect<void, GameApplicationStateError, never> =>
    Effect.gen(function* () {
      const current = yield* Ref.get(stateRef)
      yield* guardTransition(current.lifecycle, 'Pausing')
      yield* makeLifecycleUpdater(stateRef, 'Paused')
    }),

  resume: (): Effect.Effect<void, GameApplicationStateError, never> =>
    Effect.gen(function* () {
      const current = yield* Ref.get(stateRef)
      yield* guardTransition(current.lifecycle, 'Resuming')
      yield* makeLifecycleUpdater(stateRef, 'Running')
    }),

  stop: (): Effect.Effect<void, GameApplicationRuntimeError, never> =>
    Effect.gen(function* () {
      const current = yield* Ref.get(stateRef)
      yield* guardTransition(current.lifecycle, 'Stopping')
      yield* makeLifecycleUpdater(stateRef, 'Stopped')
    }),

  getState: () => Ref.get(stateRef),

  getLifecycleState: () => Ref.get(stateRef).pipe(Effect.map((state) => state.lifecycle)),

  tick: (delta = toMilliseconds(16)): Effect.Effect<void, GameApplicationRuntimeError, never> =>
    Ref.update(stateRef, (previous) => tickState(previous, delta)),

  updateConfig: (config): Effect.Effect<void, GameApplicationStateError, never> =>
    Effect.gen(function* () {
      const current = yield* Ref.get(stateRef)
      const merged = yield* mergeConfig(current.config, config)
      yield* Ref.update(stateRef, (prev) => ({
        ...prev,
        config: merged,
      }))
    }),

  healthCheck: () => Ref.get(stateRef).pipe(Effect.map(computeHealth)),

  reset: (): Effect.Effect<void, GameApplicationRuntimeError, never> =>
    Ref.update(stateRef, () => createInitialState(DEFAULT_GAME_APPLICATION_CONFIG)),
})

const makeGameApplicationLive = Effect.gen(function* () {
  const stateRef = yield* Ref.make(createInitialState(DEFAULT_GAME_APPLICATION_CONFIG))
  return GameApplication.of(makeService(stateRef))
})

export const GameApplicationLive = Layer.effect(GameApplication, makeGameApplicationLive)
