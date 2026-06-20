import { Effect } from 'effect'
import { DEFAULT_PLAYER_ID, type Position } from '@ts-minecraft/core'
import { EXHAUSTION_DAMAGE } from '@ts-minecraft/entity/application/hunger-service.config'
import { applyArmorReduction } from '@ts-minecraft/entity/domain/combat-resolution'
import { TNT_EXPLOSION_POWER } from '@ts-minecraft/entity/domain/explosion'
import { computeExplosionDamageAt } from '@ts-minecraft/entity/domain/explosion-resolution'
import type { FrameFlintAndSteelInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/flint-and-steel'

type ExplosionPlayerDamageServices = Pick<
  FrameFlintAndSteelInteractionServices,
  'gameMode' | 'healthService' | 'gameState' | 'equipmentService' | 'hungerService' | 'soundManager'
>

export const applyExplosionPlayerDamage = (
  services: ExplosionPlayerDamageServices,
  explosionPos: Position,
  power: number,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const isSpectator = yield* services.gameMode.isSpectator()
    if (isSpectator) return false

    const health = yield* services.healthService.getHealth()
    if (health.current <= 0 || health.invincibilityTicks > 0) return false

    const playerPos = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (playerPos === null) return false

    const rawDamage = computeExplosionDamageAt(explosionPos, power, playerPos)
    if (rawDamage <= 0) return false

    const armorPoints = yield* services.equipmentService.getTotalArmorPoints()
    const protectionReduction = yield* services.equipmentService.getTotalProtectionReduction()
    const blastProtectionReduction = yield* services.equipmentService.getTotalBlastProtectionReduction()
    const damage = applyArmorReduction(rawDamage, armorPoints) * (1 - protectionReduction) * (1 - blastProtectionReduction)
    if (damage <= 0) return false

    yield* services.healthService.applyDamage(damage)
    yield* services.hungerService.addExhaustion(EXHAUSTION_DAMAGE)
    yield* services.soundManager.playEffect('playerHurt', { position: playerPos })
    return true
  })

export const applyTntPlayerDamage = (
  services: FrameFlintAndSteelInteractionServices,
  tntPos: Position,
): Effect.Effect<boolean, never> => applyExplosionPlayerDamage(services, tntPos, TNT_EXPLOSION_POWER)
