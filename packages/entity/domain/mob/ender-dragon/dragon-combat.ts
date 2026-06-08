import { computeAttackDamage } from '../../combat'
import type { DragonPhase } from './dragon-phase'

export const dragonBreathAttackRange = 6
export const dragonChargeAttackRange = 4

export const dragonDamageMultiplier = (phase: DragonPhase): number =>
  phase === 'Perched' ? 0.25 : 1

export const shouldUseBreathAttack = (
  phase: DragonPhase,
  distanceToPlayer: number,
  randomRoll: number,
): boolean => phase === 'Perched'
  && distanceToPlayer <= dragonBreathAttackRange
  && randomRoll < 0.35

export const computeDragonMeleeDamage = (
  baseDamage: number,
  isCritical: boolean,
  armorPoints: number,
  phase: DragonPhase,
): number => computeAttackDamage(baseDamage, isCritical, armorPoints) * dragonDamageMultiplier(phase)
