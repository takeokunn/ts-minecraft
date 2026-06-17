import { Effect } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import type { ApplyPlayerDamage } from './types'

export const playHurtIfDamaged = (
  services: Pick<PhysicsStageServices, 'soundManager'>,
  position: Position,
  damaged: boolean,
): Effect.Effect<void, never> =>
  damaged
    ? services.soundManager.playEffect('playerHurt', { position })
    : Effect.void

export const applyDamageAndPlayHurt = (
  services: Pick<PhysicsStageServices, 'soundManager'>,
  position: Position,
  applyDamage: ApplyPlayerDamage,
  amount: number,
): Effect.Effect<boolean, never> =>
  applyDamage(amount).pipe(
    Effect.tap((damaged) => playHurtIfDamaged(services, position, damaged)),
  )
