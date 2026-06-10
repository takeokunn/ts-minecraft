import { Effect, HashMap, HashSet, MutableRef, Option, Ref, Schema } from 'effect'
import { aabbFromVoxel } from '@ts-minecraft/world'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, indexToBlockType, SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import { HOTBAR_START, isDurable, getSharpnessDamageBonus, getFortuneDropMultiplier, getPowerDamageMultiplier, getUnbreakingSkipChance } from '@ts-minecraft/inventory'
import { FORTUNE_ORE_BLOCKS, PICKAXE_BLOCK_TYPES, getInventoryDropForBlock, canHarvestBlock } from '@ts-minecraft/world'
import { getBlockHardness, computeBreakTicks } from '@ts-minecraft/block'
import { computeAttackDamage, computeKnockback, computeAttackCharge, computeChargedDamage, DEFAULT_ATTACK_COOLDOWN_SECS, getMobDefinition, computeBowCharge, computeBowDamage, canFireBow, BOW_MAX_RANGE } from '@ts-minecraft/entity'
import { getParticleUvOffset } from '@ts-minecraft/rendering/particles/particle-system'
import { triggerAttackSwing } from '@ts-minecraft/presentation/hud/attack-swing'
import {
  ENTITY_CENTER_Y_OFFSET,
  PLAYER_ATTACK_DAMAGE,
  WOODEN_SWORD_ATTACK_DAMAGE,
  STONE_SWORD_ATTACK_DAMAGE,
  IRON_SWORD_ATTACK_DAMAGE,
  DIAMOND_SWORD_ATTACK_DAMAGE,
  WOODEN_AXE_ATTACK_DAMAGE,
  STONE_AXE_ATTACK_DAMAGE,
  IRON_AXE_ATTACK_DAMAGE,
  DIAMOND_AXE_ATTACK_DAMAGE,
} from '@ts-minecraft/app/frame-handler.config'

// XP awarded when breaking ore blocks (vanilla Java Edition values).
// Placed here (not block-service.ts) to avoid a world↔entity circular dep.
const ORE_XP_DROPS: Readonly<Partial<Record<string, number>>> = {
  COAL_ORE: 5, DEEPSLATE_COAL_ORE: 5,
  IRON_ORE: 0, DEEPSLATE_IRON_ORE: 0,    // iron/gold drop raw ore, 0 XP
  GOLD_ORE: 0, DEEPSLATE_GOLD_ORE: 0,
  DIAMOND_ORE: 7, DEEPSLATE_DIAMOND_ORE: 7,
  EMERALD_ORE: 7, DEEPSLATE_EMERALD_ORE: 7,
  LAPIS_ORE: 5, DEEPSLATE_LAPIS_ORE: 5,
  REDSTONE_ORE: 5, DEEPSLATE_REDSTONE_ORE: 5,
  NETHER_QUARTZ_ORE: 5,
}

// Weapon damage lookup for swords AND axes — both are melee weapons.
// Items absent from this table use PLAYER_ATTACK_DAMAGE (bare fist).
const SWORD_DAMAGE: Readonly<Record<string, number>> = {
  WOODEN_SWORD: WOODEN_SWORD_ATTACK_DAMAGE,
  STONE_SWORD: STONE_SWORD_ATTACK_DAMAGE,
  IRON_SWORD: IRON_SWORD_ATTACK_DAMAGE,
  DIAMOND_SWORD: DIAMOND_SWORD_ATTACK_DAMAGE,
  WOODEN_AXE: WOODEN_AXE_ATTACK_DAMAGE,
  STONE_AXE: STONE_AXE_ATTACK_DAMAGE,
  IRON_AXE: IRON_AXE_ATTACK_DAMAGE,
  DIAMOND_AXE: DIAMOND_AXE_ATTACK_DAMAGE,
}

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

    const tb = context.targetBlock.value
    const blockKey = `${tb.x},${tb.y},${tb.z}`
    const chunkCoord = { x: Math.floor(tb.x / CHUNK_SIZE), z: Math.floor(tb.z / CHUNK_SIZE) }
    const chunkResult = yield* services.chunkManagerService.getChunk(chunkCoord).pipe(Effect.option)
    if (Option.isNone(chunkResult)) {
      MutableRef.set(refs.breakProgressRef, null)
      updateBreakProgressHud(context.breakProgressElementOrNull, null)
      return
    }
    const preBreakChunk = chunkResult.value

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
    const toolEnchantments = Option.match(toolStack, { onNone: () => [], onSome: (s) => s.enchantments ?? [] })
    const efficiencyEnchant = toolEnchantments.find((e) => e.type === 'EFFICIENCY')

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
          services.blockService.breakBlock(pos),
          Option.match(services.multiplayer, {
            onNone: () => Effect.void,
            onSome: (mp) => mp.sendBlockBreak(pos),
          }),
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

      const xp = ORE_XP_DROPS[blockType] ?? 0
      if (xp > 0) yield* services.xpService.addXP(xp)

      if (blockType === 'WHEAT_CROP') {
        const wasRipe = yield* services.cropGrowthService.harvest(pos)
        if (wasRipe) {
          yield* services.inventoryService.addBlock('WHEAT', 1).pipe(Effect.catchAll(() => Effect.void))
        }
      }

      if (HashSet.has(FORTUNE_ORE_BLOCKS, blockType)) {
        const fortune = Option.match(toolStack, {
          onNone: () => undefined,
          onSome: (s) => {
            if (!HashSet.has(PICKAXE_BLOCK_TYPES, s.itemType)) return undefined
            return toolEnchantments.find((e) => e.type === 'FORTUNE')
          },
        })
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

    yield* Option.match(targetEntity, {
      // Block break is handled by handleBlockBreakProgress (hold-to-break); single click no longer breaks blocks.
      onNone: () => Effect.void,
      onSome: (entityId) =>
        Effect.gen(function* () {
          const baseDamage = Option.match(context.selectedHotbarItem, {
            onNone: () => PLAYER_ATTACK_DAMAGE,
            onSome: (item) => SWORD_DAMAGE[item] ?? PLAYER_ATTACK_DAMAGE,
          })
          // Sharpness enchantment adds flat damage bonus to the base before crit/charge.
          const selectedSlot = yield* services.hotbarService.getSelectedSlot()
          const weaponStack = yield* services.inventoryService.getSlot(SlotIndex.make(HOTBAR_START + selectedSlot))
          const sharpnessBonus = Option.match(weaponStack, {
            onNone: () => 0,
            onSome: (s) => {
              const e = (s.enchantments ?? []).find((en) => en.type === 'SHARPNESS')
              return e ? getSharpnessDamageBonus(e.level) : 0
            },
          })
          // Crit when airborne. Attack cooldown weakens hits before recharge.
          // Sequential: both are pure synchronous Ref reads; no parallelism benefit.
          const now = yield* Ref.get(refs.totalTimeSecsRef)
          const lastAttack = yield* Ref.get(refs.lastPlayerAttackTimeRef)
          const charge = computeAttackCharge(now - lastAttack, DEFAULT_ATTACK_COOLDOWN_SECS)
          yield* Ref.set(refs.lastPlayerAttackTimeRef, now)
          const damage = computeChargedDamage(computeAttackDamage(baseDamage + sharpnessBonus, !playerGrounded), charge)

          // Knock back and play feedback before lethal hits can remove the entity.
          const entityOpt = yield* services.entityManager.getEntity(entityId)
          yield* Option.match(entityOpt, {
            onNone: () => Effect.void,
            onSome: (e) =>
              Effect.all(
                [
                  services.entityManager.applyKnockback(
                    entityId,
                    computeKnockback(e.position.x - deps.camera.position.x, e.position.z - deps.camera.position.z),
                  ),
                  services.soundManager.playEffect('entityHit', { position: e.position }),
                  // Denser burst on deterministic crit (airborne), never random.
                  debugFlags['particles.spawn']
                    ? services.particleSystem.spawnBurst(
                        e.position.x,
                        e.position.y + ENTITY_CENTER_Y_OFFSET,
                        e.position.z,
                        HIT_PARTICLE_UV.u,
                        HIT_PARTICLE_UV.v,
                        playerGrounded ? 6 : 12,
                      )
                    : Effect.void,
                ],
                { concurrency: 'unbounded', discard: true },
              ),
          })

          const drops = yield* services.entityManager.applyDamage(entityId, damage)
          // Vanilla: baby mobs drop no loot and grant no XP when killed.
          const wasBaby = Option.isSome(entityOpt) && entityOpt.value.isBaby === true
          yield* Effect.forEach(
            wasBaby ? [] : Option.getOrElse(drops, () => []),
            (drop) => services.inventoryService.addBlock(drop.blockType, drop.count),
            { concurrency: 'unbounded', discard: true },
          )
          // Looting enchantment: add `level` bonus count of each mob drop.
          if (Option.isSome(drops) && !wasBaby) {
            const looting = Option.match(weaponStack, {
              onNone: () => undefined,
              onSome: (s) => (s.enchantments ?? []).find((e) => e.type === 'LOOTING'),
            })
            if (looting) {
              yield* Effect.forEach(
                Option.getOrElse(drops, () => []),
                (drop) => services.inventoryService.addBlock(drop.blockType, looting.level)
                  .pipe(Effect.catchAllCause(() => Effect.void)),
                { concurrency: 'unbounded', discard: true },
              )
            }
          }
          // Mob killed (drops returned Some) → grant XP from the pre-kill entity snapshot
          // (babies grant none, matching vanilla).
          if (Option.isSome(drops) && Option.isSome(entityOpt) && !wasBaby) {
            yield* services.xpService.addXP(getMobDefinition(entityOpt.value.type).xpReward)
          }

          // Vocalization runs after damage: kill → mobDeath, survive → mobHurt.
          const vocalizationPos = Option.match(entityOpt, {
            onNone: () => deps.camera.position,
            onSome: (e) => e.position,
          })
          yield* Option.match(drops, {
            onNone: () => services.soundManager.playEffect('mobHurt', { position: vocalizationPos }),
            onSome: () => services.soundManager.playEffect('mobDeath', { position: vocalizationPos }),
          })

          yield* Option.match(context.selectedHotbarItem, {
            onNone: () => Effect.void,
            onSome: (item) =>
              Schema.is(ItemTypeSchema)(item) && isDurable(item)
                ? services.hotbarService
                    .getSelectedSlot()
                    .pipe(
                      Effect.flatMap((selectedSlot) =>
                        services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + selectedSlot), 1),
                      ),
                    )
                  : Effect.void,
          })
          yield* triggerHeldItemSwing(refs)
        }),
    })
  })

// ── Bow (R31) ─────────────────────────────────────────────────────────────────
// Called when the player releases right-click while holding a BOW. Fires a
// hitscan ray up to BOW_MAX_RANGE blocks, consuming 1 ARROW and dealing
// charge-scaled damage to the first entity in the crosshair.
export const handleBowFire = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<
    FrameHandlerServices,
    'inventoryService' | 'hotbarService' | 'entityManager' | 'soundManager'
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
    const enchantments = Option.match(bowStack, { onNone: () => [], onSome: (s) => s.enchantments ?? [] })

    const hasPower = enchantments.find((e) => e.type === 'POWER')
    const hasInfinity = enchantments.some((e) => e.type === 'INFINITY')

    // Scale base damage by charge, then apply POWER multiplier.
    const baseDamage = computeBowDamage(charge)
    const damage = hasPower ? Math.round(baseDamage * getPowerDamageMultiplier(hasPower.level)) : baseDamage

    // INFINITY skips arrow consumption. Without it, consume 1 ARROW (silent abort if empty).
    if (!hasInfinity) {
      const hasArrow = yield* Effect.match(
        services.inventoryService.removeBlock('ARROW', 1),
        { onFailure: () => false, onSuccess: () => true },
      )
      if (!hasArrow) return
    }

    // Damage the equipped bow (INFINITY still wears the bow down — vanilla behaviour).
    yield* services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + selectedSlot), 1)

    // Hitscan: find the nearest entity in the crosshair within bow range.
    // maxDistance = none() (bow ignores block occlusion; it shoots through transparent blocks).
    const targetId = findAttackableEntity(entities, deps.camera, Option.none(), BOW_MAX_RANGE)

    yield* Option.match(targetId, {
      onNone: () => Effect.void,
      onSome: (entityId) =>
        Effect.gen(function* () {
          const entityOpt = yield* services.entityManager.getEntity(entityId)
          const drops = yield* services.entityManager.applyDamage(entityId, damage)
          yield* Option.match(entityOpt, {
            onNone: () => Effect.void,
            onSome: (e) => services.soundManager.playEffect('entityHit', { position: e.position }),
          })
          yield* Effect.forEach(
            Option.getOrElse(drops, () => []),
            (drop) => services.inventoryService.addBlock(drop.blockType, drop.count),
            { discard: true },
          )
        }),
    })
  })
