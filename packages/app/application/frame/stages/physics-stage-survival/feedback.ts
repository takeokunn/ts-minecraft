import { Effect } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { PlayerDamageCause } from '@ts-minecraft/entity/domain/player-damage-cause'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import type { ApplyPlayerDamage } from './types'

export const playHurtIfDamaged = (
  services: Pick<PhysicsStageServices, 'soundManager' | 'damageOverlay'>,
  position: Position,
  damaged: boolean,
): Effect.Effect<void, never> =>
  damaged
    ? services.soundManager.playEffect('playerHurt', { position }).pipe(
      Effect.zipRight(services.damageOverlay.flash()),
    )
    : Effect.void

export const applyDamageAndPlayHurt = (
  services: Pick<PhysicsStageServices, 'soundManager' | 'damageOverlay'>,
  position: Position,
  applyDamage: ApplyPlayerDamage,
  amount: number,
  cause?: PlayerDamageCause,
): Effect.Effect<boolean, never> =>
  applyDamage(amount, cause).pipe(
    Effect.tap((damaged) => playHurtIfDamaged(services, position, damaged)),
  )
