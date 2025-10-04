export { GameApplication } from './GameApplication'
export { GameApplicationLive } from './GameApplicationLive'
export { mergeConfig } from './config'
export type { GameApplicationConfigPatch, GameApplicationConfigPatchInput } from './config'
export { guardLifecycleTransition, permittedTargets } from './lifecycle'
export { applyConfig, computeHealth, createInitialState, synchronizeLifecycle, tickState, withStartTime } from './state'
export { DEFAULT_GAME_APPLICATION_CONFIG } from './types'
export { createErrorContext, getErrorSeverity, isRecoverable } from './errors'
export * from './inventory'

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
