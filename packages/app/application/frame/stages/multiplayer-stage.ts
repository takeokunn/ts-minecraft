// Frame stage: syncs local state to the multiplayer server and applies remote
// world/entity deltas without letting network faults abort rendering.
import { Effect, HashMap, MutableRef, Option, Schema } from 'effect'
import { BlockTypeSchema, CHUNK_SIZE, InventoryItemSchema, StackCountSchema, type InventoryItem, type Position, type StackCount } from '@ts-minecraft/core'
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
  EntityType.Guardian,
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

// Chest-close edge detector: while the inventory UI is open on a chest we
// remember its position; the frame the UI closes we broadcast that chest's
// full slot array (last-writer-wins). Module scratch keyed to the frame loop —
// the broadcast re-reads local state, so a stale remembered position after a
// session swap resolves to None and sends nothing.
let openChestPosition: { readonly x: number; readonly y: number; readonly z: number } | null = null
export const resetChestSyncStateForTest = (): void => { openChestPosition = null }

const toWireSlots = (
  slots: ReadonlyArray<Option.Option<{ readonly itemType: string; readonly count: number; readonly durability: number | null }>>,
): ReadonlyArray<{ readonly itemType: string; readonly count: number; readonly durability: number | null } | null> =>
  slots.map((slot) =>
    Option.match(slot, {
      onNone: () => null,
      onSome: (stack) => ({ itemType: String(stack.itemType), count: Number(stack.count), durability: stack.durability }),
    }),
  )

export const broadcastChestOnClose = (
  multiplayer: MultiplayerService,
  services: Pick<FrameHandlerServices, 'chestService' | 'inventoryRenderer'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const uiOpen = yield* services.inventoryRenderer.isOpen()
    if (uiOpen) {
      const state = yield* services.chestService.getState()
      const selected = Option.getOrNull(state.selectedChestPosition)
      if (selected !== null) openChestPosition = selected
      return
    }
    if (openChestPosition === null) return
    const position = openChestPosition
    openChestPosition = null
    const chestOpt = yield* services.chestService.getChestStateAt(position)
    const chest = Option.getOrNull(chestOpt)
    if (chest === null) return
    yield* multiplayer
      .sendContainerUpdate(position, toWireSlots(chest.slots))
      .pipe(Effect.catchAll(() => Effect.void))
  })

// Applies remote chest snapshots. Slots are validated against the canonical
// item union and stack bounds; a chest carrying any invalid slot is skipped
// whole (a partial chest would silently delete another player's items).
export const applyInboundContainerUpdates = (
  multiplayer: MultiplayerService,
  services: Pick<FrameHandlerServices, 'chestService'>,
): Effect.Effect<void, never> =>
  multiplayer.drainContainerUpdates.pipe(
    Effect.flatMap((updates) =>
      Effect.gen(function* () {
        for (const update of updates) {
          const slots: Array<Option.Option<{ itemType: InventoryItem; count: StackCount; durability: number | null }>> = []
          let valid = true
          for (const slot of update.slots) {
            if (slot === null) {
              slots.push(Option.none())
              continue
            }
            if (!Schema.is(InventoryItemSchema)(slot.itemType) || !Schema.is(StackCountSchema)(slot.count)) {
              valid = false
              break
            }
            slots.push(Option.some({ itemType: slot.itemType, count: slot.count, durability: slot.durability }))
          }
          if (!valid) continue
          yield* services.chestService
            .applyRemoteChestState({ position: { x: update.x, y: update.y, z: update.z }, slots })
            .pipe(Effect.catchAll(() => Effect.void))
        }
      }),
    ),
  )

// ─── Dropped-item sync ────────────────────────────────────────────────────────
// The owner broadcasts spawns/upserts (new id, or count change from merging)
// and removals (id vanished: collected, expired, merged away, hopper-eaten).
// Peers mirror items under `remote:<owner>:<id>` with merging disabled — the
// owner's upserts are the single source of truth for a mirror's count. A peer
// collecting a mirror makes it vanish locally, which the same diff turns into
// a removal addressed to the ORIGINAL owner, deleting the authoritative copy.
// Known limitation: two players grabbing one item inside the network round
// trip both keep it (no server-side pickup arbitration).
const MIRROR_ID_PREFIX = 'remote:'

const mirrorDroppedItemId = (ownerId: string, itemId: string): string =>
  `${MIRROR_ID_PREFIX}${ownerId}:${itemId}`

// itemId never contains ':' (locally generated `dropped-item-N`), so the last
// colon splits owner from item even if owner ids ever contain colons.
const parseMirrorDroppedItemId = (id: string): { readonly ownerId: string; readonly itemId: string } | null => {
  if (!id.startsWith(MIRROR_ID_PREFIX)) return null
  const rest = id.slice(MIRROR_ID_PREFIX.length)
  const splitAt = rest.lastIndexOf(':')
  if (splitAt <= 0) return null
  return { ownerId: rest.slice(0, splitAt), itemId: rest.slice(splitAt + 1) }
}

let lastLocalDroppedItems: ReadonlyMap<string, number> = new Map()
let lastMirrorDroppedItemIds: ReadonlySet<string> = new Set()
export const resetDroppedItemSyncStateForTest = (): void => {
  lastLocalDroppedItems = new Map()
  lastMirrorDroppedItemIds = new Set()
}

export const syncDroppedItems = (
  multiplayer: MultiplayerService,
  services: Pick<FrameHandlerServices, 'droppedItemService'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const localPlayerId = yield* multiplayer.getLocalPlayerId().pipe(Effect.catchAll(() => Effect.succeed(null)))
    if (localPlayerId === null) return
    const items = yield* services.droppedItemService.getAll()
    const currentLocal = new Map<string, number>()
    const currentMirrors = new Set<string>()
    for (const item of items) {
      if (item.id.startsWith(MIRROR_ID_PREFIX)) currentMirrors.add(item.id)
      else currentLocal.set(item.id, item.count)
    }
    // Own items: broadcast new ids and count changes (merge absorptions).
    for (const item of items) {
      if (item.id.startsWith(MIRROR_ID_PREFIX)) continue
      if (lastLocalDroppedItems.get(item.id) === item.count) continue
      yield* multiplayer
        .sendDroppedItemSpawn({
          itemId: item.id,
          itemType: String(item.itemType),
          count: item.count,
          position: item.position,
          velocity: item.velocity,
        })
        .pipe(Effect.catchAll(() => Effect.void))
    }
    // Own items that vanished: tell peers to drop their mirrors.
    for (const id of lastLocalDroppedItems.keys()) {
      if (currentLocal.has(id)) continue
      yield* multiplayer.sendDroppedItemRemove(localPlayerId, id).pipe(Effect.catchAll(() => Effect.void))
    }
    // Mirrors that vanished (we collected them, or they expired): tell the
    // owner — and everyone else — to remove the original.
    for (const id of lastMirrorDroppedItemIds) {
      if (currentMirrors.has(id)) continue
      const parsed = parseMirrorDroppedItemId(id)
      if (parsed === null) continue
      yield* multiplayer.sendDroppedItemRemove(parsed.ownerId, parsed.itemId).pipe(Effect.catchAll(() => Effect.void))
    }
    lastLocalDroppedItems = currentLocal
    lastMirrorDroppedItemIds = currentMirrors
  })

export const applyInboundDroppedItems = (
  multiplayer: MultiplayerService,
  services: Pick<FrameHandlerServices, 'droppedItemService'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const localPlayerId = yield* multiplayer.getLocalPlayerId().pipe(Effect.catchAll(() => Effect.succeed(null)))
    const spawns = yield* multiplayer.drainDroppedItemSpawns
    for (const spawn of spawns) {
      if (!Schema.is(InventoryItemSchema)(spawn.itemType)) continue
      if (!Number.isInteger(spawn.count) || spawn.count <= 0) continue
      yield* services.droppedItemService
        .spawn({
          id: mirrorDroppedItemId(spawn.ownerId, spawn.itemId),
          noMerge: true,
          itemType: spawn.itemType,
          count: spawn.count,
          position: spawn.position,
          velocity: spawn.velocity,
          // Normal pickup delay so a peer standing on the drop point doesn't
          // vacuum it before the thrower's own delay elapses.
          pickupDelayTicks: 10,
        })
        .pipe(Effect.catchAll(() => Effect.void))
      // An upsert must not later read as "vanished → broadcast remove": keep
      // the mirror bookkeeping in step with what we just applied.
      lastMirrorDroppedItemIds = new Set([...lastMirrorDroppedItemIds, mirrorDroppedItemId(spawn.ownerId, spawn.itemId)])
    }
    const removes = yield* multiplayer.drainDroppedItemRemoves
    for (const remove of removes) {
      const id = remove.ownerId === localPlayerId
        ? remove.itemId // a peer collected OUR item: remove the original
        : mirrorDroppedItemId(remove.ownerId, remove.itemId)
      yield* services.droppedItemService.removeById(id).pipe(Effect.catchAll(() => Effect.void))
      if (remove.ownerId === localPlayerId) {
        lastLocalDroppedItems = new Map([...lastLocalDroppedItems].filter(([key]) => key !== id))
      } else {
        lastMirrorDroppedItemIds = new Set([...lastMirrorDroppedItemIds].filter((key) => key !== id))
      }
    }
  })

// ─── Parked-vehicle sync ──────────────────────────────────────────────────────
// Same owner-diff contract as dropped items: local (non-mirror) vehicles diff
// per frame into update/remove broadcasts; peers mirror them under
// `remote:<owner>:<id>`; claiming a mirror (mount/pickup) vanishes it, which
// emits a removal addressed to the ORIGINAL owner. Unlike items the server
// keeps a live log, so late joiners see every parked vehicle.
const parkedMirrorId = (ownerId: string, vehicleId: string): string =>
  `${MIRROR_ID_PREFIX}${ownerId}:${vehicleId}`

const parseParkedMirrorId = parseMirrorDroppedItemId

let lastLocalParkedVehicles: ReadonlyMap<string, string> = new Map() // id -> position signature
let lastMirrorParkedVehicleIds: ReadonlySet<string> = new Set()
export const resetParkedVehicleSyncStateForTest = (): void => {
  lastLocalParkedVehicles = new Map()
  lastMirrorParkedVehicleIds = new Set()
}

export const syncParkedVehicles = (
  multiplayer: MultiplayerService,
  services: Pick<FrameHandlerServices, 'parkedVehicleService'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const localPlayerId = yield* multiplayer.getLocalPlayerId().pipe(Effect.catchAll(() => Effect.succeed(null)))
    if (localPlayerId === null) return
    const vehicles = yield* services.parkedVehicleService.getAll()
    const currentLocal = new Map<string, string>()
    const currentMirrors = new Set<string>()
    for (const vehicle of vehicles) {
      if (vehicle.id.startsWith(MIRROR_ID_PREFIX)) currentMirrors.add(vehicle.id)
      else currentLocal.set(vehicle.id, `${vehicle.position.x},${vehicle.position.y},${vehicle.position.z}`)
    }
    for (const vehicle of vehicles) {
      if (vehicle.id.startsWith(MIRROR_ID_PREFIX)) continue
      if (lastLocalParkedVehicles.get(vehicle.id) === currentLocal.get(vehicle.id)) continue
      yield* multiplayer
        .sendParkedVehicleUpdate({ vehicleId: vehicle.id, kind: vehicle.kind, position: vehicle.position, yaw: vehicle.yaw })
        .pipe(Effect.catchAll(() => Effect.void))
    }
    for (const id of lastLocalParkedVehicles.keys()) {
      if (currentLocal.has(id)) continue
      yield* multiplayer.sendParkedVehicleRemove(localPlayerId, id).pipe(Effect.catchAll(() => Effect.void))
    }
    for (const id of lastMirrorParkedVehicleIds) {
      if (currentMirrors.has(id)) continue
      const parsed = parseParkedMirrorId(id)
      if (parsed === null) continue
      yield* multiplayer.sendParkedVehicleRemove(parsed.ownerId, parsed.itemId).pipe(Effect.catchAll(() => Effect.void))
    }
    lastLocalParkedVehicles = currentLocal
    lastMirrorParkedVehicleIds = currentMirrors
  })

export const applyInboundParkedVehicles = (
  multiplayer: MultiplayerService,
  services: Pick<FrameHandlerServices, 'parkedVehicleService'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const localPlayerId = yield* multiplayer.getLocalPlayerId().pipe(Effect.catchAll(() => Effect.succeed(null)))
    const updates = yield* multiplayer.drainParkedVehicleUpdates
    for (const update of updates) {
      const id = parkedMirrorId(update.ownerId, update.vehicleId)
      yield* services.parkedVehicleService
        .parkWithId({ id, kind: update.kind, position: update.position, yaw: update.yaw })
        .pipe(Effect.catchAll(() => Effect.void))
      lastMirrorParkedVehicleIds = new Set([...lastMirrorParkedVehicleIds, id])
    }
    const removes = yield* multiplayer.drainParkedVehicleRemoves
    for (const remove of removes) {
      const id = remove.ownerId === localPlayerId
        ? remove.vehicleId
        : parkedMirrorId(remove.ownerId, remove.vehicleId)
      yield* services.parkedVehicleService.removeById(id).pipe(Effect.catchAll(() => Effect.void))
      if (remove.ownerId === localPlayerId) {
        lastLocalParkedVehicles = new Map([...lastLocalParkedVehicles].filter(([key]) => key !== id))
      } else {
        lastMirrorParkedVehicleIds = new Set([...lastMirrorParkedVehicleIds].filter((key) => key !== id))
      }
    }
  })

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
