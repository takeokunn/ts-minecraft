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

type HostileDamage = {
  contactDamage: number
  rangedDamage: number
  explosionDamage: number
}

type ResolvedHostileDamage = {
  hostileDamage: number
  scaledHostileDamage: number
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
  const scaledHostileDamage = scaledContactDamage + scaledRangedDamage + scaledExplosionDamage
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

  return { hostileDamage, scaledHostileDamage }
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
  Effect.gen(function* () {
    for (const slot of ARMOR_SLOTS) {
      yield* services.equipmentService.damageArmorSlot(slot).pipe(Effect.catchAllCause(() => Effect.void))
    }
  })

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
      rawHostileDamage.contactDamage = yield* services.entityManager.getPlayerContactDamage(refreshedPos)
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
    }

    if (inputs.debugFlags['mobs.enabled'] && inputs.debugFlags['mobs.damage']) {
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
  applyDamage: (amount: number) => Effect.Effect<boolean, never>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const rawHostileDamage = yield* getHostileDamage(services, refs, inputs, refreshedPos)
    const difficultyMultiplier = hostileDamageMultiplierForDifficulty(inputs.difficulty)
    const scaledHostileDamage = {
      contactDamage: rawHostileDamage.contactDamage * difficultyMultiplier,
      rangedDamage: rawHostileDamage.rangedDamage * difficultyMultiplier,
      explosionDamage: rawHostileDamage.explosionDamage * difficultyMultiplier,
    }
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

    if (MutableRef.get(refs.isShieldBlockingRef) && resolvedDamage.scaledHostileDamage > 0) {
      yield* damageShieldIfBlocking(services, refs, resolvedDamage.scaledHostileDamage)
    }

    const tookHostileDamage = yield* applyDamage(resolvedDamage.hostileDamage)
    if (tookHostileDamage) {
      yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
      if (resolvedDamage.scaledHostileDamage > 0) {
        yield* damageArmorPieces(services)
      }
    }
  })
