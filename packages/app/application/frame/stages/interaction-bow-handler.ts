import { Effect, Option } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
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

// R101: avoid per-kill [] allocation when entity has no drops.
const NO_DROPS: ReadonlyArray<EntityDrop> = []

const applyBowHitToEntity = (
  entityId: EntityIdType,
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: FrameBowInteractionServices,
  opts: { damage: number; hasLooting: Enchantment | undefined; hasPunch: Enchantment | undefined },
) =>
  Effect.gen(function* () {
    const entity = Option.getOrNull(yield* services.entityManager.getEntity(entityId))
    const drops = yield* services.entityManager.applyDamage(entityId, opts.damage)

    if (entity !== null) {
      yield* services.soundManager.playEffect('entityHit', { position: entity.position })
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
    const enchantments = enchantmentsOf(bowStack)

    let hasPower: Enchantment | undefined
    let hasInfinity = false
    let hasLooting: Enchantment | undefined
    let hasPunch: Enchantment | undefined
    let bowUnbreaking: Enchantment | undefined
    for (const enchantment of enchantments) {
      switch (enchantment.type) {
        case 'POWER':
          hasPower = enchantment
          break
        case 'INFINITY':
          hasInfinity = true
          break
        case 'LOOTING':
          hasLooting = enchantment
          break
        case 'PUNCH':
          hasPunch = enchantment
          break
        case 'UNBREAKING':
          bowUnbreaking = enchantment
          break
      }
    }

    // Scale base damage by charge, then apply POWER multiplier.
    const baseDamage = computeBowDamage(charge)
    const damage = hasPower ? Math.round(baseDamage * getPowerDamageMultiplier(hasPower.level)) : baseDamage

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
    // maxDistance = none() (bow ignores block occlusion; it shoots through transparent blocks).
    const targetId = findAttackableEntity(entities, deps.camera, null, BOW_MAX_RANGE)

    const targetIdVal = Option.getOrNull(targetId)
    if (targetIdVal !== null) {
      yield* applyBowHitToEntity(targetIdVal, deps, services, { damage, hasLooting, hasPunch })
    }
  })
