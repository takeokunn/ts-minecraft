import { Effect, MutableRef, Ref } from 'effect'
import { applyArmorReduction } from '@ts-minecraft/entity/domain/combat-resolution'
import { CHUNK_SIZE, SlotIndex } from '@ts-minecraft/core'
import type { Position } from '@ts-minecraft/core'
import { computeExplosionDamageAt } from '@ts-minecraft/entity/domain/explosion-resolution'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { isBlockSolid as isCachedBlockSolid } from '@ts-minecraft/game'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import { applyExplosionBlockDamage } from '../physics-stage-damage-helpers'
import { hostileDamageMultiplierForDifficulty } from '../physics-stage-damage-logic'
import type { ApplyPlayerDamage } from '../physics-stage-survival/types'
import { blockTypeToIndex } from '@ts-minecraft/core'
import { getParticleUvOffset } from '@ts-minecraft/rendering'

type HostileDamage = {
  contactDamage: number
  rangedDamage: number
  explosionDamage: number
}

type ResolvedHostileDamage = {
  hostileDamage: number
  totalDamage: number
}

const ARMOR_SLOTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'] as const

const applyProtectionToDamage = (
  damage: number,
  armorPoints: number,
  protectionReduction: number,
  extraReduction: number,
): number => applyArmorReduction(damage, armorPoints) * (1 - protectionReduction) * (1 - extraReduction)

export const resolveHostileDamage = (
  rawHostileDamage: HostileDamage,
  armorPoints: number,
  protectionReduction: number,
  projectileProtectionReduction: number,
  blastProtectionReduction: number,
  isBlocking: boolean,
): ResolvedHostileDamage => {
  const scaledContactDamage = rawHostileDamage.contactDamage
  const scaledRangedDamage = rawHostileDamage.rangedDamage
  const scaledExplosionDamage = rawHostileDamage.explosionDamage
  const totalDamage = scaledContactDamage + scaledRangedDamage + scaledExplosionDamage
  const protectedContactDamage = applyProtectionToDamage(scaledContactDamage, armorPoints, protectionReduction, 0)
  const protectedRangedDamage = applyProtectionToDamage(
    scaledRangedDamage,
    armorPoints,
    protectionReduction,
    projectileProtectionReduction,
  )
  const protectedExplosionDamage = applyProtectionToDamage(
    scaledExplosionDamage,
    armorPoints,
    protectionReduction,
    blastProtectionReduction,
  )
  const afterProtection = protectedContactDamage + protectedRangedDamage + protectedExplosionDamage
  const hostileDamage = isBlocking ? afterProtection * 0.34 : afterProtection

  return { hostileDamage, totalDamage }
}

export const scaleHostileDamage = (raw: HostileDamage, multiplier: number): HostileDamage => ({
  contactDamage: raw.contactDamage * multiplier,
  rangedDamage: raw.rangedDamage * multiplier,
  explosionDamage: raw.explosionDamage * multiplier,
})

export const resolveHostileDeathCause = (
  damage: { contactDamage: number; rangedDamage: number; explosionDamage: number },
): 'explosion' | 'projectile' | 'mob' | 'generic' => {
  if (damage.explosionDamage > 0) return 'explosion'
  if (damage.rangedDamage > 0) return 'projectile'
  if (damage.contactDamage > 0) return 'mob'
  return 'generic'
}

const damageShieldIfBlocking = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  scaledHostileDamage: number,
): Effect.Effect<void, never> =>
  !MutableRef.get(refs.isShieldBlockingRef) || scaledHostileDamage <= 0
    ? Effect.void
    : services.hotbarService.getSelectedSlot().pipe(
        Effect.flatMap((shieldSlot) =>
          services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + shieldSlot), 1),
        ),
        Effect.catchAllCause(() => Effect.void),
      )

const damageArmorPieces = (services: PhysicsStageServices): Effect.Effect<void, never> =>
  Effect.forEach(
    ARMOR_SLOTS,
    (slot) => services.equipmentService.damageArmorSlot(slot).pipe(Effect.catchAllCause(() => Effect.void)),
    { discard: true },
  )

const getHostileDamage = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  refreshedPos: Position,
): Effect.Effect<HostileDamage, never> =>
  Effect.gen(function* () {
    const rawHostileDamage: HostileDamage = {
      contactDamage: 0,
      rangedDamage: 0,
      explosionDamage: 0,
    }

    if (inputs.debugFlags['mobs.enabled'] && inputs.debugFlags['mobs.damage']) {
      rawHostileDamage.contactDamage = (yield* services.entityManager.getPlayerContactDamageResolution(refreshedPos)).damage
      const chunkCache = yield* Ref.get(refs.entityPhysicsChunkCacheRef)
      const chunkCoord = yield* Ref.get(refs.lastEntityPhysicsChunkCoordRef)
      const centerCx = Number.isFinite(chunkCoord.cx) ? chunkCoord.cx : Math.floor(refreshedPos.x / CHUNK_SIZE)
      const centerCz = Number.isFinite(chunkCoord.cz) ? chunkCoord.cz : Math.floor(refreshedPos.z / CHUNK_SIZE)
      const isProjectileBlocked = (position: Position): boolean =>
        isCachedBlockSolid(position.x, position.y, position.z, chunkCache, centerCx, centerCz)
      rawHostileDamage.rangedDamage = yield* services.entityManager.getPlayerRangedDamage(
        refreshedPos,
        isProjectileBlocked,
      )

      // Tracer streaks: every landed ranged shot draws a particle line from
      // the shooter to the player — instant-hit shots are otherwise invisible.
      const shotOrigins = yield* services.entityManager.drainPlayerShotOrigins()
      const cameraRotation = shotOrigins.length > 0
        ? yield* services.playerCameraState.getRotation()
        : null
      for (const shot of shotOrigins) {
        // Damage-direction wedge: bearing of the attacker relative to the
        // camera (0 = ahead, positive = clockwise). Redundant channel for the
        // hurt sound, per the accessibility guidelines.
        if (cameraRotation !== null) {
          const dx = shot.x - refreshedPos.x
          const dz = shot.z - refreshedPos.z
          const yaw = cameraRotation.yaw
          const forwardness = -dx * Math.sin(yaw) - dz * Math.cos(yaw)
          const rightness = dx * Math.cos(yaw) - dz * Math.sin(yaw)
          yield* services.damageOverlay.flashDirectional(Math.atan2(rightness, forwardness))
        }
        const uv = getParticleUvOffset(blockTypeToIndex(shot.laser ? 'PRISMARINE' : shot.fire ? 'LAVA' : 'SNOW'))
        // Lasers draw dense enough to read as a solid beam; projectiles stay
        // a sparse streak.
        const TRACER_POINTS = shot.laser ? 12 : 5
        for (let i = 1; i <= TRACER_POINTS; i++) {
          const t = i / (TRACER_POINTS + 1)
          yield* services.particleSystem.spawnBurst(
            shot.x + (refreshedPos.x - shot.x) * t,
            shot.y + (refreshedPos.y + 0.5 - shot.y) * t,
            shot.z + (refreshedPos.z - shot.z) * t,
            uv.u,
            uv.v,
            1,
          )
        }
      }

      // Blaze fireballs set the player on fire: feed the drained ignite seconds
      // into the same burn timer lava uses, so the existing fire-damage cadence
      // and fire-protection reduction apply (see environment-hazards.ts).
      const igniteSecs = yield* services.entityManager.drainPlayerIgniteSecs()
      if (igniteSecs > 0) {
        MutableRef.update(refs.lavaBurnRemainingSecsRef, (remaining) => Math.max(remaining, igniteSecs))
      }

      const explosions = yield* services.entityManager.drainExplosions()
      for (const explosion of explosions) {
        yield* applyExplosionBlockDamage(services, explosion)
        const explosionDamage = computeExplosionDamageAt(explosion.position, explosion.power, refreshedPos)
        rawHostileDamage.explosionDamage += explosionDamage
        rawHostileDamage.contactDamage = Math.max(0, rawHostileDamage.contactDamage - explosionDamage)
      }
    }

    return rawHostileDamage
  })

export const applyHostileDamage = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  refreshedPos: Position,
  armorPoints: number,
  applyDamage: ApplyPlayerDamage,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const rawHostileDamage = yield* getHostileDamage(services, refs, inputs, refreshedPos)
    const difficultyMultiplier = hostileDamageMultiplierForDifficulty(inputs.difficulty)
    const scaledHostileDamage = scaleHostileDamage(rawHostileDamage, difficultyMultiplier)
    const protectionReduction = yield* services.equipmentService.getTotalProtectionReduction()
    const projectileProtectionReduction = yield* services.equipmentService.getTotalProjectileProtectionReduction()
    const blastProtectionReduction = yield* services.equipmentService.getTotalBlastProtectionReduction()
    const resolvedDamage = resolveHostileDamage(
      scaledHostileDamage,
      armorPoints,
      protectionReduction,
      projectileProtectionReduction,
      blastProtectionReduction,
      MutableRef.get(refs.isShieldBlockingRef),
    )

    if (MutableRef.get(refs.isShieldBlockingRef) && resolvedDamage.totalDamage > 0) {
      yield* damageShieldIfBlocking(services, refs, resolvedDamage.totalDamage)
    }

    const tookHostileDamage = yield* applyDamage(
      resolvedDamage.hostileDamage,
      { kind: resolveHostileDeathCause(scaledHostileDamage) },
    )
    if (tookHostileDamage) {
      yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
      if (resolvedDamage.totalDamage > 0) {
        yield* damageArmorPieces(services)
      }
    }
  })
