import { Match, Schema } from 'effect'
import type { SystemStatus as Status } from './types'
import {
  ApplicationLifecycleState,
  CpuPercentage,
  DEFAULT_GAME_APPLICATION_CONFIG,
  FrameCount,
  FramesPerSecond,
  GameApplicationConfig,
  GameApplicationState,
  HealthStatusValues,
  MemoryBytes,
  Milliseconds,
  ResourcePercentage,
  SlotCount,
  SystemHealthCheck,
  SystemStatusValues,
  Timestamp,
} from './types'

const ensureState = Schema.decodeSync(GameApplicationState)
const toFramesPerSecond = Schema.decodeSync(FramesPerSecond)
const toFrameCount = Schema.decodeSync(FrameCount)
const toMilliseconds = Schema.decodeSync(Milliseconds)
const toMemoryBytes = Schema.decodeSync(MemoryBytes)
const toCpuPercentage = Schema.decodeSync(CpuPercentage)
const toResourcePercentage = Schema.decodeSync(ResourcePercentage)
const toSlotCount = Schema.decodeSync(SlotCount)
const toTimestamp = Schema.decodeSync(Timestamp)

const lifecycleToSystemStatus = (lifecycle: ApplicationLifecycleState): Status =>
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

const mapSystemStatus = (
  state: GameApplicationState,
  lifecycle: ApplicationLifecycleState
): GameApplicationState['systems'] => {
  const status = lifecycleToSystemStatus(lifecycle)
  return {
    gameLoop: { ...state.systems.gameLoop, status },
    renderer: { ...state.systems.renderer, status },
    scene: { ...state.systems.scene, status },
    input: { ...state.systems.input, status },
    ecs: { ...state.systems.ecs, status },
  }
}

const healthFromStatus = (status: Status) =>
  Match.value(status).pipe(
    Match.when(SystemStatusValues.Error, () => HealthStatusValues.Unhealthy),
    Match.orElse(() => HealthStatusValues.Healthy)
  )

export const computeHealth = (state: GameApplicationState): SystemHealthCheck => ({
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

export const createInitialState = (
  config: GameApplicationConfig = DEFAULT_GAME_APPLICATION_CONFIG
): GameApplicationState =>
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

export const synchronizeLifecycle = (
  state: GameApplicationState,
  lifecycle: ApplicationLifecycleState
): GameApplicationState => ({
  ...state,
  lifecycle,
  systems: mapSystemStatus(state, lifecycle),
})

export const withStartTime = (state: GameApplicationState, timestamp: number): GameApplicationState => ({
  ...state,
  startTime: toTimestamp(timestamp),
  uptime: toMilliseconds(0),
})

export const tickState = (state: GameApplicationState, delta: Milliseconds): GameApplicationState =>
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

export const applyConfig = (state: GameApplicationState, config: GameApplicationConfig): GameApplicationState => ({
  ...state,
  config,
  systems: {
    ...state.systems,
    gameLoop: {
      ...state.systems.gameLoop,
      targetFps: config.rendering.targetFps,
    },
  },
})
