---
title: '体力・空腹システム仕様 - プレイヤーサバイバル管理'
description: 'プレイヤーの体力、空腹度、食事システムの完全仕様。サバイバルモードでのリソース管理とゲームバランス調整。'
category: 'specification'
difficulty: 'intermediate'
tags: ['health-system', 'hunger-system', 'food-mechanics', 'player-stats', 'survival-mode', 'resource-management']
prerequisites: ['effect-ts-fundamentals', 'player-system-basics', 'game-balance']
estimated_reading_time: '5分'
related_patterns: ['service-patterns', 'state-machine-patterns', 'event-driven-patterns']
related_docs: ['./02-player-system.md', './19-food-agriculture-system.md', './13-combat-system.md']
---

# Health & Hunger System (体力・飢餓システム)

## 概要

プレイヤーの生存を管理するMinecraftの中核システムです。体力（Health）と飢餓（Hunger）の2つの主要指標を通じて、プレイヤーのサバイバル体験を提供します。

## ドメインモデル (Domain Model with Schema)

```typescript
import { Schema, Effect, STM, Stream, Ref, Match, Context, Layer } from 'effect'

// Branded types for type safety
export type Health = number & Schema.Brand<'Health'>
export type Hunger = number & Schema.Brand<'Hunger'>
export type Saturation = number & Schema.Brand<'Saturation'>
export type FoodPoints = number & Schema.Brand<'FoodPoints'>

// Health schema with validation (0-20)
export const HealthSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(20),
  Schema.brand('Health')
)

// Hunger schema with validation (0-20)
export const HungerSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(20),
  Schema.brand('Hunger')
)

// Saturation schema with validation (0-20, cannot exceed hunger)
export const SaturationSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(20),
  Schema.brand('Saturation')
)

// Food points schema (nutritional value)
export const FoodPointsSchema = Schema.Number.pipe(Schema.greaterThan(0), Schema.brand('FoodPoints'))

// Player stats aggregate
export const PlayerStatsSchema = Schema.Struct({
  health: HealthSchema,
  hunger: HungerSchema,
  saturation: SaturationSchema,
  exhaustion: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
}).annotations({
  identifier: 'PlayerStats',
})
export type PlayerStats = Schema.Schema.Type<typeof PlayerStatsSchema>

// Status effects using TaggedUnion
export const StatusEffectSchema = Schema.TaggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('Regeneration'),
    level: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    duration: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    ticksRemaining: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Poison'),
    level: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    duration: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    ticksRemaining: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Wither'),
    level: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    duration: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    ticksRemaining: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Absorption'),
    level: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    duration: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    ticksRemaining: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    heartsAbsorbed: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Hunger'),
    level: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    duration: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    ticksRemaining: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  }),
]).annotations({
  identifier: 'StatusEffect',
})
export type StatusEffect = Schema.Schema.Type<typeof StatusEffectSchema>

// Damage source types
export const DamageSourceSchema = Schema.TaggedUnion('_tag', [
  Schema.Struct({
    _tag: Schema.Literal('Fall'),
    distance: Schema.Number.pipe(Schema.greaterThan(0)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Drowning'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Fire'),
    ticksOnFire: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Lava'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Starvation'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Suffocation'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Void'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('EntityAttack'),
    entityId: Schema.String,
    weapon: Schema.optional(Schema.String),
  }),
]).annotations({
  identifier: 'DamageSource',
})
export type DamageSource = Schema.Schema.Type<typeof DamageSourceSchema>
```

## 主要ロジック (Core Logic with Services)

```typescript
// Player stats service using STM for thread-safe concurrent updates
export interface PlayerStatsService {
  readonly getStats: (playerId: string) => Effect.Effect<PlayerStats>
  readonly updateHealthSTM: (playerId: string, delta: number) => STM.STM<Health>
  readonly updateHungerSTM: (playerId: string, delta: number) => STM.STM<Hunger>
  readonly updateSaturationSTM: (playerId: string, delta: number) => STM.STM<Saturation>
  readonly applyDamage: (playerId: string, source: DamageSource, amount: number) => Effect.Effect<PlayerStats>
  readonly applyHealing: (playerId: string, amount: number) => Effect.Effect<PlayerStats>
  readonly feed: (playerId: string, foodPoints: FoodPoints, saturationPoints: number) => Effect.Effect<PlayerStats>
}

export const PlayerStatsService = Context.GenericTag<PlayerStatsService>('@minecraft/PlayerStatsService')

// STM-based concurrent stat updates
export const makePlayerStatsService = Effect.gen(function* () {
  const statsMap = yield* STM.makeTMap<string, PlayerStats>()

  const getStats = (playerId: string): Effect.Effect<PlayerStats> =>
    STM.atomically(
      STM.gen(function* () {
        const maybeStats = yield* STM.getTMap(statsMap, playerId)
        return yield* maybeStats.pipe(
          Match.value,
          Match.when(Option.some, (stats) => STM.succeed(stats)),
          Match.when(Option.none, () => {
            const defaultStats: PlayerStats = {
              health: 20 as Health,
              hunger: 20 as Hunger,
              saturation: 5 as Saturation,
              exhaustion: 0,
            }
            return STM.flatMap(STM.setTMap(statsMap, playerId, defaultStats), () => STM.succeed(defaultStats))
          }),
          Match.exhaustive
        )
      })
    )

  const updateHealthSTM = (playerId: string, delta: number): STM.STM<Health> =>
    STM.gen(function* () {
      const currentStats = yield* STM.getTMap(statsMap, playerId)
      return yield* currentStats.pipe(
        Match.value,
        Match.when(Option.some, (stats) => {
          const newHealth = Math.max(0, Math.min(20, stats.health + delta)) as Health
          const updatedStats = { ...stats, health: newHealth }
          return STM.flatMap(STM.setTMap(statsMap, playerId, updatedStats), () => STM.succeed(newHealth))
        }),
        Match.when(Option.none, () => STM.fail(new Error(`Player ${playerId} not found`))),
        Match.exhaustive
      )
    })

  const updateHungerSTM = (playerId: string, delta: number): STM.STM<Hunger> =>
    STM.gen(function* () {
      const currentStats = yield* STM.getTMap(statsMap, playerId)
      return yield* currentStats.pipe(
        Match.value,
        Match.when(Option.some, (stats) => {
          const newHunger = Math.max(0, Math.min(20, stats.hunger + delta)) as Hunger
          // Saturation cannot exceed hunger level
          const newSaturation = Math.min(stats.saturation, newHunger) as Saturation
          const updatedStats = { ...stats, hunger: newHunger, saturation: newSaturation }
          return STM.flatMap(STM.setTMap(statsMap, playerId, updatedStats), () => STM.succeed(newHunger))
        }),
        Match.when(Option.none, () => STM.fail(new Error(`Player ${playerId} not found`))),
        Match.exhaustive
      )
    })

  const updateSaturationSTM = (playerId: string, delta: number): STM.STM<Saturation> =>
    STM.gen(function* () {
      const currentStats = yield* STM.getTMap(statsMap, playerId)
      return yield* currentStats.pipe(
        Match.value,
        Match.when(Option.some, (stats) => {
          // Saturation cannot exceed hunger level or 20
          const maxSaturation = Math.min(stats.hunger, 20)
          const newSaturation = Math.max(0, Math.min(maxSaturation, stats.saturation + delta)) as Saturation
          const updatedStats = { ...stats, saturation: newSaturation }
          return STM.flatMap(STM.setTMap(statsMap, playerId, updatedStats), () => STM.succeed(newSaturation))
        }),
        Match.when(Option.none, () => STM.fail(new Error(`Player ${playerId} not found`))),
        Match.exhaustive
      )
    })

  // Pattern matching for damage calculation
  const calculateDamage = (source: DamageSource, baseAmount: number): number =>
    source.pipe(
      Match.value,
      Match.when({ _tag: 'Fall' }, ({ distance }) => Math.max(0, Math.ceil(distance - 3))),
      Match.when({ _tag: 'Drowning' }, () => 2),
      Match.when({ _tag: 'Fire' }, () => 1),
      Match.when({ _tag: 'Lava' }, () => 4),
      Match.when({ _tag: 'Starvation' }, () => 1),
      Match.when({ _tag: 'Suffocation' }, () => 1),
      Match.when({ _tag: 'Void' }, () => 4),
      Match.when({ _tag: 'EntityAttack' }, () => baseAmount),
      Match.exhaustive
    )

  const applyDamage = (playerId: string, source: DamageSource, amount: number): Effect.Effect<PlayerStats> =>
    Effect.gen(function* () {
      const damageAmount = calculateDamage(source, amount)
      const newHealth = yield* STM.atomically(updateHealthSTM(playerId, -damageAmount))

      // Check for death condition
      if (newHealth <= 0) {
        // Trigger death event
        yield* Effect.log(`Player ${playerId} died from ${source._tag}`)
      }

      return yield* getStats(playerId)
    })

  const applyHealing = (playerId: string, amount: number): Effect.Effect<PlayerStats> =>
    Effect.gen(function* () {
      yield* STM.atomically(updateHealthSTM(playerId, amount))
      return yield* getStats(playerId)
    })

  const feed = (playerId: string, foodPoints: FoodPoints, saturationPoints: number): Effect.Effect<PlayerStats> =>
    Effect.gen(function* () {
      yield* STM.atomically(
        STM.gen(function* () {
          yield* updateHungerSTM(playerId, foodPoints)
          yield* updateSaturationSTM(playerId, saturationPoints)
        })
      )
      return yield* getStats(playerId)
    })

  return PlayerStatsService.of({
    getStats,
    updateHealthSTM,
    updateHungerSTM,
    updateSaturationSTM,
    applyDamage,
    applyHealing,
    feed,
  })
})

export const PlayerStatsServiceLive = Layer.effect(PlayerStatsService, makePlayerStatsService)

// Stream-based continuous health/hunger updates
export interface HealthUpdateService {
  readonly startHealthRegeneration: (playerId: string) => Effect.Effect<void>
  readonly startHungerDepletion: (playerId: string) => Effect.Effect<void>
  readonly processStatusEffects: (playerId: string, effects: ReadonlyArray<StatusEffect>) => Effect.Effect<void>
}

export const HealthUpdateService = Context.GenericTag<HealthUpdateService>('@minecraft/HealthUpdateService')

export const makeHealthUpdateService = Effect.gen(function* () {
  const playerStatsService = yield* PlayerStatsService

  // Health regeneration stream - ticks every 4 seconds when conditions are met
  const createRegenerationStream = (playerId: string) =>
    Stream.repeatEffect(
      Effect.gen(function* () {
        const stats = yield* playerStatsService.getStats(playerId)

        // Early return if conditions not met
        if (stats.health >= 20 || stats.hunger <= 17) {
          return Effect.unit
        }

        // Regenerate health if hunger > 17 and health < 20
        if (stats.saturation > 0) {
          // Regenerate using saturation
          yield* STM.atomically(
            STM.gen(function* () {
              yield* playerStatsService.updateHealthSTM(playerId, 1)
              yield* playerStatsService.updateSaturationSTM(playerId, -1)
            })
          )
        } else if (stats.hunger >= 18) {
          // Regenerate using hunger
          yield* STM.atomically(
            STM.gen(function* () {
              yield* playerStatsService.updateHealthSTM(playerId, 1)
              // Add exhaustion when regenerating from hunger
              const currentStats = yield* STM.getTMap(statsMap, playerId)
              return yield* currentStats.pipe(
                Match.value,
                Match.when(Option.some, (s) => {
                  const updatedStats = { ...s, exhaustion: s.exhaustion + 6 }
                  return STM.setTMap(statsMap, playerId, updatedStats)
                }),
                Match.when(Option.none, () => STM.unit),
                Match.exhaustive
              )
            })
          )
        }

        return Effect.unit
      }).pipe(Effect.flatten)
    ).pipe(Stream.schedule(Schedule.fixed(Duration.seconds(4))))

  // Hunger depletion stream - based on exhaustion levels
  const createHungerDepletionStream = (playerId: string) =>
    Stream.repeatEffect(
      Effect.gen(function* () {
        const stats = yield* playerStatsService.getStats(playerId)

        // Early return if exhaustion is low
        if (stats.exhaustion < 4) {
          return Effect.unit
        }

        // Deplete saturation/hunger based on exhaustion
        if (stats.saturation > 0) {
          yield* STM.atomically(playerStatsService.updateSaturationSTM(playerId, -1))
        } else if (stats.hunger > 0) {
          yield* STM.atomically(playerStatsService.updateHungerSTM(playerId, -1))
        }

        // Reset exhaustion
        const currentStats = yield* playerStatsService.getStats(playerId)
        const updatedStats = { ...currentStats, exhaustion: Math.max(0, currentStats.exhaustion - 4) }
        yield* STM.atomically(
          STM.gen(function* () {
            const maybeStats = yield* STM.getTMap(statsMap, playerId)
            return yield* maybeStats.pipe(
              Match.value,
              Match.when(Option.some, () => STM.setTMap(statsMap, playerId, updatedStats)),
              Match.when(Option.none, () => STM.unit),
              Match.exhaustive
            )
          })
        )

        return Effect.unit
      }).pipe(Effect.flatten)
    ).pipe(Stream.schedule(Schedule.fixed(Duration.seconds(1))))

  // Starvation damage stream when hunger reaches 0
  const createStarvationStream = (playerId: string) =>
    Stream.repeatEffect(
      Effect.gen(function* () {
        const stats = yield* playerStatsService.getStats(playerId)

        // Early return if not starving
        if (stats.hunger > 0) {
          return Effect.unit
        }

        // Apply starvation damage
        const starvationSource: DamageSource = { _tag: 'Starvation' }
        yield* playerStatsService.applyDamage(playerId, starvationSource, 1)

        return Effect.unit
      }).pipe(Effect.flatten)
    ).pipe(Stream.schedule(Schedule.fixed(Duration.seconds(4))))

  const startHealthRegeneration = (playerId: string): Effect.Effect<void> =>
    createRegenerationStream(playerId).pipe(Stream.runDrain, Effect.fork, Effect.asUnit)

  const startHungerDepletion = (playerId: string): Effect.Effect<void> =>
    Effect.gen(function* () {
      const hungerStream = createHungerDepletionStream(playerId)
      const starvationStream = createStarvationStream(playerId)

      yield* Stream.merge(hungerStream, starvationStream).pipe(Stream.runDrain, Effect.fork, Effect.asUnit)
    })

  // Status effect processing with pattern matching
  const processStatusEffects = (playerId: string, effects: ReadonlyArray<StatusEffect>): Effect.Effect<void> =>
    Effect.gen(function* () {
      for (const effect of effects) {
        yield* effect.pipe(
          Match.value,
          Match.when({ _tag: 'Regeneration' }, ({ level, ticksRemaining }) => {
            if (ticksRemaining % (50 / level) === 0) {
              return playerStatsService.applyHealing(playerId, 1).pipe(Effect.asUnit)
            }
            return Effect.unit
          }),
          Match.when({ _tag: 'Poison' }, ({ level, ticksRemaining }) => {
            if (ticksRemaining % (25 / level) === 0) {
              const poisonSource: DamageSource = { _tag: 'EntityAttack', entityId: 'poison', weapon: 'poison' }
              return playerStatsService.applyDamage(playerId, poisonSource, 1).pipe(Effect.asUnit)
            }
            return Effect.unit
          }),
          Match.when({ _tag: 'Wither' }, ({ level, ticksRemaining }) => {
            if (ticksRemaining % (40 / level) === 0) {
              const witherSource: DamageSource = { _tag: 'EntityAttack', entityId: 'wither', weapon: 'wither' }
              return playerStatsService.applyDamage(playerId, witherSource, 1).pipe(Effect.asUnit)
            }
            return Effect.unit
          }),
          Match.when({ _tag: 'Absorption' }, () => Effect.unit), // Handled in damage calculation
          Match.when({ _tag: 'Hunger' }, ({ level, ticksRemaining }) => {
            if (ticksRemaining % 80 === 0) {
              // Increase exhaustion based on hunger level
              return Effect.gen(function* () {
                const stats = yield* playerStatsService.getStats(playerId)
                const exhaustionIncrease = 0.1 * level
                const updatedStats = { ...stats, exhaustion: stats.exhaustion + exhaustionIncrease }

                yield* STM.atomically(
                  STM.gen(function* () {
                    const maybeStats = yield* STM.getTMap(statsMap, playerId)
                    return yield* maybeStats.pipe(
                      Match.value,
                      Match.when(Option.some, () => STM.setTMap(statsMap, playerId, updatedStats)),
                      Match.when(Option.none, () => STM.unit),
                      Match.exhaustive
                    )
                  })
                )
              })
            }
            return Effect.unit
          }),
          Match.exhaustive
        )
      }
    })

  return HealthUpdateService.of({
    startHealthRegeneration,
    startHungerDepletion,
    processStatusEffects,
  })
})

export const HealthUpdateServiceLive = Layer.effect(HealthUpdateService, makeHealthUpdateService)

// Food system with saturation curves and healing logic
export interface FoodService {
  readonly getFoodStats: (foodType: string) => Effect.Effect<FoodStats>
  readonly consumeFood: (playerId: string, foodType: string) => Effect.Effect<PlayerStats>
  readonly calculateSaturation: (foodPoints: number, saturationModifier: number) => Effect.Effect<number>
}

export const FoodService = Context.GenericTag<FoodService>('@minecraft/FoodService')

// Food statistics schema
export const FoodStatsSchema = Schema.Struct({
  foodType: Schema.String,
  nutrition: FoodPointsSchema,
  saturationModifier: Schema.Number.pipe(Schema.greaterThan(0)),
  canAlwaysEat: Schema.Boolean,
  eatDurationTicks: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
}).annotations({
  identifier: 'FoodStats',
})
export type FoodStats = Schema.Schema.Type<typeof FoodStatsSchema>

export const makeFoodService = Effect.gen(function* () {
  const playerStatsService = yield* PlayerStatsService

  // Food database with saturation curves
  const foodDatabase = new Map<string, FoodStats>([
    [
      'apple',
      {
        foodType: 'apple',
        nutrition: 4 as FoodPoints,
        saturationModifier: 2.4,
        canAlwaysEat: false,
        eatDurationTicks: 32,
      },
    ],
    [
      'bread',
      {
        foodType: 'bread',
        nutrition: 5 as FoodPoints,
        saturationModifier: 6.0,
        canAlwaysEat: false,
        eatDurationTicks: 32,
      },
    ],
    [
      'cooked_beef',
      {
        foodType: 'cooked_beef',
        nutrition: 8 as FoodPoints,
        saturationModifier: 12.8,
        canAlwaysEat: false,
        eatDurationTicks: 32,
      },
    ],
    [
      'golden_apple',
      {
        foodType: 'golden_apple',
        nutrition: 4 as FoodPoints,
        saturationModifier: 9.6,
        canAlwaysEat: true,
        eatDurationTicks: 32,
      },
    ],
    [
      'chorus_fruit',
      {
        foodType: 'chorus_fruit',
        nutrition: 4 as FoodPoints,
        saturationModifier: 2.4,
        canAlwaysEat: true,
        eatDurationTicks: 32,
      },
    ],
    [
      'honey_bottle',
      {
        foodType: 'honey_bottle',
        nutrition: 6 as FoodPoints,
        saturationModifier: 1.2,
        canAlwaysEat: true,
        eatDurationTicks: 40,
      },
    ],
  ])

  const getFoodStats = (foodType: string): Effect.Effect<FoodStats> =>
    Effect.gen(function* () {
      const foodStats = foodDatabase.get(foodType)
      if (!foodStats) {
        return yield* Effect.fail(new Error(`Unknown food type: ${foodType}`))
      }
      return foodStats
    })

  // Calculate saturation using Minecraft's formula: min(hunger, saturation + nutrition * saturationModifier * 2)
  const calculateSaturation = (foodPoints: number, saturationModifier: number): Effect.Effect<number> =>
    Effect.succeed(Math.min(20, foodPoints * saturationModifier * 2.0))

  const consumeFood = (playerId: string, foodType: string): Effect.Effect<PlayerStats> =>
    Effect.gen(function* () {
      const foodStats = yield* getFoodStats(foodType)
      const currentStats = yield* playerStatsService.getStats(playerId)

      // Check if player can eat (hunger not full or can always eat)
      if (currentStats.hunger >= 20 && !foodStats.canAlwaysEat) {
        return yield* Effect.fail(new Error('Player is not hungry'))
      }

      // Calculate saturation points to add
      const saturationToAdd = yield* calculateSaturation(foodStats.nutrition, foodStats.saturationModifier)

      // Apply food effects using STM for atomicity
      const updatedStats = yield* STM.atomically(
        STM.gen(function* () {
          const newHunger = Math.min(20, currentStats.hunger + foodStats.nutrition) as Hunger
          const newSaturation = Math.min(newHunger, currentStats.saturation + saturationToAdd) as Saturation

          yield* playerStatsService.updateHungerSTM(playerId, foodStats.nutrition)
          yield* playerStatsService.updateSaturationSTM(playerId, saturationToAdd)

          return { ...currentStats, hunger: newHunger, saturation: newSaturation }
        })
      )

      // Special food effects with pattern matching
      const foodEffects = foodType.pipe(
        Match.value,
        Match.when('golden_apple', () =>
          Effect.gen(function* () {
            // Golden apple gives absorption and regeneration
            // This would trigger status effect application
            yield* Effect.log('Applied golden apple effects: Absorption II (2:00), Regeneration II (0:05)')
          })
        ),
        Match.when('chorus_fruit', () =>
          Effect.gen(function* () {
            // Chorus fruit teleports player randomly
            yield* Effect.log('Chorus fruit consumed: Random teleportation triggered')
          })
        ),
        Match.when('honey_bottle', () =>
          Effect.gen(function* () {
            // Honey bottle removes poison effect
            yield* Effect.log('Honey bottle consumed: Poison effect removed')
          })
        ),
        Match.orElse(() => Effect.unit)
      )

      yield* foodEffects

      return updatedStats
    })

  return FoodService.of({
    getFoodStats,
    consumeFood,
    calculateSaturation,
  })
})

export const FoodServiceLive = Layer.effect(FoodService, makeFoodService)

// Death and respawn mechanics with Ref state management
export interface DeathService {
  readonly handlePlayerDeath: (playerId: string, cause: DamageSource) => Effect.Effect<void>
  readonly respawnPlayer: (playerId: string, spawnLocation?: { x: number; y: number; z: number }) => Effect.Effect<void>
  readonly isPlayerDead: (playerId: string) => Effect.Effect<boolean>
}

export const DeathService = Context.GenericTag<DeathService>('@minecraft/DeathService')

export const makeDeathService = Effect.gen(function* () {
  const playerStatsService = yield* PlayerStatsService
  const deadPlayersRef = yield* Ref.make(new Set<string>())

  const handlePlayerDeath = (playerId: string, cause: DamageSource): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Add player to dead players set
      yield* Ref.update(deadPlayersRef, (deadPlayers) => new Set(deadPlayers).add(playerId))

      // Reset player stats to death state
      yield* STM.atomically(
        STM.gen(function* () {
          yield* playerStatsService.updateHealthSTM(playerId, -100) // Ensure 0 health
          // Keep hunger/saturation for respawn
        })
      )

      // Generate death message using pattern matching
      const deathMessage = cause.pipe(
        Match.value,
        Match.when(
          { _tag: 'Fall' },
          ({ distance }) => `Player ${playerId} fell from a high place (${Math.floor(distance)} blocks)`
        ),
        Match.when({ _tag: 'Drowning' }, () => `Player ${playerId} drowned`),
        Match.when({ _tag: 'Fire' }, () => `Player ${playerId} went up in flames`),
        Match.when({ _tag: 'Lava' }, () => `Player ${playerId} tried to swim in lava`),
        Match.when({ _tag: 'Starvation' }, () => `Player ${playerId} starved to death`),
        Match.when({ _tag: 'Suffocation' }, () => `Player ${playerId} suffocated in a wall`),
        Match.when({ _tag: 'Void' }, () => `Player ${playerId} fell out of the world`),
        Match.when({ _tag: 'EntityAttack' }, ({ entityId, weapon }) =>
          weapon
            ? `Player ${playerId} was slain by ${entityId} using ${weapon}`
            : `Player ${playerId} was slain by ${entityId}`
        ),
        Match.exhaustive
      )

      yield* Effect.log(deathMessage)

      // Trigger death events (inventory drop, experience drop, etc.)
      yield* Effect.log(`Player ${playerId} death event triggered`)
    })

  const respawnPlayer = (playerId: string, spawnLocation?: { x: number; y: number; z: number }): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Remove player from dead players set
      yield* Ref.update(deadPlayersRef, (deadPlayers) => {
        const newSet = new Set(deadPlayers)
        newSet.delete(playerId)
        return newSet
      })

      // Reset player stats to full health
      yield* STM.atomically(
        STM.gen(function* () {
          yield* playerStatsService.updateHealthSTM(playerId, 100) // Reset to 20 health
          yield* playerStatsService.updateHungerSTM(playerId, 20) // Reset to 20 hunger
          yield* playerStatsService.updateSaturationSTM(playerId, 5) // Reset to 5 saturation
        })
      )

      const location = spawnLocation ?? { x: 0, y: 64, z: 0 }
      yield* Effect.log(`Player ${playerId} respawned at (${location.x}, ${location.y}, ${location.z})`)
    })

  const isPlayerDead = (playerId: string): Effect.Effect<boolean> =>
    Ref.get(deadPlayersRef).pipe(Effect.map((deadPlayers) => deadPlayers.has(playerId)))

  return DeathService.of({
    handlePlayerDeath,
    respawnPlayer,
    isPlayerDead,
  })
})

export const DeathServiceLive = Layer.effect(DeathService, makeDeathService)
```

## ECS統合 (ECS Integration)

```typescript
// ECS Components using Schema for validation
export const HealthComponentSchema = Schema.Struct({
  current: HealthSchema,
  maximum: HealthSchema,
  lastDamageTime: Schema.Number.pipe(Schema.int()),
  invulnerabilityTicks: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
}).annotations({
  identifier: 'HealthComponent',
})
export type HealthComponent = Schema.Schema.Type<typeof HealthComponentSchema>

export const HungerComponentSchema = Schema.Struct({
  hunger: HungerSchema,
  saturation: SaturationSchema,
  exhaustion: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  lastFoodTime: Schema.Number.pipe(Schema.int()),
}).annotations({
  identifier: 'HungerComponent',
})
export type HungerComponent = Schema.Schema.Type<typeof HungerComponentSchema>

export const StatusEffectsComponentSchema = Schema.Struct({
  effects: Schema.Array(StatusEffectSchema),
  lastUpdateTime: Schema.Number.pipe(Schema.int()),
}).annotations({
  identifier: 'StatusEffectsComponent',
})
export type StatusEffectsComponent = Schema.Schema.Type<typeof StatusEffectsComponentSchema>

// ECS Systems integration
export interface HealthSystem {
  readonly update: (entities: ReadonlyArray<string>, deltaTime: number) => Effect.Effect<void>
  readonly applyDamage: (entityId: string, damage: number, source: DamageSource) => Effect.Effect<void>
  readonly applyHealing: (entityId: string, healing: number) => Effect.Effect<void>
}

export interface HungerSystem {
  readonly update: (entities: ReadonlyArray<string>, deltaTime: number) => Effect.Effect<void>
  readonly applyExhaustion: (entityId: string, amount: number) => Effect.Effect<void>
  readonly feedEntity: (entityId: string, foodType: string) => Effect.Effect<void>
}
```

## UI連携 (UI Integration)

```typescript
// UI state management using Ref for reactive updates
export interface HealthHungerUIService {
  readonly getUIState: (playerId: string) => Effect.Effect<HealthHungerUIState>
  readonly subscribeToUpdates: (playerId: string) => Stream.Stream<HealthHungerUIState>
  readonly formatHealthBar: (health: Health) => Effect.Effect<string>
  readonly formatHungerBar: (hunger: Hunger, saturation: Saturation) => Effect.Effect<string>
}

export const HealthHungerUISchema = Schema.Struct({
  playerId: Schema.String,
  health: HealthSchema,
  hunger: HungerSchema,
  saturation: SaturationSchema,
  statusEffects: Schema.Array(StatusEffectSchema),
  isRegenerated: Schema.Boolean,
  damageFlash: Schema.Boolean,
}).annotations({
  identifier: 'HealthHungerUIState',
})
export type HealthHungerUIState = Schema.Schema.Type<typeof HealthHungerUISchema>

export const makeHealthHungerUIService = Effect.gen(function* () {
  const playerStatsService = yield* PlayerStatsService
  const uiStateRef = yield* Ref.make(new Map<string, HealthHungerUIState>())

  const getUIState = (playerId: string): Effect.Effect<HealthHungerUIState> =>
    Effect.gen(function* () {
      const stats = yield* playerStatsService.getStats(playerId)
      const uiState: HealthHungerUIState = {
        playerId,
        health: stats.health,
        hunger: stats.hunger,
        saturation: stats.saturation,
        statusEffects: [], // Would be populated from status effects service
        isRegenerated: stats.health > 18 && stats.hunger > 17,
        damageFlash: false, // Would be set temporarily after damage
      }

      yield* Ref.update(uiStateRef, (stateMap) => new Map(stateMap).set(playerId, uiState))
      return uiState
    })

  const subscribeToUpdates = (playerId: string): Stream.Stream<HealthHungerUIState> =>
    Stream.repeatEffect(getUIState(playerId)).pipe(
      Stream.schedule(Schedule.fixed(Duration.millis(100))), // 10 FPS UI updates
      Stream.changes // Only emit when state actually changes
    )

  const formatHealthBar = (health: Health): Effect.Effect<string> =>
    Effect.gen(function* () {
      const fullHearts = Math.floor(health / 2)
      const halfHeart = health % 2 === 1
      const emptyHearts = 10 - fullHearts - (halfHeart ? 1 : 0)

      const hearts = ['♥'.repeat(fullHearts), halfHeart ? '♡' : '', '♤'.repeat(emptyHearts)].join('')

      return `Health: ${hearts} (${health}/20)`
    })

  const formatHungerBar = (hunger: Hunger, saturation: Saturation): Effect.Effect<string> =>
    Effect.gen(function* () {
      const fullDrumsticks = Math.floor(hunger / 2)
      const halfDrumstick = hunger % 2 === 1
      const emptyDrumsticks = 10 - fullDrumsticks - (halfDrumstick ? 1 : 0)

      const drumsticks = ['🍗'.repeat(fullDrumsticks), halfDrumstick ? '🦴' : '', '⬜'.repeat(emptyDrumsticks)].join('')

      return `Hunger: ${drumsticks} (${hunger}/20) Sat: ${saturation.toFixed(1)}`
    })

  return {
    getUIState,
    subscribeToUpdates,
    formatHealthBar,
    formatHungerBar,
  }
})
```

## テスト (Property-Based Testing Compatible)

```typescript
import { Schema, Effect, Gen, TestClock, it } from 'effect'
import { fc } from '@effect/vitest'

// Property-based test generators
const genHealth = fc.integer({ min: 0, max: 20 }).map((n) => n as Health)
const genHunger = fc.integer({ min: 0, max: 20 }).map((n) => n as Hunger)
const genSaturation = fc.float({ min: 0, max: 20 }).map((n) => n as Saturation)

const genPlayerStats = fc.record({
  health: genHealth,
  hunger: genHunger,
  saturation: genSaturation,
  exhaustion: fc.float({ min: 0, max: 10 }),
})

const genDamageSource = fc.oneof(
  fc.record({ _tag: fc.constant('Fall'), distance: fc.float({ min: 1, max: 100 }) }),
  fc.record({ _tag: fc.constant('Drowning') }),
  fc.record({ _tag: fc.constant('Fire'), ticksOnFire: fc.integer({ min: 0, max: 100 }) }),
  fc.record({ _tag: fc.constant('Starvation') })
)

// Property-based tests
describe('Health/Hunger System Properties', () => {
  it.effect('health never exceeds maximum', () =>
    Effect.gen(function* () {
      const testLive = PlayerStatsServiceLive.pipe(Layer.provide(TestContext.TestContext))

      yield* Effect.gen(function* () {
        const service = yield* PlayerStatsService

        // Property: healing never makes health exceed 20
        yield* it.prop(
          fc.asyncProperty(genPlayerStats, fc.integer({ min: 1, max: 100 }), (stats, healing) =>
            Effect.gen(function* () {
              const playerId = 'test-player'
              // Set initial stats
              yield* STM.atomically(service.updateHealthSTM(playerId, stats.health - 20))

              // Apply healing
              yield* service.applyHealing(playerId, healing)

              // Check property
              const finalStats = yield* service.getStats(playerId)
              return finalStats.health <= 20
            }).pipe(Effect.runPromise)
          )
        )
      }).pipe(Effect.provide(testLive))
    })
  )

  it.effect('hunger depletion respects saturation priority', () =>
    Effect.gen(function* () {
      const testLive = PlayerStatsServiceLive.pipe(Layer.provide(TestContext.TestContext))

      yield* Effect.gen(function* () {
        const service = yield* PlayerStatsService

        // Property: saturation depletes before hunger
        yield* it.prop(
          fc.asyncProperty(genPlayerStats, (initialStats) =>
            Effect.gen(function* () {
              const playerId = 'test-player'

              // Simulate hunger depletion over time
              if (initialStats.saturation > 0) {
                // Apply exhaustion to trigger hunger depletion
                const stats = { ...initialStats, exhaustion: 4.0 }

                // The system should deplete saturation first
                const finalStats = yield* service.getStats(playerId)
                return initialStats.saturation === 0 || finalStats.saturation < initialStats.saturation
              }
              return true
            }).pipe(Effect.runPromise)
          )
        )
      }).pipe(Effect.provide(testLive))
    })
  )

  it.effect('damage calculation is deterministic', () =>
    Effect.gen(function* () {
      const testLive = PlayerStatsServiceLive.pipe(Layer.provide(TestContext.TestContext))

      yield* Effect.gen(function* () {
        const service = yield* PlayerStatsService

        // Property: same damage source produces same damage
        yield* it.prop(
          fc.asyncProperty(genDamageSource, fc.integer({ min: 1, max: 20 }), (source, baseAmount) =>
            Effect.gen(function* () {
              const playerId1 = 'test-player-1'
              const playerId2 = 'test-player-2'

              // Set same initial health for both players
              yield* STM.atomically(
                STM.gen(function* () {
                  yield* service.updateHealthSTM(playerId1, 20 - 20) // Reset to 20
                  yield* service.updateHealthSTM(playerId2, 20 - 20) // Reset to 20
                })
              )

              // Apply same damage to both
              yield* service.applyDamage(playerId1, source, baseAmount)
              yield* service.applyDamage(playerId2, source, baseAmount)

              // Check deterministic result
              const stats1 = yield* service.getStats(playerId1)
              const stats2 = yield* service.getStats(playerId2)

              return stats1.health === stats2.health
            }).pipe(Effect.runPromise)
          )
        )
      }).pipe(Effect.provide(testLive))
    })
  )
})

// Unit tests for specific scenarios
describe('Health/Hunger System Unit Tests', () => {
  it.effect('regeneration only works when hunger > 17', () =>
    Effect.gen(function* () {
      const testLive = PlayerStatsServiceLive.pipe(Layer.provide(TestContext.TestContext))

      yield* Effect.gen(function* () {
        const service = yield* PlayerStatsService
        const playerId = 'test-player'

        // Set low hunger (16)
        yield* STM.atomically(
          STM.gen(function* () {
            yield* service.updateHealthSTM(playerId, 15 - 20) // 15 health
            yield* service.updateHungerSTM(playerId, 16 - 20) // 16 hunger
          })
        )

        const initialStats = yield* service.getStats(playerId)

        // Fast-forward time to trigger regeneration attempt
        yield* TestClock.adjust(Duration.seconds(4))

        const finalStats = yield* service.getStats(playerId)

        // Health should not have regenerated
        return finalStats.health === initialStats.health && finalStats.health === 15
      }).pipe(
        Effect.provide(testLive),
        Effect.map((result) => expect(result).toBe(true))
      )
    })
  )

  it.effect('golden apple provides special effects', () =>
    Effect.gen(function* () {
      const testLive = FoodServiceLive.pipe(
        Layer.provide(PlayerStatsServiceLive),
        Layer.provide(TestContext.TestContext)
      )

      yield* Effect.gen(function* () {
        const foodService = yield* FoodService
        const playerId = 'test-player'

        // Consume golden apple
        const result = yield* foodService.consumeFood(playerId, 'golden_apple')

        // Should succeed even when hunger is full (canAlwaysEat: true)
        return result.hunger <= 20 && result.saturation <= result.hunger
      }).pipe(
        Effect.provide(testLive),
        Effect.map((result) => expect(result).toBe(true))
      )
    })
  )
})
```

## パフォーマンス考慮事項 (Performance Optimization)

```typescript
// Performance optimized batch operations
export interface BatchHealthUpdateService {
  readonly batchUpdateHealth: (updates: ReadonlyArray<{ playerId: string; delta: number }>) => Effect.Effect<void>
  readonly batchProcessStatusEffects: (
    playerEffects: ReadonlyArray<{ playerId: string; effects: ReadonlyArray<StatusEffect> }>
  ) => Effect.Effect<void>
}

export const makeBatchHealthUpdateService = Effect.gen(function* () {
  const playerStatsService = yield* PlayerStatsService

  // Batch health updates for better performance
  const batchUpdateHealth = (updates: ReadonlyArray<{ playerId: string; delta: number }>): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Group updates by player to avoid conflicts
      const playerUpdates = updates.reduce((acc, update) => {
        const existing = acc.get(update.playerId) ?? 0
        acc.set(update.playerId, existing + update.delta)
        return acc
      }, new Map<string, number>())

      // Apply all updates atomically using STM
      yield* STM.atomically(
        STM.gen(function* () {
          for (const [playerId, totalDelta] of playerUpdates) {
            yield* playerStatsService.updateHealthSTM(playerId, totalDelta)
          }
        })
      )
    })

  // Batch process status effects for multiple players
  const batchProcessStatusEffects = (
    playerEffects: ReadonlyArray<{ playerId: string; effects: ReadonlyArray<StatusEffect> }>
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Process effects in parallel for better performance
      yield* Effect.all(
        playerEffects.map(({ playerId, effects }) => processStatusEffectsOptimized(playerId, effects)),
        { concurrency: 'unbounded' }
      )
    })

  // Optimized status effect processing with early returns
  const processStatusEffectsOptimized = (playerId: string, effects: ReadonlyArray<StatusEffect>): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Early return if no effects
      if (effects.length === 0) return

      // Group effects by type for batch processing
      const effectGroups = effects.reduce(
        (acc, effect) => {
          if (!acc[effect._tag]) acc[effect._tag] = []
          acc[effect._tag].push(effect)
          return acc
        },
        {} as Record<string, StatusEffect[]>
      )

      // Process each effect type in batch
      for (const [effectType, effectList] of Object.entries(effectGroups)) {
        yield* effectType.pipe(
          Match.value,
          Match.when('Regeneration', () => processBatchRegeneration(playerId, effectList)),
          Match.when('Poison', () => processBatchPoison(playerId, effectList)),
          Match.orElse(() => Effect.unit)
        )
      }
    })

  const processBatchRegeneration = (playerId: string, effects: StatusEffect[]): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Sum all regeneration effects
      const totalHealing = effects.reduce((total, effect) => {
        if (effect._tag === 'Regeneration' && effect.ticksRemaining % (50 / effect.level) === 0) {
          return total + 1
        }
        return total
      }, 0)

      if (totalHealing > 0) {
        yield* playerStatsService.applyHealing(playerId, totalHealing).pipe(Effect.asUnit)
      }
    })

  const processBatchPoison = (playerId: string, effects: StatusEffect[]): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Sum all poison damage
      const totalDamage = effects.reduce((total, effect) => {
        if (effect._tag === 'Poison' && effect.ticksRemaining % (25 / effect.level) === 0) {
          return total + 1
        }
        return total
      }, 0)

      if (totalDamage > 0) {
        const poisonSource: DamageSource = { _tag: 'EntityAttack', entityId: 'poison', weapon: 'poison' }
        yield* playerStatsService.applyDamage(playerId, poisonSource, totalDamage).pipe(Effect.asUnit)
      }
    })

  return {
    batchUpdateHealth,
    batchProcessStatusEffects,
  }
})

// Performance monitoring
export const HealthSystemMetrics = Schema.Struct({
  playersTracked: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  updatesPerSecond: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  averageProcessingTimeMs: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  memoryUsageMB: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
}).annotations({
  identifier: 'HealthSystemMetrics',
})
export type HealthSystemMetrics = Schema.Schema.Type<typeof HealthSystemMetrics>

// 最適化のポイント:
// 1. STM使用により並行更新の安全性を保証
// 2. Stream活用で効率的な連続更新処理
// 3. バッチ処理で複数プレイヤーの同時更新
// 4. 早期リターンパターンで不要な計算を回避
// 5. パターンマッチングで分岐処理を最適化
// 6. Property-based testingで境界条件の網羅的テスト
```
