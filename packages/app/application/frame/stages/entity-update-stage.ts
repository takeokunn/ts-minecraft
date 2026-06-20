import { Effect, MutableRef, Option as EffectOption, Ref } from 'effect'
import * as THREE from 'three'
import {
  getBlockCollisionShapeAt as getCachedBlockCollisionShapeAt,
  isBlockSolid as isCachedBlockSolid,
  PRESSURE_PLATE_COLLISION_HEIGHT,
  resolveBlockCollisionsInto,
} from '@ts-minecraft/game'
import { MOB_HALF_HEIGHT, MOB_HALF_WIDTH } from '@ts-minecraft/entity/domain/mob/spawner-config'
import { resolveBreedingExperience } from '@ts-minecraft/entity/domain/mob/breeding'
import { DROPPED_ITEM_PICKUP_DELAY_TICKS, type DroppedItemEntity } from '@ts-minecraft/entity/domain/dropped-item'
import type { DroppedXpOrbEntity } from '@ts-minecraft/entity/domain/dropped-xp-orb'
import { RedstoneComponentType } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import type { Entity } from '@ts-minecraft/entity/domain/mob/entity'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { runTickable } from '@ts-minecraft/app/frame/frame-fixed-step'
import { addExperienceWithMending } from '@ts-minecraft/app/application/frame/stages/xp-mending'
import { REDSTONE_TICK_INTERVAL_SECS, FLUID_TICK_INTERVAL_SECS } from '@ts-minecraft/app/frame-handler.config'
import { CHUNK_SIZE, type DeltaTimeSecs, type Position } from '@ts-minecraft/core'

const ENTITY_PHYSICS_CHUNK_OFFSETS = [
  [-1, -1, 0], [-1, 0, 1], [-1, 1, 2],
  [0, -1, 3], [0, 0, 4], [0, 1, 5],
  [1, -1, 6], [1, 0, 7], [1, 1, 8],
] as const
const RENDER_DISABLED_STRUCTURE_VERSION = Number.NEGATIVE_INFINITY
const _playerLookDirection = new THREE.Vector3()
const PRESSURE_PLATE_PLAYER_VERTICAL_REACH = 1.75

const hasMissingPhysicsChunk = (chunkCache: ReadonlyArray<unknown>): boolean => {
  for (let i = 0; i < chunkCache.length; i++) {
    if (chunkCache[i] == null) return true
  }
  return false
}

export const isPlayerPressingPressurePlate = (playerPos: Position, platePos: Position): boolean => {
  const overlapsHorizontally =
    playerPos.x >= platePos.x &&
    playerPos.x < platePos.x + 1 &&
    playerPos.z >= platePos.z &&
    playerPos.z < platePos.z + 1
  const verticalOffset = playerPos.y - platePos.y
  return overlapsHorizontally && verticalOffset >= 0 && verticalOffset <= PRESSURE_PLATE_PLAYER_VERTICAL_REACH
}

export const isEntityPressingPressurePlate = (entity: Pick<Entity, 'position'>, platePos: Position): boolean => {
  const pos = entity.position
  const overlapsHorizontally =
    pos.x + MOB_HALF_WIDTH > platePos.x &&
    pos.x - MOB_HALF_WIDTH < platePos.x + 1 &&
    pos.z + MOB_HALF_WIDTH > platePos.z &&
    pos.z - MOB_HALF_WIDTH < platePos.z + 1
  const entityBottom = pos.y - MOB_HALF_HEIGHT
  const entityTop = pos.y + MOB_HALF_HEIGHT
  return overlapsHorizontally && entityBottom <= platePos.y + PRESSURE_PLATE_COLLISION_HEIGHT && entityTop >= platePos.y
}

const isAnyEntityPressingPressurePlate = (entities: ReadonlyArray<Pick<Entity, 'position'>>, platePos: Position): boolean => {
  for (const entity of entities) {
    if (isEntityPressingPressurePlate(entity, platePos)) return true
  }
  return false
}

export const updatePressurePlateStates = (
  redstoneService: Pick<FrameHandlerServices['redstoneService'], 'getComponents' | 'setPressurePlatePressed'>,
  playerPos: Position,
  entities: ReadonlyArray<Pick<Entity, 'position'>> = [],
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const components = yield* redstoneService.getComponents()
    for (const component of components) {
      if (component.type !== RedstoneComponentType.PressurePlate) continue
      yield* redstoneService.setPressurePlatePressed(
        component.position,
        isPlayerPressingPressurePlate(playerPos, component.position) ||
          isAnyEntityPressingPressurePlate(entities, component.position),
      )
    }
  })

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
    'chunkManagerService' | 'droppedItemService' | 'droppedXpOrbService' | 'droppedItemRenderer' | 'droppedXpOrbRenderer' | 'entityManager' | 'entityRenderer' | 'redstoneService' | 'fluidService' | 'particleSystem' | 'inventoryService' | 'equipmentService' | 'xpService'
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
  >,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly debugFlags: DebugFeatureFlags
    readonly playerPos: Position
    readonly totalTimeSecs: number
    readonly isNight: boolean
    readonly daylightBurnProtected?: boolean
  },
): Effect.Effect<void, never> =>
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

        // Sequential for...of: chunk boundary crossing event (not per-frame).
        // Individual yield* avoids fiber spawn + Effect.gen callback allocations.
        for (const [dx, dz, index] of ENTITY_PHYSICS_CHUNK_OFFSETS) {
          /* c8 ignore next 3 -- cache-hit path: requires 2nd frame at same chunk coord with partial cache populated */
          if (!refreshAllChunks && chunkCache[index] != null) continue
          const chunk = yield* services.chunkManagerService.getChunk({ x: playerCx + dx, z: playerCz + dz }).pipe(Effect.catchAll(() => Effect.succeed(null)))
          if (chunk !== null) chunkCache[index] = chunk
        }

        yield* Ref.set(refs.entityPhysicsChunkCacheRef, chunkCache)
        yield* Ref.set(refs.lastEntityPhysicsChunkCoordRef, { cx: playerCx, cz: playerCz })
        yield* Ref.set(refs.lastEntityPhysicsLoadedChunksRef, loadedChunks)
      }
    }

    const isBlockSolid = (wx: number, wy: number, wz: number): boolean =>
      isCachedBlockSolid(wx, wy, wz, chunkCache, playerCx, playerCz)
    const getBlockCollisionShape = (wx: number, wy: number, wz: number) =>
      getCachedBlockCollisionShapeAt(wx, wy, wz, chunkCache, playerCx, playerCz)

    // Entity simulation stays on the frame lane so visible transforms remain responsive.
    // Slower world simulation (furnace/spawn/village) runs on the maintenance lane.
    if (mobsAiEnabled) {
      deps.camera.getWorldDirection(_playerLookDirection)
      yield* logErrors(
        services.entityManager.update(
          inputs.deltaTime,
          inputs.playerPos,
          inputs.isNight,
          _playerLookDirection,
          deps.camera.position,
          (position) => isBlockSolid(position.x, position.y, position.z),
          inputs.daylightBurnProtected ?? false,
        ),
        'Entity system error',
      )
      // R10: reward the player with XP for each animal born this tick (vanilla breeding XP).
      const births = yield* services.entityManager.drainBirths()
      if (births > 0) {
        let breedingExperience = 0
        for (let i = 0; i < births; i++) {
          breedingExperience += resolveBreedingExperience(Math.random())
        }
        yield* logErrors(addExperienceWithMending(breedingExperience, services), 'Breeding XP error')
      }
    }

    if (mobsPhysicsEnabled && typeof applyPhysics === 'function') {
      yield* logErrors(
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
      )
    }

    yield* logErrors(
      Effect.gen(function* () {
        yield* services.droppedItemService.tick()
        const collectedItems = yield* services.droppedItemService.collectWithin(inputs.playerPos)
        for (const item of collectedItems) {
          yield* addCollectedDroppedItem(services, item)
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
        const structureVersion = yield* services.entityManager.getStructureVersion()
        const lastStructureVersion = yield* Ref.get(refs.lastEntityStructureVersionRef)

        if (!mobsRenderEnabled) {
          /* c8 ignore start -- mobs-disabled render path; idempotent and hard to trigger in frame tests */
          if (lastStructureVersion !== RENDER_DISABLED_STRUCTURE_VERSION) {
            yield* services.entityRenderer.syncEntities([], deps.scene)
            yield* Ref.set(refs.lastEntityStructureVersionRef, RENDER_DISABLED_STRUCTURE_VERSION)
          }
          /* c8 ignore end */
          return
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
      }),
      'Entity render error',
    )

    if (debugFlags['simulation.redstone']) {
      yield* logErrors(
        runTickable(
          refs.redstoneTickAccumulatorRef,
          Effect.gen(function* () {
            const entitiesSnapshot = mobsEnabled ? yield* services.entityManager.getEntities() : []
            yield* updatePressurePlateStates(services.redstoneService, inputs.playerPos, entitiesSnapshot)
            yield* services.redstoneService.tick()
          }),
          inputs.deltaTime,
          REDSTONE_TICK_INTERVAL_SECS,
        ),
        'Redstone system error',
      )
    }

    if (debugFlags['simulation.fluid']) {
      yield* logErrors(
        runTickable(refs.fluidTickAccumulatorRef, services.fluidService.tick(), inputs.deltaTime, FLUID_TICK_INTERVAL_SECS),
        'Fluid system error',
      )
    }

    // FR-1.6 — block-break particles: integrate position/velocity/lifetime
    // and write the InstancedMesh's instanceMatrix exactly once per frame.
    if (debugFlags['particles.update']) {
      yield* logErrors(services.particleSystem.update(inputs.deltaTime), 'Particle system error')
    }
  })
