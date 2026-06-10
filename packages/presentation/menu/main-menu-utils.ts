import { WorldId } from '@ts-minecraft/core'
import type { GameMode } from '@ts-minecraft/game'

export type SubState = 'root' | 'new-world' | 'load-world'

export const formatLastPlayed = (date: Date): string =>
  Number.isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString()

// 3-way cycle: survival → creative → spectator → survival (R2d).
export const cycleGameMode = (mode: GameMode): GameMode =>
  mode === 'survival' ? 'creative' : mode === 'creative' ? 'spectator' : 'survival'

// Human-readable label for a game mode (menu button + world badge).
export const gameModeLabel = (mode: GameMode): string =>
  mode === 'creative' ? 'Creative' : mode === 'spectator' ? 'Spectator' : 'Survival'

export const generateWorldId = (): WorldId =>
  WorldId.make(`world-${Date.now()}-${Math.floor(Math.random() * 10_000)}`)
