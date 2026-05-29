import { Effect, HashMap, Option, Ref, Schema } from 'effect'
import { aabbFromVoxel } from '@ts-minecraft/terrain'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import { CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType, blockTypeToIndex, SlotIndex, BlockTypeSchema, ItemTypeSchema } from '@ts-minecraft/kernel'
import { HOTBAR_START, isDurable, isArmorItem } from '@ts-minecraft/inventory'
import { getFoodProperties, MAX_FOOD_LEVEL } from '@ts-minecraft/player'
import { computeAttackDamage, computeKnockback, computeAttackCharge, computeChargedDamage, DEFAULT_ATTACK_COOLDOWN_SECS, getMobDefinition } from '@ts-minecraft/entities'
import { getParticleUvOffset } from '@ts-minecraft/rendering/particles/particle-system'
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
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef' | 'totalTimeSecsRef' | 'lastPlayerAttackTimeRef'>,
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
            // FR-1.6 — read block type BEFORE breakBlock mutates it so the
            // particle UV uses the correct atlas tile. Falls back to dirt
            // (tile 0) if the local index is out of range.
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
          // Crit when airborne. Attack cooldown (1.9 charge): a hit before the
          // weapon recharges is weakened. Charge from time since the last attack;
          // record this attack. The mob is the defender and carries no armor, so
          // the attack uses the default armorPoints=0 — the player's own armor
          // mitigates INCOMING damage in physics-stage, never their own attacks.
          const [now, lastAttack] = yield* Effect.all(
            [Ref.get(refs.totalTimeSecsRef), Ref.get(refs.lastPlayerAttackTimeRef)],
            { concurrency: 'unbounded' },
          )
          const charge = computeAttackCharge(now - lastAttack, DEFAULT_ATTACK_COOLDOWN_SECS)
          yield* Ref.set(refs.lastPlayerAttackTimeRef, now)
          const damage = computeChargedDamage(computeAttackDamage(baseDamage, !playerGrounded), charge)

          // Knock the target away + play the hit sound. Done BEFORE applyDamage
          // since a lethal hit removes the entity. Direction = attacker→target
          // (horizontal), derived from camera vs. entity position (no THREE dep).
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
                  // Combat-feedback fleck at the entity's bounding-box center. A
                  // denser burst on the DETERMINISTIC crit (airborne = !playerGrounded,
                  // the same signal used for crit damage — never a random roll).
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
          // Mob killed (drops returned Some) → grant XP from the pre-kill entity snapshot.
          if (Option.isSome(drops) && Option.isSome(entityOpt)) {
            yield* services.xpService.addXP(getMobDefinition(entityOpt.value.type).xpReward)
          }

          // Mob vocalization, sequenced AFTER applyDamage (it must NOT join the
          // parallel entityHit Effect.all above, which is the PLAYER's swing cue
          // and fires on every landed hit). applyDamage returns Some on a lethal
          // hit (even with empty drops) and None on a survived/no-op hit, so the
          // drops Option is the kill discriminator: kill → only mobDeath, survive
          // → only mobHurt (mutually exclusive — never both). The mob is removed
          // on a lethal hit, so the position comes from the pre-kill `entityOpt`
          // snapshot (never a post-kill getEntity); falls back to the camera if
          // the entity vanished before the swing resolved.
          const vocalizationPos = Option.match(entityOpt, {
            onNone: () => deps.camera.position,
            onSome: (e) => e.position,
          })
          yield* Option.match(drops, {
            onNone: () => services.soundManager.playEffect('mobHurt', { position: vocalizationPos }),
            onSome: () => services.soundManager.playEffect('mobDeath', { position: vocalizationPos }),
          })

          // A landed melee hit wears down a durable weapon (1 point per swing). The
          // held item type comes from the selected hotbar slot; non-tools (and the
          // bare fist) take no durability damage.
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
        }),
    })
  })

// Handles right-click item use on the selected hotbar item, in priority order:
//   1. fishing rod  → toggle cast/cancel (does not consume the rod)
//   2. armor item   → equip it (removes one from the slot)
//   3. food item    → eat it (restores hunger, consumes one from the slot)
// Returns true when an item action was taken, so the caller skips the block-
// placement path. Independent of any block target (e.g. you can eat while looking
// at the sky). Eating is suppressed when the food bar is already full (vanilla
// behaviour), and for both equip and eat the slot consumption (removeBlock) runs
// BEFORE the grant — so a failed removeBlock never gives free hunger/equipment.
export const handleFoodConsumption = (
  services: Pick<FrameHandlerServices, 'hotbarService' | 'hungerService' | 'inventoryService' | 'equipmentService' | 'fishingService' | 'xpService'>,
): Effect.Effect<boolean, never> =>
  Effect.all(
    [services.hotbarService.getSelectedBlockType(), services.hotbarService.getSelectedSlot()],
    { concurrency: 'unbounded' },
  ).pipe(
    Effect.flatMap(([selected, selectedSlot]) =>
      Option.match(selected, {
        onNone: () => Effect.succeed(false),
        onSome: (item) => {
          if (!Schema.is(ItemTypeSchema)(item)) return Effect.succeed(false)

          // Priority 0: fishing rod — toggle cast/cancel (does not consume the rod).
          if (item === 'FISHING_ROD') {
            return services.fishingService.isFishing().pipe(
              Effect.flatMap((alreadyFishing) =>
                alreadyFishing
                  ? services.fishingService.cancel().pipe(Effect.as(true))
                  : services.xpService.getXP().pipe(
                      Effect.flatMap((xp) =>
                        services.fishingService.cast(xp.totalXP + xp.xpIntoLevel),
                      ),
                      Effect.as(true),
                    ),
              ),
            )
          }

          // Priority 1: equip armor.
          if (isArmorItem(item)) {
            return services.inventoryService
              .removeBlock(item, 1, SlotIndex.make(HOTBAR_START + selectedSlot))
              .pipe(
                Effect.andThen(services.equipmentService.equip(item)),
                Effect.as(true),
                Effect.catchAll(() => Effect.succeed(false)),
              )
          }

          // Priority 2: eat food.
          return Option.match(getFoodProperties(item), {
            onNone: () => Effect.succeed(false),
            onSome: (food) =>
              services.hungerService.getHunger().pipe(
                Effect.flatMap((hunger) =>
                  hunger.foodLevel >= MAX_FOOD_LEVEL
                    ? Effect.succeed(false)
                    : services.inventoryService
                        .removeBlock(item, 1, SlotIndex.make(HOTBAR_START + selectedSlot))
                        .pipe(
                          Effect.andThen(services.hungerService.eat(food.foodLevel, food.saturationModifier)),
                          Effect.as(true),
                          Effect.catchAll(() => Effect.succeed(false)),
                        ),
                ),
              ),
          })
        },
      }),
    ),
  )

// In-game unequip (KeyG): removes the FIRST occupied armor slot and deposits it
// back into the inventory. Symmetric with the per-item right-click equip path.
// If addBlock fails (a full inventory), the piece is RE-EQUIPPED so it stays worn
// rather than being silently destroyed — the slot was already cleared by unequip,
// so re-equip restores the original state. The frame never crashes either way.
export const handleUnequipArmor = (
  services: Pick<FrameHandlerServices, 'equipmentService' | 'inventoryService'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const slots = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'] as const
    for (const slot of slots) {
      const removed = yield* services.equipmentService.unequipSlot(slot)
      if (Option.isSome(removed)) {
        yield* services.inventoryService
          .addBlock(removed.value, 1)
          .pipe(Effect.catchAll(() => services.equipmentService.equip(removed.value).pipe(Effect.asVoid)))
        return
      }
    }
  })

export const handleRightClick = (
  services: Pick<
    FrameHandlerServices,
    'blockService' | 'chunkManagerService' | 'soundManager' | 'hotbarService' | 'furnaceService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
) =>
  Option.match(context.targetHit, {
    onNone: () => Effect.void,
    onSome: (hit) => {
      const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      const targetChunkCoord = {
        x: Math.floor(targetPos.x / CHUNK_SIZE),
        z: Math.floor(targetPos.z / CHUNK_SIZE),
      }
      return services.chunkManagerService.getChunk(targetChunkCoord).pipe(
        Effect.flatMap((targetChunk) => {
          const targetLx = ((targetPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const targetLz = ((targetPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const targetIdx = targetPos.y + targetLz * CHUNK_HEIGHT + targetLx * CHUNK_HEIGHT * CHUNK_SIZE
          const targetBlockType = indexToBlockType(targetChunk.blocks[targetIdx] ?? 0)
          /* c8 ignore next 3 */
          if (targetBlockType === 'FURNACE') {
            return services.furnaceService.setSelectedFurnace(targetPos)
          }

          const adjacentPos = {
            x: hit.blockX + Math.round(hit.normal.x),
            y: hit.blockY + Math.round(hit.normal.y),
            z: hit.blockZ + Math.round(hit.normal.z),
          }
          return Effect.all(
            [services.hotbarService.getSelectedBlockType(), services.hotbarService.getSelectedSlot()],
            { concurrency: 'unbounded' },
          ).pipe(
            Effect.flatMap(([selectedBlock, selectedSlot]) =>
              Option.match(selectedBlock, {
                onNone: () => Effect.void,
                onSome: (item) => {
                  if (!Schema.is(BlockTypeSchema)(item)) return Effect.void
                  const chunkCoord = {
                    x: Math.floor(adjacentPos.x / CHUNK_SIZE),
                    z: Math.floor(adjacentPos.z / CHUNK_SIZE),
                  }
                  const coordKey = `${chunkCoord.x},${chunkCoord.z}`
                  const adjLx = ((adjacentPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  const adjLz = ((adjacentPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                  return services.blockService
                    .placeBlock(adjacentPos, item, SlotIndex.make(HOTBAR_START + selectedSlot))
                    .pipe(
                      Effect.flatMap(() =>
                        services.soundManager.playEffect('blockPlace', { position: adjacentPos }),
                      ),
                      Effect.andThen(services.chunkManagerService.getChunk(chunkCoord)),
                      Effect.flatMap((updatedChunk) =>
                        // FR-4.2: seed AABB at the placed voxel; see handleLeftClick.
                        Ref.update(refs.dirtyChunksRef, (map) =>
                          HashMap.set(map, coordKey, {
                            chunk: updatedChunk,
                            dirtyAABB: Option.some(aabbFromVoxel({ lx: adjLx, y: adjacentPos.y, lz: adjLz })),
                          }),
                        ),
                      ),
                    )
                },
              }),
            ),
          )
        }),
      )
    },
  })
