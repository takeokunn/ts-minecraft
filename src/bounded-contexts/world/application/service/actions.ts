import { Schema } from '@effect/schema'
import { Clock, Duration, Effect, Match, Option, Ref, Schedule, Stream, pipe } from 'effect'
import * as THREE from 'three'
import {
  ApplicationLifecycleState,
  DEFAULT_GAME_APPLICATION_CONFIG,
  GameApplicationConfig,
  GameApplicationConfigInput,
  GameApplicationState,
  HealthStatusValues,
  Milliseconds,
  SystemHealthCheck,
  SystemStatus,
  SystemStatusValues,
  FramesPerSecond,
  FrameCount,
  MemoryBytes,
  CpuPercentage,
  ResourcePercentage,
  SlotCount,
  Timestamp,
  SceneState,
} from '@application/types'
import {
  ConfigurationValidationError,
  GameApplicationInitError,
  GameApplicationRuntimeError,
  GameApplicationStateError,
  InvalidStateTransitionError,
  JsonValue,
  CanvasNotFoundError,
  RendererInitializationFailedError,
  createErrorContext,
} from '@application/errors'
import { RendererService } from '@mc/bc-world/infrastructure/rendering/disabled/renderer-service'
import { createGameRuntime, GameRuntime } from '@presentation/game'

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

const cloneConfigInput = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

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
  const candidateInput = cloneConfigInput(encodeConfig(base))
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
            {
              key: 'configPatch',
              value: toJsonValue(patch ?? {}),
            },
            {
              key: 'error',
              value: toJsonValue(String(cause)),
            },
          ],
        })

        const safeValue = (() => {
          try {
            return toJsonValue(patch ?? {})
          } catch (_) {
            return toJsonValue(String(patch ?? {}))
          }
        })()

        return yield* Effect.fail<ConfigurationValidationError>(
          ConfigurationValidationError.make({
            context,
            field: 'configPatch',
            value: safeValue,
            constraint: cause instanceof Error ? cause.message : String(cause),
          })
        )
      })
    )
  )
}

const guardTransition = (
  current: ApplicationLifecycleState,
  next: ApplicationLifecycleState
): Effect.Effect<void, InvalidStateTransitionError> =>
  Effect.gen(function* () {
    const allowed = allowedTransitions[current] ?? noTransitions
    const isAllowed = allowed.includes(next)

    if (!isAllowed) {
      const context = yield* createErrorContext({
        system: 'GameApplication',
        operation: 'guardTransition',
        details: [
          { key: 'currentState', value: toJsonValue(current) },
          { key: 'attemptedState', value: toJsonValue(next) },
          { key: 'allowedTransitions', value: toJsonValue(allowed) },
        ],
      })

      return yield* Effect.fail(
        InvalidStateTransitionError.make({
          context,
          currentState: current,
          attemptedState: next,
          validTransitions: allowed,
        })
      )
    }
  })

const makeLifecycleUpdater = (
  stateRef: Ref.Ref<GameApplicationState>,
  lifecycle: ApplicationLifecycleState
): Effect.Effect<void, never, never> =>
  Ref.update(stateRef, (previous) =>
    ({
      ...previous,
      lifecycle,
      systems: mapSystemStatus(previous, lifecycle),
    })
  )

const tickState = (
  state: GameApplicationState,
  delta: Milliseconds
): GameApplicationState => ({
  ...state,
  systems: {
    ...state.systems,
    gameLoop: {
      ...state.systems.gameLoop,
      frameCount: toFrameCount(state.systems.gameLoop.frameCount + Number(delta) / 16),
      totalTime: toMilliseconds(state.systems.gameLoop.totalTime + Number(delta)),
      currentFps: toFramesPerSecond(1000 / Number(delta)),
    },
  },
  performance: {
    ...state.performance,
    overallFps: toFramesPerSecond(1000 / Number(delta)),
  },
  uptime: toMilliseconds(state.uptime + Number(delta)),
})

interface GameRuntimeHandle {
  readonly runtime: GameRuntime
  readonly renderer: THREE.WebGLRenderer
}

const runtimeNotInitialized = (operation: string) =>
  Effect.gen(function* () {
    const context = yield* createErrorContext({
      system: 'GameApplication',
      operation,
    })

    return yield* Effect.fail(
      InvalidStateTransitionError.make({
        context,
        currentState: 'Uninitialized',
        attemptedState: operation,
        validTransitions: [],
      })
    )
  })

export interface GameApplicationServiceContext {
  readonly stateRef: Ref.Ref<GameApplicationState>
  readonly runtimeRef: Ref.Ref<Option.Option<GameRuntimeHandle>>
  readonly rendererService: RendererService
}

const makeState = () => Ref.make(createInitialState(DEFAULT_GAME_APPLICATION_CONFIG))

export const makeGameApplicationService = ({ stateRef, runtimeRef, rendererService }: GameApplicationServiceContext) => ({
  initialize: (
    config?: Partial<GameApplicationConfigInput>
  ): Effect.Effect<void, GameApplicationInitError, never> =>
    Effect.gen(function* () {
      yield* guardTransition('Uninitialized', 'Initializing')

      const initContext = yield* createErrorContext({
        system: 'GameApplication',
        operation: 'initialize',
      })

      const existingRuntime = yield* Ref.get(runtimeRef)
      const existingHandle = Option.getOrNull(existingRuntime)
      if (existingHandle !== null) {
        existingHandle.runtime.stop()
        existingHandle.runtime.dispose()
        yield* rendererService.dispose()
        yield* Ref.set(runtimeRef, Option.none())
      }

      const canvas = yield* Effect.try({
        try: () => {
          const element = document.createElement('canvas')
          element.id = 'game-canvas'
          element.style.display = 'block'
          element.tabIndex = 0
          return element
        },
        catch: () =>
          CanvasNotFoundError.make({
            context: initContext,
            canvasId: 'game-canvas',
            selector: '#game-canvas',
          }),
      })

      yield* rendererService.initialize(canvas)

      const rendererInstance = yield* rendererService.getRenderer()

      if (rendererInstance === null) {
        return yield* Effect.fail(
          RendererInitializationFailedError.make({
            context: yield* createErrorContext({
              system: 'GameApplication',
              operation: 'renderer.initialize',
              details: [
                { key: 'canvasId', value: toJsonValue(canvas.id) },
              ],
            }),
            cause: 'Renderer service returned null instance',
            webglVersion: undefined,
          })
        )
      }

      const runtime = createGameRuntime({ renderer: rendererInstance })

      yield* Ref.set(runtimeRef, Option.some({ runtime, renderer: rendererInstance }))

      const startTime = yield* Clock.currentTimeMillis

      yield* Ref.update(stateRef, (previous) => {
        const initializing = ensureState({
          ...previous,
          startTime,
          lifecycle: 'Initialized',
          systems: mapSystemStatus(previous, 'Initializing'),
        })

        return ensureState({
          ...initializing,
          systems: {
            ...initializing.systems,
            input: {
              ...initializing.systems.input,
              connectedDevices: {
                ...initializing.systems.input.connectedDevices,
                keyboard: true,
                mouse: true,
              },
            },
            scene: {
              ...initializing.systems.scene,
              currentScene: 'GameWorld',
            },
          },
        })
      })

      if (config) {
        const merged = yield* Ref.get(stateRef).pipe(
          Effect.flatMap((previous) => mergeConfig(previous.config, config))
        )
        yield* Ref.update(stateRef, (previous) => ({
          ...previous,
          config: merged,
        }))
      }
    }),

  start: (): Effect.Effect<void, GameApplicationRuntimeError, never> =>
    Effect.gen(function* () {
      const current = yield* Ref.get(stateRef)
      yield* guardTransition(current.lifecycle, 'Starting')

      const runtimeOption = yield* Ref.get(runtimeRef)
      const handle = Option.getOrNull(runtimeOption)
      if (handle === null) {
        yield* Effect.dieMessage('Game runtime not initialized')
      } else {
        handle.runtime.start()
      }

      const startTime = yield* Clock.currentTimeMillis
      yield* Ref.update(stateRef, (previous) =>
        ensureState({
          ...previous,
          startTime,
          lifecycle: 'Running',
          systems: mapSystemStatus(previous, 'Running'),
        })
      )
    }),

  pause: (): Effect.Effect<void, GameApplicationStateError, never> =>
    Effect.gen(function* () {
      const current = yield* Ref.get(stateRef)
      yield* guardTransition(current.lifecycle, 'Pausing')

      const runtimeOption = yield* Ref.get(runtimeRef)
      const handle = Option.getOrNull(runtimeOption)
      if (handle === null) {
        return yield* runtimeNotInitialized('pause')
      }

      handle.runtime.pause()
      yield* makeLifecycleUpdater(stateRef, 'Paused')
    }),

  resume: (): Effect.Effect<void, GameApplicationStateError, never> =>
    Effect.gen(function* () {
      const current = yield* Ref.get(stateRef)
      yield* guardTransition(current.lifecycle, 'Resuming')

      const runtimeOption = yield* Ref.get(runtimeRef)
      const handle = Option.getOrNull(runtimeOption)
      if (handle === null) {
        return yield* runtimeNotInitialized('resume')
      }

      handle.runtime.resume()
      yield* makeLifecycleUpdater(stateRef, 'Running')
    }),

  stop: (): Effect.Effect<void, GameApplicationRuntimeError, never> =>
    Effect.gen(function* () {
      const current = yield* Ref.get(stateRef)
      yield* guardTransition(current.lifecycle, 'Stopping')

      const runtimeOption = yield* Ref.get(runtimeRef)
      const handle = Option.getOrNull(runtimeOption)
      if (handle !== null) {
        handle.runtime.stop()
        handle.runtime.dispose()
      }

      yield* rendererService.dispose()
      yield* Ref.set(runtimeRef, Option.none())
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
    Effect.gen(function* () {
      const runtimeOption = yield* Ref.get(runtimeRef)
      const handle = Option.getOrNull(runtimeOption)
      if (handle !== null) {
        handle.runtime.stop()
        handle.runtime.dispose()
      }
      yield* rendererService.dispose()
      yield* Ref.set(runtimeRef, Option.none())
      yield* Ref.set(stateRef, createInitialState(DEFAULT_GAME_APPLICATION_CONFIG))
    }),
})

export const createGameApplicationController = Effect.gen(function* () {
  const stateRef = yield* makeState()
  const runtimeRef = yield* Ref.make<Option.Option<GameRuntimeHandle>>(Option.none())
  const rendererService = yield* RendererService
  const service = makeGameApplicationService({ stateRef, runtimeRef, rendererService })

  return { stateRef, service }
})

export const GameApplicationStateStream = (
  stateRef: Ref.Ref<GameApplicationState>
): Stream.Stream<GameApplicationState> =>
  Stream.repeatEffectWith(Ref.get(stateRef), Schedule.spaced(Duration.millis(100)))
