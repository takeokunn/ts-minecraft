// App-level multiplayer service: aggregates network state, exposed to frame stages
// and presentation. Pure state management + network delegation.
import { Context, Effect, Fiber, Layer, Option, Ref, Stream } from 'effect'
import type { ConnectionState, ClientServiceShape } from '@ts-minecraft/network/application/client-service'
import { MessageType, PlayerName, WorldId, type NetworkMessage, type Vec3 } from '@ts-minecraft/network/domain/schemas'
import type { BlockType } from '@ts-minecraft/core'
import { processInbound } from './multiplayer-inbound'
import type {
  ChatEntry,
  LocalEntitySnapshot,
  LocalPlayerIdentity,
  MultiplayerSessionState,
  RemoteBlockEdit,
  RemoteContainerSlot,
  RemoteContainerUpdate,
  RemoteDroppedItemRemove,
  RemoteDroppedItemSpawn,
  RemoteEntityDamage,
  RemoteEntitySnapshot,
  RemotePlayerSnapshot,
} from './multiplayer-types'
// Re-export the shared data/message types so the 17 consumers keep importing
// them from this module (and the presentation/frame code that references them).
export type {
  ChatEntry,
  LocalEntitySnapshot,
  MultiplayerSessionState,
  RemoteBlockEdit,
  RemoteContainerSlot,
  RemoteContainerUpdate,
  RemoteDroppedItemRemove,
  RemoteDroppedItemSpawn,
  RemoteEntityDamage,
  RemoteEntitySnapshot,
  RemotePlayerSnapshot,
} from './multiplayer-types'

const OVERWORLD_ID = WorldId.make('overworld')

// Dimension stamped onto outbound block edits and used to filter inbound ones.
// Pushed each frame by the frame executor (module scratch — the established
// cross-layer idiom). Nether edits used to be stamped 'overworld' and applied
// to every peer's overworld: silent world corruption in co-op.
let activeEditDimension: 'overworld' | 'nether' | 'end' = 'overworld'
export const setMultiplayerEditDimension = (dim: 'overworld' | 'nether' | 'end'): void => {
  activeEditDimension = dim
}
export const getMultiplayerEditDimension = (): 'overworld' | 'nether' | 'end' => activeEditDimension

export type MultiplayerService = {
  readonly connect: (serverUrl: string, playerName: PlayerName, localTimeOfDay?: number, localDayLengthSeconds?: number) => Effect.Effect<void, never>
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
  // Container sync: broadcast a chest's full slot array on close
  // (last-writer-wins per chest position within a dimension).
  readonly sendContainerUpdate: (
    pos: { readonly x: number; readonly y: number; readonly z: number },
    slots: ReadonlyArray<RemoteContainerSlot | null>,
  ) => Effect.Effect<void, never>
  // Entity host authority: true when this client should simulate & broadcast
  // mobs — i.e. offline, on a pre-host-authority server (none announced), or
  // announced as the session's entity host via WorldInfo.
  readonly isEntityAuthority: () => Effect.Effect<boolean, never>
  // Non-host combat: relay a hit on a host-owned entity (raw host entity id).
  readonly sendEntityDamage: (
    entityId: string,
    damage: number,
    knockback: { readonly x: number; readonly y: number; readonly z: number },
  ) => Effect.Effect<void, never>
  // FR-3 block sync: drain and clear the queue of remote edits to apply locally.
  readonly drainBlockEdits: Effect.Effect<ReadonlyArray<RemoteBlockEdit>, never>
  readonly drainContainerUpdates: Effect.Effect<ReadonlyArray<RemoteContainerUpdate>, never>
  readonly sendDroppedItemSpawn: (spawn: {
    readonly itemId: string
    readonly itemType: string
    readonly count: number
    readonly position: { readonly x: number; readonly y: number; readonly z: number }
    readonly velocity: { readonly x: number; readonly y: number; readonly z: number }
  }) => Effect.Effect<void, never>
  readonly sendDroppedItemRemove: (ownerId: string, itemId: string) => Effect.Effect<void, never>
  // Assigned player id once joined (null before the join echo lands).
  readonly getLocalPlayerId: () => Effect.Effect<string | null, never>
  readonly drainDroppedItemSpawns: Effect.Effect<ReadonlyArray<RemoteDroppedItemSpawn>, never>
  readonly drainDroppedItemRemoves: Effect.Effect<ReadonlyArray<RemoteDroppedItemRemove>, never>
  readonly drainEntitySnapshots: Effect.Effect<ReadonlyArray<RemoteEntitySnapshot>, never>
  readonly drainEntityDamages: Effect.Effect<ReadonlyArray<RemoteEntityDamage>, never>
  readonly drainInbound: Effect.Effect<void, never>
}

export const MultiplayerService = Context.GenericTag<MultiplayerService>(
  '@minecraft/MultiplayerService',
)

const MAX_PENDING_CHAT_MESSAGES = 20

export const MultiplayerServiceImpl = (
  client: ClientServiceShape,
): Effect.Effect<MultiplayerService, never, never> =>
  Effect.gen(function* () {
    const remotePlayersRef = yield* Ref.make<Map<string, RemotePlayerSnapshot>>(
      new Map(),
    )
    const chatMessagesRef = yield* Ref.make<ReadonlyArray<ChatEntry>>([])
    const inboundBlockEditsRef = yield* Ref.make<ReadonlyArray<RemoteBlockEdit>>([])
    const inboundContainerUpdatesRef = yield* Ref.make<ReadonlyArray<RemoteContainerUpdate>>([])
    const inboundDroppedItemSpawnsRef = yield* Ref.make<ReadonlyArray<RemoteDroppedItemSpawn>>([])
    const inboundDroppedItemRemovesRef = yield* Ref.make<ReadonlyArray<RemoteDroppedItemRemove>>([])
    const inboundEntitySnapshotsRef = yield* Ref.make<ReadonlyArray<RemoteEntitySnapshot>>([])
    const inboundEntityDamagesRef = yield* Ref.make<ReadonlyArray<RemoteEntityDamage>>([])
    const playerNameRef = yield* Ref.make<Option.Option<PlayerName>>(Option.none())
    const localPlayerRef = yield* Ref.make<Option.Option<LocalPlayerIdentity>>(Option.none())
    const pendingChatRef = yield* Ref.make<ReadonlyArray<string>>([])
    const localWorldSeedRef = yield* Ref.make<number | null>(null)
    const hostWorldSeedRef = yield* Ref.make<number | null>(null)
    const hostTimeOfDayRef = yield* Ref.make<number | null>(null)
    const entityHostIdRef = yield* Ref.make<string | null>(null)
    const drainFiberRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(
      Option.none(),
    )

    const resetSessionState: Effect.Effect<void, never> = Effect.gen(function* () {
      yield* Ref.set(remotePlayersRef, new Map<string, RemotePlayerSnapshot>())
      yield* Ref.set(chatMessagesRef, [])
      yield* Ref.set(inboundBlockEditsRef, [])
      yield* Ref.set(inboundContainerUpdatesRef, [])
      yield* Ref.set(inboundDroppedItemSpawnsRef, [])
      yield* Ref.set(inboundDroppedItemRemovesRef, [])
      yield* Ref.set(inboundEntitySnapshotsRef, [])
      yield* Ref.set(inboundEntityDamagesRef, [])
      yield* Ref.set(localPlayerRef, Option.none())
      yield* Ref.set(pendingChatRef, [])
      yield* Ref.set(hostWorldSeedRef, null)
      yield* Ref.set(hostTimeOfDayRef, null)
      yield* Ref.set(entityHostIdRef, null)
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
              inboundContainerUpdatesRef,
              inboundDroppedItemSpawnsRef,
              inboundDroppedItemRemovesRef,
              inboundEntitySnapshotsRef,
              inboundEntityDamagesRef,
              playerNameRef,
              localPlayerRef,
              hostWorldSeedRef,
              hostTimeOfDayRef,
              entityHostIdRef,
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
      connect: (serverUrl, playerName, localTimeOfDay, localDayLengthSeconds) =>
        Effect.gen(function* () {
          yield* stopDrain
          yield* resetSessionState
          const localSeed = yield* Ref.get(localWorldSeedRef)
          const connected = yield* client.connect(serverUrl, playerName, localSeed ?? undefined, localTimeOfDay, localDayLengthSeconds).pipe(
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
          worldId: WorldId.make(activeEditDimension),
          position: floorPos(pos),
          blockType: blockType as BlockType,
          timestamp: Date.now(),
        } as NetworkMessage)),

      sendBlockBreak: (pos) =>
        sendIfConnected((identity) => ({
          type: MessageType.BlockBreak,
          playerId: identity.playerId,
          worldId: WorldId.make(activeEditDimension),
          position: floorPos(pos),
          timestamp: Date.now(),
        } as NetworkMessage)),

      sendContainerUpdate: (pos, slots) =>
        sendIfConnected((identity) => ({
          type: MessageType.ContainerUpdate,
          playerId: identity.playerId,
          worldId: WorldId.make(activeEditDimension),
          position: floorPos(pos),
          slots,
          timestamp: Date.now(),
        } as NetworkMessage)),

      sendDroppedItemSpawn: (spawn) =>
        sendIfConnected((identity) => ({
          type: MessageType.DroppedItemSpawn,
          playerId: identity.playerId,
          worldId: WorldId.make(activeEditDimension),
          itemId: spawn.itemId,
          itemType: spawn.itemType,
          count: spawn.count,
          position: spawn.position as Vec3,
          velocity: spawn.velocity as Vec3,
          timestamp: Date.now(),
        } as NetworkMessage)),

      sendDroppedItemRemove: (ownerId, itemId) =>
        sendIfConnected((identity) => ({
          type: MessageType.DroppedItemRemove,
          playerId: identity.playerId,
          worldId: WorldId.make(activeEditDimension),
          ownerId,
          itemId,
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

      isEntityAuthority: () =>
        Effect.gen(function* () {
          const state = yield* getClientConnectionState()
          if (state !== 'connected') return true
          const entityHostId = yield* Ref.get(entityHostIdRef)
          // Pre-host-authority server (or handshake still in flight): keep the
          // legacy behavior where every client simulates its own mobs.
          if (entityHostId === null) return true
          const identity = yield* Ref.get(localPlayerRef)
          return Option.isSome(identity) && String(identity.value.playerId) === entityHostId
        }),

      sendEntityDamage: (entityId, damage, knockback) =>
        sendIfConnected((identity) => ({
          type: MessageType.EntityDamage,
          playerId: identity.playerId,
          worldId: OVERWORLD_ID,
          entityId,
          damage,
          knockback: knockback as Vec3,
          timestamp: Date.now(),
        } as NetworkMessage)),

      drainBlockEdits: Ref.getAndSet(inboundBlockEditsRef, []),

      drainContainerUpdates: Ref.getAndSet(inboundContainerUpdatesRef, []),

      getLocalPlayerId: () =>
        Effect.map(Ref.get(localPlayerRef), (identity) =>
          Option.isSome(identity) ? String(identity.value.playerId) : null,
        ),

      drainDroppedItemSpawns: Ref.getAndSet(inboundDroppedItemSpawnsRef, []),

      drainDroppedItemRemoves: Ref.getAndSet(inboundDroppedItemRemovesRef, []),

      drainEntitySnapshots: Ref.getAndSet(inboundEntitySnapshotsRef, []),

      drainEntityDamages: Ref.getAndSet(inboundEntityDamagesRef, []),

      drainInbound: Effect.void,
    }

    return service
  })

export const MultiplayerServiceDefault = (
  client: ClientServiceShape,
): Layer.Layer<MultiplayerService, never, never> =>
  Layer.effect(MultiplayerService, MultiplayerServiceImpl(client))
