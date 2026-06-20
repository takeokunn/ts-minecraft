import type { Position } from '@ts-minecraft/core'
import { CREEPER_EXPLOSION_POWER, type ExplosionEvent } from '../../domain/explosion'
import { computeExplosionDamageAt } from '../../domain/explosion-resolution'
import { CREEPER_FUSE_SECONDS } from '../../domain/mob/creeper-fuse'
import { EntityType } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'

export type CreeperDetonationResolution = Readonly<{
  damage: number
  explosionEvent: ExplosionEvent
}>

export const resolveCreeperContactDamage = (
  entity: ManagedEntity,
  playerPosition: Position,
): CreeperDetonationResolution | null => {
  if (entity.type !== EntityType.Creeper) return null
  if (entity.fuseSecs < CREEPER_FUSE_SECONDS) return null

  return {
    damage: computeExplosionDamageAt(entity.position, CREEPER_EXPLOSION_POWER, playerPosition),
    explosionEvent: {
      source: 'creeper',
      position: entity.position,
      power: CREEPER_EXPLOSION_POWER,
    },
  }
}
