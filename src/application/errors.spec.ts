import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import {
  CanvasNotFoundError,
  ConfigurationValidationError,
  createErrorContext,
  FrameProcessingError,
  GameLoopInitializationFailedError,
  getErrorSeverity,
  isRecoverable,
  MemoryLeakError,
  RendererInitializationFailedError,
  SystemSynchronizationError,
} from './errors'
import { MemoryBytes, Milliseconds } from './types'

describe('application errors', () => {
  it.effect('createErrorContext embeds system metadata', () =>
    Effect.gen(function* () {
      const context = yield* createErrorContext({
        system: 'Renderer',
        operation: 'initialize',
      })
      expect(context.system).toBe('Renderer')
      expect(context.operation).toBe('initialize')
      expect(typeof context.timestamp).toBe('number')
    })
  )

  it.effect('getErrorSeverity classifies critical errors', () =>
    Effect.gen(function* () {
      const context = yield* createErrorContext({ system: 'Renderer', operation: 'boot' })
      const error = RendererInitializationFailedError.make({ context, cause: 'Device missing' })
      expect(getErrorSeverity(error)).toBe('critical')
    })
  )

  it.effect('isRecoverable reflects retryable flag', () =>
    Effect.gen(function* () {
      const context = yield* createErrorContext({ system: 'GameLoop', operation: 'start' })
      const retryable = GameLoopInitializationFailedError.make({
        context,
        cause: 'Transient',
        retryable: true,
      })
      expect(isRecoverable(retryable)).toBe(true)
      const terminal = MemoryLeakError.make({
        context,
        memoryUsage: Schema.decodeSync(MemoryBytes)(1_000),
        memoryLimit: Schema.decodeSync(MemoryBytes)(512),
      })
      expect(isRecoverable(terminal)).toBe(false)
    })
  )

  it.effect('ConfigurationValidationError yields medium severity and recoverable state', () =>
    Effect.gen(function* () {
      const context = yield* createErrorContext({ system: 'Config', operation: 'validate' })
      const validation = ConfigurationValidationError.make({
        context,
        field: 'rendering.targetFps',
        value: 10,
        constraint: '>= 30',
      })
      expect(getErrorSeverity(validation)).toBe('low')
      expect(isRecoverable(validation)).toBe(true)
    })
  )

  it.effect('SystemSynchronizationError captures drift metrics', () =>
    Effect.gen(function* () {
      const context = yield* createErrorContext({ system: 'Sync', operation: 'tick' })
      const syncError = SystemSynchronizationError.make({
        context,
        outOfSyncSystems: ['renderer', 'physics'],
        timeDrift: Schema.decodeSync(Milliseconds)(16),
      })
      expect(getErrorSeverity(syncError)).toBe('medium')
      expect(isRecoverable(syncError)).toBe(true)
    })
  )

  it.effect('FrameProcessingError marks high severity but recoverable', () =>
    Effect.gen(function* () {
      const context = yield* createErrorContext({ system: 'Loop', operation: 'frame' })
      const frameError = FrameProcessingError.make({
        context,
        frameNumber: 42,
        deltaTime: Schema.decodeSync(Milliseconds)(16),
        stage: 'render',
        cause: 'GPU stall',
      })
      expect(getErrorSeverity(frameError)).toBe('high')
      expect(isRecoverable(frameError)).toBe(true)
    })
  )

  it.effect('CanvasNotFoundError escalates to critical severity', () =>
    Effect.gen(function* () {
      const context = yield* createErrorContext({ system: 'Renderer', operation: 'canvas' })
      const error = CanvasNotFoundError.make({ context })
      expect(getErrorSeverity(error)).toBe('critical')
      expect(isRecoverable(error)).toBe(false)
    })
  )
})
