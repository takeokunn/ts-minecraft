import { describe, expect, it } from '@effect/vitest'
import { Schema } from 'effect'
import {
  DEFAULT_GAME_APPLICATION_CONFIG,
  GameApplicationConfig,
  GameApplicationState,
  TargetFramesPerSecond,
} from './types'

describe('application types', () => {
  it('default configuration satisfies schema constraints', () => {
    const decoded = Schema.decodeSync(GameApplicationConfig)(DEFAULT_GAME_APPLICATION_CONFIG)
    expect(decoded.rendering.targetFps).toEqual(Schema.decodeSync(TargetFramesPerSecond)(60))
  })

  it('GameApplicationState enforces structural invariants', () => {
    const state = Schema.decodeSync(GameApplicationState)({
      lifecycle: 'Uninitialized',
      startTime: undefined,
      uptime: 0,
      systems: {
        gameLoop: {
          status: 'idle',
          currentFps: 0,
          targetFps: 60,
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
      },
      performance: {
        overallFps: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        isHealthy: true,
      },
      config: Schema.decodeSync(GameApplicationConfig)(DEFAULT_GAME_APPLICATION_CONFIG),
      lastError: undefined,
    })

    expect(state.lifecycle).toBe('Uninitialized')
    expect(state.performance.isHealthy).toBe(true)
  })
})
