import { Context, Effect, Match, pipe } from 'effect'
import { Schema } from '@effect/schema'
import type { DamageSource, DamageAmount } from './HealthTypes.js'

// =======================================
// Damage Calculation Configuration
// =======================================

export const DamageConfig = Schema.Struct({
  fallDamageThreshold: Schema.Number.pipe(Schema.positive(), Schema.annotations({ default: 3 })),
  fallDamageMultiplier: Schema.Number.pipe(Schema.positive(), Schema.annotations({ default: 1 })),
  lavaDamagePerSecond: Schema.Number.pipe(Schema.positive(), Schema.annotations({ default: 4 })),
  drowningDamagePerSecond: Schema.Number.pipe(Schema.positive(), Schema.annotations({ default: 2 })),
  fireDamagePerSecond: Schema.Number.pipe(Schema.positive(), Schema.annotations({ default: 1 })),
  hungerDamage: Schema.Number.pipe(Schema.positive(), Schema.annotations({ default: 1 })),
  voidDamage: Schema.Number.pipe(Schema.positive(), Schema.annotations({ default: 4 })),
  explosionBaseDamage: Schema.Number.pipe(Schema.positive(), Schema.annotations({ default: 7 })),
})

export type DamageConfig = Schema.Schema.Type<typeof DamageConfig>

// =======================================
// Armor & Protection
// =======================================

export const ArmorValue = Schema.Number.pipe(Schema.between(0, 20), Schema.brand('ArmorValue'))
export type ArmorValue = Schema.Schema.Type<typeof ArmorValue>

export const ProtectionLevel = Schema.Number.pipe(Schema.between(0, 4), Schema.brand('ProtectionLevel'))
export type ProtectionLevel = Schema.Schema.Type<typeof ProtectionLevel>

// =======================================
// DamageCalculator Service Interface
// =======================================

export interface DamageCalculator {
  readonly calculateDamage: (
    source: DamageSource,
    armor?: ArmorValue,
    protectionLevel?: ProtectionLevel
  ) => Effect.Effect<DamageAmount>

  readonly calculateFallDamage: (height: number) => Effect.Effect<DamageAmount>

  readonly calculateLavaDamage: (duration: number) => Effect.Effect<DamageAmount>

  readonly calculateDrowningDamage: (duration: number) => Effect.Effect<DamageAmount>

  readonly calculateExplosionDamage: (power: number, distance: number) => Effect.Effect<DamageAmount>

  readonly calculateMobDamage: (mobId: unknown, weaponType?: string) => Effect.Effect<DamageAmount>

  readonly applyArmorReduction: (
    damage: DamageAmount,
    armor: ArmorValue,
    protectionLevel?: ProtectionLevel
  ) => Effect.Effect<DamageAmount>
}

export const DamageCalculator = Context.GenericTag<DamageCalculator>('@minecraft/DamageCalculator')

// =======================================
// DamageCalculator Implementation
// =======================================

export const makeDamageCalculator = (
  config: DamageConfig = {
    fallDamageThreshold: 3,
    fallDamageMultiplier: 1,
    lavaDamagePerSecond: 4,
    drowningDamagePerSecond: 2,
    fireDamagePerSecond: 1,
    hungerDamage: 1,
    voidDamage: 4,
    explosionBaseDamage: 7,
  }
): DamageCalculator => {
  const calculateFallDamage = (height: number) =>
    Effect.gen(function* () {
      if (height <= config.fallDamageThreshold) {
        return 0 as DamageAmount
      }

      const damage = Math.floor((height - config.fallDamageThreshold) * config.fallDamageMultiplier)

      return Math.min(damage, 20) as DamageAmount
    })

  const calculateLavaDamage = (duration: number) =>
    Effect.gen(function* () {
      const damage = Math.ceil(duration * config.lavaDamagePerSecond)
      return Math.min(damage, 20) as DamageAmount
    })

  const calculateDrowningDamage = (duration: number) =>
    Effect.gen(function* () {
      const damage = Math.ceil(duration * config.drowningDamagePerSecond)
      return Math.min(damage, 20) as DamageAmount
    })

  const calculateExplosionDamage = (power: number, distance: number) =>
    Effect.gen(function* () {
      const maxDistance = power * 2

      if (distance >= maxDistance) {
        return 0 as DamageAmount
      }

      const distanceRatio = 1 - distance / maxDistance
      const damage = Math.floor(config.explosionBaseDamage * power * distanceRatio)

      return Math.min(damage, 20) as DamageAmount
    })

  const calculateMobDamage = (mobId: unknown, weaponType?: string) =>
    Effect.gen(function* () {
      // Base mob damage (can be extended with mob types)
      let baseDamage = 2

      // Weapon modifier
      const weaponModifier = weaponType === 'sword' ? 1.5 : weaponType === 'axe' ? 1.3 : 1

      const damage = Math.floor(baseDamage * weaponModifier)
      return Math.min(damage, 20) as DamageAmount
    })

  const applyArmorReduction = (
    damage: DamageAmount,
    armor: ArmorValue,
    protectionLevel: ProtectionLevel = 0 as ProtectionLevel
  ) =>
    Effect.gen(function* () {
      // Minecraft armor damage reduction formula
      const armorReduction = armor * 0.04 // 4% per armor point
      const protectionReduction = protectionLevel * 0.04 // 4% per protection level

      const totalReduction = Math.min(
        armorReduction + protectionReduction,
        0.8 // Max 80% reduction
      )

      const reducedDamage = damage * (1 - totalReduction)
      return Math.max(1, Math.floor(reducedDamage)) as DamageAmount
    })

  const calculateDamage = (
    source: DamageSource,
    armor: ArmorValue = 0 as ArmorValue,
    protectionLevel: ProtectionLevel = 0 as ProtectionLevel
  ): Effect.Effect<DamageAmount> =>
    Effect.gen(function* () {
      // Calculate base damage based on source type
      let baseDamage: DamageAmount

      if (source._tag === 'Fall') {
        baseDamage = yield* calculateFallDamage(source.height)
      } else if (source._tag === 'Lava') {
        baseDamage = yield* calculateLavaDamage(source.duration)
      } else if (source._tag === 'Drowning') {
        baseDamage = yield* calculateDrowningDamage(source.duration)
      } else if (source._tag === 'Fire') {
        const damage = Math.ceil(source.duration * config.fireDamagePerSecond)
        baseDamage = Math.min(damage, 20) as DamageAmount
      } else if (source._tag === 'Mob') {
        baseDamage = yield* calculateMobDamage(source.mobId, source.weaponType)
      } else if (source._tag === 'Player') {
        baseDamage = 2 as DamageAmount
      } else if (source._tag === 'Hunger') {
        baseDamage = config.hungerDamage as DamageAmount
      } else if (source._tag === 'Explosion') {
        baseDamage = yield* calculateExplosionDamage(source.power, source.distance)
      } else if (source._tag === 'Void') {
        baseDamage = config.voidDamage as DamageAmount
      } else if (source._tag === 'Magic') {
        baseDamage = 3 as DamageAmount
      } else {
        baseDamage = 1 as DamageAmount
      }

      // Apply armor reduction for physical damage
      const isPhysicalDamage =
        source._tag === 'Fall' || source._tag === 'Mob' || source._tag === 'Player' || source._tag === 'Explosion'

      if (isPhysicalDamage && armor > 0) {
        return yield* applyArmorReduction(baseDamage, armor, protectionLevel)
      }

      return baseDamage
    })

  return {
    calculateDamage,
    calculateFallDamage,
    calculateLavaDamage,
    calculateDrowningDamage,
    calculateExplosionDamage,
    calculateMobDamage,
    applyArmorReduction,
  }
}
