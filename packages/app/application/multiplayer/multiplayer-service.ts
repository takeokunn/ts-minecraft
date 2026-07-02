// App-level multiplayer service: aggregates network state, exposed to frame stages
// and presentation. Pure state management + network delegation.
import { Context, Effect, Fiber, Layer, Option, Ref, Stream } from 'effect'
import type { ConnectionState, ClientServiceShape } from '@ts-minecraft/network/application/client-service'
import { MessageType, PlayerId, PlayerName, WorldId, type NetworkMessage, type Vec3 } from '@ts-minecraft/network/domain/schemas'
import type { BlockType } from '@ts-minecraft/core'

const OVERWORLD_ID = WorldId.make('overworld')

export type RemotePlayerSnapshot = {
  readonly playerId: string
  readonly playerName: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
  readonly pitch: number
}

export type ChatEntry = {
  readonly player: string
  readonly text: string
  readonly timestamp: number
}

// A block edit received from a remote player, queued for the frame loop to apply
// to the local world (T15c). The network layer stays world-agnostic.
export type RemoteBlockEdit =
  | { readonly kind: 'place'; readonly x: number; readonly y: number; readonly z: number; readonly blockType: string }
  | { readonly kind: 'break'; readonly x: number; readonly y: number; readonly z: number }

export type LocalEntitySnapshot = {
  readonly entityId: string
  readonly entityType: string
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly health: number
  readonly alive: boolean
}

export type RemoteEntitySnapshot = LocalEntitySnapshot & {
  readonly playerId: string
  readonly worldId: string
  readonly timestamp: number
}

type LocalPlayerIdentity = {
  readonly playerId: PlayerId
  readonly playerName: PlayerName
}

export type MultiplayerSessionState = ConnectionState | 'joining' | 'ready'

export type MultiplayerService = {
  readonly connect: (serverUrl: string, playerName: PlayerName, localTimeOfDay?: number) => Effect.Effect<void, never>
  // Terrain-seed handshake: the session records the local world's seed before
  // connecting; the server echoes the authoritative (first joiner's) seed back.
  readonly setLocalWorldSeed: (seed: number) => Effect.Effect<void, never>
  readonly getWorldSeedInfo: () => Effect.Effect<
    { readonly local: number | null; readonly host: number | null },
    never
  >
  // Session-authoritative time of day echoed by the server (null until the
  // WorldInfo handshake lands or when the host predates time sync).
  readonly getHostTimeOfDay: () => Effect.Effect<number | null, never>
  readonly disconnect: Effect.Effect<void, never>
  readonly getConnectionState: () => Effect.Effect<ConnectionState, never>
  readonly getSessionState: () => Effect.Effect<MultiplayerSessionState, never>
  readonly getRemotePlayers: () => Effect.Effect<ReadonlyMap<string, RemotePlayerSnapshot>, never>
  readonly getChatMessages: () => Effect.Effect<ReadonlyArray<ChatEntry>, never>
  readonly sendChat: (text: string) => Effect.Effect<void, never>
  readonly sendPositionUpdate: (
    pos: { readonly x: number; readonly y: number; readonly z: number },
    rot: { readonly yaw: number; readonly pitch: number },
  ) => Effect.Effect<void, never>
  // FR-3 block sync: emit local edits to the server.
  readonly sendBlockPlace: (
    pos: { readonly x: number; readonly y: number; readonly z: number },
    blockType: string,
  ) => Effect.Effect<void, never>
  readonly sendBlockBreak: (
    pos: { readonly x: number; readonly y: number; readonly z: number },
  ) => Effect.Effect<void, never>
  readonly sendEntitySnapshot: (snapshot: LocalEntitySnapshot) => Effect.Effect<void, never>
  // FR-3 block sync: drain and clear the queue of remote edits to apply locally.
  readonly drainBlockEdits: Effect.Effect<ReadonlyArray<RemoteBlockEdit>, never>
  readonly drainEntitySnapshots: Effect.Effect<ReadonlyArray<RemoteEntitySnapshot>, never>
  readonly drainInbound: Effect.Effect<void, never>
}

export const MultiplayerService = Context.GenericTag<MultiplayerService>(
  '@minecraft/MultiplayerService',
)

const MAX_CHAT_ENTRIES = 50
const MAX_PENDING_CHAT_MESSAGES = 20

const processInbound = (
  msg: NetworkMessage,
  remotePlayersRef: Ref.Ref<Map<string, RemotePlayerSnapshot>>,
  chatMessagesRef: Ref.Ref<ReadonlyArray<ChatEntry>>,
  inboundBlockEditsRef: Ref.Ref<ReadonlyArray<RemoteBlockEdit>>,
  inboundEntitySnapshotsRef: Ref.Ref<ReadonlyArray<RemoteEntitySnapshot>>,
  playerNameRef: Ref.Ref<Option.Option<PlayerName>>,
  localPlayerRef: Ref.Ref<Option.Option<LocalPlayerIdentity>>,
  hostWorldSeedRef: Ref.Ref<number | null>,
  hostTimeOfDayRef: Ref.Ref<number | null>,
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
    case MessageType.BlockPlace:
      return Effect.gen(function* () {
        const localPlayer = yield* Ref.get(localPlayerRef)
        if (Option.isSome(localPlayer) && localPlayer.value.playerId === msg.playerId) return
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
        const edits = yield* Ref.get(inboundBlockEditsRef)
        const next = [
          ...edits,
          { kind: 'break' as const, x: msg.position.x, y: msg.position.y, z: msg.position.z },
        ]
        yield* Ref.set(inboundBlockEditsRef, next)
      })
    case MessageType.PlayerJoin:
      return Effect.gen(function* () {
        const localPlayer = yield* Ref.get(localPlayerRef)
        const requestedName = yield* Ref.get(playerNameRef)
        if (
          Option.isNone(localPlayer)
          && Option.isSome(requestedName)
          && String(requestedName.value) === String(msg.playerName)
        ) {
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
      )
    default:
      return Effect.void
  }
}

export const MultiplayerServiceImpl = (
  client: ClientServiceShape,
): Effect.Effect<MultiplayerService, never, never> =>
  Effect.gen(function* () {
    const remotePlayersRef = yield* Ref.make<Map<string, RemotePlayerSnapshot>>(
      new Map(),
    )
    const chatMessagesRef = yield* Ref.make<ReadonlyArray<ChatEntry>>([])
    const inboundBlockEditsRef = yield* Ref.make<ReadonlyArray<RemoteBlockEdit>>([])
    const inboundEntitySnapshotsRef = yield* Ref.make<ReadonlyArray<RemoteEntitySnapshot>>([])
    const playerNameRef = yield* Ref.make<Option.Option<PlayerName>>(Option.none())
    const localPlayerRef = yield* Ref.make<Option.Option<LocalPlayerIdentity>>(Option.none())
    const pendingChatRef = yield* Ref.make<ReadonlyArray<string>>([])
    const localWorldSeedRef = yield* Ref.make<number | null>(null)
    const hostWorldSeedRef = yield* Ref.make<number | null>(null)
    const hostTimeOfDayRef = yield* Ref.make<number | null>(null)
    const drainFiberRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(
      Option.none(),
    )

    const resetSessionState: Effect.Effect<void, never> = Effect.gen(function* () {
      yield* Ref.set(remotePlayersRef, new Map<string, RemotePlayerSnapshot>())
      yield* Ref.set(chatMessagesRef, [])
      yield* Ref.set(inboundBlockEditsRef, [])
      yield* Ref.set(inboundEntitySnapshotsRef, [])
      yield* Ref.set(localPlayerRef, Option.none())
      yield* Ref.set(pendingChatRef, [])
      yield* Ref.set(hostWorldSeedRef, null)
      yield* Ref.set(hostTimeOfDayRef, null)
    })

    const getClientConnectionState = (): Effect.Effect<ConnectionState, never> =>
      client.getConnectionState().pipe(
        Effect.catchAll(() => Effect.succeed<ConnectionState>('disconnected' as ConnectionState)),
      )

    const chatMessageFor = (identity: LocalPlayerIdentity, text: string): NetworkMessage => ({
      type: MessageType.Chat,
      playerId: identity.playerId,
      worldId: OVERWORLD_ID,
      message: text,
      timestamp: Date.now(),
    } as NetworkMessage)

    const sendChatFor = (
      identity: LocalPlayerIdentity,
      text: string,
    ): Effect.Effect<void, never> =>
      client.sendMessage(chatMessageFor(identity, text)).pipe(Effect.catchAll(() => Effect.void))

    const flushPendingChat = (identity: LocalPlayerIdentity): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const pending = yield* Ref.getAndSet(pendingChatRef, [])
        for (const text of pending) {
          yield* sendChatFor(identity, text)
        }
      })

    const startDrain: Effect.Effect<void, never> = Effect.gen(function* () {
      const fiber = yield* Effect.forkDaemon(
        Effect.gen(function* () {
          const stream = yield* client.receiveMessages()
          yield* Stream.runForEach(stream, (msg: NetworkMessage) =>
            processInbound(
              msg,
              remotePlayersRef,
              chatMessagesRef,
              inboundBlockEditsRef,
              inboundEntitySnapshotsRef,
              playerNameRef,
              localPlayerRef,
              hostWorldSeedRef,
              hostTimeOfDayRef,
              flushPendingChat,
            ),
          )
        }).pipe(Effect.catchAll(() => Effect.void)),
      )
      yield* Ref.set(drainFiberRef, Option.some(fiber))
    })

    const stopDrain: Effect.Effect<void, never> = Effect.gen(function* () {
      const fiber = Option.getOrNull(yield* Ref.get(drainFiberRef))
      if (fiber !== null) {
        yield* Fiber.interrupt(fiber).pipe(Effect.ignore)
      }
      yield* Ref.set(drainFiberRef, Option.none())
    })

    const sendIfConnected = (
      build: (identity: LocalPlayerIdentity) => NetworkMessage,
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const identity = yield* Ref.get(localPlayerRef)
        if (Option.isNone(identity)) return
        yield* client.sendMessage(build(identity.value)).pipe(Effect.catchAll(() => Effect.void))
      })

    const queueChatUntilReady = (text: string): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const requestedName = yield* Ref.get(playerNameRef)
        if (Option.isNone(requestedName)) return
        const state = yield* getClientConnectionState()
        if (state !== 'connected') return
        const pending = yield* Ref.get(pendingChatRef)
        const next = [...pending, text]
        yield* Ref.set(
          pendingChatRef,
          next.length > MAX_PENDING_CHAT_MESSAGES ? next.slice(next.length - MAX_PENDING_CHAT_MESSAGES) : next,
        )
      })

    const floorPos = (pos: { readonly x: number; readonly y: number; readonly z: number }): Vec3 =>
      ({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) }) as Vec3

    const service: MultiplayerService = {
      connect: (serverUrl, playerName, localTimeOfDay) =>
        Effect.gen(function* () {
          yield* stopDrain
          yield* resetSessionState
          const localSeed = yield* Ref.get(localWorldSeedRef)
          const connected = yield* client.connect(serverUrl, playerName, localSeed ?? undefined, localTimeOfDay).pipe(
            Effect.as(true),
            Effect.catchAll((e) =>
              Effect.logWarning(`Multiplayer connect failed: ${String(e)}`).pipe(Effect.as(false)),
            ),
          )
          if (!connected) {
            yield* Ref.set(playerNameRef, Option.none())
            return
          }
          yield* Ref.set(playerNameRef, Option.some(playerName))
          yield* startDrain
        }),

      setLocalWorldSeed: (seed) => Ref.set(localWorldSeedRef, seed),

      getHostTimeOfDay: () => Ref.get(hostTimeOfDayRef),

      getWorldSeedInfo: () =>
        Effect.gen(function* () {
          const local = yield* Ref.get(localWorldSeedRef)
          const host = yield* Ref.get(hostWorldSeedRef)
          return { local, host }
        }),

      disconnect: Effect.gen(function* () {
        yield* stopDrain
        yield* client.disconnect().pipe(Effect.catchAll(() => Effect.void))
        yield* Ref.set(playerNameRef, Option.none())
        yield* resetSessionState
      }),

      getConnectionState: () =>
        getClientConnectionState(),

      getSessionState: () =>
        Effect.gen(function* () {
          const state = yield* getClientConnectionState()
          if (state !== 'connected') return state
          const identity = yield* Ref.get(localPlayerRef)
          if (Option.isSome(identity)) return 'ready' as const
          const requestedName = yield* Ref.get(playerNameRef)
          return Option.isSome(requestedName) ? 'joining' as const : state
        }),

      getRemotePlayers: () => Ref.get(remotePlayersRef),

      getChatMessages: () => Ref.get(chatMessagesRef),

      sendChat: (text) =>
        Effect.gen(function* () {
          const identity = yield* Ref.get(localPlayerRef)
          if (Option.isSome(identity)) {
            yield* sendChatFor(identity.value, text)
            return
          }
          yield* queueChatUntilReady(text)
        }),

      sendPositionUpdate: (pos, rot) =>
        sendIfConnected((identity) => ({
          type: MessageType.PlayerMove,
          playerId: identity.playerId,
          worldId: OVERWORLD_ID,
          position: pos as Vec3,
          rotation: rot,
          timestamp: Date.now(),
        } as NetworkMessage)),

      sendBlockPlace: (pos, blockType) =>
        sendIfConnected((identity) => ({
          type: MessageType.BlockPlace,
          playerId: identity.playerId,
          worldId: OVERWORLD_ID,
          position: floorPos(pos),
          blockType: blockType as BlockType,
          timestamp: Date.now(),
        } as NetworkMessage)),

      sendBlockBreak: (pos) =>
        sendIfConnected((identity) => ({
          type: MessageType.BlockBreak,
          playerId: identity.playerId,
          worldId: OVERWORLD_ID,
          position: floorPos(pos),
          timestamp: Date.now(),
        } as NetworkMessage)),

      sendEntitySnapshot: (snapshot) =>
        sendIfConnected((identity) => ({
          type: MessageType.EntitySnapshot,
          playerId: identity.playerId,
          worldId: OVERWORLD_ID,
          entityId: snapshot.entityId,
          entityType: snapshot.entityType,
          position: snapshot.position as Vec3,
          health: snapshot.health,
          alive: snapshot.alive,
          timestamp: Date.now(),
        } as NetworkMessage)),

      drainBlockEdits: Ref.getAndSet(inboundBlockEditsRef, []),

      drainEntitySnapshots: Ref.getAndSet(inboundEntitySnapshotsRef, []),

      drainInbound: Effect.void,
    }

    return service
  })

export const MultiplayerServiceDefault = (
  client: ClientServiceShape,
): Layer.Layer<MultiplayerService, never, never> =>
  Layer.effect(MultiplayerService, MultiplayerServiceImpl(client))
