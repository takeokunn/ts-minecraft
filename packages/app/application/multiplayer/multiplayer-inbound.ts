// Inbound-message dispatcher: folds each NetworkMessage into the multiplayer
// service's state refs (remote players, chat, queued block edits / entity
// snapshots / entity damages, host world info). A pure function over explicit
// refs — no closure over the service — split out of multiplayer-service.ts.
import { Effect, Option, Ref } from 'effect'
import { MessageType, type NetworkMessage, type PlayerName } from '@ts-minecraft/network/domain/schemas'
import { getMultiplayerEditDimension } from './multiplayer-service'
import type {
  ChatEntry,
  LocalPlayerIdentity,
  RemoteBlockEdit,
  RemoteContainerUpdate,
  RemoteEntityDamage,
  RemoteEntitySnapshot,
  RemotePlayerSnapshot,
} from './multiplayer-types'

export const MAX_CHAT_ENTRIES = 50

export const processInbound = (
  msg: NetworkMessage,
  remotePlayersRef: Ref.Ref<Map<string, RemotePlayerSnapshot>>,
  chatMessagesRef: Ref.Ref<ReadonlyArray<ChatEntry>>,
  inboundBlockEditsRef: Ref.Ref<ReadonlyArray<RemoteBlockEdit>>,
  inboundContainerUpdatesRef: Ref.Ref<ReadonlyArray<RemoteContainerUpdate>>,
  inboundEntitySnapshotsRef: Ref.Ref<ReadonlyArray<RemoteEntitySnapshot>>,
  inboundEntityDamagesRef: Ref.Ref<ReadonlyArray<RemoteEntityDamage>>,
  playerNameRef: Ref.Ref<Option.Option<PlayerName>>,
  localPlayerRef: Ref.Ref<Option.Option<LocalPlayerIdentity>>,
  hostWorldSeedRef: Ref.Ref<number | null>,
  hostTimeOfDayRef: Ref.Ref<number | null>,
  entityHostIdRef: Ref.Ref<string | null>,
  onLocalPlayerReady: (identity: LocalPlayerIdentity) => Effect.Effect<void, never>,
): Effect.Effect<void, never> => {
  switch (msg.type) {
    case MessageType.EntitySnapshot:
      return Effect.gen(function* () {
        const localPlayer = yield* Ref.get(localPlayerRef)
        if (Option.isSome(localPlayer) && localPlayer.value.playerId === msg.playerId) return
        const snapshots = yield* Ref.get(inboundEntitySnapshotsRef)
        yield* Ref.set(inboundEntitySnapshotsRef, [
          ...snapshots,
          {
            playerId: String(msg.playerId),
            worldId: String(msg.worldId),
            entityId: msg.entityId,
            entityType: msg.entityType,
            position: msg.position,
            health: msg.health,
            alive: msg.alive,
            timestamp: msg.timestamp,
          },
        ])
      })
    case MessageType.EntityDamage:
      return Effect.gen(function* () {
        // Server routes these to the entity host only; ignore echoes of our own hits.
        const localPlayer = yield* Ref.get(localPlayerRef)
        if (Option.isSome(localPlayer) && localPlayer.value.playerId === msg.playerId) return
        const damages = yield* Ref.get(inboundEntityDamagesRef)
        yield* Ref.set(inboundEntityDamagesRef, [
          ...damages,
          {
            attackerId: String(msg.playerId),
            entityId: msg.entityId,
            damage: msg.damage,
            knockback: msg.knockback,
          },
        ])
      })
    case MessageType.BlockPlace:
      return Effect.gen(function* () {
        const localPlayer = yield* Ref.get(localPlayerRef)
        if (Option.isSome(localPlayer) && localPlayer.value.playerId === msg.playerId) return
        // Dimension guard: a nether edit must never touch this client's
        // overworld. Same-dimension edits only (cross-dimension convergence is
        // handled by the server edit-log replay when switching worlds).
        if (String(msg.worldId) !== getMultiplayerEditDimension()) return
        const edits = yield* Ref.get(inboundBlockEditsRef)
        const next = [
          ...edits,
          { kind: 'place' as const, x: msg.position.x, y: msg.position.y, z: msg.position.z, blockType: String(msg.blockType) },
        ]
        yield* Ref.set(inboundBlockEditsRef, next)
      })
    case MessageType.BlockBreak:
      return Effect.gen(function* () {
        const localPlayer = yield* Ref.get(localPlayerRef)
        if (Option.isSome(localPlayer) && localPlayer.value.playerId === msg.playerId) return
        // Dimension guard: a nether edit must never touch this client's
        // overworld. Same-dimension edits only (cross-dimension convergence is
        // handled by the server edit-log replay when switching worlds).
        if (String(msg.worldId) !== getMultiplayerEditDimension()) return
        const edits = yield* Ref.get(inboundBlockEditsRef)
        const next = [
          ...edits,
          { kind: 'break' as const, x: msg.position.x, y: msg.position.y, z: msg.position.z },
        ]
        yield* Ref.set(inboundBlockEditsRef, next)
      })
    case MessageType.ContainerUpdate:
      return Effect.gen(function* () {
        const localPlayer = yield* Ref.get(localPlayerRef)
        if (Option.isSome(localPlayer) && localPlayer.value.playerId === msg.playerId) return
        // Same dimension guard as block edits: a nether chest state must not
        // overwrite an overworld chest at the same coordinates.
        if (String(msg.worldId) !== getMultiplayerEditDimension()) return
        const updates = yield* Ref.get(inboundContainerUpdatesRef)
        yield* Ref.set(inboundContainerUpdatesRef, [
          ...updates,
          {
            x: msg.position.x,
            y: msg.position.y,
            z: msg.position.z,
            slots: msg.slots.map((slot) =>
              slot === null ? null : { itemType: slot.itemType, count: slot.count, durability: slot.durability },
            ),
          },
        ])
      })
    case MessageType.PlayerJoin:
      return Effect.gen(function* () {
        const localPlayer = yield* Ref.get(localPlayerRef)
        const requestedName = yield* Ref.get(playerNameRef)
        // Identity adoption: the server flags its direct echo with isSelf, so
        // the assigned id binds exactly. Name matching remains only as the
        // fallback for pre-isSelf servers — and must never bind a message the
        // server addressed to someone else (isSelf === false is impossible;
        // broadcasts simply omit the flag, hence the strict checks below).
        const isSelfEcho = msg.isSelf === true
        const legacyNameMatch =
          msg.isSelf === undefined
          && Option.isSome(requestedName)
          && String(requestedName.value) === String(msg.playerName)
        if (Option.isNone(localPlayer) && Option.isSome(requestedName) && (isSelfEcho || legacyNameMatch)) {
          const identity: LocalPlayerIdentity = {
            playerId: msg.playerId,
            playerName: msg.playerName,
          }
          yield* Ref.set(localPlayerRef, Option.some(identity))
          yield* onLocalPlayerReady(identity)
          return
        }
        if (Option.isSome(localPlayer) && localPlayer.value.playerId === msg.playerId) return
        const snap: RemotePlayerSnapshot = {
          playerId: String(msg.playerId),
          playerName: String(msg.playerName),
          x: msg.position.x,
          y: msg.position.y,
          z: msg.position.z,
          yaw: 0,
          pitch: 0,
        }
        const players = yield* Ref.get(remotePlayersRef)
        const next = new Map(players)
        next.set(snap.playerId, snap)
        yield* Ref.set(remotePlayersRef, next)
      })
    case MessageType.PlayerLeave:
      return Effect.gen(function* () {
        const localPlayer = yield* Ref.get(localPlayerRef)
        if (Option.isSome(localPlayer) && localPlayer.value.playerId === msg.playerId) {
          yield* Ref.set(localPlayerRef, Option.none())
          return
        }
        const players = yield* Ref.get(remotePlayersRef)
        const next = new Map(players)
        next.delete(String(msg.playerId))
        yield* Ref.set(remotePlayersRef, next)
      })
    case MessageType.PlayerMove:
      return Effect.gen(function* () {
        const localPlayer = yield* Ref.get(localPlayerRef)
        if (Option.isSome(localPlayer) && localPlayer.value.playerId === msg.playerId) return
        const players = yield* Ref.get(remotePlayersRef)
        const existing = players.get(String(msg.playerId))
        if (!existing) return
        const next = new Map(players)
        next.set(String(msg.playerId), {
          ...existing,
          x: msg.position.x,
          y: msg.position.y,
          z: msg.position.z,
          yaw: msg.rotation.yaw,
          pitch: msg.rotation.pitch,
        })
        yield* Ref.set(remotePlayersRef, next)
      })
    case MessageType.Chat: {
      return Effect.gen(function* () {
        const players = yield* Ref.get(remotePlayersRef)
        const localPlayer = yield* Ref.get(localPlayerRef)
        const remotePlayer = players.get(String(msg.playerId))
        const player = Option.isSome(localPlayer) && localPlayer.value.playerId === msg.playerId
          ? String(localPlayer.value.playerName)
          : remotePlayer?.playerName ?? String(msg.playerId)
        const entry: ChatEntry = {
          player,
          text: msg.message,
          timestamp: msg.timestamp,
        }
        const entries = yield* Ref.get(chatMessagesRef)
        const next = [...entries, entry]
        yield* Ref.set(
          chatMessagesRef,
          next.length > MAX_CHAT_ENTRIES ? next.slice(next.length - MAX_CHAT_ENTRIES) : next,
        )
      })
    }
    case MessageType.WorldInfo:
      return Ref.set(hostWorldSeedRef, msg.worldSeed).pipe(
        Effect.zipRight(Ref.set(hostTimeOfDayRef, msg.timeOfDay ?? null)),
        Effect.zipRight(Ref.set(entityHostIdRef, msg.entityHostPlayerId !== undefined ? String(msg.entityHostPlayerId) : null)),
      )
    default:
      return Effect.void
  }
}
