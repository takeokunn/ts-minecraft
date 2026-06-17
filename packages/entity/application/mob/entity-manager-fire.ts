import type { DeltaTimeSecs } from '@ts-minecraft/core'
import type { ManagedEntity } from '../../domain/mob/entity-internal'

export type FireTick = {
  readonly fireSecsRemaining: number
  readonly fireDamageAccumulatorSecs: number
  readonly damage: number
  readonly changed: boolean
}

export const tickEntityFire = (entity: ManagedEntity, deltaTime: DeltaTimeSecs): FireTick => {
  if (entity.fireSecsRemaining <= 0) {
    return {
      fireSecsRemaining: 0,
      fireDamageAccumulatorSecs: 0,
      damage: 0,
      changed: entity.fireSecsRemaining !== 0 || entity.fireDamageAccumulatorSecs !== 0,
    }
  }

  const fireSecsRemaining = Math.max(0, entity.fireSecsRemaining - deltaTime)
  const activeSecs = entity.fireSecsRemaining - fireSecsRemaining
  const accumulatedSecs = entity.fireDamageAccumulatorSecs + activeSecs
  const damage = Math.floor(accumulatedSecs)

  return {
    fireSecsRemaining,
    fireDamageAccumulatorSecs: fireSecsRemaining > 0 ? accumulatedSecs - damage : 0,
    damage,
    changed: fireSecsRemaining !== entity.fireSecsRemaining,
  }
}
