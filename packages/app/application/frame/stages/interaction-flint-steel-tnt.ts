import type { Position } from '@ts-minecraft/core'
import { TNT_EXPLOSION_POWER } from '@ts-minecraft/entity/domain/explosion'
import { applyExplosionPlayerDamage } from '@ts-minecraft/entity/application/explosion-service'
import type { FrameFlintAndSteelInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/flint-and-steel'

// Only the explosion-damage slice — lets callers without the full flint&steel
// service surface (e.g. dispensers) reuse the blast.
export type TntPlayerDamageServices = Pick<
  FrameFlintAndSteelInteractionServices,
  'gameMode' | 'gameState' | 'healthService' | 'hungerService' | 'equipmentService' | 'soundManager'
>

export const applyTntPlayerDamage = (
  services: TntPlayerDamageServices,
  tntPos: Position,
) => applyExplosionPlayerDamage(services, tntPos, TNT_EXPLOSION_POWER)
