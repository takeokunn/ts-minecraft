import { Context, Effect } from 'effect'
import type { PlayerId } from '../PlayerTypes.js'
import type { Vector3D } from '../../../shared/schemas/spatial.js'
import type {
  CurrentHealth,
  MaxHealth,
  DamageSource,
  HealingSource,
  HealAmount,
  HealthState,
  HealthError,
} from './HealthTypes.js'
import type { ArmorValue, ProtectionLevel } from './DamageCalculator.js'

// =======================================
// Health Service Interface
// =======================================

export interface HealthService {
  /**
   * Deal damage to a player
   */
  readonly takeDamage: (
    playerId: PlayerId,
    source: DamageSource,
    armor?: ArmorValue,
    protectionLevel?: ProtectionLevel
  ) => Effect.Effect<CurrentHealth, HealthError>

  /**
   * Heal a player
   */
  readonly heal: (playerId: PlayerId, source: HealingSource) => Effect.Effect<CurrentHealth, HealthError>

  /**
   * Set player's health directly
   */
  readonly setHealth: (playerId: PlayerId, health: CurrentHealth) => Effect.Effect<void, HealthError>

  /**
   * Get current health of a player
   */
  readonly getCurrentHealth: (playerId: PlayerId) => Effect.Effect<CurrentHealth, HealthError>

  /**
   * Get full health state of a player
   */
  readonly getHealthState: (playerId: PlayerId) => Effect.Effect<HealthState, HealthError>

  /**
   * Check if player is dead
   */
  readonly isDead: (playerId: PlayerId) => Effect.Effect<boolean, HealthError>

  /**
   * Kill a player instantly
   */
  readonly kill: (playerId: PlayerId, source: DamageSource) => Effect.Effect<void, HealthError>

  /**
   * Respawn a dead player
   */
  readonly respawn: (playerId: PlayerId, spawnLocation: Vector3D) => Effect.Effect<void, HealthError>

  /**
   * Set max health for a player
   */
  readonly setMaxHealth: (playerId: PlayerId, maxHealth: MaxHealth) => Effect.Effect<void, HealthError>

  /**
   * Initialize health for a new player
   */
  readonly initializePlayer: (
    playerId: PlayerId,
    initialHealth?: CurrentHealth,
    maxHealth?: MaxHealth
  ) => Effect.Effect<void, HealthError>

  /**
   * Remove player from health system
   */
  readonly removePlayer: (playerId: PlayerId) => Effect.Effect<void, HealthError>

  /**
   * Apply natural regeneration
   */
  readonly applyNaturalRegeneration: (playerId: PlayerId) => Effect.Effect<CurrentHealth, HealthError>

  /**
   * Check if player is invulnerable
   */
  readonly isInvulnerable: (playerId: PlayerId) => Effect.Effect<boolean, HealthError>
}

export const HealthService = Context.GenericTag<HealthService>('@minecraft/HealthService')
