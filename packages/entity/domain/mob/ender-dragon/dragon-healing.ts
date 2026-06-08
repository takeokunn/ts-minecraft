import { distance, type Position } from '@ts-minecraft/core'

export const DRAGON_HEAL_RATE = 1
export const CRYSTAL_HEAL_RANGE = 16
export const MAX_DRAGON_HEALTH = 200

export const computeCrystalHealing = (
  crystalPositions: ReadonlyArray<Position>,
  dragonPosition: Position,
  currentHealth: number,
): { readonly newHealth: number; readonly crystalsUsed: number } => {
  const crystalsUsed = crystalPositions.filter((crystal) =>
    distance(crystal, dragonPosition) <= CRYSTAL_HEAL_RANGE
  ).length
  const newHealth = Math.min(MAX_DRAGON_HEALTH, currentHealth + crystalsUsed * DRAGON_HEAL_RATE)
  return { newHealth, crystalsUsed }
}
