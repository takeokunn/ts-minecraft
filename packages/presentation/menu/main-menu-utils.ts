import { WorldId } from '@ts-minecraft/core'
import type { GameMode } from '@ts-minecraft/game'

export type SubState = 'root' | 'new-world' | 'load-world'

export const formatLastPlayed = (date: Date): string =>
  Number.isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString()

export const cycleGameMode = (mode: GameMode): GameMode => (mode === 'survival' ? 'creative' : 'survival')

export const generateWorldId = (): WorldId =>
  WorldId.make(`world-${Date.now()}-${Math.floor(Math.random() * 10_000)}`)
