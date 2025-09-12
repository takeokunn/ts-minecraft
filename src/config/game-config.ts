/**
 * Game-specific configuration using Effect-TS patterns
 * 
 * @deprecated Direct interface usage is deprecated. Use GameConfigService instead.
 * This file maintains backward compatibility while migrating to Effect-TS.
 */

import { Effect } from 'effect'
import { 
  GameConfig, 
  defaultGameConfig,
  GameConfigSchema,
  WorldConfig,
  PlayerConfig,
  PhysicsConfig,
  GameplayConfig,
  PerformanceConfig,
  GraphicsConfig,
  AudioConfig,
  ControlsConfig
} from './schemas/game.schema'
import { 
  GameConfigService, 
  GameConfigServiceLive,
  GameConfigError 
} from './services/game-config.service'

// Re-export types for backward compatibility
export type { 
  GameConfig,
  WorldConfig,
  PlayerConfig,
  PhysicsConfig,
  GameplayConfig,
  PerformanceConfig,
  GraphicsConfig,
  AudioConfig,
  ControlsConfig
}

// Re-export schema for validation
export { GameConfigSchema, GameConfigError }

// Re-export service
export { GameConfigService, GameConfigServiceLive }

// Backward compatibility layer
// These functions are deprecated and will be removed in future versions

/**
 * @deprecated Use GameConfigService.get() instead
 */
export const GAME_CONFIG = defaultGameConfig