import type { Position } from '@ts-minecraft/core'
import { tickDragonDeath, type DragonDeathEvent, type DragonDeathPhase } from '../../domain/mob/ender-dragon/dragon-death'

export type DragonDeathSequenceState = {
  readonly progress: number
  readonly phase: DragonDeathPhase
  readonly events: ReadonlyArray<DragonDeathEvent>
}

export const tickDragonDeathSequence = (
  state: Pick<DragonDeathSequenceState, 'progress'>,
  tick: number,
  dragonPosition: Position,
): DragonDeathSequenceState => {
  const step = tickDragonDeath(state.progress, tick, dragonPosition)
  return {
    progress: step.progress,
    phase: step.phase,
    events: step.events,
  }
}
