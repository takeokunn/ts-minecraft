import { WorldId } from '@ts-minecraft/core'
import type { GameMode } from '@ts-minecraft/game'

export type SubState = 'root' | 'new-world' | 'load-world'

const WORLD_SEED_MODULUS = 0x1_0000_0000

const normalizeWorldSeed = (seed: number): number =>
  Number.isFinite(seed)
    ? ((Math.trunc(seed) % WORLD_SEED_MODULUS) + WORLD_SEED_MODULUS) % WORLD_SEED_MODULUS
    : 0

const hashWorldSeedText = (value: string): number => {
  let hash = 2_166_136_261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

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

export const parseWorldSeedInput = (input: string): number | undefined => {
  const trimmed = input.trim()
  if (trimmed.length === 0) return undefined
  if (/^[+-]?\d+$/.test(trimmed)) return normalizeWorldSeed(Number(trimmed))
  return hashWorldSeedText(trimmed)
}
