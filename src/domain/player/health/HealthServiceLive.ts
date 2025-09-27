import { Effect, Layer, HashMap, Option, Queue, Match, pipe, Ref } from 'effect'
import { Schema } from '@effect/schema'
import { HealthService } from './HealthService'
import { DamageCalculator, type ArmorValue, type ProtectionLevel } from './DamageCalculator'
import type { PlayerId } from '../PlayerTypes'
import { PlayerEventBus } from '../PlayerServiceV2'
import { Health } from '../PlayerTypes'
import { PlayerService } from '../PlayerService'
import type { Vector3D } from '@domain/core/types/spatial'
import {
  type CurrentHealth,
  type MaxHealth,
  type DamageSource,
  type HealingSource,
  type HealthState,
  type HealthEvent,
  type HealAmount,
  createHealthError,
  HEALTH_CONSTANTS,
} from './HealthTypes'

// =======================================
// HealthService Live Implementation
// =======================================

const makeHealthService = Effect.gen(function* () {
  // Dependencies
  const damageCalculator = yield* DamageCalculator
  const eventBus = yield* PlayerEventBus
  const playerService = yield* PlayerService

  // Ref-based state for health management
  const healthStates = yield* Ref.make(HashMap.empty<PlayerId, HealthState>())

  // Event queue for async event publishing
  const eventQueue = yield* Queue.unbounded<HealthEvent>()

  // Start event publisher fiber
  yield* Effect.forkDaemon(
    Effect.forever(
      Effect.gen(function* () {
        const event = yield* Queue.take(eventQueue)

        // Convert HealthEvent to PlayerEvent for the event bus
        if (event._tag === 'Damaged') {
          yield* eventBus.publish({
            _tag: 'PlayerDamaged' as const,
            playerId: event.playerId,
            damage: event.amount,
            source: event.source as any,
            newHealth: event.newHealth as unknown as Health,
            timestamp: event.timestamp,
          })
        } else if (event._tag === 'Died') {
          yield* eventBus.publish({
            _tag: 'PlayerDied' as const,
            playerId: event.playerId,
            cause: event.source as any,
            position: event.deathLocation,
            timestamp: event.timestamp,
          })
        } else if (event._tag === 'Respawned') {
          yield* eventBus.publish({
            _tag: 'PlayerRespawned' as const,
            playerId: event.playerId,
            position: event.spawnLocation,
            timestamp: event.timestamp,
          })
        }
      })
    )
  )

  // Helper: Get or create health state
  const getOrCreateHealthState = (playerId: PlayerId): Effect.Effect<HealthState> =>
    Effect.gen(function* () {
      const states = yield* Ref.get(healthStates)
      const existingState = HashMap.get(states, playerId)

      return pipe(
        existingState,
        Option.getOrElse(() => ({
          playerId,
          currentHealth: HEALTH_CONSTANTS.DEFAULT_MAX_HEALTH as unknown as CurrentHealth,
          maxHealth: HEALTH_CONSTANTS.DEFAULT_MAX_HEALTH,
          isDead: false,
          lastDamageSource: undefined,
          lastDamageTime: undefined,
          invulnerabilityEndTime: undefined,
        }))
      )
    })

  // Helper: Update health state atomically
  const updateHealthState = (
    playerId: PlayerId,
    updater: (state: HealthState) => HealthState
  ): Effect.Effect<HealthState> =>
    Effect.gen(function* () {
      const currentState = yield* getOrCreateHealthState(playerId)
      const newState = updater(currentState)

      yield* Ref.update(healthStates, (states) => HashMap.set(states, playerId, newState))

      return newState
    })

  // Take damage implementation
  const takeDamage = (
    playerId: PlayerId,
    source: DamageSource,
    armor: ArmorValue = 0 as ArmorValue,
    protectionLevel: ProtectionLevel = 0 as ProtectionLevel
  ) =>
    Effect.gen(function* () {
      // Check if player exists
      const playerExists = yield* playerService.playerExists(playerId)
      if (!playerExists) {
        return yield* Effect.fail(createHealthError.playerNotFound(playerId))
      }

      const now = Date.now()

      // Calculate damage amount
      const damageAmount = yield* damageCalculator.calculateDamage(source, armor, protectionLevel)

      // Atomic state update
      const result = yield* Effect.gen(function* () {
        const state = yield* getOrCreateHealthState(playerId)

        // Check if dead
        if (state.isDead) {
          return yield* Effect.fail(createHealthError.alreadyDead(playerId))
        }

        // Check invulnerability
        if (state.invulnerabilityEndTime && now < state.invulnerabilityEndTime) {
          return yield* Effect.fail(createHealthError.invulnerable(playerId))
        }

        // Apply damage
        const previousHealth = state.currentHealth
        const newHealth = Math.max(0, state.currentHealth - damageAmount) as CurrentHealth

        // Update state
        const newState = yield* updateHealthState(playerId, (s) => ({
          ...s,
          currentHealth: newHealth,
          isDead: newHealth === 0,
          lastDamageSource: source,
          lastDamageTime: now,
          invulnerabilityEndTime: now + HEALTH_CONSTANTS.INVULNERABILITY_DURATION_MS,
        }))

        // Create damage event
        const event: HealthEvent = {
          _tag: 'Damaged',
          playerId,
          amount: damageAmount,
          source,
          previousHealth,
          newHealth,
          timestamp: now,
        }

        return { newHealth, event, isDead: newState.isDead }
      })

      // Publish events
      yield* Queue.offer(eventQueue, result.event)

      // Handle death if occurred
      if (result.isDead) {
        // Get player position for death location
        const playerState = yield* playerService
          .getPlayerState(playerId)
          .pipe(Effect.mapError((playerError) => createHealthError.playerNotFound(playerId)))
        const deathEvent: HealthEvent = {
          _tag: 'Died',
          playerId,
          source,
          deathLocation: playerState.position as Vector3D,
          timestamp: now,
        }
        yield* Queue.offer(eventQueue, deathEvent)
      }

      return result.newHealth
    })

  // Heal implementation
  const heal = (playerId: PlayerId, source: HealingSource) =>
    Effect.gen(function* () {
      // Check if player exists
      const playerExists = yield* playerService.playerExists(playerId)
      if (!playerExists) {
        return yield* Effect.fail(createHealthError.playerNotFound(playerId))
      }

      const now = Date.now()

      // Determine heal amount
      let healAmount: HealAmount
      if (source._tag === 'Food') {
        healAmount = source.healAmount
      } else if (source._tag === 'Potion') {
        healAmount = (source.instant ? 8 : 4) as HealAmount
      } else if (source._tag === 'NaturalRegeneration') {
        healAmount = HEALTH_CONSTANTS.NATURAL_REGENERATION_AMOUNT
      } else if (source._tag === 'Beacon') {
        healAmount = (source.level * 2) as HealAmount
      } else if (source._tag === 'Command') {
        healAmount = 20 as HealAmount
      } else {
        healAmount = 1 as HealAmount
      }

      // Atomic state update
      const result = yield* Effect.gen(function* () {
        const state = yield* getOrCreateHealthState(playerId)

        // Cannot heal dead players
        if (state.isDead) {
          return yield* Effect.fail(createHealthError.alreadyDead(playerId))
        }

        const previousHealth = state.currentHealth
        const newHealth = Math.min(state.maxHealth, state.currentHealth + healAmount) as CurrentHealth

        // Update state
        yield* updateHealthState(playerId, (s) => ({
          ...s,
          currentHealth: newHealth,
        }))

        // Create heal event
        const event: HealthEvent = {
          _tag: 'Healed',
          playerId,
          amount: healAmount,
          source,
          previousHealth,
          newHealth,
          timestamp: now,
        }

        return { newHealth, event }
      })

      // Publish event
      yield* Queue.offer(eventQueue, result.event)

      return result.newHealth
    })

  // Set health directly
  const setHealth = (playerId: PlayerId, health: CurrentHealth) =>
    Effect.gen(function* () {
      const playerExists = yield* playerService.playerExists(playerId)
      if (!playerExists) {
        return yield* Effect.fail(createHealthError.playerNotFound(playerId))
      }

      yield* updateHealthState(playerId, (state) => ({
        ...state,
        currentHealth: health,
        isDead: health === 0,
      }))
    })

  // Get current health
  const getCurrentHealth = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const playerExists = yield* playerService.playerExists(playerId)
      if (!playerExists) {
        return yield* Effect.fail(createHealthError.playerNotFound(playerId))
      }

      const state = yield* getOrCreateHealthState(playerId)
      return state.currentHealth
    })

  // Get full health state
  const getHealthState = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const playerExists = yield* playerService.playerExists(playerId)
      if (!playerExists) {
        return yield* Effect.fail(createHealthError.playerNotFound(playerId))
      }

      return yield* getOrCreateHealthState(playerId)
    })

  // Check if dead
  const isDead = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const playerExists = yield* playerService.playerExists(playerId)
      if (!playerExists) {
        return yield* Effect.fail(createHealthError.playerNotFound(playerId))
      }

      const state = yield* getOrCreateHealthState(playerId)
      return state.isDead
    })

  // Kill instantly
  const kill = (playerId: PlayerId, source: DamageSource) =>
    Effect.gen(function* () {
      const playerExists = yield* playerService.playerExists(playerId)
      if (!playerExists) {
        return yield* Effect.fail(createHealthError.playerNotFound(playerId))
      }

      const playerState = yield* playerService
        .getPlayerState(playerId)
        .pipe(Effect.mapError((playerError) => createHealthError.playerNotFound(playerId)))

      yield* updateHealthState(playerId, (state) => ({
        ...state,
        currentHealth: 0 as CurrentHealth,
        isDead: true,
        lastDamageSource: source,
        lastDamageTime: Date.now(),
      }))

      // Publish death event
      const deathEvent: HealthEvent = {
        _tag: 'Died',
        playerId,
        source,
        deathLocation: playerState.position as Vector3D,
        timestamp: Date.now(),
      }
      yield* Queue.offer(eventQueue, deathEvent)
    })

  // Respawn player
  const respawn = (playerId: PlayerId, spawnLocation: Vector3D) =>
    Effect.gen(function* () {
      const playerExists = yield* playerService.playerExists(playerId)
      if (!playerExists) {
        return yield* Effect.fail(createHealthError.playerNotFound(playerId))
      }

      const state = yield* getOrCreateHealthState(playerId)

      if (!state.isDead) {
        return yield* Effect.fail(createHealthError.notDead(playerId))
      }

      yield* updateHealthState(playerId, (s) => ({
        ...s,
        currentHealth: s.maxHealth as unknown as CurrentHealth,
        isDead: false,
        lastDamageSource: undefined,
        lastDamageTime: undefined,
        invulnerabilityEndTime: Date.now() + HEALTH_CONSTANTS.INVULNERABILITY_DURATION_MS * 2,
      }))

      // Update player position
      yield* playerService
        .setPlayerPosition(playerId, spawnLocation)
        .pipe(Effect.mapError((playerError) => createHealthError.playerNotFound(playerId)))

      // Publish respawn event
      const respawnEvent: HealthEvent = {
        _tag: 'Respawned',
        playerId,
        spawnLocation,
        timestamp: Date.now(),
      }
      yield* Queue.offer(eventQueue, respawnEvent)
    })

  // Set max health
  const setMaxHealth = (playerId: PlayerId, maxHealth: MaxHealth) =>
    Effect.gen(function* () {
      const playerExists = yield* playerService.playerExists(playerId)
      if (!playerExists) {
        return yield* Effect.fail(createHealthError.playerNotFound(playerId))
      }

      yield* updateHealthState(playerId, (state) => ({
        ...state,
        maxHealth,
        currentHealth: Math.min(state.currentHealth, maxHealth) as CurrentHealth,
      }))
    })

  // Initialize player
  const initializePlayer = (
    playerId: PlayerId,
    initialHealth: CurrentHealth = HEALTH_CONSTANTS.DEFAULT_MAX_HEALTH as unknown as CurrentHealth,
    maxHealth: MaxHealth = HEALTH_CONSTANTS.DEFAULT_MAX_HEALTH
  ) =>
    Effect.gen(function* () {
      yield* Ref.update(healthStates, (states) => {
        const newState: HealthState = {
          playerId,
          currentHealth: initialHealth,
          maxHealth,
          isDead: false,
          lastDamageSource: undefined,
          lastDamageTime: undefined,
          invulnerabilityEndTime: undefined,
        }
        return HashMap.set(states, playerId, newState)
      })
    })

  // Remove player
  const removePlayer = (playerId: PlayerId) =>
    Effect.gen(function* () {
      yield* Ref.update(healthStates, (states) => HashMap.remove(states, playerId))
    })

  // Apply natural regeneration
  const applyNaturalRegeneration = (playerId: PlayerId) => heal(playerId, { _tag: 'NaturalRegeneration' })

  // Check invulnerability
  const isInvulnerable = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const playerExists = yield* playerService.playerExists(playerId)
      if (!playerExists) {
        return yield* Effect.fail(createHealthError.playerNotFound(playerId))
      }

      const state = yield* getOrCreateHealthState(playerId)
      const now = Date.now()

      return state.invulnerabilityEndTime ? now < state.invulnerabilityEndTime : false
    })

  return HealthService.of({
    takeDamage,
    heal,
    setHealth,
    getCurrentHealth,
    getHealthState,
    isDead,
    kill,
    respawn,
    setMaxHealth,
    initializePlayer,
    removePlayer,
    applyNaturalRegeneration,
    isInvulnerable,
  })
})

// =======================================
// Layer Definition
// =======================================

export const HealthServiceLive = Layer.effect(HealthService, makeHealthService)
