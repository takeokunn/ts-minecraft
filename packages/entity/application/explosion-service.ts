import { Effect } from 'effect'
import { DEFAULT_PLAYER_ID, type PlayerId, type Position } from '@ts-minecraft/core'
import { applyArmorReduction } from '../domain/combat-resolution'
import { computeExplosionDamageAt } from '../domain/explosion-resolution'
import type { PlayerHealth } from '../domain/player-health'
import type { PlayerDamageCause } from '../domain/player-damage-cause'
import { EXHAUSTION_DAMAGE } from './hunger-service.config'

const EXPLOSION_DAMAGE_CAUSE: PlayerDamageCause = { kind: 'explosion' }

type ExplosionPlayerDamageServices = {
  readonly gameMode: { isSpectator: () => Effect.Effect<boolean, never> }
  readonly gameState: { getPlayerPosition: (id: PlayerId) => Effect.Effect<Position, unknown> }
  readonly healthService: {
    getHealth: () => Effect.Effect<PlayerHealth, never>
    applyDamage: (amount: number, cause?: PlayerDamageCause) => Effect.Effect<void, never>
  }
  readonly hungerService: { addExhaustion: (amount: number) => Effect.Effect<void, never> }
  readonly equipmentService: {
    getTotalArmorPoints: () => Effect.Effect<number, never>
    getTotalProtectionReduction: () => Effect.Effect<number, never>
    getTotalBlastProtectionReduction: () => Effect.Effect<number, never>
  }
  readonly soundManager: {
    playEffect: (effect: 'playerHurt', options?: { readonly position?: Position }) => Effect.Effect<void, never>
  }
}

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

    yield* services.healthService.applyDamage(damage, EXPLOSION_DAMAGE_CAUSE)
    yield* services.hungerService.addExhaustion(EXHAUSTION_DAMAGE)
    yield* services.soundManager.playEffect('playerHurt', { position: playerPos })
    return true
  })
