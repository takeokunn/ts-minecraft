// Service exports
export { GameLoopService } from './GameLoopService'
export { GameLoopServiceLive } from './GameLoopServiceLive'

// Type exports
export type {
  GameLoopState,
  FrameInfo,
  PerformanceMetrics,
  GameLoopConfig,
} from './types'

export {
  GameLoopStateSchema,
  FrameInfoSchema,
  PerformanceMetricsSchema,
  GameLoopConfigSchema,
  DEFAULT_GAME_LOOP_CONFIG,
} from './types'

// Error exports
export {
  GameLoopError,
  GameLoopInitError,
  GameLoopRuntimeError,
  GameLoopPerformanceError,
  GameLoopStateError,
} from './errors'