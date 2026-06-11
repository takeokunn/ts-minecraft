import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { applyArmorReduction } from '@ts-minecraft/entity'
import { DEFAULT_PLAYER_ID, CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType, SlotIndex } from '@ts-minecraft/core'
import { KeyMappings } from '@ts-minecraft/entity'
import { HOTBAR_START, getFeatherFallingReduction, getFireProtectionReduction, getRespirationBonusSecs, enchantmentsOf } from '@ts-minecraft/inventory'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import { EXHAUSTION_WALK_PER_BLOCK, EXHAUSTION_SPRINT_PER_BLOCK, EXHAUSTION_SPRINT_JUMP, EXHAUSTION_JUMP, EXHAUSTION_DAMAGE, MAX_FOOD_LEVEL } from '@ts-minecraft/entity'
import { accrueHazardTicks, nextAirSecs, LAVA_DAMAGE, LAVA_DAMAGE_INTERVAL_SECS, DROWN_DAMAGE, DROWN_DAMAGE_INTERVAL_SECS, MAX_AIR_SECS } from '@ts-minecraft/entity'
import { EYE_LEVEL_OFFSET } from '@ts-minecraft/app/frame-handler.config'
import { resolveNetherTravel, type Dimension, type ChunkManagerService } from '@ts-minecraft/world'

/** Seconds a player must stand in a NETHER_PORTAL block to trigger dimension travel. */
const PORTAL_ACTIVATION_SECS = 4.0

type DamageServices = Pick<FrameHandlerServices, 'healthService' | 'hungerService'>

const tryApplyPlayerDamage = (
  amount: number,
  isSpectatorMode: boolean,
  services: DamageServices,
): Effect.Effect<boolean, never> => {
  if (amount <= 0 || isSpectatorMode) return Effect.succeed(false)
  return services.healthService.getHealth().pipe(
    Effect.flatMap((health) =>
      health.current <= 0 || health.invincibilityTicks > 0
        ? Effect.succeed(false)
        : services.healthService.applyDamage(amount).pipe(
            Effect.flatMap(() => services.hungerService.addExhaustion(EXHAUSTION_DAMAGE)),
            Effect.as(true),
          ),
    ),
  )
}

/**
 * Pure column-reader: given a resolved chunkOpt plus the pre-computed local
 * x/z offsets inside that chunk, return a function that maps a world-Y to the
 * block type at that position (null when out of bounds or chunk absent).
 *
 * Hoisted out of the per-frame Effect.gen body so no new closure is allocated
 * on every frame — only the single call-site invocation below allocates.
 */
const makeColumnReader = (
  chunkOpt: Option.Option<{ readonly blocks: ArrayLike<number> }>,
  lx: number,
  lz: number,
): ((wy: number) => ReturnType<typeof indexToBlockType> | null) => {
  const chunk = Option.getOrNull(chunkOpt)
  return (wy: number) => {
    const by = Math.floor(wy)
    if (by < 0 || by >= CHUNK_HEIGHT || chunk === null) return null
    return indexToBlockType(chunk.blocks[by + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] ?? 0)
  }
}

const makeColumnReaderAt = (
  chunkManagerService: ChunkManagerService,
  pos: Position,
): Effect.Effect<(wy: number) => ReturnType<typeof indexToBlockType> | null> => {
  const bx = Math.floor(pos.x)
  const bz = Math.floor(pos.z)
  const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return chunkManagerService
    .getChunk({ x: Math.floor(bx / CHUNK_SIZE), z: Math.floor(bz / CHUNK_SIZE) })
    .pipe(
      Effect.option,
      Effect.map((chunkOpt) => makeColumnReader(chunkOpt, lx, lz)),
    )
}

export const physicsStage = (
  deps: Pick<FrameHandlerDeps, 'respawnPositionRef'>,
  services: Pick<
    FrameHandlerServices,
    'gameState' | 'healthService' | 'hungerService' | 'xpService' | 'equipmentService' | 'fishingService' | 'inventoryService' | 'hotbarService' | 'soundManager' | 'entityManager' | 'gameMode' | 'debugFeatureFlags' | 'chunkManagerService' | 'netherService' | 'blockService' | 'inputService'
  >,
  refs: Pick<FrameStageRefs, 'lastHealthRef' | 'lastHungerRef' | 'lastXPRef' | 'lastArmorRef' | 'portalSecsRef' | 'dirtyChunksRef' | 'lavaDamageSecsRef' | 'airSecsRef' | 'drownDamageSecsRef' | 'lastAirBubblesRef' | 'isShieldBlockingRef' | 'wasGroundedRef' | 'finalPosRef'>,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly initialPlayerPos: Position
    readonly healthValueElementOrNull: HTMLElement | null
    readonly healthMaxElementOrNull: HTMLElement | null
    readonly hungerValueElementOrNull: HTMLElement | null
    readonly hungerMaxElementOrNull: HTMLElement | null
    readonly xpLevelElementOrNull: HTMLElement | null
    readonly xpBarElementOrNull: HTMLElement | null
    readonly xpBarMaxElementOrNull: HTMLElement | null
    readonly armorValueElementOrNull: HTMLElement | null
    readonly airElementOrNull: HTMLElement | null
  },
): Effect.Effect<{ readonly playerPos: Position }, never> =>
  Effect.gen(function* () {
    const debugFlags = yield* services.debugFeatureFlags.getFlags()

    // Update game state (input -> movement -> physics -> position sync)
    yield* logErrors(services.gameState.update(inputs.deltaTime), 'Physics update error')

    // Health: fall damage processing and HUD update
    // finalPosRef is hoisted into FrameStageRefs — reset to initialPlayerPos on every
    // frame entry to avoid allocating a new Ref object on the hot path (R87).
    yield* Ref.set(refs.finalPosRef, inputs.initialPlayerPos)

    yield* logErrors(
      Effect.gen(function* () {
        const refreshedPos = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
          Effect.catchAllCause(() => Effect.succeed(inputs.initialPlayerPos)),
        )
        yield* Ref.set(refs.finalPosRef, refreshedPos)

        // Read total armor points ONCE per frame. Reused below for both incoming
        // hostile-damage mitigation (applyArmorReduction) and the armor HUD.
        const armorPoints = yield* services.equipmentService.getTotalArmorPoints()
        const protectionReduction = yield* services.equipmentService.getTotalProtectionReduction()

        // Spectator is immune to ALL damage (every source routes through here).
        const isSpectatorMode = yield* services.gameMode.isSpectator()
        const applyDamage = (amount: number) => tryApplyPlayerDamage(amount, isSpectatorMode, services)

        const isGrounded = yield* services.gameState.isPlayerGrounded()
        const rawFallDamage = yield* services.healthService.processFallDamage(refreshedPos.y, isGrounded)
        // FEATHER_FALLING: reduce fall damage by 12% per level.
        const fallDamage = yield* rawFallDamage > 0
          ? services.equipmentService.getEquippedItem('BOOTS').pipe(
              Effect.map((bootsOpt) => {
                const ff = enchantmentsOf(bootsOpt).find((e) => e.type === 'FEATHER_FALLING')
                return ff ? rawFallDamage * (1 - getFeatherFallingReduction(ff.level)) : rawFallDamage
              }),
            )
          : Effect.succeed(rawFallDamage)
        const tookFallDamage = yield* applyDamage(fallDamage)
        if (tookFallDamage) {
          yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
        }

        // Mob melee is mitigated by the player's equipped armor (4%/point, cap
        // 80%). Fall damage and starvation BYPASS armor in vanilla, so only the
        // hostile-contact source is routed through applyArmorReduction.
        const rawHostileDamage = debugFlags['mobs.enabled'] && debugFlags['mobs.damage']
          ? yield* services.entityManager.getPlayerContactDamage(refreshedPos)
          : 0
        // Armor points reduce damage (4%/point, cap 80%); Protection enchantments
        // add an additional multiplicative reduction (additive per piece, cap 64%).
        const afterArmor = applyArmorReduction(rawHostileDamage, armorPoints)
        const afterProtection = afterArmor * (1 - protectionReduction)
        // Shield blocking: 66% reduction (vanilla). Damages the shield by 1 durability
        // point when a hit is absorbed (same as vanilla — shield breaks at 0 durability).
        const isBlocking = MutableRef.get(refs.isShieldBlockingRef)
        const hostileDamage = isBlocking ? afterProtection * 0.34 : afterProtection
        if (isBlocking && rawHostileDamage > 0) {
          const shieldSlot = yield* services.hotbarService.getSelectedSlot()
          yield* services.inventoryService.damageSlot(SlotIndex.make(HOTBAR_START + shieldSlot), 1)
            .pipe(Effect.catchAllCause(() => Effect.void))
        }
        const tookHostileDamage = yield* applyDamage(hostileDamage)
        if (tookHostileDamage) {
          yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
          // Each piece of worn armor loses 1 durability when the player takes a hit.
          if (rawHostileDamage > 0) {
            // Sequential: damageArmorSlot is a synchronous Ref write; unbounded
            // concurrency would spawn 4 fibers per hit for no parallelism gain.
            yield* Effect.all([
              services.equipmentService.damageArmorSlot('HELMET'),
              services.equipmentService.damageArmorSlot('CHESTPLATE'),
              services.equipmentService.damageArmorSlot('LEGGINGS'),
              services.equipmentService.damageArmorSlot('BOOTS'),
            ], { discard: true }).pipe(Effect.catchAllCause(() => Effect.void))
          }
        }

        const isDead = yield* services.healthService.isDead()
        if (isDead) {
          // FR-1.3: in SURVIVAL, the death-screen overlay (DeathScreenService)
          // owns respawn — it shows "YOU DIED" and waits for the player to click
          // Respawn or Quit-to-Title. Auto-respawning here would race the overlay
          // and produce a 1-frame flicker where the player snaps back to spawn
          // before the screen renders.
          // CREATIVE uses immediate auto-respawn (no death screen).
          // On any death in survival: drop all XP (vanilla — XP orbs are not
          // simulated, so we simply reset to 0).
          yield* services.xpService.reset()
          yield* services.equipmentService.reset()
          // Cancel any dangling fishing cast so the bobber does not persist
          // across the death/respawn boundary.
          yield* services.fishingService.cancel()
          const isCreative = yield* services.gameMode.isCreative()
          if (isCreative) {
            yield* services.healthService.reset()
            const respawnPos = MutableRef.get(deps.respawnPositionRef)
            yield* services.gameState.respawn(respawnPos)
            yield* Ref.set(refs.finalPosRef, respawnPos)
          }
        } else {
          yield* services.healthService.tick()
          const inCreative = yield* services.gameMode.isCreative()

          // Hunger coupling: horizontal distance travelled this frame accrues
          // exhaustion (Minecraft drains the food bar through activity, not idle
          // time). The food tick then either regenerates 1 HP when well-fed or
          // deals 1 starvation damage when the food bar is empty.
          const dx = refreshedPos.x - inputs.initialPlayerPos.x
          const dz = refreshedPos.z - inputs.initialPlayerPos.z
          // Sprint/sneak detection mirrors camera-stage: Ctrl + forward + !sneak.
          // Read once and share between movement and jump exhaustion branches.
          // Sequential: isKeyPressed is a synchronous Set lookup; unbounded
          // concurrency would spawn 4 fibers every frame for no parallelism gain.
          const [ctrlL, ctrlR, forward, sneak] = yield* Effect.all([
            services.inputService.isKeyPressed(KeyMappings.SPRINT),
            services.inputService.isKeyPressed(KeyMappings.SPRINT_ALT),
            services.inputService.isKeyPressed(KeyMappings.MOVE_FORWARD),
            services.inputService.isKeyPressed(KeyMappings.SNEAK),
          ])
          const isSprinting = (ctrlL || ctrlR) && forward && !sneak
          const isSneaking = sneak

          const distanceMoved = Math.hypot(dx, dz)
          // Walk = 0.01/block, sprint = 0.1/block (vanilla Java Edition).
          // Sneaking accrues no exhaustion from movement (vanilla).
          if (distanceMoved > 0 && !isSneaking) {
            const rate = isSprinting ? EXHAUSTION_SPRINT_PER_BLOCK : EXHAUSTION_WALK_PER_BLOCK
            yield* services.hungerService.addExhaustion(distanceMoved * rate)
          }
          // Jump exhaustion: transitioning from grounded to airborne.
          // Sprint-jump = 0.2, normal jump = 0.05 (vanilla). Creative players are immune.
          const wasGrounded = MutableRef.get(refs.wasGroundedRef)
          if (!inCreative && wasGrounded && !isGrounded) {
            yield* services.hungerService.addExhaustion(isSprinting ? EXHAUSTION_SPRINT_JUMP : EXHAUSTION_JUMP)
          }
          MutableRef.set(refs.wasGroundedRef, isGrounded)

          // Regen (and the exhaustion it costs) only when actually below max health,
          // matching vanilla — otherwise an idle full-health player's food drains.
          const healthForRegen = yield* services.healthService.getHealth()
          const hungerEffect = yield* services.hungerService.tick(healthForRegen.current < healthForRegen.max)
          if (hungerEffect === 'regen') {
            yield* services.healthService.heal(1)
          } else if (hungerEffect === 'starve') {
            const starved = yield* applyDamage(1)
            if (starved) {
              yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
            }
          }

          // Advance an active fishing cast. tick() is a no-op when not fishing
          // (returns None without mutating state), so it is safe to call every
          // frame. When the bobber resolves it yields the caught item, which we
          // deposit into the inventory with a soft audible cue. A full inventory
          // drops the catch (catchAll) rather than crashing the frame.
          const caught = Option.getOrNull(yield* services.fishingService.tick(inputs.deltaTime))
          if (caught !== null) {
            yield* Effect.all(
              [
                services.inventoryService.addBlock(caught, 1).pipe(Effect.catchAll(() => Effect.void)),
                services.soundManager.playEffect('blockPlace', { position: refreshedPos }),
              ],
              { concurrency: 'unbounded', discard: true },
            )
          }

          // Lava burn (FR-2 / T14a): standing in LAVA deals LAVA_DAMAGE every
          // LAVA_DAMAGE_INTERVAL_SECS. Creative players are immune (vanilla). The
          // accumulator keeps the cadence frame-rate independent.
          // Fetch the player's chunk column ONCE, then read block types at any Y
          // synchronously. The feet (lava) and eye (drowning) checks share the same
          // x,z column — a single getChunk avoids a redundant per-frame fetch.
          const columnBlockAt = yield* makeColumnReaderAt(services.chunkManagerService, refreshedPos)
          const feetBlock = columnBlockAt(refreshedPos.y)
          if (!inCreative && feetBlock === 'LAVA') {
            const { acc, ticks } = accrueHazardTicks(
              MutableRef.get(refs.lavaDamageSecsRef),
              inputs.deltaTime,
              LAVA_DAMAGE_INTERVAL_SECS,
            )
            MutableRef.set(refs.lavaDamageSecsRef, acc)
            if (ticks > 0) {
              // FIRE_PROTECTION: sum reduction across all worn armor pieces, cap 64%.
              const armorSlots = yield* services.equipmentService.getAll()
              const fireProtTotal = Math.min(
                0.64,
                [armorSlots.HELMET, armorSlots.CHESTPLATE, armorSlots.LEGGINGS, armorSlots.BOOTS].reduce(
                  (acc, slotOpt) => {
                    const fp = enchantmentsOf(slotOpt).find((e) => e.type === 'FIRE_PROTECTION')
                    return acc + (fp ? getFireProtectionReduction(fp.level) : 0)
                  },
                  0,
                ),
              )
              const lavaDamage = LAVA_DAMAGE * ticks * (1 - fireProtTotal)
              const burned = yield* applyDamage(lavaDamage)
              if (burned) {
                yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
              }
            }
          } else {
            MutableRef.set(refs.lavaDamageSecsRef, 0)
          }

          // Drowning (FR-2 / T14b): when the eye-level block is WATER the air supply
          // drains; once empty it deals DROWN_DAMAGE every DROWN_DAMAGE_INTERVAL_SECS.
          // Surfacing instantly refills air. Creative players never drown.
          const eyeBlock = columnBlockAt(refreshedPos.y + EYE_LEVEL_OFFSET)
          const headSubmerged = !inCreative && eyeBlock === 'WATER'
          // RESPIRATION: each level adds 15s to the maximum air supply.
          const helmetOpt = yield* services.equipmentService.getEquippedItem('HELMET')
          const respirationEnch = enchantmentsOf(helmetOpt).find((e) => e.type === 'RESPIRATION')
          const effectiveMaxAirSecs = respirationEnch
            ? MAX_AIR_SECS + getRespirationBonusSecs(respirationEnch.level)
            : MAX_AIR_SECS
          const air = nextAirSecs(MutableRef.get(refs.airSecsRef), headSubmerged, inputs.deltaTime, effectiveMaxAirSecs)
          MutableRef.set(refs.airSecsRef, air)
          if (headSubmerged && air <= 0) {
            const drown = accrueHazardTicks(
              MutableRef.get(refs.drownDamageSecsRef),
              inputs.deltaTime,
              DROWN_DAMAGE_INTERVAL_SECS,
            )
            MutableRef.set(refs.drownDamageSecsRef, drown.acc)
            if (drown.ticks > 0) {
              const drowned = yield* applyDamage(DROWN_DAMAGE * drown.ticks)
              if (drowned) {
                yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
              }
            }
          } else {
            MutableRef.set(refs.drownDamageSecsRef, 0)
          }

          // Air HUD (FR-2 / T14c): bubble count 0-10, shown only while underwater
          // (hidden at full air, like vanilla). Change-gated on the integer count.
          const airBubbles = headSubmerged ? Math.max(0, Math.ceil((air / effectiveMaxAirSecs) * 10)) : 10
          if (MutableRef.get(refs.lastAirBubblesRef) !== airBubbles) {
            MutableRef.set(refs.lastAirBubblesRef, airBubbles)
            if (inputs.airElementOrNull) {
              const el = inputs.airElementOrNull
              yield* Effect.sync(() => {
                if (airBubbles >= 10) {
                  el.style.display = 'none'
                } else {
                  el.style.display = 'block'
                  el.textContent = airBubbles > 0 ? '🫧'.repeat(airBubbles) : '💀 Drowning'
                }
              })
            }
          }
        }

        const health = yield* services.healthService.getHealth()
        // Pre-cached element refs (resolved once at startup in FrameHandlerDeps)
        // FR-006: Only write DOM when health values actually change
        const lastHealth = MutableRef.get(refs.lastHealthRef)
        if (lastHealth.current !== health.current || lastHealth.max !== health.max) {
          MutableRef.set(refs.lastHealthRef, { current: health.current, max: health.max })
          yield* Effect.sync(() => {
            /* c8 ignore next 2 */
            if (inputs.healthValueElementOrNull) inputs.healthValueElementOrNull.textContent = String(health.current)
            if (inputs.healthMaxElementOrNull) inputs.healthMaxElementOrNull.textContent = String(health.max)
          })
        }

        // Hunger HUD — same change-gated write pattern as health (FR-006).
        // foodLevel is the only varying value; max is the fixed MAX_FOOD_LEVEL.
        const hunger = yield* services.hungerService.getHunger()
        const lastHunger = MutableRef.get(refs.lastHungerRef)
        if (lastHunger.foodLevel !== hunger.foodLevel || lastHunger.max !== MAX_FOOD_LEVEL) {
          MutableRef.set(refs.lastHungerRef, { foodLevel: hunger.foodLevel, max: MAX_FOOD_LEVEL })
          yield* Effect.sync(() => {
            /* c8 ignore next 2 */
            if (inputs.hungerValueElementOrNull) inputs.hungerValueElementOrNull.textContent = String(hunger.foodLevel)
            if (inputs.hungerMaxElementOrNull) inputs.hungerMaxElementOrNull.textContent = String(MAX_FOOD_LEVEL)
          })
        }

        // XP HUD — change-gated level and bar progress display.
        const xp = yield* services.xpService.getXP()
        const lastXP = MutableRef.get(refs.lastXPRef)
        if (lastXP.level !== xp.level || lastXP.xpIntoLevel !== xp.xpIntoLevel) {
          MutableRef.set(refs.lastXPRef, { level: xp.level, xpIntoLevel: xp.xpIntoLevel, xpRequiredForNext: xp.xpRequiredForNext })
          yield* Effect.sync(() => {
            /* c8 ignore next 4 */
            if (inputs.xpLevelElementOrNull) inputs.xpLevelElementOrNull.textContent = String(xp.level)
            if (inputs.xpBarElementOrNull) inputs.xpBarElementOrNull.textContent = String(xp.xpIntoLevel)
            if (inputs.xpBarMaxElementOrNull) inputs.xpBarMaxElementOrNull.textContent = String(xp.xpRequiredForNext)
          })
        }

        // Armor HUD — change-gated write reusing the single armorPoints read
        // hoisted above (no second getTotalArmorPoints call).
        const lastArmor = MutableRef.get(refs.lastArmorRef)
        if (lastArmor.armorPoints !== armorPoints) {
          MutableRef.set(refs.lastArmorRef, { armorPoints })
          yield* Effect.sync(() => {
            /* c8 ignore next */
            if (inputs.armorValueElementOrNull) inputs.armorValueElementOrNull.textContent = String(armorPoints)
          })
        }
      }),
      'Health error',
    )

    const playerPos = yield* Ref.get(refs.finalPosRef)

    // ---- Nether portal travel detection ----
    // Check if the player's feet block is NETHER_PORTAL; accumulate time and
    // teleport after PORTAL_ACTIVATION_SECS (frame-rate independent).
    yield* logErrors(
      Effect.gen(function* () {
        const py = Math.floor(playerPos.y)
        const columnBlockAt = yield* makeColumnReaderAt(services.chunkManagerService, playerPos)
        const inPortal = columnBlockAt(py) === 'NETHER_PORTAL'

        if (inPortal) {
          const newSecs = yield* Ref.updateAndGet(refs.portalSecsRef, (s) => s + inputs.deltaTime)
          if (newSecs >= PORTAL_ACTIVATION_SECS) {
            yield* Ref.set(refs.portalSecsRef, 0)
            const currentDim = yield* services.netherService.getDimension()
            const destDimPortals = yield* services.netherService.getPortals(
              currentDim === 'overworld' ? 'nether' : 'overworld',
            )
            const plan = resolveNetherTravel(currentDim, playerPos, destDimPortals)
            yield* services.netherService.setDimension(plan.toDimension)
            yield* services.chunkManagerService.setActiveDimension(plan.toDimension)
            yield* services.gameState.respawn(plan.destination)
            yield* Ref.set(refs.finalPosRef, plan.destination)
            const portalLayout = Option.getOrNull(plan.portalToCreate)
            if (portalLayout !== null) {
              yield* Effect.forEach(
                portalLayout.frame,
                (pos) => services.blockService.forceSetBlock(pos, 'OBSIDIAN').pipe(Effect.catchAll(() => Effect.void)),
                { concurrency: 'unbounded', discard: true },
              )
              yield* Effect.forEach(
                portalLayout.interior,
                (pos) => services.blockService.forceSetBlock(pos, 'NETHER_PORTAL').pipe(Effect.catchAll(() => Effect.void)),
                { concurrency: 'unbounded', discard: true },
              )
              yield* services.netherService.registerPortal(plan.destination, plan.toDimension)
              const allPositions = [...portalLayout.frame, ...portalLayout.interior]
              const affectedCoordKeys = Array.from(
                new Set(allPositions.map((pos) => `${Math.floor(pos.x / CHUNK_SIZE)},${Math.floor(pos.z / CHUNK_SIZE)}`)),
              )
              yield* Effect.forEach(
                affectedCoordKeys,
                (coordKey) => {
                  const parts = coordKey.split(',')
                  const cx = parseInt(parts[0]!, 10)
                  const cz = parseInt(parts[1]!, 10)
                  return services.chunkManagerService.getChunk({ x: cx, z: cz }).pipe(
                    Effect.flatMap((chunk) =>
                      Ref.update(refs.dirtyChunksRef, (map) =>
                        HashMap.set(map, coordKey, { chunk, dirtyAABB: Option.none() }),
                      ),
                    ),
                    Effect.catchAll(() => Effect.void),
                  )
                },
                { concurrency: 'unbounded', discard: true },
              )
            }
          }
        } else {
          yield* Ref.set(refs.portalSecsRef, 0)
        }
      }),
      'Portal travel error',
    )

    // ---- End portal travel detection ----
    // Standing on END_PORTAL triggers instant dimension travel (no charge-up).
    yield* logErrors(
      Effect.gen(function* () {
        const py = Math.floor(playerPos.y)
        const columnBlockAt = yield* makeColumnReaderAt(services.chunkManagerService, playerPos)
        const onEndPortal = columnBlockAt(py) === 'END_PORTAL'
        if (!onEndPortal) return
        const currentDim = yield* services.netherService.getDimension()
        const destDim: Dimension = currentDim === 'end' ? 'overworld' : 'end'
        const destPos = currentDim === 'end'
          ? { x: 0, y: 68, z: 0 }          // return to overworld spawn
          : { x: 0, y: 67, z: 0 }           // The End island center, above surface
        yield* services.netherService.setDimension(destDim)
        yield* services.chunkManagerService.setActiveDimension(destDim)
        yield* services.gameState.respawn(destPos)
        yield* Ref.set(refs.finalPosRef, destPos)
        // Spawn the Ender Dragon when entering The End for the first time
        if (destDim === 'end') {
          const existingEntities = yield* services.entityManager.getEntities()
          const hasDragon = existingEntities.some((e) => e.type === 'EnderDragon')
          if (!hasDragon) {
            yield* services.entityManager.addEntity('EnderDragon', { x: 0, y: 80, z: 20 })
              .pipe(Effect.catchAllCause(() => Effect.void))
          }
        }
      }),
      'End portal travel error',
    )

    return { playerPos: yield* Ref.get(refs.finalPosRef) }
  })
