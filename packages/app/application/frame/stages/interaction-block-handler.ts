import { Array as Arr, Effect, HashMap, HashSet, MutableRef, Option, Ref, Schema } from 'effect'
import { aabbFromVoxel } from '@ts-minecraft/world'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, indexToBlockType, SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import type { EntityId as EntityIdType } from '@ts-minecraft/entity'
import { HOTBAR_START, isDurable, getFortuneDropMultiplier, getPowerDamageMultiplier, getUnbreakingSkipChance, getKnockbackHorizontalMultiplier, getPunchKnockbackBonus, enchantmentsOf } from '@ts-minecraft/inventory'
import type { Enchantment } from '@ts-minecraft/inventory'
import { FORTUNE_ORE_BLOCKS, PICKAXE_BLOCK_TYPES, getInventoryDropForBlock, canHarvestBlock, rollLeafDrops } from '@ts-minecraft/world'
import { getBlockHardness, computeBreakTicks, getOreXpDrop } from '@ts-minecraft/block'
import { computeAttackDamage, computeKnockback, computeAttackCharge, computeChargedDamage, DEFAULT_ATTACK_COOLDOWN_SECS, getMobDefinition, computeBowCharge, computeBowDamage, canFireBow, BOW_MAX_RANGE, EXHAUSTION_ATTACK, dropPasses, getWeaponBaseDamage, computeWeaponEnchantBonus } from '@ts-minecraft/entity'
import { getParticleUvOffset } from '@ts-minecraft/rendering/particles/particle-system'
import { triggerAttackSwing } from '@ts-minecraft/presentation/hud/attack-swing'
import {
  ENTITY_CENTER_Y_OFFSET,
} from '@ts-minecraft/app/frame-handler.config'

// Combat-feedback hit burst: a small fleck of red particles on a landed melee
// hit. REDSTONE_BLOCK is the red-ish source block; its top-face atlas tile UV is
// precomputed ONCE at module load (perf policy — no per-frame alloc). NOTE:
// getParticleUvOffset takes a BLOCK id, not an atlas tile index.
const HIT_PARTICLE_BLOCK_ID = blockTypeToIndex('REDSTONE_BLOCK')
const HIT_PARTICLE_UV = getParticleUvOffset(HIT_PARTICLE_BLOCK_ID)

export type TargetBlockHit = { readonly x: number; readonly y: number; readonly z: number }
export type TargetRayHit = {
  readonly blockX: number
  readonly blockY: number
  readonly blockZ: number
  readonly distance: number
  readonly normal: { readonly x: number; readonly y: number; readonly z: number }
}

export { handleFoodConsumption, handleUnequipArmor, handleFeedAnimal, handleShearAnimal } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler'
export { handleRightClick } from '@ts-minecraft/app/frame/stages/interaction-placement-handler'

const updateBreakProgressHud = (
  el: HTMLElement | null,
  progress: { ticks: number; totalTicks: number } | null,
): void => {
  if (el === null) return
  if (progress === null) {
    el.style.display = 'none'
    return
  }
  el.setAttribute('value', String(progress.ticks))
  el.setAttribute('max', String(progress.totalTicks))
  el.style.display = 'block'
}

export const handleBlockBreakProgress = (
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'debugFeatureFlags'
    | 'soundManager'
    | 'inventoryService'
    | 'hotbarService'
    | 'particleSystem'
    | 'xpService'
    | 'multiplayer'
    | 'cropGrowthService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef' | 'breakProgressRef'>,
  context: {
    readonly targetBlock: Option.Option<TargetBlockHit>
    readonly selectedHotbarItem: Option.Option<string>
    readonly targetEntityPresent: boolean
    readonly breakProgressElementOrNull: HTMLElement | null
  },
) =>
  Effect.gen(function* () {
    // Entity in range → break progress is cancelled (attack takes priority on click).
    if (context.targetEntityPresent || Option.isNone(context.targetBlock)) {
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
      return
    }

    const tb = Option.getOrNull(context.targetBlock)!
    const blockKey = `${tb.x},${tb.y},${tb.z}`
    const chunkCoord = { x: Math.floor(tb.x / CHUNK_SIZE), z: Math.floor(tb.z / CHUNK_SIZE) }
    const preBreakChunk = Option.getOrNull(
      yield* services.chunkManagerService.getChunk(chunkCoord).pipe(Effect.option),
    )
    if (preBreakChunk === null) {
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
      return
    }

    const lx = ((tb.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((tb.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const flatIdx = tb.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
    const blockId = preBreakChunk.blocks[flatIdx] ?? 0
    const blockType = indexToBlockType(blockId)

    // Block requires a pickaxe the player doesn't have → never fill the progress bar.
    // canHarvestBlock returns false only when the block is in DIAMOND_PICKAXE_HARVESTABLE_BLOCKS
    // and the held item is not a qualifying pickaxe tier.
    if (!canHarvestBlock(blockType as BlockType, context.selectedHotbarItem as Option.Option<InventoryItem>)) {
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
      return
    }

    // Read hotbar slot + enchantments once here — used for EFFICIENCY (affects breakTicks)
    // and for FORTUNE/UNBREAKING/durability on break. Avoids duplicate slot reads.
    const selectedSlotIdx = yield* services.hotbarService.getSelectedSlot()
    const toolStack = yield* services.inventoryService.getSlot(SlotIndex.make(HOTBAR_START + selectedSlotIdx))
    const toolEnchantments = enchantmentsOf(toolStack)
    const efficiencyEnchant = toolEnchantments.find((e) => e.type === 'EFFICIENCY')
    const hasSilkTouch = toolEnchantments.some((e) => e.type === 'SILK_TOUCH')

    const hardness = getBlockHardness(blockType)
    const breakTicks = computeBreakTicks(hardness, context.selectedHotbarItem, efficiencyEnchant?.level)

    const current = MutableRef.get(refs.breakProgressRef)
    const currentTicks = current !== null && current.blockKey === blockKey ? current.ticks : 0
    const newTicks = currentTicks + 1

    if (breakTicks === 0 || newTicks >= breakTicks) {
      // Threshold reached — execute the break.
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
      const pos = { x: tb.x, y: tb.y, z: tb.z }
      const coordKey = `${chunkCoord.x},${chunkCoord.z}`
      const debugFlags = yield* services.debugFeatureFlags.getFlags()
      const uv = getParticleUvOffset(blockId)

      yield* Effect.all(
        [
          services.blockService.breakBlock(pos, hasSilkTouch),
          (Option.getOrNull(services.multiplayer)?.sendBlockBreak(pos)) ?? Effect.void,
          services.soundManager.playEffect('blockBreak', { position: pos }),
          debugFlags['particles.spawn']
            ? services.particleSystem.spawnBurst(tb.x + 0.5, tb.y + 0.5, tb.z + 0.5, uv.u, uv.v, 6)
            /* c8 ignore next -- particles.spawn=false during block-break tests */
            : Effect.void,
        ],
        { concurrency: 'unbounded', discard: true },
      )

      const updatedChunk = yield* services.chunkManagerService.getChunk(chunkCoord)
      yield* Ref.update(refs.dirtyChunksRef, (map) =>
        HashMap.set(map, coordKey, {
          chunk: updatedChunk,
          dirtyAABB: Option.some(aabbFromVoxel({ lx, y: tb.y, lz })),
        }),
      )

      const xp = getOreXpDrop(blockType)
      if (xp > 0) yield* services.xpService.addXP(xp)

      if (blockType === 'WHEAT_CROP') {
        const wasRipe = yield* services.cropGrowthService.harvest(pos)
        if (wasRipe) {
          // Ripe wheat: 1 wheat + 1-4 seeds (vanilla: Math.floor(3*random+1) → 1..4)
          const seedCount = Math.floor(Math.random() * 4) + 1
          yield* Effect.all([
            services.inventoryService.addBlock('WHEAT', 1),
            services.inventoryService.addBlock('WHEAT_SEEDS', seedCount),
          ], { concurrency: 'unbounded', discard: true }).pipe(Effect.catchAllCause(() => Effect.void))
        } else {
          // Unripe: only 1 seed (block already removed by breakBlock above)
          yield* services.inventoryService.addBlock('WHEAT_SEEDS', 1).pipe(Effect.catchAll(() => Effect.void))
        }
      }

      // R69: breaking LEAVES has a small chance to drop an APPLE (1/200) or STICKS (2%) —
      // the only survival source of apples (→ golden apple). breakBlock already dropped the
      // LEAVES block itself; these are bonus rolls on top.
      if (blockType === 'LEAVES') {
        const drops = rollLeafDrops(Math.random(), Math.random())
        if (drops.apple > 0) {
          yield* services.inventoryService.addBlock('APPLE', drops.apple).pipe(Effect.catchAllCause(() => Effect.void))
        }
        if (drops.sticks > 0) {
          yield* services.inventoryService.addBlock('STICKS', drops.sticks).pipe(Effect.catchAllCause(() => Effect.void))
        }
      }

      // SILK_TOUCH and FORTUNE are mutually exclusive (vanilla). With SILK_TOUCH the ore
      // itself drops (handled by breakBlock), so skip the fortune-bonus path entirely.
      if (!hasSilkTouch && HashSet.has(FORTUNE_ORE_BLOCKS, blockType)) {
        const fortune = Option.exists(toolStack, (s) => HashSet.has(PICKAXE_BLOCK_TYPES, s.itemType))
          ? toolEnchantments.find((e) => e.type === 'FORTUNE')
          : undefined
        if (fortune) {
          const extra = Math.round(getFortuneDropMultiplier(fortune.level)) - 1
          if (extra > 0) {
            yield* services.inventoryService.addBlock(getInventoryDropForBlock(blockType), extra)
              .pipe(Effect.catchAllCause(() => Effect.void))
          }
        }
      }

      // Durable tools lose 1 durability per block broken, respecting UNBREAKING skip chance.
      const heldItem = Option.getOrNull(toolStack)
      if (heldItem !== null && isDurable(heldItem.itemType)) {
        const unbreaking = toolEnchantments.find((e) => e.type === 'UNBREAKING')
        const skip = unbreaking ? Math.random() < getUnbreakingSkipChance(unbreaking.level) : false
        if (!skip) {
          yield* services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + selectedSlotIdx), 1)
            .pipe(Effect.catchAllCause(() => Effect.void))
        }
      }
    } else {
      MutableRef.set(refs.breakProgressRef, { blockKey, ticks: newTicks, totalTicks: breakTicks })
      updateBreakProgressHud(context.breakProgressElementOrNull, { ticks: newTicks, totalTicks: breakTicks })
    }
  })

const triggerHeldItemSwing = (refs: Pick<FrameStageRefs, 'totalTimeSecsRef' | 'attackSwingStateRef'>) =>
  Ref.get(refs.totalTimeSecsRef).pipe(
    Effect.flatMap((nowSecs) =>
      Ref.update(refs.attackSwingStateRef, (state) => triggerAttackSwing({ ...state }, nowSecs * 1000)),
    ),
  )

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
    const targetEntity = yield* services.entityManager.getEntities().pipe(
      Effect.map((entities) =>
        findAttackableEntity(entities, deps.camera, Option.map(context.targetHit, (hit) => hit.distance)),
      ),
    )
    // Vanilla critical hits are deterministic: an attack while airborne (falling)
    // deals 1.5× damage. Read grounded state once for use in the attack branch.
    const playerGrounded = yield* services.gameState.isPlayerGrounded()

    // Block break is handled by handleBlockBreakProgress (hold-to-break); single click no longer breaks blocks.
    const entityId = Option.getOrNull(targetEntity)
    if (entityId !== null) {
      yield* Effect.gen(function* () {
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
              yield* services.hotbarService
                .getSelectedSlot()
                .pipe(
                  Effect.flatMap((selectedSlot) =>
                    services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + selectedSlot), 1),
                  ),
                )
            }
          }
          yield* triggerHeldItemSwing(refs)
        })
    }
  })

// ── Bow (R31) ─────────────────────────────────────────────────────────────────

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
    const rolledBowDrops = Arr.filter(Option.getOrElse(drops, () => []), (drop) => dropPasses(drop, Math.random()))
    yield* Effect.forEach(
      rolledBowDrops,
      (drop) => services.inventoryService.addBlock(drop.blockType, drop.count),
      { discard: true },
    )

    // Looting on bow kills: same bonus-drop mechanic as melee.
    if (rolledBowDrops.length > 0 && opts.hasLooting) {
      yield* Effect.forEach(
        rolledBowDrops,
        (drop) => services.inventoryService.addBlock(drop.blockType, opts.hasLooting!.level)
          .pipe(Effect.catchAllCause(() => Effect.void)),
        { discard: true },
      )
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
      const arrowConsumed = yield* services.inventoryService.removeBlock('ARROW', 1).pipe(
        Effect.as(true),
        Effect.orElse(() => Effect.succeed(false)),
      )
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
