import { Schema } from '@effect/schema'
import { Effect, Match } from 'effect'
import { pipe } from 'effect/Function'
import * as Either from 'effect/Either'
import * as Option from 'effect/Option'
import {
  GameMode,
  GameModeSchema,
  Player,
  PlayerAbilities,
  PlayerAbilitiesSchema,
  PlayerStats,
  PlayerStatsSchema,
  PlayerUpdateData,
  PlayerUpdateDataSchema,
} from '../types/core'
import {
  EntityUpdateError,
  EntityValidationError,
  makeEntityUpdateError,
  makeEntityValidationError,
} from '../types/errors'

const deriveAbilities = (abilities: PlayerAbilities, mode: GameMode): PlayerAbilities =>
  pipe(
    Match.value(mode),
    Match.when('creative', () => ({
      ...abilities,
      canFly: true,
      isFlying: true,
      canBreakBlocks: true,
      canPlaceBlocks: true,
      invulnerable: true,
    })),
    Match.when('spectator', () => ({
      ...abilities,
      canFly: true,
      isFlying: true,
      canBreakBlocks: false,
      canPlaceBlocks: false,
      invulnerable: true,
    })),
    Match.when('adventure', () => ({
      ...abilities,
      canBreakBlocks: false,
      canPlaceBlocks: false,
      invulnerable: false,
    })),
    Match.orElse(() => ({
      ...abilities,
      canFly: false,
      isFlying: false,
      canBreakBlocks: true,
      canPlaceBlocks: true,
      invulnerable: false,
    }))
  )

const clampStats = (stats: PlayerStats): PlayerStats => ({
  ...stats,
  health: Math.min(Math.max(stats.health, 0), stats.maxHealth),
  hunger: Math.min(Math.max(stats.hunger, 0), 20),
  saturation: Math.min(Math.max(stats.saturation, 0), 20),
  armor: Math.min(Math.max(stats.armor, 0), 20),
})

const levelFromExperience = (experience: number): number =>
  pipe(
    Match.value(true),
    Match.when(experience >= 1395, () => Math.floor((Math.sqrt(72 * experience - 54215) + 325) / 18)),
    Match.when(experience >= 315, () => Math.floor(Math.sqrt(40 * experience - 7839) / 2 + 8.5)),
    Match.orElse(() => Math.floor(Math.sqrt(experience + 9) - 3))
  )

export const changeGameMode = (
  player: Player,
  next: GameMode
): Effect.Effect<Player, EntityValidationError> =>
  Effect.gen(function* () {
    const decodedMode = yield* pipe(
      Schema.decodeUnknownEither(GameModeSchema)(next),
      Either.match({
        onLeft: (error) =>
          Effect.fail(
            makeEntityValidationError({
              entityId: player.entityId,
              field: 'gameMode',
              message: error.message,
              timestamp: player.lastUpdate,
            })
          ),
        onRight: Effect.succeed,
      })
    )

    const updatedAbilities = deriveAbilities(player.abilities, decodedMode)

    return {
      ...player,
      gameMode: decodedMode,
      abilities: updatedAbilities,
    }
  })

export const applyExperienceGain = (
  player: Player,
  amount: number
): Effect.Effect<Player, EntityUpdateError> =>
  Effect.gen(function* () {
    const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
    const experience = player.stats.experience + amount

    return yield* pipe(
      experience < 0,
      Match.value,
      Match.when(true, () =>
        Effect.fail(
          makeEntityUpdateError({
            entityId: player.entityId,
            attemptedStatus: undefined,
            attemptedType: undefined,
            reason: 'Experience cannot be negative',
            timestamp: now,
          })
        )
      ),
      Match.orElse(() =>
        Effect.succeed({
          ...player,
          stats: {
            ...player.stats,
            experience,
            level: levelFromExperience(experience),
          },
          lastUpdate: now,
        })
      )
    )
  })

export const applyPlayerUpdate = (
  player: Player,
  patch: PlayerUpdateData
): Effect.Effect<Player, EntityValidationError> =>
  Effect.gen(function* () {
    const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis)

    const payload = yield* pipe(
      Schema.decodeUnknownEither(PlayerUpdateDataSchema)(patch),
      Either.match({
        onLeft: (error) =>
          Effect.fail(
            makeEntityValidationError({
              entityId: player.entityId,
              field: 'playerUpdate',
              message: error.message,
              timestamp: now,
            })
          ),
        onRight: Effect.succeed,
      })
    )

    const updatedStats = pipe(
      Option.fromNullable(payload.health),
      Option.map((health) => ({ ...player.stats, health })),
      Option.orElse(() => Option.fromNullable(payload.hunger).map((hunger) => ({ ...player.stats, hunger }))),
      Option.orElse(() => Option.fromNullable(payload.saturation).map((saturation) => ({ ...player.stats, saturation }))),
      Option.getOrElse(() => player.stats)
    )

    const nextMode = payload.gameMode ?? player.gameMode

    return {
      ...player,
      gameMode: nextMode,
      stats: clampStats(updatedStats),
      abilities: deriveAbilities(player.abilities, nextMode),
      position: payload.position ?? player.position,
      rotation: payload.rotation ?? player.rotation,
      velocity: payload.velocity ?? player.velocity,
      isSneaking: payload.isSneaking ?? player.isSneaking,
      isSprinting: payload.isSprinting ?? player.isSprinting,
      lastUpdate: now,
    }
  })

export const normaliseAbilities = (
  abilities: PlayerAbilities
): Effect.Effect<PlayerAbilities, EntityValidationError> =>
  Effect.gen(function* () {
    const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis)

    const payload = yield* pipe(
      Schema.decodeUnknownEither(PlayerAbilitiesSchema)(abilities),
      Either.match({
        onLeft: (error) =>
          Effect.fail(
            makeEntityValidationError({
              entityId: undefined,
              field: 'playerAbilities',
              message: error.message,
              timestamp: now,
            })
          ),
        onRight: Effect.succeed,
      })
    )

    return clampAbilityFlags(payload)
  })

const clampAbilityFlags = (abilities: PlayerAbilities): PlayerAbilities => ({
  ...abilities,
  flySpeed: Math.min(Math.max(abilities.flySpeed, 0.1), 4),
  walkSpeed: Math.min(Math.max(abilities.walkSpeed, 0.05), 1),
})

export type PlayerDomainFailure = EntityValidationError | EntityUpdateError
