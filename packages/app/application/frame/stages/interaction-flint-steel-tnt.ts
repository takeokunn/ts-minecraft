import type { Position } from '@ts-minecraft/core'
import { TNT_EXPLOSION_POWER } from '@ts-minecraft/entity/domain/explosion'
import { applyExplosionPlayerDamage } from '@ts-minecraft/entity/application/explosion-service'
import type { FrameFlintAndSteelInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/flint-and-steel'

export const applyTntPlayerDamage = (
  services: FrameFlintAndSteelInteractionServices,
  tntPos: Position,
) => applyExplosionPlayerDamage(services, tntPos, TNT_EXPLOSION_POWER)
