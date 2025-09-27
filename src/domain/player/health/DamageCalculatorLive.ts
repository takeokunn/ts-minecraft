import { Layer } from 'effect'
import { DamageCalculator, makeDamageCalculator } from './DamageCalculator'

// Default configuration for damage calculation
const defaultDamageConfig = {
  fallDamageThreshold: 3,
  fallDamageMultiplier: 1,
  lavaDamagePerSecond: 4,
  drowningDamagePerSecond: 2,
  fireDamagePerSecond: 1,
  hungerDamage: 1,
  voidDamage: 4,
  explosionBaseDamage: 7,
}

export const DamageCalculatorLive = Layer.succeed(DamageCalculator, makeDamageCalculator(defaultDamageConfig))
