import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import {
  BrandedTypes,
  PlayerAbilitiesSchema,
  PlayerEquipmentSchema,
  PlayerInventorySchema,
  PlayerSchema,
  PlayerStatsSchema,
} from '../../types/core'
import { applyExperienceGain, applyPlayerUpdate, changeGameMode, normaliseAbilities } from '../player'

const equipment = Schema.decodeUnknownSync(PlayerEquipmentSchema)({
  id: 'eqp_abcd1234',
  ownerId: BrandedTypes.createPlayerId('player_abcd12'),
  slots: {},
  metadata: undefined,
  version: 1,
  createdAt: 0,
  updatedAt: 0,
})

const inventory = Schema.decodeUnknownSync(PlayerInventorySchema)({
  id: 'inventory_player_abcd12',
  ownerId: BrandedTypes.createPlayerId('player_abcd12'),
  slots: Array.from({ length: 36 }, () => undefined),
  hotbar: Array.from({ length: 9 }, (_, index) => index),
  selectedSlot: 0,
  metadata: undefined,
  version: 1,
  createdAt: 0,
  updatedAt: 0,
})

const basePlayer = Schema.decodeUnknownSync(PlayerSchema)({
  id: BrandedTypes.createPlayerId('player_abcd12'),
  entityId: BrandedTypes.createEntityId('entity_player_core'),
  name: 'Alex',
  position: BrandedTypes.createVector3D(0, 64, 0),
  rotation: BrandedTypes.createRotation(0, 0, 0),
  velocity: BrandedTypes.createVector3D(0, 0, 0),
  stats: Schema.decodeUnknownSync(PlayerStatsSchema)({
    health: 20,
    maxHealth: 20,
    hunger: 20,
    saturation: 10,
    experience: 0,
    level: 0,
    armor: 0,
  }),
  gameMode: 'survival',
  abilities: Schema.decodeUnknownSync(PlayerAbilitiesSchema)({
    canFly: false,
    isFlying: false,
    canBreakBlocks: true,
    canPlaceBlocks: true,
    invulnerable: false,
    walkSpeed: 0.1,
    flySpeed: 0.5,
  }),
  inventory,
  equipment,
  isOnGround: true,
  isSneaking: false,
  isSprinting: false,
  lastUpdate: 0,
  createdAt: 0,
})

describe('entities/model/player', () => {
  it.effect('changeGameMode adjusts abilities', () =>
    Effect.gen(function* () {
      const updated = yield* changeGameMode(basePlayer, 'creative')
      expect(updated.gameMode).toBe('creative')
      expect(updated.abilities.canFly).toBe(true)
      expect(updated.abilities.invulnerable).toBe(true)
    })
  )

  it.effect('applyExperienceGain updates level', () =>
    Effect.gen(function* () {
      const updated = yield* applyExperienceGain(basePlayer, 100)
      expect(updated.stats.experience).toBe(100)
      expect(updated.stats.level).toBeGreaterThanOrEqual(0)
    })
  )

  it.effect('applyExperienceGain rejects negative accumulation', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(applyExperienceGain(basePlayer, -50))
      expect(result._tag).toBe('Left')
    })
  )

  it.effect('applyPlayerUpdate merges new state', () =>
    Effect.gen(function* () {
      const updated = yield* applyPlayerUpdate(basePlayer, {
        position: BrandedTypes.createVector3D(5, 70, 5),
        health: 15,
        gameMode: 'adventure',
      })

      expect(updated.position.x).toBe(5)
      expect(updated.stats.health).toBe(15)
      expect(updated.gameMode).toBe('adventure')
      expect(updated.abilities.canBreakBlocks).toBe(false)
    })
  )

  it.effect('normaliseAbilities clamps speed ranges', () =>
    Effect.gen(function* () {
      const abilities = yield* normaliseAbilities({
        canFly: true,
        isFlying: true,
        canBreakBlocks: true,
        canPlaceBlocks: true,
        invulnerable: false,
        walkSpeed: 10,
        flySpeed: 10,
      })

      expect(abilities.walkSpeed).toBeLessThanOrEqual(1)
      expect(abilities.flySpeed).toBeLessThanOrEqual(4)
    })
  )
})
