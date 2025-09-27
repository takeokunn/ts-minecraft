// Service exports
export { GameLoopService } from './services/GameLoopService'
export { GameLoopServiceLive } from './services/GameLoopServiceLive'

// Type exports
export type { GameLoopState, FrameInfo, PerformanceMetrics, GameLoopConfig } from './types/types'

export {
  GameLoopStateSchema,
  FrameInfoSchema,
  PerformanceMetricsSchema,
  GameLoopConfigSchema,
  DEFAULT_GAME_LOOP_CONFIG,
} from './types/types'

// Error exports
export {
  GameLoopError,
  GameLoopInitError,
  GameLoopRuntimeError,
  GameLoopPerformanceError,
  GameLoopStateError,
} from './errors'
