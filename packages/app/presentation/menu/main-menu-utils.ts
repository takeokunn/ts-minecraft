import { WorldId } from '@ts-minecraft/kernel'
import type { GameMode } from '@ts-minecraft/game'

export type SubState = 'root' | 'new-world' | 'load-world'

export const formatLastPlayed = (date: Date): string => {
  try {
    return date.toLocaleString()
  } catch {
    return date.toISOString()
  }
}

export const cycleGameMode = (mode: GameMode): GameMode => (mode === 'survival' ? 'creative' : 'survival')

export const generateWorldId = (): WorldId =>
  WorldId.make(`world-${Date.now()}-${Math.floor(Math.random() * 10_000)}`)
