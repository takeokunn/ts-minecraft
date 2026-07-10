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

// Seconds of burning a landed Blaze fireball inflicts on the player (vanilla: 5s).
export const BLAZE_IGNITE_SECS = 5

export type PlayerShotOrigin = Readonly<{
  readonly x: number
  readonly y: number
  readonly z: number
  // Fire shots (Blaze/Ghast fireballs) trace in lava tint; arrows in white.
  readonly fire: boolean
  // Guardian beams trace as a dense prismarine-tinted line (solid beam look).
  readonly laser: boolean
}>

type PlayerRangedDamageResolution = Readonly<{
  damage: number
  // Seconds of player burn inflicted by fire-based shooters (Blaze). 0 when no
  // igniting shot landed this resolution.
  igniteSecs: number
  readonly shotOrigins: ReadonlyArray<PlayerShotOrigin>
}>

export const resolvePlayerContactDamage = (
  entities: HashMap.HashMap<EntityId, ManagedEntity>,
  playerPosition: Position,
): readonly [PlayerContactDamageResolution, HashMap.HashMap<EntityId, ManagedEntity>] => {
  let totalDamage = 0
  let updatedEntities = entities
  let anyEntityModified = false
  let entityRemoved = false
  const explosionEvents: ExplosionEvent[] = []

  HashMap.forEach(entities, (entity) => {
    const creeperDetonation = resolveCreeperContactDamage(entity, playerPosition)
    if (creeperDetonation !== null) {
      totalDamage += creeperDetonation.damage
      explosionEvents.push(creeperDetonation.explosionEvent)
      updatedEntities = HashMap.remove(updatedEntities, entity.entityId)
      anyEntityModified = true
      entityRemoved = true
      return
    }

    if (!canHostileContactDamagePlayer(entity, playerPosition)) return

    totalDamage += entity.attackDamage
    updatedEntities = HashMap.set(updatedEntities, entity.entityId, {
      ...entity,
      attackCooldownRemaining: HOSTILE_ATTACK_COOLDOWN_SECS,
    })
    anyEntityModified = true
  })

  return [
    {
      damage: totalDamage,
      removed: entityRemoved,
      explosions: explosionEvents,
    },
    anyEntityModified ? updatedEntities : entities,
  ]
}

export const resolvePlayerRangedDamage = (
  entities: HashMap.HashMap<EntityId, ManagedEntity>,
  playerPosition: Position,
  isProjectileBlocked?: ProjectileBlocker,
): readonly [PlayerRangedDamageResolution, HashMap.HashMap<EntityId, ManagedEntity>] => {
  let totalDamage = 0
  let igniteSecs = 0
  const shotOrigins: Array<PlayerShotOrigin> = []
  let updatedEntities = entities
  let anyEntityModified = false

  HashMap.forEach(entities, (entity) => {
    if (entity.type !== EntityType.Skeleton && entity.type !== EntityType.Blaze && entity.type !== EntityType.Ghast && entity.type !== EntityType.Guardian) return
    if (entity.behavior !== 'hostile' || entity.attackDamage <= 0) return
    if (entity.attackCooldownRemaining > 0) return
    if (!canSkeletonShootPlayer(entity, playerPosition, isProjectileBlocked)) return

    totalDamage += entity.attackDamage
    const isFireShot = entity.type === EntityType.Blaze || entity.type === EntityType.Ghast
    const isLaserShot = entity.type === EntityType.Guardian
    // Tracer origin for the frame layer: shots are instant-hit, the visual
    // streak from shooter to player is drawn by the app.
    shotOrigins.push({ x: entity.position.x, y: entity.position.y + 0.5, z: entity.position.z, fire: isFireShot, laser: isLaserShot })
    // Fire-based shooters: a landed fireball also sets the player burning.
    if (isFireShot) {
      igniteSecs = Math.max(igniteSecs, BLAZE_IGNITE_SECS)
    }
    updatedEntities = HashMap.set(updatedEntities, entity.entityId, {
      ...entity,
      attackCooldownRemaining: HOSTILE_ATTACK_COOLDOWN_SECS,
    })
    anyEntityModified = true
  })

  return [
    {
      damage: totalDamage,
      igniteSecs,
      shotOrigins,
    },
    anyEntityModified ? updatedEntities : entities,
  ]
}
