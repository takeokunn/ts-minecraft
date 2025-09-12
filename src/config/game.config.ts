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

/**
 * @deprecated Use GameConfigSchema validation instead
 */
export const validateGameConfig = (config: GameConfig): boolean => {
  try {
    // Use Effect-TS schema validation but return boolean for compatibility
    const result = Effect.runSync(
      Effect.tryPromise({
        try: async () => {
          const { GameConfigService } = await import('./services/game-config.service')
          return Effect.runPromise(
            Effect.gen(function* () {
              const service = yield* GameConfigService
              yield* service.validate(config)
              return true
            }).pipe(Effect.provide(GameConfigServiceLive))
          )
        },
        catch: () => false,
      })
    )
    return result ?? false
  } catch {
    return false
  }
}

/**
 * @deprecated Use GameConfigService.loadUserPreferences() instead
 */
export const loadUserGameConfig = (): Partial<GameConfig> => {
  try {
    const saved = localStorage.getItem('ts-minecraft-game-config')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.warn('Failed to load game config:', error)
  }
  return {}
}

/**
 * @deprecated Use GameConfigService.saveUserPreferences() instead
 */
export const saveUserGameConfig = (config: Partial<GameConfig>): void => {
  try {
    localStorage.setItem('ts-minecraft-game-config', JSON.stringify(config))
  } catch (error) {
    console.warn('Failed to save game config:', error)
  }
}

/**
 * @deprecated Use GameConfigService.get() instead
 */
export const getUserGameConfig = (): GameConfig => {
  try {
    // Use the new service but provide fallback for compatibility
    const result = Effect.runSync(
      Effect.gen(function* () {
        const service = yield* GameConfigService
        return yield* service.get
      }).pipe(
        Effect.provide(GameConfigServiceLive),
        Effect.catchAll(() => Effect.succeed(defaultGameConfig))
      )
    )
    return result
  } catch {
    return defaultGameConfig
  }
}

// Initialize the service and validate on load (for backward compatibility)
Effect.runPromise(
  Effect.gen(function* () {
    const service = yield* GameConfigService
    yield* service.load
  }).pipe(
    Effect.provide(GameConfigServiceLive),
    Effect.catchAll((error) => {
      console.error('Failed to initialize game configuration:', error)
      return Effect.void
    })
  )
).catch(() => {
  // Fallback for environments where Effect cannot run
  console.warn('Using fallback game configuration')
})
