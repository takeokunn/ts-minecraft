import { Effect, Layer, Ref } from 'effect'
import { GameApplication } from './GameApplication'
import type {
  ApplicationLifecycleState,
  GameApplicationConfig,
  GameApplicationState,
} from './types'
import { DEFAULT_GAME_APPLICATION_CONFIG } from './types'
import type { SystemHealthCheck } from './types'

const createInitialSystems = (config: GameApplicationConfig): GameApplicationState['systems'] => ({
  gameLoop: {
    status: 'idle',
    currentFps: 0,
    targetFps: config.rendering.targetFps,
    frameCount: 0,
    totalTime: 0,
  },
  renderer: {
    status: 'idle',
    memoryUsage: { geometries: 0, textures: 0, total: 0 },
    renderStats: { drawCalls: 0, triangles: 0, frameTime: 0 },
  },
  scene: {
    status: 'idle',
    currentScene: undefined,
    sceneStack: [],
    isTransitioning: false,
    transitionProgress: 0,
  },
  input: {
    status: 'idle',
    connectedDevices: { keyboard: false, mouse: false, gamepad: 0 },
    activeInputs: 0,
  },
  ecs: {
    status: 'idle',
    entityCount: 0,
    componentCount: 0,
    systemCount: 0,
    activeQueries: 0,
  },
})

const createInitialState = (config: GameApplicationConfig): GameApplicationState => ({
  lifecycle: 'Uninitialized',
  startTime: undefined,
  uptime: 0,
  systems: createInitialSystems(config),
  performance: {
    overallFps: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    isHealthy: true,
  },
  config,
  lastError: undefined,
})

const allowedTransitions: Readonly<Record<ApplicationLifecycleState, readonly ApplicationLifecycleState[]>> = {
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

const transitionAllowed = (
  current: ApplicationLifecycleState,
  target: ApplicationLifecycleState
) => allowedTransitions[current]?.includes(target) ?? false

const syncState = (
  state: GameApplicationState,
  updates: Partial<GameApplicationState>
): GameApplicationState => ({ ...state, ...updates, systems: { ...state.systems, ...(updates.systems ?? {}) } })

const withLifecycle = (state: GameApplicationState, lifecycle: ApplicationLifecycleState): GameApplicationState =>
  syncState(state, { lifecycle })

const lifecycleToSystemStatus = (lifecycle: ApplicationLifecycleState): 'idle' | 'initializing' | 'running' | 'paused' | 'error' => {
  switch (lifecycle) {
    case 'Running':
      return 'running'
    case 'Paused':
    case 'Pausing':
      return 'paused'
    case 'Initializing':
    case 'Starting':
    case 'Resuming':
      return 'initializing'
    case 'Error':
      return 'error'
    case 'Stopping':
    case 'Stopped':
    case 'Uninitialized':
    default:
      return 'idle'
  }
}

const markSystemsStatus = (
  systems: GameApplicationState['systems'],
  lifecycle: ApplicationLifecycleState
): GameApplicationState['systems'] => {
  const status = lifecycleToSystemStatus(lifecycle)
  return {
    gameLoop: { ...systems.gameLoop, status },
    renderer: { ...systems.renderer, status },
    scene: { ...systems.scene, status },
    input: { ...systems.input, status },
    ecs: { ...systems.ecs, status },
  }
}

const computeHealth = (state: GameApplicationState): SystemHealthCheck => ({
  gameLoop: { status: state.systems.gameLoop.status === 'error' ? 'unhealthy' : 'healthy', fps: state.systems.gameLoop.currentFps },
  renderer: { status: state.systems.renderer.status === 'error' ? 'unhealthy' : 'healthy', memory: state.performance.memoryUsage },
  scene: { status: state.systems.scene.status === 'error' ? 'unhealthy' : 'healthy', sceneCount: state.systems.scene.sceneStack.length },
  input: { status: state.systems.input.status === 'error' ? 'unhealthy' : 'healthy' },
  ecs: { status: state.systems.ecs.status === 'error' ? 'unhealthy' : 'healthy', entityCount: state.systems.ecs.entityCount },
})

const makeGameApplicationLive = Effect.gen(function* () {
  const stateRef = yield* Ref.make(createInitialState(DEFAULT_GAME_APPLICATION_CONFIG))

  const updateState = (updater: (state: GameApplicationState) => GameApplicationState) =>
    Ref.update(stateRef, updater)

const ensureTransition = (
  target: ApplicationLifecycleState
) =>
  Effect.gen(function* () {
    const current = yield* Ref.get(stateRef).pipe(Effect.map((state) => state.lifecycle))
    if (!transitionAllowed(current, target)) {
      return
    }
    yield* updateState((prev) => withLifecycle(prev, target))
  })

  const setLifecycle = (lifecycle: ApplicationLifecycleState) =>
    updateState((prev) => ({ ...withLifecycle(prev, lifecycle), systems: markSystemsStatus(prev.systems, lifecycle) }))

  const initialize = (config?: Partial<GameApplicationConfig>) =>
    Effect.gen(function* () {
      const mergedConfig: GameApplicationConfig = { ...DEFAULT_GAME_APPLICATION_CONFIG, ...(config ?? {}) }
      yield* ensureTransition('Initializing')
      yield* updateState(() => ({ ...createInitialState(mergedConfig), lifecycle: 'Initializing' }))
      yield* setLifecycle('Initialized')
    })

  const start = () =>
    Effect.gen(function* () {
      yield* ensureTransition('Starting')
      const startTime = Date.now()
      yield* updateState((prev) => ({
        ...prev,
        lifecycle: 'Starting',
        startTime,
        uptime: 0,
        systems: markSystemsStatus(prev.systems, 'Starting'),
      }))
      yield* setLifecycle('Running')
    })

  const pause = () =>
    Effect.gen(function* () {
      yield* ensureTransition('Pausing')
      yield* setLifecycle('Paused')
    })

  const resume = () =>
    Effect.gen(function* () {
      yield* ensureTransition('Resuming')
      yield* setLifecycle('Running')
    })

  const stop = () =>
    Effect.gen(function* () {
      yield* ensureTransition('Stopping')
      yield* updateState((prev) => ({
        ...prev,
        lifecycle: 'Stopped',
        systems: markSystemsStatus(prev.systems, 'Stopped'),
      }))
    })

  const getState = () => Ref.get(stateRef)

  const getLifecycleState = () =>
    Ref.get(stateRef).pipe(Effect.map((state) => state.lifecycle))

  const tick = (deltaTime: number = 16) =>
    Ref.update(stateRef, (prev) => {
      if (prev.lifecycle !== 'Running') {
        return prev
      }
      const nextFrameCount = prev.systems.gameLoop.frameCount + 1
      const nextTotalTime = prev.systems.gameLoop.totalTime + deltaTime
      const totalSeconds = nextTotalTime / 1000
      const overallFps = totalSeconds > 0 ? nextFrameCount / totalSeconds : 0
      return {
        ...prev,
        uptime: prev.uptime + deltaTime,
        systems: {
          ...prev.systems,
          gameLoop: {
            ...prev.systems.gameLoop,
            status: 'running',
            frameCount: nextFrameCount,
            totalTime: nextTotalTime,
            currentFps: overallFps,
          },
        },
        performance: {
          ...prev.performance,
          overallFps,
        },
      }
    })

  const updateConfig = (config: Partial<GameApplicationConfig>) =>
    Ref.update(stateRef, (prev) => ({
      ...prev,
      config: { ...prev.config, ...config },
    }))

  const healthCheck = () =>
    Ref.get(stateRef).pipe(Effect.map(computeHealth))

  const reset = () => Ref.set(stateRef, createInitialState(DEFAULT_GAME_APPLICATION_CONFIG))

  const service = {
    initialize,
    start,
    pause,
    resume,
    stop,
    getState,
    getLifecycleState,
    tick,
    updateConfig,
    healthCheck,
    reset,
  }

  return GameApplication.of(service)
})

export const GameApplicationLive = Layer.effect(GameApplication, makeGameApplicationLive)
