import { Effect, MutableRef, Option, Schema } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import { blockTypeToIndex, SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import { isDurable } from '@ts-minecraft/inventory/domain/durability'
import { getFireAspectDurationSecs, getKnockbackHorizontalMultiplier, getUnbreakingSkipChance } from '@ts-minecraft/inventory/domain/enchantment'
import { enchantmentsOf } from '@ts-minecraft/inventory/domain/item-stack'
import type { Entity } from '@ts-minecraft/entity/domain/mob/entity'
import type { EntityDrop } from '@ts-minecraft/entity/domain/mob/drop'
import {
  computeAttackDamage,
  computeKnockback,
  computeAttackCharge,
  computeChargedDamage,
  getWeaponBaseDamage,
  computeWeaponEnchantBonus,
  computeAttackKnockbackHorizontalMultiplier,
} from '@ts-minecraft/entity/domain/combat-resolution'
import { DEFAULT_ATTACK_COOLDOWN_SECS } from '@ts-minecraft/entity/domain/combat.config'
import { EXHAUSTION_ATTACK } from '@ts-minecraft/entity/application/hunger-service.config'
import { dropPasses } from '@ts-minecraft/entity/domain/mob/drop'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { getMobDefinition } from '@ts-minecraft/entity/domain/mob/mobs/get-mob-definition'
import { getParticleUvOffset } from '@ts-minecraft/rendering'
import { triggerAttackSwing } from '@ts-minecraft/presentation'
import { ENTITY_CENTER_Y_OFFSET } from '@ts-minecraft/app/frame-handler.config'
import type { TargetBlockHit, TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import { spawnMobDrop, spawnMobXpOrb } from '@ts-minecraft/app/application/frame/stages/interaction-mob-drops'

// Combat-feedback hit burst: a small fleck of red particles on a landed melee
// hit. REDSTONE_BLOCK is the red-ish source block; its top-face atlas tile UV is
// precomputed ONCE at module load (perf policy — no per-frame alloc).
const HIT_PARTICLE_BLOCK_ID = blockTypeToIndex('REDSTONE_BLOCK')
const HIT_PARTICLE_UV = getParticleUvOffset(HIT_PARTICLE_BLOCK_ID)

// R101: avoid per-kill [] allocation when entity has no drops.
const NO_DROPS: ReadonlyArray<EntityDrop> = []

const triggerHeldItemSwing = (refs: Pick<FrameStageRefs, 'totalTimeSecsRef' | 'attackSwingStateRef'>) =>
  Effect.sync(() => {
    const nowSecs = MutableRef.get(refs.totalTimeSecsRef)
    // triggerAttackSwing mutates in-place and returns the same reference — no spread needed.
    const nextState = triggerAttackSwing(MutableRef.get(refs.attackSwingStateRef), nowSecs * 1000)
    MutableRef.set(refs.attackSwingStateRef, nextState)
  })

export const handleLeftClick = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'soundManager'
    | 'entityManager'
    | 'inventoryService'
    | 'equipmentService'
    | 'hotbarService'
    | 'particleSystem'
    | 'gameState'
    | 'inputService'
    | 'multiplayer'
    | 'cropGrowthService'
    | 'hungerService'
    | 'droppedItemService'
    | 'droppedXpOrbService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef' | 'totalTimeSecsRef' | 'lastPlayerAttackTimeRef' | 'attackSwingStateRef'>,
  context: {
    readonly targetBlock: Option.Option<TargetBlockHit>
    readonly targetHit: Option.Option<TargetRayHit>
    readonly selectedHotbarItem: Option.Option<string>
    readonly debugFlags: DebugFeatureFlags
    readonly entities: ReadonlyArray<Entity>
  },
) =>
  Effect.gen(function* () {
    const debugFlags = context.debugFlags
    const targetDistance = Option.isSome(context.targetHit)
      ? context.targetHit.value.distance
      : null
    const targetEntity = findAttackableEntity(context.entities, deps.camera, targetDistance)
    // Vanilla critical hits are deterministic: an attack while airborne (falling)
    // deals 1.5× damage. Read grounded state once for use in the attack branch.
    const playerGrounded = yield* services.gameState.isPlayerGrounded()

    // Block break is handled by handleBlockBreakProgress (hold-to-break); single click no longer breaks blocks.
    const entityId = Option.getOrNull(targetEntity)
    if (entityId === null) return

    const baseDamage = getWeaponBaseDamage(Option.getOrUndefined(context.selectedHotbarItem))
    // Sharpness/Smite/Bane enchantment bonuses: fetched now so entity type is known
    // before the damage formula runs. entity is reused for knockback below.
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const weaponStack = yield* services.inventoryService.getSlot(SlotIndex.make(HOTBAR_START + selectedSlot))
    const weaponEnchantments = enchantmentsOf(weaponStack)
    // Fetch entity BEFORE damage calculation so SMITE/BANE can be applied.
    const entity = Option.getOrNull(yield* services.entityManager.getEntity(entityId))
    const entityType = (entity?.type as string) ?? ''
    const enchantBonus = computeWeaponEnchantBonus(weaponEnchantments, entityType)
    let knockbackEnchant: (typeof weaponEnchantments)[number] | undefined
    let fireAspectEnchant: (typeof weaponEnchantments)[number] | undefined
    let lootingEnchant: (typeof weaponEnchantments)[number] | undefined
    let unbreakingEnchant: (typeof weaponEnchantments)[number] | undefined
    for (const enchantment of weaponEnchantments) {
      if (enchantment.type === 'KNOCKBACK') {
        knockbackEnchant = enchantment
      } else if (enchantment.type === 'FIRE_ASPECT') {
        fireAspectEnchant = enchantment
      } else if (enchantment.type === 'LOOTING') {
        lootingEnchant = enchantment
      } else if (enchantment.type === 'UNBREAKING') {
        unbreakingEnchant = enchantment
      }
    }

    // Crit when airborne. Attack cooldown weakens hits before recharge.
    // Sequential: both are pure synchronous reads; no parallelism benefit.
    const now = MutableRef.get(refs.totalTimeSecsRef)
    const lastAttack = MutableRef.get(refs.lastPlayerAttackTimeRef)
    const charge = computeAttackCharge(now - lastAttack, DEFAULT_ATTACK_COOLDOWN_SECS)
    MutableRef.set(refs.lastPlayerAttackTimeRef, now)
    const damage = computeChargedDamage(computeAttackDamage(baseDamage + enchantBonus, !playerGrounded), charge)

    // Knock back and play feedback before lethal hits can remove the entity.
    if (entity !== null) {
      const movingForward = (yield* services.inputService.isKeyPressed(KeyMappings.MOVE_FORWARD))
        || (yield* services.inputService.isKeyPressed(KeyMappings.MOVE_FORWARD_ALT))
      const sprinting = (yield* services.inputService.isKeyPressed(KeyMappings.SPRINT))
        || (yield* services.inputService.isKeyPressed(KeyMappings.SPRINT_ALT))
      const sneaking = yield* services.inputService.isKeyPressed(KeyMappings.SNEAK)
      const isSprintAttack = movingForward && sprinting && !sneaking
      const base = computeKnockback(entity.position.x - deps.camera.position.x, entity.position.z - deps.camera.position.z)
      const enchantmentKbMult = knockbackEnchant ? getKnockbackHorizontalMultiplier(knockbackEnchant.level) : 1
      const kbMult = computeAttackKnockbackHorizontalMultiplier(enchantmentKbMult, isSprintAttack)
      const impulse = kbMult === 1 ? base : { x: base.x * kbMult, y: base.y, z: base.z * kbMult }
      yield* services.entityManager.applyKnockback(entityId, impulse)
      yield* services.soundManager.playEffect('entityHit', { position: entity.position })
      if (debugFlags['particles.spawn']) {
        yield* services.particleSystem.spawnBurst(
          entity.position.x,
          entity.position.y + ENTITY_CENTER_Y_OFFSET,
          entity.position.z,
          HIT_PARTICLE_UV.u,
          HIT_PARTICLE_UV.v,
          playerGrounded ? 6 : 12,
        )
      }
    }

    const drops = yield* services.entityManager.applyDamage(entityId, damage)
    if (fireAspectEnchant && Option.isNone(drops)) {
      yield* services.entityManager.igniteEntity(entityId, getFireAspectDurationSecs(fireAspectEnchant.level))
    }
    // Attacking costs exhaustion (vanilla: 0.1 per hit regardless of kill/miss).
    yield* services.hungerService.addExhaustion(EXHAUSTION_ATTACK)
    // Vanilla: baby mobs drop no loot and grant no XP when killed.
    const wasBaby = entity?.isBaby === true
    // Roll each chance-gated drop once; un-gated drops always pass.
    const sourceDrops = wasBaby || Option.isNone(drops) ? NO_DROPS : drops.value
    let rolledDrops: EntityDrop[] | null = null
    for (const drop of sourceDrops) {
      if (!dropPasses(drop, Math.random())) continue
      if (rolledDrops === null) rolledDrops = []
      rolledDrops.push(drop)
      if (entity !== null) {
        yield* spawnMobDrop(services, entity, drop)
      }
    }
    // Looting enchantment: add `level` bonus count of each (rolled) mob drop.
    if (rolledDrops !== null && !wasBaby) {
      if (lootingEnchant) {
        for (const drop of rolledDrops) {
          if (entity !== null) {
            yield* spawnMobDrop(services, entity, drop, lootingEnchant.level)
          }
        }
      }
    }
    // Mob killed (drops returned Some) → grant XP from the pre-kill entity snapshot
    // (babies grant none, matching vanilla).
    if (Option.isSome(drops) && entity !== null && !wasBaby) {
      yield* spawnMobXpOrb(services, entity, getMobDefinition(entity.type).xpReward)
    }

    // Vocalization runs after damage: kill → mobDeath, survive → mobHurt.
    const vocalizationPos = entity?.position ?? deps.camera.position
    yield* Option.isSome(drops)
      ? services.soundManager.playEffect('mobDeath', { position: vocalizationPos })
      : services.soundManager.playEffect('mobHurt', { position: vocalizationPos })

    const selectedHotbarItem = Option.getOrNull(context.selectedHotbarItem)
    if (selectedHotbarItem !== null && Schema.is(ItemTypeSchema)(selectedHotbarItem) && isDurable(selectedHotbarItem)) {
      if (!(unbreakingEnchant && Math.random() < getUnbreakingSkipChance(unbreakingEnchant.level))) {
        yield* services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + selectedSlot), 1)
      }
    }
    yield* triggerHeldItemSwing(refs)
  })
