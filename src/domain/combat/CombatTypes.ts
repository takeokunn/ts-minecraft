import { Schema } from '@effect/schema'
import { pipe } from 'effect'
import type { EntityId, ItemId } from '../../shared/types/branded.js'
import { EntityId as EntityIdSchema, ItemId as ItemIdSchema } from '../../shared/types/branded.js'
import { Vector3DSchema, type Vector3D } from '../../shared/types/spatial-brands.js'

// ================================
// Branded Types
// ================================

export const AttackDamage = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('AttackDamage'),
  Schema.annotations({
    title: 'AttackDamage',
    description: 'Damage value for attacks',
  })
)
export type AttackDamage = Schema.Schema.Type<typeof AttackDamage>

export const DefenseValue = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand('DefenseValue'),
  Schema.annotations({
    title: 'DefenseValue',
    description: 'Defense value for armor',
  })
)
export type DefenseValue = Schema.Schema.Type<typeof DefenseValue>

export const KnockbackForce = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('KnockbackForce'),
  Schema.annotations({
    title: 'KnockbackForce',
    description: 'Force applied for knockback',
  })
)
export type KnockbackForce = Schema.Schema.Type<typeof KnockbackForce>

export const AttackCooldown = Schema.Number.pipe(
  Schema.between(0, 1000),
  Schema.brand('AttackCooldown'),
  Schema.annotations({
    title: 'AttackCooldown',
    description: 'Attack cooldown in milliseconds',
  })
)
export type AttackCooldown = Schema.Schema.Type<typeof AttackCooldown>

export const Durability = Schema.Number.pipe(
  Schema.between(0, 1000),
  Schema.brand('Durability'),
  Schema.annotations({
    title: 'Durability',
    description: 'Item durability value',
  })
)
export type Durability = Schema.Schema.Type<typeof Durability>

// ================================
// Enchantment Types
// ================================

export const EnchantmentType = Schema.Literal(
  'sharpness',
  'knockback',
  'fire_aspect',
  'looting',
  'protection',
  'blast_protection',
  'projectile_protection',
  'thorns'
)
export type EnchantmentType = Schema.Schema.Type<typeof EnchantmentType>

// ================================
// Armor Slot
// ================================

export const ArmorSlot = Schema.Literal('helmet', 'chestplate', 'leggings', 'boots')
export type ArmorSlot = Schema.Schema.Type<typeof ArmorSlot>

// ================================
// Weapon Definition
// ================================

export const Weapon = Schema.Struct({
  itemId: ItemIdSchema,
  baseDamage: AttackDamage,
  attackSpeed: Schema.Number.pipe(Schema.positive()),
  knockback: KnockbackForce,
  enchantments: Schema.Array(EnchantmentType),
  durability: Durability,
})
export type Weapon = Schema.Schema.Type<typeof Weapon>

// ================================
// Armor Definition
// ================================

export const Armor = Schema.Struct({
  slot: ArmorSlot,
  defense: DefenseValue,
  toughness: Schema.Number.pipe(Schema.between(0, 10)),
  enchantments: Schema.Array(EnchantmentType),
  durability: Durability,
})
export type Armor = Schema.Schema.Type<typeof Armor>

// ================================
// Combat Events
// ================================

export const CombatEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('AttackInitiated'),
    attackerId: EntityIdSchema,
    targetId: EntityIdSchema,
    weapon: Schema.optional(Weapon),
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('DamageDealt'),
    attackerId: EntityIdSchema,
    targetId: EntityIdSchema,
    rawDamage: AttackDamage,
    finalDamage: AttackDamage,
    isCritical: Schema.Boolean,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Blocked'),
    blockerId: EntityIdSchema,
    attackerId: EntityIdSchema,
    damageBlocked: AttackDamage,
  }),
  Schema.Struct({
    _tag: Schema.Literal('KnockbackApplied'),
    targetId: EntityIdSchema,
    force: Vector3DSchema,
    sourceId: EntityIdSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('EntityKilled'),
    entityId: EntityIdSchema,
    killerId: Schema.optional(EntityIdSchema),
    timestamp: Schema.Number,
  })
)
export type CombatEvent = Schema.Schema.Type<typeof CombatEvent>

// ================================
// Attack Types
// ================================

export const ProjectileType = Schema.Literal('arrow', 'trident', 'snowball', 'egg', 'fireball')
export type ProjectileType = Schema.Schema.Type<typeof ProjectileType>

export const SpellType = Schema.Literal('fireball', 'ice_shard', 'lightning', 'heal', 'shield')
export type SpellType = Schema.Schema.Type<typeof SpellType>

export const AttackType = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Melee'),
    weapon: Schema.optional(Weapon),
    chargeTime: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Ranged'),
    projectileType: ProjectileType,
    power: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Magic'),
    spellType: SpellType,
    manaCost: Schema.Number.pipe(Schema.positive()),
  })
)
export type AttackType = Schema.Schema.Type<typeof AttackType>

// ================================
// Damage Source
// ================================

export const DamageSource = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Mob'),
    mobId: EntityIdSchema,
    weaponType: Schema.optional(AttackType),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Player'),
    playerId: EntityIdSchema,
    weaponType: Schema.optional(AttackType),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Projectile'),
    projectileType: ProjectileType,
    sourceId: EntityIdSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Environment'),
    cause: Schema.Literal('fall', 'drowning', 'fire', 'lava', 'suffocation', 'void'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Magic'),
    spellType: SpellType,
    casterId: EntityIdSchema,
  })
)
export type DamageSource = Schema.Schema.Type<typeof DamageSource>

// ================================
// Combat Result
// ================================

export const CombatResult = Schema.Struct({
  damage: AttackDamage,
  targetId: EntityIdSchema,
  knockback: KnockbackForce,
  isCritical: Schema.Boolean,
  durabilityLoss: Schema.optional(Schema.Number),
})
export type CombatResult = Schema.Schema.Type<typeof CombatResult>

// ================================
// Combat Errors
// ================================

export class CombatError extends Schema.TaggedError<CombatError>()('CombatError', {
  message: Schema.String,
  code: Schema.Literal('ATTACK_ON_COOLDOWN', 'TARGET_NOT_FOUND', 'INVALID_ATTACK', 'WEAPON_BROKEN'),
}) {}

export class AttackOnCooldownError extends Schema.TaggedError<AttackOnCooldownError>()('AttackOnCooldownError', {
  attackerId: EntityIdSchema,
  remainingCooldown: Schema.Number,
}) {}

export class TargetNotFoundError extends Schema.TaggedError<TargetNotFoundError>()('TargetNotFoundError', {
  targetId: EntityIdSchema,
}) {}

export class EntityNotFoundError extends Schema.TaggedError<EntityNotFoundError>()('EntityNotFoundError', {
  entityId: EntityIdSchema,
}) {}

export class KnockbackError extends Schema.TaggedError<KnockbackError>()('KnockbackError', {
  message: Schema.String,
  targetId: EntityIdSchema,
}) {}

// ================================
// Helper Functions
// ================================

export const createAttackDamage = (damage: number): AttackDamage =>
  Schema.decodeSync(AttackDamage)(damage)

export const createDefenseValue = (defense: number): DefenseValue =>
  Schema.decodeSync(DefenseValue)(defense)

export const createKnockbackForce = (force: number): KnockbackForce =>
  Schema.decodeSync(KnockbackForce)(force)

export const createAttackCooldown = (cooldown: number): AttackCooldown =>
  Schema.decodeSync(AttackCooldown)(cooldown)

export const createDurability = (durability: number): Durability =>
  Schema.decodeSync(Durability)(durability)