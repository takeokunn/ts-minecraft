import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import * as FastCheck from 'effect/FastCheck'
import * as ReadonlyArray from 'effect/Array'
import {
  DEFAULT_GAME_APPLICATION_CONFIG,
  FramesPerSecond,
  GameApplicationConfig,
  Milliseconds,
  TargetFramesPerSecond,
} from './types'
import {
  applyConfig,
  computeHealth,
  createInitialState,
  synchronizeLifecycle,
  tickState,
  withStartTime,
} from './state'

describe('application/state', () => {
  const toMilliseconds = Schema.decodeSync(Milliseconds)
  const toFps = Schema.decodeSync(FramesPerSecond)

  it('tickState increments frame count while running', () => {
    const initial = synchronizeLifecycle(
      createInitialState(DEFAULT_GAME_APPLICATION_CONFIG),
      'Running'
    )
    const updated = tickState(initial, toMilliseconds(16))

    expect(updated.systems.gameLoop.frameCount).toEqual(
      initial.systems.gameLoop.frameCount + 1
    )
    expect(updated.systems.gameLoop.currentFps).toEqual(toFps(62.5))
    expect(updated.performance.overallFps).toEqual(toFps(62.5))
  })

  it('tickState is idempotent when lifecycle is paused', () => {
    const paused = synchronizeLifecycle(
      createInitialState(DEFAULT_GAME_APPLICATION_CONFIG),
      'Paused'
    )
    const delta = toMilliseconds(32)
    const updated = tickState(paused, delta)
    expect(updated).toEqual(paused)
  })

  it('applyConfig updates target FPS while preserving counters', () => {
    const running = synchronizeLifecycle(
      createInitialState(DEFAULT_GAME_APPLICATION_CONFIG),
      'Running'
    )
    const nextConfig: GameApplicationConfig = {
      ...DEFAULT_GAME_APPLICATION_CONFIG,
      rendering: {
        ...DEFAULT_GAME_APPLICATION_CONFIG.rendering,
        targetFps: Schema.decodeSync(TargetFramesPerSecond)(144),
      },
    }
    const applied = applyConfig(running, nextConfig)
    expect(applied.systems.gameLoop.targetFps).toEqual(144)
    expect(applied.systems.gameLoop.frameCount).toEqual(
      running.systems.gameLoop.frameCount
    )
  })

  it('computeHealth reflects lifecycle derived system status', () => {
    const base = synchronizeLifecycle(
      createInitialState(DEFAULT_GAME_APPLICATION_CONFIG),
      'Running'
    )
    const withStart = withStartTime(base, 0)
    const health = computeHealth(withStart)
    expect(health.gameLoop.status).toBe('healthy')
    expect(health.renderer.status).toBe('healthy')
  })

  it('tickState accumulates frames monotonically (property)', () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.integer({ min: 1, max: 120 }), (steps) => {
        const running = synchronizeLifecycle(
          createInitialState(DEFAULT_GAME_APPLICATION_CONFIG),
          'Running'
        )
        const deltas = ReadonlyArray.replicate(toMilliseconds(16), steps)
        const result = ReadonlyArray.reduce(deltas, running, (state, delta) =>
          tickState(state, delta)
        )
        expect(result.systems.gameLoop.frameCount).toEqual(
          running.systems.gameLoop.frameCount + steps
        )
      })
    )
  })
})
