// Player experience (XP) system — Minecraft Java Edition vanilla formula.
// XP is accumulated as raw points; level is computed from the running total.
//
// XP cost to advance one level (vanilla Java):
//   Level 0-15:  cost = 2*level + 7
//   Level 16-30: cost = 5*level - 38
//   Level 31+:   cost = 9*level - 158

export type PlayerXP = {
  readonly totalXP: number
  readonly level: number
  readonly xpIntoLevel: number       // XP accumulated since last level-up
  readonly xpRequiredForNext: number // XP needed to reach the next level
}

export const xpToNextLevel = (level: number): number => {
  if (level <= 15) return 2 * level + 7
  if (level <= 30) return 5 * level - 38
  return 9 * level - 158
}

export const levelFromXP = (totalXP: number): number => {
  let level = 0
  let accumulated = 0
  while (true) {
    const cost = xpToNextLevel(level)
    if (accumulated + cost > totalXP) break
    accumulated += cost
    level++
  }
  return level
}

export const xpAtLevelStart = (level: number): number => {
  let total = 0
  for (let l = 0; l < level; l++) {
    total += xpToNextLevel(l)
  }
  return total
}

export const buildPlayerXP = (totalXP: number): PlayerXP => {
  const level = levelFromXP(totalXP)
  const levelStart = xpAtLevelStart(level)
  return {
    totalXP,
    level,
    xpIntoLevel: totalXP - levelStart,
    xpRequiredForNext: xpToNextLevel(level),
  }
}

export const addXPToPlayer = (current: PlayerXP, amount: number): PlayerXP =>
  buildPlayerXP(Math.max(0, current.totalXP + amount))

export const INITIAL_PLAYER_XP: PlayerXP = buildPlayerXP(0)
