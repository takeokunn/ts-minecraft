import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { applyArmorReduction } from '@ts-minecraft/entity'
import { DEFAULT_PLAYER_ID, CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType } from '@ts-minecraft/core'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import { EXHAUSTION_SPRINT_PER_BLOCK, MAX_FOOD_LEVEL } from '@ts-minecraft/entity'
import { resolveNetherTravel, type Dimension } from '@ts-minecraft/world'

/** Seconds a player must stand in a NETHER_PORTAL block to trigger dimension travel. */
const PORTAL_ACTIVATION_SECS = 4.0

export const physicsStage = (
  deps: Pick<FrameHandlerDeps, 'respawnPositionRef'>,
  services: Pick<
    FrameHandlerServices,
    'gameState' | 'healthService' | 'hungerService' | 'xpService' | 'equipmentService' | 'fishingService' | 'inventoryService' | 'soundManager' | 'entityManager' | 'gameMode' | 'debugFeatureFlags' | 'chunkManagerService' | 'netherService' | 'blockService'
  >,
  refs: Pick<FrameStageRefs, 'lastHealthRef' | 'lastHungerRef' | 'lastXPRef' | 'lastArmorRef' | 'portalSecsRef' | 'dirtyChunksRef'>,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly initialPlayerPos: Position
    readonly healthValueElementOrNull: HTMLElement | null
    readonly healthMaxElementOrNull: HTMLElement | null
    readonly hungerValueElementOrNull: HTMLElement | null
    readonly hungerMaxElementOrNull: HTMLElement | null
    readonly xpLevelElementOrNull: HTMLElement | null
    readonly xpBarElementOrNull: HTMLElement | null
    readonly armorValueElementOrNull: HTMLElement | null
  },
): Effect.Effect<{ readonly playerPos: Position }, never> =>
  Effect.gen(function* () {
    const debugFlags = yield* services.debugFeatureFlags.getFlags()

    // Update game state (input -> movement -> physics -> position sync)
    yield* logErrors(services.gameState.update(inputs.deltaTime), 'Physics update error')

    // Health: fall damage processing and HUD update
    const finalPosRef = yield* Ref.make(inputs.initialPlayerPos)

    yield* logErrors(
      Effect.gen(function* () {
        const refreshedPos = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
          Effect.catchAllCause(() => Effect.succeed(inputs.initialPlayerPos)),
        )
        yield* Ref.set(finalPosRef, refreshedPos)

        // Read total armor points ONCE per frame. Reused below for both incoming
        // hostile-damage mitigation (applyArmorReduction) and the armor HUD.
        const armorPoints = yield* services.equipmentService.getTotalArmorPoints()
        const protectionReduction = yield* services.equipmentService.getTotalProtectionReduction()

        const tryApplyPlayerDamage = (amount: number): Effect.Effect<boolean, never> =>
          amount <= 0
            ? Effect.succeed(false)
            : services.healthService.getHealth().pipe(
                Effect.flatMap((health) =>
                  health.current <= 0 || health.invincibilityTicks > 0
                    ? Effect.succeed(false)
                    : services.healthService.applyDamage(amount).pipe(Effect.as(true)),
                ),
              )

        const isGrounded = yield* services.gameState.isPlayerGrounded()
        const fallDamage = yield* services.healthService.processFallDamage(refreshedPos.y, isGrounded)
        const tookFallDamage = yield* tryApplyPlayerDamage(fallDamage)
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
        const hostileDamage = afterArmor * (1 - protectionReduction)
        const tookHostileDamage = yield* tryApplyPlayerDamage(hostileDamage)
        if (tookHostileDamage) {
          yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
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
            yield* Ref.set(finalPosRef, respawnPos)
          }
        } else {
          yield* services.healthService.tick()

          // Hunger coupling: horizontal distance travelled this frame accrues
          // exhaustion (Minecraft drains the food bar through activity, not idle
          // time). The food tick then either regenerates 1 HP when well-fed or
          // deals 1 starvation damage when the food bar is empty.
          const dx = refreshedPos.x - inputs.initialPlayerPos.x
          const dz = refreshedPos.z - inputs.initialPlayerPos.z
          const distanceMoved = Math.hypot(dx, dz)
          if (distanceMoved > 0) {
            yield* services.hungerService.addExhaustion(distanceMoved * EXHAUSTION_SPRINT_PER_BLOCK)
          }

          // Regen (and the exhaustion it costs) only when actually below max health,
          // matching vanilla — otherwise an idle full-health player's food drains.
          const healthForRegen = yield* services.healthService.getHealth()
          const hungerEffect = yield* services.hungerService.tick(healthForRegen.current < healthForRegen.max)
          if (hungerEffect === 'regen') {
            yield* services.healthService.heal(1)
          } else if (hungerEffect === 'starve') {
            const starved = yield* tryApplyPlayerDamage(1)
            if (starved) {
              yield* services.soundManager.playEffect('playerHurt', { position: refreshedPos })
            }
          }

          // Advance an active fishing cast. tick() is a no-op when not fishing
          // (returns None without mutating state), so it is safe to call every
          // frame. When the bobber resolves it yields the caught item, which we
          // deposit into the inventory with a soft audible cue. A full inventory
          // drops the catch (catchAll) rather than crashing the frame.
          const caught = yield* services.fishingService.tick(inputs.deltaTime)
          yield* Option.match(caught, {
            onNone: () => Effect.void,
            onSome: (item) =>
              Effect.all(
                [
                  services.inventoryService.addBlock(item, 1).pipe(Effect.catchAll(() => Effect.void)),
                  services.soundManager.playEffect('blockPlace', { position: refreshedPos }),
                ],
                { concurrency: 'unbounded', discard: true },
              ),
          })
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
            /* c8 ignore next 3 */
            if (inputs.xpLevelElementOrNull) inputs.xpLevelElementOrNull.textContent = String(xp.level)
            if (inputs.xpBarElementOrNull) inputs.xpBarElementOrNull.textContent = String(xp.xpIntoLevel)
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

    const playerPos = yield* Ref.get(finalPosRef)

    // ---- Nether portal travel detection ----
    // Check if the player's feet block is NETHER_PORTAL; accumulate time and
    // teleport after PORTAL_ACTIVATION_SECS (frame-rate independent).
    yield* logErrors(
      Effect.gen(function* () {
        const px = Math.floor(playerPos.x)
        const py = Math.floor(playerPos.y)
        const pz = Math.floor(playerPos.z)
        const chunkCoord = {
          x: Math.floor(px / CHUNK_SIZE),
          z: Math.floor(pz / CHUNK_SIZE),
        }
        const lx = ((px % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const lz = ((pz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const chunkOpt = yield* services.chunkManagerService.getChunk(chunkCoord).pipe(Effect.option)
        const inPortal = Option.match(chunkOpt, {
          onNone: () => false,
          onSome: (chunk) => {
            const idx = py + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
            return py >= 0 && py < CHUNK_HEIGHT && indexToBlockType(chunk.blocks[idx] ?? 0) === 'NETHER_PORTAL'
          },
        })

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
            yield* Ref.set(finalPosRef, plan.destination)
            yield* Option.match(plan.portalToCreate, {
              onNone: () => Effect.void,
              onSome: (layout) =>
                Effect.gen(function* () {
                  yield* Effect.forEach(
                    layout.frame,
                    (pos) => services.blockService.forceSetBlock(pos, 'OBSIDIAN').pipe(Effect.catchAll(() => Effect.void)),
                    { concurrency: 'unbounded', discard: true },
                  )
                  yield* Effect.forEach(
                    layout.interior,
                    (pos) => services.blockService.forceSetBlock(pos, 'NETHER_PORTAL').pipe(Effect.catchAll(() => Effect.void)),
                    { concurrency: 'unbounded', discard: true },
                  )
                  yield* services.netherService.registerPortal(plan.destination, plan.toDimension)
                  const allPositions = [...layout.frame, ...layout.interior]
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
                }),
            })
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
        const px = Math.floor(playerPos.x)
        const py = Math.floor(playerPos.y)
        const pz = Math.floor(playerPos.z)
        const chunkCoord = { x: Math.floor(px / CHUNK_SIZE), z: Math.floor(pz / CHUNK_SIZE) }
        const lx = ((px % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const lz = ((pz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const chunkOpt = yield* services.chunkManagerService.getChunk(chunkCoord).pipe(Effect.option)
        const onEndPortal = Option.match(chunkOpt, {
          onNone: () => false,
          onSome: (chunk) => {
            const idx = py + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
            return py >= 0 && py < CHUNK_HEIGHT && indexToBlockType(chunk.blocks[idx] ?? 0) === 'END_PORTAL'
          },
        })
        if (!onEndPortal) return
        const currentDim = yield* services.netherService.getDimension()
        const destDim: Dimension = currentDim === 'end' ? 'overworld' : 'end'
        const destPos = currentDim === 'end'
          ? { x: 0, y: 68, z: 0 }          // return to overworld spawn
          : { x: 0, y: 67, z: 0 }           // The End island center, above surface
        yield* services.netherService.setDimension(destDim)
        yield* services.chunkManagerService.setActiveDimension(destDim)
        yield* services.gameState.respawn(destPos)
        yield* Ref.set(finalPosRef, destPos)
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

    return { playerPos: yield* Ref.get(finalPosRef) }
  })
