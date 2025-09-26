import { Schema } from '@effect/schema'
import { Brand, Data } from 'effect'
import { PlayerId, EntityId } from '../PlayerTypes.js'
import type { Vector3D } from '../../../shared/schemas/spatial.js'
import { Vector3D as Vector3DSchema } from '../../../shared/schemas/spatial.js'

// =======================================
// Branded Types for Health Domain
// =======================================

export const MaxHealth = Schema.Number.pipe(
  Schema.between(1, 20),
  Schema.brand('MaxHealth'),
  Schema.annotations({
    title: 'MaxHealth',
    description: 'Maximum health points (1-20, Minecraft standard)',
  })
)
export type MaxHealth = Schema.Schema.Type<typeof MaxHealth>

export const CurrentHealth = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand('CurrentHealth'),
  Schema.annotations({
    title: 'CurrentHealth',
    description: 'Current health points (0-20, where 20 is full health)',
  })
)
export type CurrentHealth = Schema.Schema.Type<typeof CurrentHealth>

export const DamageAmount = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand('DamageAmount'),
  Schema.annotations({
    title: 'DamageAmount',
    description: 'Amount of damage to deal',
  })
)
export type DamageAmount = Schema.Schema.Type<typeof DamageAmount>

export const HealAmount = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('HealAmount'),
  Schema.annotations({
    title: 'HealAmount',
    description: 'Amount of health to restore',
  })
)
export type HealAmount = Schema.Schema.Type<typeof HealAmount>

// =======================================
// Damage Source Tagged Union
// =======================================

export const DamageSource = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Fall'),
    height: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Lava'),
    duration: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Drowning'),
    duration: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Mob'),
    mobId: EntityId,
    weaponType: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Player'),
    attackerId: PlayerId,
    weaponType: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Hunger'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Explosion'),
    power: Schema.Number.pipe(Schema.positive()),
    distance: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Void'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Magic'),
    type: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Fire'),
    duration: Schema.Number.pipe(Schema.positive()),
  })
)

export type DamageSource = Schema.Schema.Type<typeof DamageSource>

// =======================================
// Healing Source Tagged Union
// =======================================

export const HealingSource = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('NaturalRegeneration'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Food'),
    itemId: Schema.String,
    healAmount: HealAmount,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Potion'),
    potionType: Schema.String,
    instant: Schema.Boolean,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Command'),
    source: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Beacon'),
    level: Schema.Number.pipe(Schema.between(1, 4)),
  })
)

export type HealingSource = Schema.Schema.Type<typeof HealingSource>

// =======================================
// Health State
// =======================================

export const HealthState = Schema.Struct({
  playerId: PlayerId,
  currentHealth: CurrentHealth,
  maxHealth: MaxHealth,
  isDead: Schema.Boolean,
  lastDamageSource: Schema.optional(DamageSource),
  lastDamageTime: Schema.optional(Schema.Number),
  invulnerabilityEndTime: Schema.optional(Schema.Number),
})

export type HealthState = Schema.Schema.Type<typeof HealthState>

// =======================================
// Health Events
// =======================================

export const HealthEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Damaged'),
    playerId: PlayerId,
    amount: DamageAmount,
    source: DamageSource,
    previousHealth: CurrentHealth,
    newHealth: CurrentHealth,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Healed'),
    playerId: PlayerId,
    amount: HealAmount,
    source: HealingSource,
    previousHealth: CurrentHealth,
    newHealth: CurrentHealth,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Died'),
    playerId: PlayerId,
    source: DamageSource,
    deathLocation: Vector3DSchema,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Respawned'),
    playerId: PlayerId,
    spawnLocation: Vector3DSchema,
    timestamp: Schema.Number,
  })
)

export type HealthEvent = Schema.Schema.Type<typeof HealthEvent>

// =======================================
// Health Errors
// =======================================

export const HealthErrorReason = Schema.Literal(
  'PLAYER_NOT_FOUND',
  'INVALID_HEALTH_VALUE',
  'INVALID_DAMAGE_SOURCE',
  'INVALID_HEALING_SOURCE',
  'ALREADY_DEAD',
  'NOT_DEAD',
  'INVULNERABLE'
)

export type HealthErrorReason = Schema.Schema.Type<typeof HealthErrorReason>

export class HealthError extends Data.TaggedError('HealthError')<{
  readonly reason: HealthErrorReason
  readonly message: string
  readonly playerId?: PlayerId
  readonly cause?: unknown
}> {}

// =======================================
// Helper Functions
// =======================================

export const createHealthError = {
  playerNotFound: (playerId: PlayerId) =>
    new HealthError({
      reason: 'PLAYER_NOT_FOUND',
      message: `Player ${playerId} not found`,
      playerId,
    }),

  invalidHealthValue: (value: unknown, playerId?: PlayerId) =>
    new HealthError({
      reason: 'INVALID_HEALTH_VALUE',
      message: `Invalid health value: ${value}`,
      ...(playerId && { playerId }),
      cause: value,
    }),

  alreadyDead: (playerId: PlayerId) =>
    new HealthError({
      reason: 'ALREADY_DEAD',
      message: `Player ${playerId} is already dead`,
      playerId,
    }),

  notDead: (playerId: PlayerId) =>
    new HealthError({
      reason: 'NOT_DEAD',
      message: `Player ${playerId} is not dead`,
      playerId,
    }),

  invulnerable: (playerId: PlayerId) =>
    new HealthError({
      reason: 'INVULNERABLE',
      message: `Player ${playerId} is invulnerable`,
      playerId,
    }),
}

// =======================================
// Constants
// =======================================

export const HEALTH_CONSTANTS = {
  DEFAULT_MAX_HEALTH: 20 as MaxHealth,
  INVULNERABILITY_DURATION_MS: 500,
  NATURAL_REGENERATION_INTERVAL_MS: 4000,
  NATURAL_REGENERATION_AMOUNT: 1 as HealAmount,
} as const