// Frame stage: syncs local state to the multiplayer server and applies remote
// world/entity deltas without letting network faults abort rendering.
import { Effect, HashMap, MutableRef, Option, Schema } from 'effect'
import { BlockTypeSchema, CHUNK_SIZE, type Position } from '@ts-minecraft/core'
import { EntityId, EntityType, type EntityType as EntityTypeValue } from '@ts-minecraft/entity/domain/mob/entity'
import { aabbFromVoxel } from '@ts-minecraft/world'
import type {
  LocalEntitySnapshot,
  MultiplayerService,
  RemoteEntitySnapshot,
} from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'

const ACTIVE_REMOTE_ENTITY_TYPES: ReadonlySet<string> = new Set([
  EntityType.Zombie,
  EntityType.Cow,
  EntityType.Pig,
  EntityType.Sheep,
  EntityType.Chicken,
  EntityType.Bat,
  EntityType.Bee,
  EntityType.Squid,
  EntityType.GlowSquid,
  EntityType.Witch,
  EntityType.Drowned,
  EntityType.ZombieVillager,
  EntityType.Creeper,
  EntityType.Skeleton,
  EntityType.Spider,
  EntityType.Enderman,
  EntityType.EnderDragon,
  EntityType.Endermite,
])

const isActiveRemoteEntityType = (value: string): value is EntityTypeValue =>
  ACTIVE_REMOTE_ENTITY_TYPES.has(value)

const remoteEntityId = (snapshot: RemoteEntitySnapshot): EntityId =>
  EntityId.make(`remote:${snapshot.playerId}:${snapshot.entityId}`)

const EMPTY_BROADCAST: ReadonlyMap<string, LocalEntitySnapshot> = new Map()

export const multiplayerStage = (
  multiplayer: MultiplayerService,
  services: Pick<FrameHandlerServices, 'entityManager'>,
  refs: Pick<FrameStageRefs, 'lastBroadcastEntitySnapshotsRef'>,
  playerPos: { readonly x: number; readonly y: number; readonly z: number },
  playerYaw: number,
  playerPitch: number,
  entitySnapshots: ReadonlyArray<LocalEntitySnapshot> = [],
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* multiplayer
      .sendPositionUpdate(playerPos, { yaw: playerYaw, pitch: playerPitch })
      .pipe(Effect.catchAll(() => Effect.void))

    const isAuthority = yield* multiplayer.isEntityAuthority().pipe(
      Effect.catchAll(() => Effect.succeed(true)),
    )

    if (!isAuthority) {
      // Another client is the entity host: our own simulation must not leak
      // into the session. Remove any locally simulated mobs (entitySnapshots
      // is exactly the list of non-remote entities this frame) — the host's
      // authoritative copies arrive via applyInboundEntitySnapshots.
      MutableRef.set(refs.lastBroadcastEntitySnapshotsRef, EMPTY_BROADCAST)
      for (const snapshot of entitySnapshots) {
        yield* services.entityManager
          .removeEntity(EntityId.make(snapshot.entityId))
          .pipe(Effect.catchAll(() => Effect.void))
      }
      return
    }

    const previousBroadcast = MutableRef.get(refs.lastBroadcastEntitySnapshotsRef)
    const currentBroadcast = new Map<string, LocalEntitySnapshot>()
    for (const snapshot of entitySnapshots) {
      currentBroadcast.set(snapshot.entityId, snapshot)
      yield* multiplayer.sendEntitySnapshot(snapshot).pipe(Effect.catchAll(() => Effect.void))
    }
    // Entities we broadcast last frame but not this one were removed locally
    // (killed/despawned). Without a final alive:false, every other client
    // keeps a ghost copy forever — remote mirrors are exempt from local
    // distance despawn by design.
    for (const [entityId, lastSnapshot] of previousBroadcast) {
      if (currentBroadcast.has(entityId)) continue
      yield* multiplayer
        .sendEntitySnapshot({ ...lastSnapshot, health: 0, alive: false })
        .pipe(Effect.catchAll(() => Effect.void))
    }
    MutableRef.set(refs.lastBroadcastEntitySnapshotsRef, currentBroadcast)
  })

/**
 * Entity host side of non-host combat: applies hits relayed by the server
 * (knockback first, then damage — a lethal hit removes the entity). Loot and
 * XP are intentionally NOT spawned here; the attacking client already rolled
 * its drops locally as prediction, so spawning again would duplicate loot.
 */
export const applyInboundEntityDamages = (
  multiplayer: MultiplayerService,
  services: Pick<FrameHandlerServices, 'entityManager'>,
): Effect.Effect<void, never> =>
  multiplayer.drainEntityDamages.pipe(
    Effect.flatMap((damages) =>
      Effect.gen(function* () {
        for (const hit of damages) {
          const entityId = EntityId.make(hit.entityId)
          yield* services.entityManager
            .applyKnockback(entityId, hit.knockback)
            .pipe(
              Effect.flatMap(() => services.entityManager.applyDamage(entityId, hit.damage)),
              Effect.asVoid,
              Effect.catchAll(() => Effect.void),
            )
        }
      }),
    ),
  )

/**
 * FR-3: applies block edits received from remote players to the local world.
 * Drains the multiplayer inbound queue, force-sets each voxel (place → block,
 * break → AIR), and records the chunk in dirtyChunksRef so frame-maintenance
 * remeshes it — the same dirty-chunk path local edits use. Fully fault-isolated:
 * a bad edit is skipped, never crashing the frame.
 */
export const applyInboundBlockEdits = (
  multiplayer: MultiplayerService,
  services: Pick<FrameHandlerServices, 'blockService' | 'chunkManagerService'>,
  dirtyChunksRef: FrameStageRefs['dirtyChunksRef'],
): Effect.Effect<void, never> =>
  multiplayer.drainBlockEdits.pipe(
    Effect.flatMap((edits) =>
      Effect.gen(function* () {
        for (const edit of edits) {
          const blockType = edit.kind === 'place' ? edit.blockType : 'AIR'
          // Validate against the canonical block-type set before mutating the world.
          if (!Schema.is(BlockTypeSchema)(blockType)) continue
          const pos = { x: edit.x, y: edit.y, z: edit.z } as Position
          const chunkCoord = { x: Math.floor(edit.x / CHUNK_SIZE), z: Math.floor(edit.z / CHUNK_SIZE) }
          const coordKey = `${chunkCoord.x},${chunkCoord.z}`
          const lx = ((edit.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const lz = ((edit.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          yield* services.blockService.forceSetBlock(pos, blockType).pipe(
            Effect.flatMap(() => services.chunkManagerService.getChunk(chunkCoord)),
            Effect.flatMap((chunk) =>
              Effect.sync(() => {
                MutableRef.set(
                  dirtyChunksRef,
                  HashMap.set(MutableRef.get(dirtyChunksRef), coordKey, {
                    chunk,
                    dirtyAABB: Option.some(aabbFromVoxel({ lx, y: edit.y, lz })),
                  }),
                )
              }),
            ),
          ).pipe(Effect.catchAll(() => Effect.void))
        }
      }),
    ),
  )

export const applyInboundEntitySnapshots = (
  multiplayer: MultiplayerService,
  services: Pick<FrameHandlerServices, 'entityManager'>,
): Effect.Effect<void, never> =>
  multiplayer.drainEntitySnapshots.pipe(
    Effect.flatMap((snapshots) =>
      Effect.gen(function* () {
        for (const snapshot of snapshots) {
          if (!isActiveRemoteEntityType(snapshot.entityType)) continue
          yield* services.entityManager
            .applyEntitySnapshot({
              entityId: remoteEntityId(snapshot),
              entityType: snapshot.entityType,
              position: snapshot.position,
              health: snapshot.health,
              alive: snapshot.alive,
            })
            .pipe(Effect.catchAll(() => Effect.void))
        }
      }),
    ),
  )
