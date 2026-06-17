import { HashMap } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { ExplosionEvent } from '../../domain/explosion'
import { EntityType, type EntityId } from '../../domain/mob/entity'
import { HOSTILE_ATTACK_COOLDOWN_SECS, type ManagedEntity } from '../../domain/mob/entity-internal'
import { type ProjectileBlocker } from './entity-manager-projectile'
import { canHostileContactDamagePlayer } from './entity-manager-contact-eligibility'
import { resolveCreeperContactDamage } from './entity-manager-creeper-detonation'
import { canSkeletonShootPlayer } from './entity-manager-skeleton-shot'

export type PlayerContactDamageResolution = Readonly<{
  damage: number
  removed: boolean
  explosions: ReadonlyArray<ExplosionEvent>
}>

export type PlayerRangedDamageResolution = Readonly<{
  damage: number
}>

export const resolvePlayerContactDamage = (
  entities: HashMap.HashMap<EntityId, ManagedEntity>,
  playerPosition: Position,
): readonly [PlayerContactDamageResolution, HashMap.HashMap<EntityId, ManagedEntity>] => {
  let totalDamage = 0
  let updatedEntities = entities
  let touched = false
  let entityRemoved = false
  const explosionEvents: ExplosionEvent[] = []

  HashMap.forEach(entities, (entity) => {
    const creeperDetonation = resolveCreeperContactDamage(entity, playerPosition)
    if (creeperDetonation !== null) {
      totalDamage += creeperDetonation.damage
      explosionEvents.push(creeperDetonation.explosionEvent)
      updatedEntities = HashMap.remove(updatedEntities, entity.entityId)
      touched = true
      entityRemoved = true
      return
    }

    if (!canHostileContactDamagePlayer(entity, playerPosition)) return

    totalDamage += entity.attackDamage
    updatedEntities = HashMap.set(updatedEntities, entity.entityId, {
      ...entity,
      attackCooldownRemaining: HOSTILE_ATTACK_COOLDOWN_SECS,
    })
    touched = true
  })

  return [
    {
      damage: totalDamage,
      removed: entityRemoved,
      explosions: explosionEvents,
    },
    touched ? updatedEntities : entities,
  ]
}

export const resolvePlayerRangedDamage = (
  entities: HashMap.HashMap<EntityId, ManagedEntity>,
  playerPosition: Position,
  isProjectileBlocked?: ProjectileBlocker,
): readonly [PlayerRangedDamageResolution, HashMap.HashMap<EntityId, ManagedEntity>] => {
  let totalDamage = 0
  let updatedEntities = entities
  let touched = false

  HashMap.forEach(entities, (entity) => {
    if (entity.type !== EntityType.Skeleton) return
    if (entity.behavior !== 'hostile' || entity.attackDamage <= 0) return
    if (entity.attackCooldownRemaining > 0) return
    if (!canSkeletonShootPlayer(entity, playerPosition, isProjectileBlocked)) return

    totalDamage += entity.attackDamage
    updatedEntities = HashMap.set(updatedEntities, entity.entityId, {
      ...entity,
      attackCooldownRemaining: HOSTILE_ATTACK_COOLDOWN_SECS,
    })
    touched = true
  })

  return [
    {
      damage: totalDamage,
    },
    touched ? updatedEntities : entities,
  ]
}
