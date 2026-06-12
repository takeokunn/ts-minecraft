import { Array as Arr, Effect, Option, Ref, Schema } from 'effect'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import { blockTypeToIndex, SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import { HOTBAR_START, isDurable, getKnockbackHorizontalMultiplier, getUnbreakingSkipChance, enchantmentsOf } from '@ts-minecraft/inventory'
import { computeAttackDamage, computeKnockback, computeAttackCharge, computeChargedDamage, DEFAULT_ATTACK_COOLDOWN_SECS, getMobDefinition, EXHAUSTION_ATTACK, dropPasses, getWeaponBaseDamage, computeWeaponEnchantBonus } from '@ts-minecraft/entity'
import { getParticleUvOffset } from '@ts-minecraft/rendering/particles/particle-system'
import { triggerAttackSwing } from '@ts-minecraft/presentation/hud/attack-swing'
import { ENTITY_CENTER_Y_OFFSET } from '@ts-minecraft/app/frame-handler.config'
import type { TargetBlockHit, TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'

// Combat-feedback hit burst: a small fleck of red particles on a landed melee
// hit. REDSTONE_BLOCK is the red-ish source block; its top-face atlas tile UV is
// precomputed ONCE at module load (perf policy — no per-frame alloc).
const HIT_PARTICLE_BLOCK_ID = blockTypeToIndex('REDSTONE_BLOCK')
const HIT_PARTICLE_UV = getParticleUvOffset(HIT_PARTICLE_BLOCK_ID)

const triggerHeldItemSwing = (refs: Pick<FrameStageRefs, 'totalTimeSecsRef' | 'attackSwingStateRef'>) =>
  Effect.gen(function* () {
    const nowSecs = yield* Ref.get(refs.totalTimeSecsRef)
    // triggerAttackSwing mutates in-place and returns the same reference — no spread needed.
    yield* Ref.update(refs.attackSwingStateRef, (state) => triggerAttackSwing(state, nowSecs * 1000))
  })

export const handleLeftClick = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'debugFeatureFlags'
    | 'soundManager'
    | 'entityManager'
    | 'inventoryService'
    | 'hotbarService'
    | 'particleSystem'
    | 'gameState'
    | 'xpService'
    | 'multiplayer'
    | 'cropGrowthService'
    | 'hungerService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef' | 'totalTimeSecsRef' | 'lastPlayerAttackTimeRef' | 'attackSwingStateRef'>,
  context: {
    readonly targetBlock: Option.Option<TargetBlockHit>
    readonly targetHit: Option.Option<TargetRayHit>
    readonly selectedHotbarItem: Option.Option<string>
  },
) =>
  Effect.gen(function* () {
    const debugFlags = yield* services.debugFeatureFlags.getFlags()
    const entities = yield* services.entityManager.getEntities()
    const targetEntity = findAttackableEntity(entities, deps.camera, Option.map(context.targetHit, (hit) => hit.distance))
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

    // Crit when airborne. Attack cooldown weakens hits before recharge.
    // Sequential: both are pure synchronous Ref reads; no parallelism benefit.
    const now = yield* Ref.get(refs.totalTimeSecsRef)
    const lastAttack = yield* Ref.get(refs.lastPlayerAttackTimeRef)
    const charge = computeAttackCharge(now - lastAttack, DEFAULT_ATTACK_COOLDOWN_SECS)
    yield* Ref.set(refs.lastPlayerAttackTimeRef, now)
    const damage = computeChargedDamage(computeAttackDamage(baseDamage + enchantBonus, !playerGrounded), charge)

    // Knock back and play feedback before lethal hits can remove the entity.
    const knockbackEnchant = weaponEnchantments.find((enc) => enc.type === 'KNOCKBACK')
    if (entity !== null) {
      const base = computeKnockback(entity.position.x - deps.camera.position.x, entity.position.z - deps.camera.position.z)
      const kbMult = knockbackEnchant ? getKnockbackHorizontalMultiplier(knockbackEnchant.level) : 1
      const impulse = kbMult === 1 ? base : { x: base.x * kbMult, y: base.y, z: base.z * kbMult }
      yield* Effect.all(
        [
          services.entityManager.applyKnockback(entityId, impulse),
          services.soundManager.playEffect('entityHit', { position: entity.position }),
          // Denser burst on deterministic crit (airborne), never random.
          debugFlags['particles.spawn']
            ? services.particleSystem.spawnBurst(
                entity.position.x,
                entity.position.y + ENTITY_CENTER_Y_OFFSET,
                entity.position.z,
                HIT_PARTICLE_UV.u,
                HIT_PARTICLE_UV.v,
                playerGrounded ? 6 : 12,
              )
            : Effect.void,
        ],
        { concurrency: 'unbounded', discard: true },
      )
    }

    const drops = yield* services.entityManager.applyDamage(entityId, damage)
    // Attacking costs exhaustion (vanilla: 0.1 per hit regardless of kill/miss).
    yield* services.hungerService.addExhaustion(EXHAUSTION_ATTACK)
    // Vanilla: baby mobs drop no loot and grant no XP when killed.
    const wasBaby = entity?.isBaby === true
    // Roll each chance-gated drop once; un-gated drops always pass.
    const rolledDrops = wasBaby
      ? []
      : Arr.filter(Option.getOrElse(drops, () => []), (drop) => dropPasses(drop, Math.random()))
    yield* Effect.forEach(
      rolledDrops,
      (drop) => services.inventoryService.addBlock(drop.blockType, drop.count),
      { concurrency: 'unbounded', discard: true },
    )
    // Looting enchantment: add `level` bonus count of each (rolled) mob drop.
    if (rolledDrops.length > 0 && !wasBaby) {
      const looting = weaponEnchantments.find((e) => e.type === 'LOOTING')
      if (looting) {
        yield* Effect.forEach(
          rolledDrops,
          (drop) => services.inventoryService.addBlock(drop.blockType, looting.level)
            .pipe(Effect.catchAllCause(() => Effect.void)),
          { concurrency: 'unbounded', discard: true },
        )
      }
    }
    // Mob killed (drops returned Some) → grant XP from the pre-kill entity snapshot
    // (babies grant none, matching vanilla).
    if (Option.isSome(drops) && entity !== null && !wasBaby) {
      yield* services.xpService.addXP(getMobDefinition(entity.type).xpReward)
    }

    // Vocalization runs after damage: kill → mobDeath, survive → mobHurt.
    const vocalizationPos = entity?.position ?? deps.camera.position
    yield* Option.isSome(drops)
      ? services.soundManager.playEffect('mobDeath', { position: vocalizationPos })
      : services.soundManager.playEffect('mobHurt', { position: vocalizationPos })

    const selectedHotbarItem = Option.getOrNull(context.selectedHotbarItem)
    if (selectedHotbarItem !== null && Schema.is(ItemTypeSchema)(selectedHotbarItem) && isDurable(selectedHotbarItem)) {
      const unbreaking = weaponEnchantments.find((e) => e.type === 'UNBREAKING')
      if (!(unbreaking && Math.random() < getUnbreakingSkipChance(unbreaking.level))) {
        yield* services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + selectedSlot), 1)
      }
    }
    yield* triggerHeldItemSwing(refs)
  })
