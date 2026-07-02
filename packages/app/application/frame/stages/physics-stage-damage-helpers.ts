import { Effect, Option } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameAudioServices } from '@ts-minecraft/app/frame/frame-service-types/audio'
import type { FrameGameplayServices } from '@ts-minecraft/app/frame/frame-service-types/gameplay'
import type { FrameInteractionServices } from '@ts-minecraft/app/frame/frame-service-types/interaction'
import type { FrameLivingServices } from '@ts-minecraft/app/frame/frame-service-types/living'
import type { PlayerDamageCause } from '@ts-minecraft/entity/domain/player-damage-cause'
import type { ExplosionEvent } from '@ts-minecraft/entity/domain/explosion'
import { EXHAUSTION_DAMAGE } from '@ts-minecraft/entity/application/hunger-service.config'
import { buildExplosionBreakPositions } from './placement-geometry'

export type DamageServices = FrameLivingServices

export const tryApplyPlayerDamage = (
  amount: number,
  isSpectatorMode: boolean,
  services: DamageServices,
  cause?: PlayerDamageCause,
): Effect.Effect<boolean, never> => {
  if (amount <= 0 || isSpectatorMode) return Effect.succeed(false)
  return Effect.gen(function* () {
    const health = yield* services.healthService.getHealth()
    if (health.current <= 0 || health.invincibilityTicks > 0) return false
    yield* cause !== undefined
      ? services.healthService.applyDamage(amount, cause)
      : services.healthService.applyDamage(amount)
    yield* services.hungerService.addExhaustion(EXHAUSTION_DAMAGE)
    return true
  })
}

export const applyExplosionBlockDamage = (
  services: Pick<FrameInteractionServices, 'blockService'> &
    Pick<FrameAudioServices, 'soundManager'> &
    Partial<Pick<FrameGameplayServices, 'multiplayer'>>,
  explosion: ExplosionEvent,
): Effect.Effect<void, never> =>
  logErrors(
    Effect.gen(function* () {
      yield* services.soundManager.playEffect('blockBreak', { position: explosion.position })
      // Creeper craters happen on the entity host only (remote copies never
      // arm a fuse) — replicate each broken voxel so peers' worlds converge
      // and the server edit log covers late joiners.
      const multiplayerOrNull = services.multiplayer !== undefined ? Option.getOrNull(services.multiplayer) : null
      for (const pos of buildExplosionBreakPositions(explosion.position, Math.floor(explosion.power))) {
        yield* services.blockService.forceSetBlock(pos, 'AIR').pipe(Effect.catchAll(() => Effect.void))
        yield* multiplayerOrNull?.sendBlockBreak(pos) ?? Effect.void
      }
    }),
    'Explosion block damage error',
  )
