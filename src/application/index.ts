export { mergeConfig } from './config'
export type { GameApplicationConfigPatch, GameApplicationConfigPatchInput } from './config'
export { createErrorContext, getErrorSeverity, isRecoverable } from './errors'
export { GameApplication } from './game-application'
export { GameApplicationLive } from './game-application-live'
export * from './inventory'
export { guardLifecycleTransition, permittedTargets } from './lifecycle'
export { applyConfig, computeHealth, createInitialState, synchronizeLifecycle, tickState, withStartTime } from './state'
export { DEFAULT_GAME_APPLICATION_CONFIG } from './types'

export type {
  ApplicationLifecycleState,
  ECSState,
  GameApplicationConfig,
  GameApplicationState,
  GameLoopState,
  InputState,
  RendererState,
  SceneState,
  SystemHealthCheck,
  SystemStatus,
} from './types'

export type {
  CanvasNotFoundError,
  ConfigurationValidationError,
  ECSInitializationFailedError,
  FrameProcessingError,
  GameApplicationInitError,
  GameApplicationRuntimeError,
  GameApplicationStateError,
  GameLoopInitializationFailedError,
  InputInitializationFailedError,
  InvalidStateTransitionError,
  MemoryLeakError,
  PerformanceDegradationError,
  RendererInitializationFailedError,
  SceneInitializationFailedError,
  SystemCommunicationError,
  SystemSynchronizationError,
  WebGLContextLostError,
} from './errors'
