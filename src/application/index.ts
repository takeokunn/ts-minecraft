export { mergeConfig } from './config'
export type { GameApplicationConfigPatch, GameApplicationConfigPatchInput } from './config'
export { createErrorContext, getErrorSeverity, isRecoverable } from './errors'
export { GameApplication } from './game-application'
export { GameApplicationLive } from './game-application-live'
export * from './inventory'
export { guardLifecycleTransition, permittedTargets } from './lifecycle'
export * from './settings'
export { applyConfig, computeHealth, createInitialState, synchronizeLifecycle, tickState, withStartTime } from './state'
export { DEFAULT_GAME_APPLICATION_CONFIG } from './types'

// FR-1 Application Services
export * from './camera'
export * from './chunk'
export * from './chunk_manager'
export * from './crafting'
export * from './equipment'
export * from './game_loop'
export * from './interaction'
export * from './inventory'
export * from './physics'
export * from './player'
export * from './world'
export * from './world_generation'

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

export {
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
