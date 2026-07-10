import { setSkyExposureProbe } from '@ts-minecraft/entity'
import { Effect, MutableRef, Option as EffectOption, Ref } from 'effect'
import { markEffect } from '@ts-minecraft/rendering'
import { CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import { getParticleUvOffset } from '@ts-minecraft/rendering'
import * as THREE from 'three'
import {
  getBlockCollisionShapeAt as getCachedBlockCollisionShapeAt,
  isBlockSolidForMobPhysics as isCachedBlockSolidForMobPhysics,
  resolveBlockCollisionsInto,
} from '@ts-minecraft/game'
import { MOB_HALF_HEIGHT, MOB_HALF_WIDTH } from '@ts-minecraft/entity/domain/mob/spawner-config'
import { resolveBreedingExperience } from '@ts-minecraft/entity/domain/mob/breeding'
import { DROPPED_ITEM_PICKUP_DELAY_TICKS, type DroppedItemEntity } from '@ts-minecraft/entity/domain/dropped-item'
import type { DroppedXpOrbEntity } from '@ts-minecraft/entity/domain/dropped-xp-orb'
import type { Entity } from '@ts-minecraft/entity/domain/mob/entity'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { LocalEntitySnapshot } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import { runTickable } from '@ts-minecraft/app/frame/frame-fixed-step'
import { addExperienceWithMending } from '@ts-minecraft/app/application/frame/stages/xp-mending'
import { updatePressurePlateStates } from '@ts-minecraft/app/application/frame/stages/entity-update-stage.pressure-plate'
import {
  ENTITY_PHYSICS_CHUNK_OFFSETS,
  ENTITY_PHYSICS_CHUNK_RADIUS,
  hasMissingPhysicsChunk,
} from '@ts-minecraft/app/application/frame/stages/entity-update-stage.physics-chunks'
import { dragonDeathStage } from '@ts-minecraft/app/application/frame/stages/dragon-death-stage'
import { applyPistonWorldEffects } from '@ts-minecraft/app/application/frame/stages/redstone-piston-world-effects'
import { applyLampWorldEffects } from '@ts-minecraft/app/application/frame/stages/redstone-lamp-world-effects'
import { applyObserverWorldEffects } from '@ts-minecraft/app/application/frame/stages/redstone-observer-world-effects'
import { applyHopperWorldEffects } from '@ts-minecraft/app/application/frame/stages/redstone-hopper-world-effects'
import { applyDispenserWorldEffects } from '@ts-minecraft/app/application/frame/stages/redstone-dispenser-world-effects'
import { REDSTONE_TICK_INTERVAL_SECS, FLUID_TICK_INTERVAL_SECS } from '@ts-minecraft/app/frame-handler.config'
import { CHUNK_SIZE, type DeltaTimeSecs, type Position } from '@ts-minecraft/core'

const RENDER_DISABLED_STRUCTURE_VERSION = Number.NEGATIVE_INFINITY
const REMOTE_ENTITY_ID_PREFIX = 'remote:'
const _playerLookDirection = new THREE.Vector3()

export const createLocalEntitySnapshots = (
  entities: ReadonlyArray<Pick<Entity, 'entityId' | 'type' | 'position' | 'health'>>,
): ReadonlyArray<LocalEntitySnapshot> =>
  entities
    .filter((entity) => !String(entity.entityId).startsWith(REMOTE_ENTITY_ID_PREFIX))
    .map((entity) => ({
      entityId: String(entity.entityId),
      entityType: entity.type,
      position: entity.position,
      health: entity.health,
      alive: entity.health > 0,
    }))

const addCollectedDroppedItem = (
  services: Pick<FrameHandlerServices, 'droppedItemService' | 'inventoryService'>,
  item: DroppedItemEntity,
): Effect.Effect<void, never> =>
  services.inventoryService.addBlock(item.itemType, item.count).pipe(
    Effect.catchAll(() =>
      services.droppedItemService.spawn({
        itemType: item.itemType,
        count: item.count,
        position: item.position,
        velocity: item.velocity,
        pickupDelayTicks: DROPPED_ITEM_PICKUP_DELAY_TICKS,
      }).pipe(Effect.asVoid),
    ),
  )

const addCollectedXpOrb = (
  services: Pick<FrameHandlerServices, 'inventoryService' | 'equipmentService' | 'xpService'>,
  orb: DroppedXpOrbEntity,
): Effect.Effect<void, never> => addExperienceWithMending(orb.amount, services)

export const entityUpdateStage = (
  deps: Pick<FrameHandlerDeps, 'scene' | 'camera'>,
  services: Pick<
    FrameHandlerServices,
    'chunkManagerService' | 'droppedItemService' | 'droppedXpOrbService' | 'droppedItemRenderer' | 'droppedXpOrbRenderer' | 'entityManager' | 'entityRenderer' | 'redstoneService' | 'fluidService' | 'particleSystem' | 'inventoryService' | 'equipmentService' | 'xpService' | 'blockService' | 'soundManager' | 'chestService' | 'gameState' | 'gameMode' | 'multiplayer' | 'healthService' | 'hungerService'
  >,
  refs: Pick<
    FrameStageRefs,
    | 'lastEntityStructureVersionRef'
    | 'entityPhysicsChunkCacheRef'
    | 'lastEntityPhysicsChunkCoordRef'
    | 'lastEntityPhysicsLoadedChunksRef'
    | 'lastLoadedChunksRef'
    | 'redstoneTickAccumulatorRef'
    | 'fluidTickAccumulatorRef'
    | 'dirtyChunksRef'
  >,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly debugFlags: DebugFeatureFlags
    readonly playerPos: Position
    readonly totalTimeSecs: number
    readonly isNight: boolean
    readonly daylightBurnProtected?: boolean
    // Co-op peers' positions — the entity host feeds these into mob AI so
    // detection/chase target the nearest player, not just the local one.
    readonly remotePlayerPositions?: ReadonlyArray<Position>
  },
): Effect.Effect<ReadonlyArray<LocalEntitySnapshot>, never> =>
  Effect.gen(function* () {
    const debugFlags = inputs.debugFlags
    const mobsEnabled = debugFlags['mobs.enabled']
    const mobsAiEnabled = mobsEnabled && debugFlags['mobs.ai']
    const mobsDamageEnabled = mobsEnabled && debugFlags['mobs.damage']
    const mobsPhysicsEnabled = mobsEnabled && debugFlags['mobs.physics']
    const mobsRenderEnabled = mobsEnabled && debugFlags['mobs.render']
    const applyPhysics = services.entityManager.applyPhysics
    const needsEntityChunkCache = mobsAiEnabled || mobsDamageEnabled || (mobsPhysicsEnabled && typeof applyPhysics === 'function')
    const playerCx = Math.floor(inputs.playerPos.x / CHUNK_SIZE)
    const playerCz = Math.floor(inputs.playerPos.z / CHUNK_SIZE)
    let chunkCache = yield* Ref.get(refs.entityPhysicsChunkCacheRef)

    if (needsEntityChunkCache) {
      yield* markEffect('entity:chunkCache', Effect.gen(function* () {
      const lastChunkCoord = yield* Ref.get(refs.lastEntityPhysicsChunkCoordRef)
      const loadedChunks = MutableRef.get(refs.lastLoadedChunksRef)
      const lastLoadedChunks = yield* Ref.get(refs.lastEntityPhysicsLoadedChunksRef)
      const loadedChunksValue = EffectOption.getOrNull(loadedChunks)
      const lastLoadedChunksValue = EffectOption.getOrNull(lastLoadedChunks)
      const loadedChunksChanged =
        (loadedChunksValue === null) !== (lastLoadedChunksValue === null) ||
        (loadedChunksValue !== null &&
          lastLoadedChunksValue !== null &&
          loadedChunksValue !== lastLoadedChunksValue)
      const chunkCoordChanged = lastChunkCoord.cx !== playerCx || lastChunkCoord.cz !== playerCz
      const hasMissingChunk = hasMissingPhysicsChunk(chunkCache)

      if (chunkCoordChanged || loadedChunksChanged || hasMissingChunk) {
        const refreshAllChunks = chunkCoordChanged || loadedChunksChanged
        // Mutate the existing cache array in-place to avoid a 9-element Array
        // allocation on every chunk-boundary crossing.  fill() resets all slots
        // when the player moves to a new chunk; individual nulls are filled
        // below when only a partial cache miss remains.
        if (refreshAllChunks) chunkCache.fill(null)

        const chunksToRefresh = ENTITY_PHYSICS_CHUNK_OFFSETS.filter(([, , index]) => refreshAllChunks || chunkCache[index] == null)
        const refreshedChunks = yield* Effect.forEach(
          chunksToRefresh,
          ([dx, dz, index]) =>
            services.chunkManagerService
              .getChunk({ x: playerCx + dx, z: playerCz + dz })
              .pipe(Effect.catchAll(() => Effect.succeed(null)), Effect.map((chunk) => [index, chunk] as const)),
          { concurrency: 8 },
        )
        for (const [index, chunk] of refreshedChunks) {
          if (chunk !== null) chunkCache[index] = chunk
        }

        yield* Ref.set(refs.entityPhysicsChunkCacheRef, chunkCache)
        yield* Ref.set(refs.lastEntityPhysicsChunkCoordRef, { cx: playerCx, cz: playerCz })
        yield* Ref.set(refs.lastEntityPhysicsLoadedChunksRef, loadedChunks)
      }
      }))
    }

    const isBlockSolid = (wx: number, wy: number, wz: number): boolean =>
      isCachedBlockSolidForMobPhysics(wx, wy, wz, chunkCache, playerCx, playerCz, ENTITY_PHYSICS_CHUNK_RADIUS)

    // Sky-exposure probe for daylight burning: an undead under any solid cover
    // (or outside the cached area — conservative burn) is exempt. Scans the
    // column above the head; runs only on burn ticks for a handful of undead.
    setSkyExposureProbe((wx, wy, wz) => {
      for (let y = Math.ceil(wy); y < CHUNK_HEIGHT; y++) {
        if (isBlockSolid(wx, y, wz)) return false
      }
      return true
    })
    const getBlockCollisionShape = (wx: number, wy: number, wz: number) =>
      getCachedBlockCollisionShapeAt(wx, wy, wz, chunkCache, playerCx, playerCz, ENTITY_PHYSICS_CHUNK_RADIUS)

    // Entity simulation stays on the frame lane so visible transforms remain responsive.
    // Slower world simulation (furnace/spawn/village) runs on the maintenance lane.
    if (mobsAiEnabled) {
      deps.camera.getWorldDirection(_playerLookDirection)
      yield* markEffect('entity:ai', logErrors(
        services.entityManager.update(
          inputs.deltaTime,
          inputs.playerPos,
          inputs.isNight,
          _playerLookDirection,
          deps.camera.position,
          (position) => isBlockSolid(position.x, position.y, position.z),
          inputs.daylightBurnProtected ?? false,
          inputs.remotePlayerPositions ?? [],
        ),
        'Entity system error',
      ))
      // R10: reward the player with XP for each animal born this tick (vanilla breeding XP).
      const births = yield* services.entityManager.drainBirths()
      if (births > 0) {
        let breedingExperience = 0
        for (let i = 0; i < births; i++) {
          breedingExperience += resolveBreedingExperience(Math.random())
        }
        yield* logErrors(addExperienceWithMending(breedingExperience, services), 'Breeding XP error')
      }
      // Ender Dragon boss: drain & apply this tick's death events (egg/return-portal block
      // placement + XP fountain). Emitted by entityManager.update() above.
      yield* logErrors(dragonDeathStage(services, refs), 'Dragon death error')
    }

    if (mobsPhysicsEnabled && typeof applyPhysics === 'function') {
      yield* markEffect('entity:physics', logErrors(
        applyPhysics(
          inputs.deltaTime,
          (
            outPos: { x: number; y: number; z: number },
            outVel: { x: number; y: number; z: number },
            position: Position,
            velocity: { x: number; y: number; z: number },
          ) => resolveBlockCollisionsInto(outPos, outVel, position, velocity, MOB_HALF_WIDTH, MOB_HALF_HEIGHT, isBlockSolid, getBlockCollisionShape),
        ),
        'Entity physics error',
      ))
    }

    const entitySnapshotsResult = yield* markEffect('entity:dropsAndRender', logErrors(
      Effect.gen(function* () {
        yield* services.droppedItemService.tick(1, isBlockSolid)
        const collectedItems = yield* services.droppedItemService.collectWithin(inputs.playerPos)
        for (const item of collectedItems) {
          yield* addCollectedDroppedItem(services, item)
        }
        // Pickup feedback: one bright pop + a small sparkle at the item's
        // last position (once per frame, not per stack — no sound pile-up).
        if (collectedItems.length > 0) {
          yield* services.soundManager.playEffect('itemPickup', { position: inputs.playerPos })
          const first = collectedItems[0]!
          const pickupUv = getParticleUvOffset(blockTypeToIndex('GOLD_BLOCK'))
          yield* services.particleSystem.spawnBurst(
            first.position.x,
            first.position.y + 0.3,
            first.position.z,
            pickupUv.u,
            pickupUv.v,
            4,
          )
        }
        yield* services.droppedXpOrbService.tick(1, inputs.playerPos)
        const collectedXpOrbs = yield* services.droppedXpOrbService.collectWithin(inputs.playerPos)
        for (const orb of collectedXpOrbs) {
          yield* addCollectedXpOrb(services, orb)
        }
        const droppedItems = yield* services.droppedItemService.getAll()
        yield* services.droppedItemRenderer.syncItems(droppedItems, deps.scene, inputs.totalTimeSecs)
        const droppedXpOrbs = yield* services.droppedXpOrbService.getAll()
        yield* services.droppedXpOrbRenderer.syncOrbs(droppedXpOrbs, deps.scene, inputs.totalTimeSecs)

        // Sequential synchronous reads stay on the frame lane; nested flatMaps
        // would add callback allocations without any concurrency gain here.
        const entitiesSnapshot = yield* services.entityManager.getEntities()
        const entitySnapshots: ReadonlyArray<LocalEntitySnapshot> = mobsEnabled
          ? createLocalEntitySnapshots(entitiesSnapshot)
          : []
        const structureVersion = yield* services.entityManager.getStructureVersion()
        const lastStructureVersion = yield* Ref.get(refs.lastEntityStructureVersionRef)

        if (!mobsRenderEnabled) {
          /* c8 ignore start -- mobs-disabled render path; idempotent and hard to trigger in frame tests */
          if (lastStructureVersion !== RENDER_DISABLED_STRUCTURE_VERSION) {
            yield* services.entityRenderer.syncEntities([], deps.scene)
            yield* Ref.set(refs.lastEntityStructureVersionRef, RENDER_DISABLED_STRUCTURE_VERSION)
          }
          /* c8 ignore end */
          return entitySnapshots
        }

        if (lastStructureVersion !== structureVersion) {
          yield* services.entityRenderer.syncEntities(entitiesSnapshot, deps.scene)
          yield* Ref.set(refs.lastEntityStructureVersionRef, structureVersion)
        }

        yield* services.entityRenderer.updateEntityTransforms(
          entitiesSnapshot,
          inputs.totalTimeSecs,
          inputs.deltaTime,
        )
        return entitySnapshots
      }),
      'Entity render error',
    ))

    if (debugFlags['simulation.redstone']) {
      yield* markEffect('entity:redstone', logErrors(
        runTickable(
          refs.redstoneTickAccumulatorRef,
          Effect.gen(function* () {
            const entitiesSnapshotEffect: Effect.Effect<ReadonlyArray<Pick<Entity, 'position'>>, never> = mobsEnabled
              ? services.entityManager.getEntities()
              : Effect.succeed([])
            const droppedItemsEffect: Effect.Effect<ReadonlyArray<Pick<DroppedItemEntity, 'position'>>, never> =
              services.droppedItemService.getAll()
            const [entitiesSnapshot, droppedItems] = yield* Effect.all([
              entitiesSnapshotEffect,
              droppedItemsEffect,
            ], { concurrency: 2 })
            yield* updatePressurePlateStates(services.redstoneService, inputs.playerPos, entitiesSnapshot, droppedItems)
            const redstoneComponentsBeforeTick = yield* services.redstoneService.getComponents()
            yield* services.redstoneService.tick()
            const redstoneComponentsAfterTick = yield* services.redstoneService.getComponents()
            yield* applyPistonWorldEffects(
              services,
              refs,
              redstoneComponentsBeforeTick,
              redstoneComponentsAfterTick,
            )
            yield* applyObserverWorldEffects(services, redstoneComponentsAfterTick)
            yield* applyHopperWorldEffects(services, redstoneComponentsAfterTick)
            yield* applyDispenserWorldEffects(services, redstoneComponentsAfterTick)
            yield* applyLampWorldEffects(services, refs, redstoneComponentsAfterTick)
          }),
          inputs.deltaTime,
          REDSTONE_TICK_INTERVAL_SECS,
        ),
        'Redstone system error',
      ))
    }

    if (debugFlags['simulation.fluid']) {
      yield* markEffect('entity:fluid', logErrors(
        runTickable(refs.fluidTickAccumulatorRef, services.fluidService.tick(), inputs.deltaTime, FLUID_TICK_INTERVAL_SECS),
        'Fluid system error',
      ))
    }

    // FR-1.6 — block-break particles: integrate position/velocity/lifetime
    // and write the InstancedMesh's instanceMatrix exactly once per frame.
    if (debugFlags['particles.update']) {
      yield* markEffect('entity:particles', logErrors(services.particleSystem.update(inputs.deltaTime), 'Particle system error'))
    }
    return entitySnapshotsResult ?? []
  })
