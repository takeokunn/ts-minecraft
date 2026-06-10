import { Effect, HashMap, HashSet, Option, Ref, Schema } from 'effect'
import { aabbFromVoxel } from '@ts-minecraft/world'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, indexToBlockType, SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import { HOTBAR_START, isDurable, getSharpnessDamageBonus, getFortuneDropMultiplier } from '@ts-minecraft/inventory'
import { FORTUNE_ORE_BLOCKS, PICKAXE_BLOCK_TYPES, getInventoryDropForBlock } from '@ts-minecraft/world'
import { computeAttackDamage, computeKnockback, computeAttackCharge, computeChargedDamage, DEFAULT_ATTACK_COOLDOWN_SECS, getMobDefinition } from '@ts-minecraft/entity'
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

export { handleFoodConsumption, handleUnequipArmor } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler'
export { handleRightClick } from '@ts-minecraft/app/frame/stages/interaction-placement-handler'

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
      onNone: () =>
        Option.match(context.targetBlock, {
          onNone: () => Effect.void,
          onSome: (tb) => {
            const pos = { x: tb.x, y: tb.y, z: tb.z }
            const chunkCoord = { x: Math.floor(tb.x / CHUNK_SIZE), z: Math.floor(tb.z / CHUNK_SIZE) }
            const coordKey = `${chunkCoord.x},${chunkCoord.z}`
            // Read block type before mutation so particles use the correct atlas tile.
            const lx = ((tb.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const lz = ((tb.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const flatIdx = tb.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
            return services.chunkManagerService.getChunk(chunkCoord).pipe(
              Effect.flatMap((preBreakChunk) => {
                const blockId = preBreakChunk.blocks[flatIdx] ?? 0
                const uv = getParticleUvOffset(blockId)
                return Effect.all(
                  [
                    services.blockService.breakBlock(pos),
                    // FR-3: broadcast the break to other players (no-op offline).
                    Option.match(services.multiplayer, {
                      onNone: () => Effect.void,
                      onSome: (mp) => mp.sendBlockBreak(pos),
                    }),
                    services.soundManager.playEffect('blockBreak', { position: pos }),
                    debugFlags['particles.spawn']
                      ? services.particleSystem.spawnBurst(
                          tb.x + 0.5,
                          tb.y + 0.5,
                          tb.z + 0.5,
                          uv.u,
                          uv.v,
                          6,
                        )
                      /* c8 ignore next -- particles.spawn=false during block-break; covered by entity attack test */
                      : Effect.void,
                  ],
                  { concurrency: 'unbounded', discard: true },
                ).pipe(
                  Effect.andThen(services.chunkManagerService.getChunk(chunkCoord)),
                  Effect.flatMap((updatedChunk) =>
                    // FR-4.2: seed AABB is the broken voxel itself — chunk-manager's
                    // markChunkDirty (called inside breakBlock) records the fuller
                    // light-affected AABB which the next drainRenderDirtyChunkEntries
                    // will union in via frame-maintenance.
                    Ref.update(refs.dirtyChunksRef, (map) =>
                      HashMap.set(map, coordKey, {
                        chunk: updatedChunk,
                        dirtyAABB: Option.some(aabbFromVoxel({ lx, y: tb.y, lz })),
                      }),
                    ),
                  ),
                  Effect.andThen(Effect.gen(function* () {
                    const blockType = indexToBlockType(blockId)
                    const xp = ORE_XP_DROPS[blockType] ?? 0
                    if (xp > 0) yield* services.xpService.addXP(xp)
                  })),
                  Effect.andThen(Effect.gen(function* () {
                    const blockType = indexToBlockType(blockId)
                    if (!HashSet.has(FORTUNE_ORE_BLOCKS, blockType)) return
                    const slot = yield* services.hotbarService.getSelectedSlot()
                    const ws = yield* services.inventoryService.getSlot(SlotIndex.make(HOTBAR_START + slot))
                    const fortune = Option.match(ws, {
                      onNone: () => undefined,
                      onSome: (s) => {
                        // Fortune only applies when held item is a pickaxe
                        if (!HashSet.has(PICKAXE_BLOCK_TYPES, s.itemType)) return undefined
                        return (s.enchantments ?? []).find((e) => e.type === 'FORTUNE')
                      },
                    })
                    if (!fortune) return
                    const extra = Math.round(getFortuneDropMultiplier(fortune.level)) - 1
                    if (extra <= 0) return
                    yield* services.inventoryService.addBlock(getInventoryDropForBlock(blockType), extra)
                      .pipe(Effect.catchAllCause(() => Effect.void))
                  })),
                  Effect.andThen(triggerHeldItemSwing(refs)),
                )
              }),
            )
          },
        }),
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
          const [now, lastAttack] = yield* Effect.all(
            [Ref.get(refs.totalTimeSecsRef), Ref.get(refs.lastPlayerAttackTimeRef)],
            { concurrency: 'unbounded' },
          )
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
          yield* Effect.forEach(
            Option.getOrElse(drops, () => []),
            (drop) => services.inventoryService.addBlock(drop.blockType, drop.count),
            { concurrency: 'unbounded', discard: true },
          )
          // Looting enchantment: add `level` bonus count of each mob drop.
          if (Option.isSome(drops)) {
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
          // Mob killed (drops returned Some) → grant XP from the pre-kill entity snapshot.
          if (Option.isSome(drops) && Option.isSome(entityOpt)) {
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
