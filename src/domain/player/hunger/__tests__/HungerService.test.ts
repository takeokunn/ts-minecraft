import { Effect, TestClock, TestContext, Layer, Option, Either, pipe } from 'effect'
import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import type { PlayerId, ItemId } from '@domain/core/types/brands'
import { HungerService } from '../HungerService'
import { HungerServiceLive } from '../HungerServiceLive'
import type { FoodItem, HungerLevel, SaturationLevel, HungerDecreaseReason, StatusEffect } from '../HungerTypes'
import { HUNGER_CONSTANTS } from '../HungerTypes'

// =========================================
// Test Data Generators (Effect-based)
// =========================================

const generatePlayerId = (): PlayerId => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const length = Math.floor(Math.random() * 10) + 5
  const id = Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `player_${id}` as PlayerId
}

const generateItemId = (): ItemId => {
  const items = ['bread', 'apple', 'steak', 'golden_apple', 'carrot', 'potato', 'cookie']
  return items[Math.floor(Math.random() * items.length)] as ItemId
}

const generateFoodItem = (): FoodItem => ({
  itemId: generateItemId(),
  nutrition: (Math.floor(Math.random() * 10) + 1) as any,
  saturation: Math.floor(Math.random() * 10) as SaturationLevel,
  effects: [],
  eatTime: 1600, // Standard eating time
})

const generateStatusEffect = (): StatusEffect => ({
  type: 'regeneration' as const,
  duration: Math.floor(Math.random() * 600) + 100,
  amplifier: Math.floor(Math.random() * 3),
})

const generateHungerDecreaseReason = (): HungerDecreaseReason => {
  const reasons: HungerDecreaseReason[] = [
    { _tag: 'Movement', distance: Math.random() * 100 },
    { _tag: 'Combat', damage: Math.random() * 10 },
    { _tag: 'Mining', blockHardness: Math.random() * 5 },
    { _tag: 'Regeneration', healthRestored: (Math.random() * 10) as any },
    { _tag: 'Swimming', duration: Math.random() * 60 },
    { _tag: 'Sprinting', distance: Math.random() * 50 },
  ]
  return reasons[Math.floor(Math.random() * reasons.length)]!
}

// =========================================
// Test Layers
// =========================================

const TestLayers = Layer.mergeAll(HungerServiceLive, TestContext.TestContext)

// =========================================
// Test Suite
// =========================================

describe('HungerService', () => {
  describe('Player Initialization', () => {
    it.effect('should initialize player with full hunger and default saturation', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        const state = yield* service.initializePlayer(playerId)

        expect(state.hunger).toBe(20)
        expect(state.saturation).toBe(5)
        expect(state.exhaustion).toBe(0)
        expect(state.isStarving).toBe(false)
        expect(Option.isNone(state.lastFoodEaten)).toBe(true)
      }).pipe(Effect.provide(TestLayers) as any)
    )

    it.effect('should handle multiple player initializations', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerIds = Array.from({ length: 5 }, generatePlayerId)

        const states = yield* Effect.all(playerIds.map((id) => service.initializePlayer(id)))

        expect(states.length).toBe(5)
        states.forEach((state) => {
          expect(state.hunger).toBe(20)
          expect(state.saturation).toBe(5)
        })
      }).pipe(Effect.provide(TestLayers) as any)
    )
  })

  describe('Food Consumption', () => {
    it.effect('should increase hunger and saturation when consuming food', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()
        const foodItem = generateFoodItem()

        yield* service.initializePlayer(playerId)

        // Set initial low hunger
        yield* service.addExhaustion(playerId, 40) // Reduce hunger significantly
        const initialState = yield* service.getHungerState(playerId)

        const newState = yield* service.consumeFood(playerId, foodItem)

        expect(newState.hunger).toBeGreaterThan(initialState.hunger)
        expect(newState.saturation).toBeGreaterThanOrEqual(initialState.saturation)
        expect(Option.isSome(newState.lastFoodEaten)).toBe(true)
      }).pipe(Effect.provide(TestLayers) as any)
    )

    it.effect('should never exceed maximum hunger level', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        yield* service.initializePlayer(playerId)

        // Consume multiple food items
        const foods = Array.from({ length: 5 }, generateFoodItem)

        for (const food of foods) {
          const state = yield* service.consumeFood(playerId, food)
          expect(state.hunger).toBeLessThanOrEqual(HUNGER_CONSTANTS.MAX_HUNGER)
          expect(state.saturation).toBeLessThanOrEqual(state.hunger)
        }
      }).pipe(Effect.provide(TestLayers) as any)
    )

    it.effect('saturation should never exceed hunger level', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        yield* service.initializePlayer(playerId)

        // Reduce hunger but keep saturation
        yield* service.addExhaustion(playerId, 20)

        const foodItem = generateFoodItem()
        const state = yield* service.consumeFood(playerId, foodItem)

        expect(state.saturation).toBeLessThanOrEqual(state.hunger)
      }).pipe(Effect.provide(TestLayers) as any)
    )
  })

  describe('Hunger Decrease and Exhaustion', () => {
    it.effect('should decrease hunger based on action reason', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        yield* service.initializePlayer(playerId)

        const reason: HungerDecreaseReason = { _tag: 'Sprinting', distance: 100 }
        const hungerBefore = yield* service.getHungerState(playerId)
        const hungerLevel = yield* service.decreaseHunger(playerId, reason)

        expect(hungerLevel).toBeLessThanOrEqual(hungerBefore.hunger)
      }).pipe(Effect.provide(TestLayers) as any)
    )

    it.effect('should trigger hunger decrease when exhaustion exceeds threshold', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        yield* service.initializePlayer(playerId)
        const initialState = yield* service.getHungerState(playerId)

        // First deplete all saturation (5 * 4 = 20 exhaustion)
        yield* service.addExhaustion(playerId, 20)
        const noSaturationState = yield* service.getHungerState(playerId)
        expect(noSaturationState.hunger).toBe(initialState.hunger)
        expect(noSaturationState.saturation).toBe(0)

        // Add exhaustion just below and then above threshold
        yield* service.addExhaustion(playerId, 3.5)
        const midState = yield* service.getHungerState(playerId)
        expect(midState.hunger).toBe(initialState.hunger)

        yield* service.addExhaustion(playerId, 1.0)
        const finalState = yield* service.getHungerState(playerId)
        expect(finalState.hunger).toBeLessThan(initialState.hunger)
        expect(finalState.exhaustion).toBeLessThan(HUNGER_CONSTANTS.EXHAUSTION_THRESHOLD)
      }).pipe(Effect.provide(TestLayers) as any)
    )

    it.effect('should deplete saturation before hunger', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        yield* service.initializePlayer(playerId)
        const initialState = yield* service.getHungerState(playerId)

        // Add exhaustion to trigger depletion
        yield* service.addExhaustion(playerId, HUNGER_CONSTANTS.EXHAUSTION_THRESHOLD)
        const state = yield* service.getHungerState(playerId)

        if (initialState.saturation > 0) {
          expect(state.saturation).toBeLessThan(initialState.saturation)
          expect(state.hunger).toBe(initialState.hunger)
        } else {
          expect(state.hunger).toBeLessThan(initialState.hunger)
        }
      }).pipe(Effect.provide(TestLayers) as any)
    )
  })

  describe('Sprint and Regeneration Capabilities', () => {
    it.effect('should allow sprint when hunger is above minimum threshold', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        yield* service.initializePlayer(playerId)

        // Full hunger - can sprint
        const canSprintFull = yield* service.canSprint(playerId)
        expect(canSprintFull).toBe(true)

        // Reduce hunger below sprint threshold
        yield* service.addExhaustion(playerId, 76) // Reduce to 6 (5 saturation + 14 hunger = 76 exhaustion)
        const canSprintLow = yield* service.canSprint(playerId)
        expect(canSprintLow).toBe(false)

        // Restore to exactly sprint threshold
        const foodItem: FoodItem = {
          itemId: 'bread' as ItemId,
          nutrition: 5 as any,
          saturation: 2 as SaturationLevel,
          effects: [],
          eatTime: 1600,
        }
        yield* service.consumeFood(playerId, foodItem)
        const state = yield* service.getHungerState(playerId)

        if (state.hunger >= HUNGER_CONSTANTS.MIN_SPRINT_HUNGER) {
          const canSprintThreshold = yield* service.canSprint(playerId)
          expect(canSprintThreshold).toBe(true)
        }
      }).pipe(Effect.provide(TestLayers) as any)
    )

    it.effect('should enable health regeneration at high hunger levels', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        yield* service.initializePlayer(playerId)

        // Full hunger - should regenerate
        const shouldRegenFull = yield* service.shouldRegenerateHealth(playerId)
        expect(shouldRegenFull).toBe(true)

        // Reduce hunger below regeneration threshold
        yield* service.addExhaustion(playerId, 32) // Reduce to 17 (5 saturation + 3 hunger = 32 exhaustion)
        const shouldRegenLow = yield* service.shouldRegenerateHealth(playerId)
        expect(shouldRegenLow).toBe(false)
      }).pipe(Effect.provide(TestLayers) as any)
    )
  })

  describe('Starvation State', () => {
    it.effect('should detect starvation when hunger reaches zero', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        yield* service.initializePlayer(playerId)

        // Not starving initially
        const isStarvingInitial = yield* service.isStarving(playerId)
        expect(isStarvingInitial).toBe(false)

        // Reduce hunger to zero
        yield* service.addExhaustion(playerId, 100)
        const isStarvingFinal = yield* service.isStarving(playerId)
        const state = yield* service.getHungerState(playerId)

        expect(isStarvingFinal).toBe(true)
        expect(state.hunger).toBe(0)
        expect(state.isStarving).toBe(true)
      }).pipe(Effect.provide(TestLayers) as any)
    )

    it.effect('should exit starvation after eating', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        yield* service.initializePlayer(playerId)

        // Starve the player
        yield* service.addExhaustion(playerId, 100)
        const starvingState = yield* service.getHungerState(playerId)
        expect(starvingState.isStarving).toBe(true)

        // Feed the player
        const foodItem = generateFoodItem()
        const fedState = yield* service.consumeFood(playerId, foodItem)

        expect(fedState.isStarving).toBe(false)
        expect(fedState.hunger).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayers) as any)
    )
  })

  describe('Edge Cases and Error Handling', () => {
    it.effect('should fail when consuming food for non-existent player', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()
        const foodItem = generateFoodItem()

        const result = yield* Effect.either(service.consumeFood(playerId, foodItem))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('PlayerNotFoundError')
        }
      }).pipe(Effect.provide(TestLayers) as any)
    )

    it.effect('should handle concurrent operations safely', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        yield* service.initializePlayer(playerId)

        // Perform multiple concurrent operations
        const operations = Array.from({ length: 10 }, (_, i) => {
          if (i % 2 === 0) {
            return service.addExhaustion(playerId, Math.random() * 2)
          } else {
            return service.decreaseHunger(playerId, generateHungerDecreaseReason())
          }
        })

        const results = yield* Effect.all(operations, { concurrency: 'unbounded' })
        expect(results.length).toBe(10)

        // Check final state is consistent
        const finalState = yield* service.getHungerState(playerId)
        expect(finalState.hunger).toBeGreaterThanOrEqual(0)
        expect(finalState.hunger).toBeLessThanOrEqual(HUNGER_CONSTANTS.MAX_HUNGER)
        expect(finalState.saturation).toBeGreaterThanOrEqual(0)
        expect(finalState.saturation).toBeLessThanOrEqual(finalState.hunger)
      }).pipe(Effect.provide(TestLayers) as any)
    )

    it.effect('should handle negative exhaustion amounts gracefully', () =>
      Effect.gen(function* () {
        const service = yield* HungerService
        const playerId = generatePlayerId()

        yield* service.initializePlayer(playerId)
        const initialState = yield* service.getHungerState(playerId)

        // Try adding negative exhaustion
        yield* service.addExhaustion(playerId, -5)
        const state = yield* service.getHungerState(playerId)

        // Should not crash and exhaustion should not go below 0
        expect(state.exhaustion).toBeGreaterThanOrEqual(0)
      }).pipe(Effect.provide(TestLayers) as any)
    )
  })
})
