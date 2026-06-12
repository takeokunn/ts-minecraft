import { Array as Arr, Effect, Option } from 'effect'
import type { FrameHandlerDeps, FrameHandlerServices } from '@ts-minecraft/app/frame/types'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import { SlotIndex } from '@ts-minecraft/core'
import type { EntityDrop, EntityId as EntityIdType } from '@ts-minecraft/entity'
import { computeKnockback, computeBowCharge, computeBowDamage, canFireBow, BOW_MAX_RANGE, getMobDefinition, dropPasses } from '@ts-minecraft/entity'
import { HOTBAR_START, getPowerDamageMultiplier, getUnbreakingSkipChance, getPunchKnockbackBonus, enchantmentsOf } from '@ts-minecraft/inventory'
import type { Enchantment } from '@ts-minecraft/inventory'

// R101: avoid per-kill [] allocation when entity has no drops.
const NO_DROPS: ReadonlyArray<EntityDrop> = []

const applyBowHitToEntity = (
  entityId: EntityIdType,
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<FrameHandlerServices, 'entityManager' | 'soundManager' | 'inventoryService' | 'xpService'>,
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
    const rolledBowDrops = Arr.filter(Option.getOrElse(drops, () => NO_DROPS), (drop) => dropPasses(drop, Math.random()))
    for (const drop of rolledBowDrops) {
      yield* services.inventoryService.addBlock(drop.blockType, drop.count)
    }

    // Looting on bow kills: same bonus-drop mechanic as melee.
    if (rolledBowDrops.length > 0 && opts.hasLooting) {
      for (const drop of rolledBowDrops) {
        yield* services.inventoryService.addBlock(drop.blockType, opts.hasLooting!.level)
          .pipe(Effect.catchAllCause(() => Effect.void))
      }
    }

    // Award mob XP on kill (drops is Some when the entity was removed).
    if (Option.isSome(drops) && entity !== null) {
      const xpReward = getMobDefinition(entity.type).xpReward
      if (xpReward > 0) yield* services.xpService.addXP(xpReward)
    }
  })

// Called when the player releases right-click while holding a BOW. Fires a
// hitscan ray up to BOW_MAX_RANGE blocks, consuming 1 ARROW and dealing
// charge-scaled damage to the first entity in the crosshair.
export const handleBowFire = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<
    FrameHandlerServices,
    'inventoryService' | 'hotbarService' | 'entityManager' | 'soundManager' | 'xpService'
  >,
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

    const hasPower = enchantments.find((e) => e.type === 'POWER')
    const hasInfinity = enchantments.some((e) => e.type === 'INFINITY')
    const hasLooting = enchantments.find((e) => e.type === 'LOOTING')
    const hasPunch = enchantments.find((e) => e.type === 'PUNCH')

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
    const bowUnbreaking = enchantments.find((e) => e.type === 'UNBREAKING')
    const skipBowDurability = bowUnbreaking ? Math.random() < getUnbreakingSkipChance(bowUnbreaking.level) : false
    if (!skipBowDurability) {
      yield* services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + selectedSlot), 1)
    }

    // Hitscan: find the nearest entity in the crosshair within bow range.
    // maxDistance = none() (bow ignores block occlusion; it shoots through transparent blocks).
    const targetId = findAttackableEntity(entities, deps.camera, Option.none(), BOW_MAX_RANGE)

    const targetIdVal = Option.getOrNull(targetId)
    if (targetIdVal !== null) {
      yield* applyBowHitToEntity(targetIdVal, deps, services, { damage, hasLooting, hasPunch })
    }
  })
