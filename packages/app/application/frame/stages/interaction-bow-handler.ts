import { Effect, Option } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import { readBlockTypeAt } from '@ts-minecraft/app/application/frame/stages/interaction-block-access'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import { SlotIndex } from '@ts-minecraft/core'
import type { EntityDrop } from '@ts-minecraft/entity/domain/mob/drop'
import type { EntityId as EntityIdType } from '@ts-minecraft/entity/domain/mob/entity'
import { computeKnockback } from '@ts-minecraft/entity/domain/combat-resolution'
import { BOW_MAX_RANGE } from '@ts-minecraft/entity/domain/bow.config'
import { canFireBow, computeBowCharge, computeBowDamage } from '@ts-minecraft/entity/domain/bow-resolution'
import { dropPasses } from '@ts-minecraft/entity/domain/mob/drop'
import { getMobDefinition } from '@ts-minecraft/entity/domain/mob/mobs/get-mob-definition'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { getPowerDamageMultiplier, getUnbreakingSkipChance, getPunchKnockbackBonus } from '@ts-minecraft/inventory/domain/enchantment'
import type { Enchantment } from '@ts-minecraft/inventory/domain/enchantment.types'
import { enchantmentsOf } from '@ts-minecraft/inventory/domain/item-stack'
import type { FrameBowInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/bow'
import { spawnMobDrop, spawnMobXpOrb } from '@ts-minecraft/app/application/frame/stages/interaction-mob-drops'
import { isPassableBlockType } from '@ts-minecraft/game/domain/block-collision-predicates'
import * as THREE from 'three'
import { blockTypeToIndex } from '@ts-minecraft/core'
import { getParticleUvOffset } from '@ts-minecraft/rendering'

// Module scratch for the tracer direction (render loop is single-fiber).
const scratchBowDirection = new THREE.Vector3()

type BowEnchantments = {
  readonly hasPower: Enchantment | undefined
  readonly hasInfinity: boolean
  readonly hasLooting: Enchantment | undefined
  readonly hasPunch: Enchantment | undefined
  readonly bowUnbreaking: Enchantment | undefined
}

export const resolveBowEnchantments = (enchantments: ReadonlyArray<Enchantment>): BowEnchantments => {
  let hasPower: Enchantment | undefined
  let hasInfinity = false
  let hasLooting: Enchantment | undefined
  let hasPunch: Enchantment | undefined
  let bowUnbreaking: Enchantment | undefined
  for (const enchantment of enchantments) {
    switch (enchantment.type) {
      case 'POWER': hasPower = enchantment; break
      case 'INFINITY': hasInfinity = true; break
      case 'LOOTING': hasLooting = enchantment; break
      case 'PUNCH': hasPunch = enchantment; break
      case 'UNBREAKING': bowUnbreaking = enchantment; break
    }
  }
  return { hasPower, hasInfinity, hasLooting, hasPunch, bowUnbreaking }
}

export const resolveBowDamage = (
  charge: number,
  powerEnchant: Enchantment | undefined,
): number => {
  const baseDamage = computeBowDamage(charge)
  return powerEnchant ? Math.round(baseDamage * getPowerDamageMultiplier(powerEnchant.level)) : baseDamage
}

// R101: avoid per-kill [] allocation when entity has no drops.
const NO_DROPS: ReadonlyArray<EntityDrop> = []
const ENTITY_CENTER_Y_OFFSET = 0.9
const BOW_LOS_STEP = 0.1
const BOW_LOS_COORD_EPSILON = 1e-6

const isBowShotBlockedByTerrain = (
  services: Pick<FrameBowInteractionServices, 'chunkManagerService'>,
  from: { readonly x: number; readonly y: number; readonly z: number },
  to: { readonly x: number; readonly y: number; readonly z: number },
) =>
  Effect.gen(function* () {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dz = to.z - from.z
    const distance = Math.hypot(dx, dy, dz)
    if (distance <= 0) return false

    const steps = Math.max(1, Math.ceil(distance / BOW_LOS_STEP))
    for (let i = 1; i < steps; i++) {
      const t = (i * BOW_LOS_STEP) / distance
      if (t >= 1) break
      const blockType = yield* readBlockTypeAt(services.chunkManagerService, {
        x: Math.floor(from.x + dx * t + BOW_LOS_COORD_EPSILON),
        y: Math.floor(from.y + dy * t + BOW_LOS_COORD_EPSILON),
        z: Math.floor(from.z + dz * t + BOW_LOS_COORD_EPSILON),
      })
      if (!isPassableBlockType(blockType)) return true
    }

    return false
  }).pipe(
    Effect.catchAll(() => Effect.succeed(false)),
  )

const applyBowHitToEntity = (
  entityId: EntityIdType,
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: FrameBowInteractionServices,
  opts: { damage: number; hasLooting: Enchantment | undefined; hasPunch: Enchantment | undefined },
) =>
  Effect.gen(function* () {
    const entity = Option.getOrNull(yield* services.entityManager.getEntity(entityId))
    if (entity !== null) {
      const blocked = yield* isBowShotBlockedByTerrain(services, deps.camera.position, {
        x: entity.position.x,
        y: entity.position.y + ENTITY_CENTER_Y_OFFSET,
        z: entity.position.z,
      })
      if (blocked) return
    }

    const drops = yield* services.entityManager.applyDamage(entityId, opts.damage)

    if (entity !== null) {
      yield* services.soundManager.playEffect('entityHit', { position: entity.position })
      yield* services.crosshair.pulse()
    }

    // PUNCH: apply horizontal knockback on arrow hit when entity survived.
    if (opts.hasPunch && entity !== null && Option.isNone(drops)) {
      const base = computeKnockback(
        entity.position.x - deps.camera.position.x,
        entity.position.z - deps.camera.position.z,
      )
      const punchBonus = getPunchKnockbackBonus(opts.hasPunch.level)
      const mult = 1 + punchBonus / 5
      yield* services.entityManager.applyKnockback(entityId, { x: base.x * mult, y: base.y, z: base.z * mult })
    }

    // Roll each chance-gated drop once; un-gated drops always pass.
    const sourceDrops = Option.isNone(drops) ? NO_DROPS : drops.value
    let rolledBowDrops: EntityDrop[] | null = null
    for (const drop of sourceDrops) {
      if (!dropPasses(drop, Math.random())) continue
      if (rolledBowDrops === null) rolledBowDrops = []
      rolledBowDrops.push(drop)
      if (entity !== null) {
        yield* spawnMobDrop(services, entity, drop)
      }
    }

    // Looting on bow kills: same bonus-drop mechanic as melee.
    if (rolledBowDrops !== null && opts.hasLooting) {
      for (const drop of rolledBowDrops) {
        if (entity !== null) {
          yield* spawnMobDrop(services, entity, drop, opts.hasLooting.level)
        }
      }
    }

    // Award mob XP on kill (drops is Some when the entity was removed).
    if (Option.isSome(drops) && entity !== null) {
      const xpReward = getMobDefinition(entity.type).xpReward
      yield* spawnMobXpOrb(services, entity, xpReward)
    }
  })

// Called when the player releases right-click while holding a BOW. Fires a
// hitscan ray up to BOW_MAX_RANGE blocks, consuming 1 ARROW and dealing
// charge-scaled damage to the first entity in the crosshair.
export const handleBowFire = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: FrameBowInteractionServices,
  entities: Parameters<typeof findAttackableEntity>[0],
  context: {
    readonly chargeStartSecs: number
    readonly nowSecs: number
  },
) =>
  Effect.gen(function* () {
    const secsHeld = context.nowSecs - context.chargeStartSecs
    if (!canFireBow(secsHeld)) return

    const charge = computeBowCharge(secsHeld)

    // Read bow enchantments before consuming the arrow (slot still intact here).
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const bowStack = yield* services.inventoryService.getSlot(SlotIndex.make(HOTBAR_START + selectedSlot))
    const { hasPower, hasInfinity, hasLooting, hasPunch, bowUnbreaking } = resolveBowEnchantments(enchantmentsOf(bowStack))

    const damage = resolveBowDamage(charge, hasPower)

    // INFINITY skips arrow consumption. Without it, consume 1 ARROW (silent abort if empty).
    if (!hasInfinity) {
      const arrowConsumed = yield* Effect.gen(function* () {
        yield* services.inventoryService.removeBlock('ARROW', 1)
        return true
      }).pipe(Effect.orElse(() => Effect.succeed(false)))
      if (!arrowConsumed) return
    }

    // Damage the equipped bow (INFINITY still wears the bow down — vanilla behaviour).
    // UNBREAKING: skip durability loss with probability getUnbreakingSkipChance(level).
    const skipBowDurability = bowUnbreaking ? Math.random() < getUnbreakingSkipChance(bowUnbreaking.level) : false
    if (!skipBowDurability) {
      yield* services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + selectedSlot), 1)
    }

    // Hitscan: find the nearest entity in the crosshair within bow range.
    const targetId = findAttackableEntity(entities, deps.camera, null, BOW_MAX_RANGE)

    const targetIdVal = Option.getOrNull(targetId)
    // Tracer streak along the arrow's flight line — the hitscan arrow is
    // otherwise invisible. On a hit the streak stops at the target; on a
    // miss it flies the full range.
    deps.camera.getWorldDirection(scratchBowDirection)
    const target = targetIdVal !== null ? entities.find((entity) => entity.entityId === targetIdVal) : undefined
    const tracerRange = target !== undefined
      ? Math.min(
          BOW_MAX_RANGE,
          Math.hypot(
            target.position.x - deps.camera.position.x,
            target.position.y - deps.camera.position.y,
            target.position.z - deps.camera.position.z,
          ),
        )
      : BOW_MAX_RANGE
    const arrowUv = getParticleUvOffset(blockTypeToIndex('SNOW'))
    const TRACER_POINTS = 6
    for (let i = 1; i <= TRACER_POINTS; i++) {
      const t = (i / TRACER_POINTS) * tracerRange
      yield* services.particleSystem.spawnBurst(
        deps.camera.position.x + scratchBowDirection.x * t,
        deps.camera.position.y + scratchBowDirection.y * t,
        deps.camera.position.z + scratchBowDirection.z * t,
        arrowUv.u,
        arrowUv.v,
        1,
      )
    }

    if (targetIdVal !== null) {
      yield* applyBowHitToEntity(targetIdVal, deps, services, { damage, hasLooting, hasPunch })
    }
  })
