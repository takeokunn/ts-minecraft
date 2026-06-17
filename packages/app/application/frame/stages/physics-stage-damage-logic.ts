import type { GameDifficulty } from '@ts-minecraft/game'

export const hostileDamageMultiplierForDifficulty = (difficulty: GameDifficulty): number => {
  switch (difficulty) {
    case 'peaceful':
      return 0
    case 'easy':
      return 0.5
    case 'normal':
      return 1
    case 'hard':
      return 1.5
  }
}

export const starvationDamageForDifficulty = (difficulty: GameDifficulty, currentHealth: number): number => {
  switch (difficulty) {
    case 'peaceful':
      return 0
    case 'easy':
      return currentHealth > 10 ? Math.min(1, currentHealth - 10) : 0
    case 'normal':
      return currentHealth > 1 ? Math.min(1, currentHealth - 1) : 0
    case 'hard':
      return 1
  }
}
