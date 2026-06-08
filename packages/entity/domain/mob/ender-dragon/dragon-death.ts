import type { Position } from '@ts-minecraft/core'

export enum DragonDeathPhase {
  Dying = 'Dying',
  Exploding = 'Exploding',
  EggSpawn = 'EggSpawn',
  PortalActivate = 'PortalActivate',
  XPFountain = 'XPFountain',
  Complete = 'Complete',
}

export const DEATH_ANIMATION_TICKS = 200
export const DRAGON_DEATH_XP_TOTAL = 12000
export const DRAGON_EGG_POSITION: Position = { x: 0, y: 65, z: 0 }
export const RETURN_PORTAL_POSITION: Position = { x: 0, y: 64, z: 0 }

export type DragonDeathEvent =
  | {
    readonly type: 'Dying'
    readonly liftTowardSky: true
    readonly flashes: true
    readonly position: Position
  }
  | {
    readonly type: 'Exploding'
    readonly rapidFlashes: true
    readonly explodes: boolean
    readonly position: Position
  }
  | {
    readonly type: 'DragonEggSpawn'
    readonly blockType: 'DRAGON_EGG'
    readonly position: Position
  }
  | {
    readonly type: 'ReturnPortalActivate'
    readonly blockType: 'END_PORTAL'
    readonly position: Position
    readonly emissive: true
    readonly canEnter: true
  }
  | {
    readonly type: 'XPFountain'
    readonly amount: number
    readonly total: typeof DRAGON_DEATH_XP_TOTAL
    readonly position: Position
  }
  | { readonly type: 'Complete'; readonly removeDragon: true }

export type DragonDeathTick = {
  readonly phase: DragonDeathPhase
  readonly progress: number
  readonly events: ReadonlyArray<DragonDeathEvent>
}

const XP_FOUNTAIN_START = 160
const XP_FOUNTAIN_TICKS = DEATH_ANIMATION_TICKS - XP_FOUNTAIN_START
const XP_PER_TICK = DRAGON_DEATH_XP_TOTAL / XP_FOUNTAIN_TICKS

export const dragonDeathPhaseForProgress = (progress: number): DragonDeathPhase => {
  if (progress < 80) return DragonDeathPhase.Dying
  if (progress < 120) return DragonDeathPhase.Exploding
  if (progress < 140) return DragonDeathPhase.EggSpawn
  if (progress < 160) return DragonDeathPhase.PortalActivate
  if (progress < DEATH_ANIMATION_TICKS) return DragonDeathPhase.XPFountain
  return DragonDeathPhase.Complete
}

export const tickDragonDeath = (
  progress: number,
  tick: number,
  dragonPosition: Position = RETURN_PORTAL_POSITION,
): DragonDeathTick => {
  const elapsed = Math.max(0, Math.floor(progress))
  const phase = dragonDeathPhaseForProgress(elapsed)
  const nextProgress = Math.min(DEATH_ANIMATION_TICKS, elapsed + 1)

  switch (phase) {
    case DragonDeathPhase.Dying:
      return {
        phase,
        progress: nextProgress,
        events: [{ type: 'Dying', liftTowardSky: true, flashes: true, position: dragonPosition }],
      }
    case DragonDeathPhase.Exploding:
      return {
        phase,
        progress: nextProgress,
        events: [{ type: 'Exploding', rapidFlashes: true, explodes: elapsed >= 119, position: dragonPosition }],
      }
    case DragonDeathPhase.EggSpawn:
      return {
        phase,
        progress: nextProgress,
        events: elapsed === 120
          ? [{ type: 'DragonEggSpawn', blockType: 'DRAGON_EGG', position: DRAGON_EGG_POSITION }]
          : [],
      }
    case DragonDeathPhase.PortalActivate:
      return {
        phase,
        progress: nextProgress,
        events: elapsed === 140
          ? [{
            type: 'ReturnPortalActivate',
            blockType: 'END_PORTAL',
            position: RETURN_PORTAL_POSITION,
            emissive: true,
            canEnter: true,
          }]
          : [],
      }
    case DragonDeathPhase.XPFountain:
      return {
        phase,
        progress: nextProgress,
        events: [{
          type: 'XPFountain',
          amount: Math.min(XP_PER_TICK, DRAGON_DEATH_XP_TOTAL - (elapsed - XP_FOUNTAIN_START) * XP_PER_TICK),
          total: DRAGON_DEATH_XP_TOTAL,
          position: dragonPosition,
        }],
      }
    case DragonDeathPhase.Complete:
      return { phase, progress: DEATH_ANIMATION_TICKS, events: tick >= 0 ? [{ type: 'Complete', removeDragon: true }] : [] }
  }
}
