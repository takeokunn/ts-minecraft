import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import type {
  FrameCount,
  FrameDuration,
  FrameId,
  FrameInfo,
  FramesPerSecond,
  GameLoopConfig,
  GameLoopState,
  PerformanceMetrics,
  Timestamp,
} from '../types/core'
import { InitializationError, PerformanceError, RuntimeCallbackError, StateTransitionError } from '../types/errors'

/**
 * ゲームループサービスインターフェース
 */
export interface GameLoopService {
  readonly configure: (input: Partial<GameLoopConfig>) => Effect.Effect<GameLoopConfig, InitializationError>

  readonly initialize: Effect.Effect<GameLoopState, InitializationError>

  readonly start: Effect.Effect<GameLoopState, StateTransitionError>

  readonly pause: Effect.Effect<GameLoopState, StateTransitionError>

  readonly resume: Effect.Effect<GameLoopState, StateTransitionError>

  readonly stop: Effect.Effect<GameLoopState, StateTransitionError>

  readonly state: Effect.Effect<GameLoopState>

  readonly metrics: Effect.Effect<PerformanceMetrics>

  readonly nextFrame: (timestamp?: Timestamp) => Effect.Effect<FrameInfo, PerformanceError | RuntimeCallbackError>

  readonly registerFrameCallback: (callback: FrameCallback) => Effect.Effect<FrameCallbackRegistration>

  readonly fps: Effect.Effect<FramesPerSecond>

  readonly frameCount: Effect.Effect<FrameCount>

  readonly lastFrameId: Effect.Effect<FrameId>

  readonly delta: Effect.Effect<FrameDuration>
}

export interface FrameCallbackContext {
  readonly state: GameLoopState
  readonly metrics: PerformanceMetrics
}

export type FrameCallback = (
  info: FrameInfo,
  context: FrameCallbackContext
) => Effect.Effect<void, RuntimeCallbackError>

export interface FrameCallbackRegistration {
  readonly unregister: Effect.Effect<void>
}

export const GameLoopService = Context.GenericTag<GameLoopService>('@minecraft/domain/GameLoopService')

export type GameLoopServiceLayer = Layer.Layer<GameLoopService>
