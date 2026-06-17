import { distance, type Position } from '@ts-minecraft/core'

export const DRAGON_HEAL_RATE = 1
export const CRYSTAL_HEAL_RANGE = 16
export const MAX_DRAGON_HEALTH = 200

export const computeCrystalHealing = (
  crystalPositions: ReadonlyArray<Position>,
  dragonPosition: Position,
  currentHealth: number,
): { readonly newHealth: number; readonly crystalsUsed: number } => {
  let crystalsUsed = 0
  for (const crystal of crystalPositions) {
    if (distance(crystal, dragonPosition) <= CRYSTAL_HEAL_RANGE) {
      crystalsUsed++
    }
  }
  const newHealth = Math.min(MAX_DRAGON_HEALTH, currentHealth + crystalsUsed * DRAGON_HEAL_RATE)
  return { newHealth, crystalsUsed }
}
