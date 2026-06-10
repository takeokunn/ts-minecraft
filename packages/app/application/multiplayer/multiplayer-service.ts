// App-level multiplayer service: aggregates network state, exposed to frame stages
// and presentation. Pure state management + network delegation.
import { Context, Effect, Fiber, Layer, Option, Ref, Stream } from 'effect'
import type { ConnectionState, NetworkMessage, PlayerId, PlayerName } from '@ts-minecraft/network'
import { MessageType } from '@ts-minecraft/network'
import type { ClientServiceShape } from '@ts-minecraft/network'

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

export type MultiplayerService = {
  readonly connect: (serverUrl: string, playerName: PlayerName) => Effect.Effect<void, never>
  readonly disconnect: Effect.Effect<void, never>
  readonly getConnectionState: () => Effect.Effect<ConnectionState, never>
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
  // FR-3 block sync: drain and clear the queue of remote edits to apply locally.
  readonly drainBlockEdits: Effect.Effect<ReadonlyArray<RemoteBlockEdit>, never>
  readonly drainInbound: Effect.Effect<void, never>
}

export const MultiplayerService = Context.GenericTag<MultiplayerService>(
  '@minecraft/MultiplayerService',
)

const MAX_CHAT_ENTRIES = 50

const processInbound = (
  msg: NetworkMessage,
  remotePlayersRef: Ref.Ref<Map<string, RemotePlayerSnapshot>>,
  chatMessagesRef: Ref.Ref<ReadonlyArray<ChatEntry>>,
  inboundBlockEditsRef: Ref.Ref<ReadonlyArray<RemoteBlockEdit>>,
): Effect.Effect<void, never> => {
  switch (msg.type) {
    case MessageType.BlockPlace:
      return Ref.update(inboundBlockEditsRef, (edits) => [
        ...edits,
        { kind: 'place' as const, x: msg.position.x, y: msg.position.y, z: msg.position.z, blockType: String(msg.blockType) },
      ])
    case MessageType.BlockBreak:
      return Ref.update(inboundBlockEditsRef, (edits) => [
        ...edits,
        { kind: 'break' as const, x: msg.position.x, y: msg.position.y, z: msg.position.z },
      ])
    case MessageType.PlayerJoin: {
      const snap: RemotePlayerSnapshot = {
        playerId: String(msg.playerId),
        playerName: String(msg.playerName),
        x: msg.position.x,
        y: msg.position.y,
        z: msg.position.z,
        yaw: 0,
        pitch: 0,
      }
      return Ref.update(remotePlayersRef, (m) => new Map(m).set(snap.playerId, snap))
    }
    case MessageType.PlayerLeave:
      return Ref.update(remotePlayersRef, (m) => {
        const next = new Map(m)
        next.delete(String(msg.playerId))
        return next
      })
    case MessageType.PlayerMove:
      return Ref.update(remotePlayersRef, (m) => {
        const existing = m.get(String(msg.playerId))
        if (!existing) return m
        return new Map(m).set(String(msg.playerId), {
          ...existing,
          x: msg.position.x,
          y: msg.position.y,
          z: msg.position.z,
          yaw: msg.rotation.yaw,
          pitch: msg.rotation.pitch,
        })
      })
    case MessageType.Chat: {
      const entry: ChatEntry = {
        player: String(msg.playerId),
        text: msg.message,
        timestamp: msg.timestamp,
      }
      return Ref.update(chatMessagesRef, (entries) => {
        const next = [...entries, entry]
        return next.length > MAX_CHAT_ENTRIES ? next.slice(next.length - MAX_CHAT_ENTRIES) : next
      })
    }
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
    const playerNameRef = yield* Ref.make<Option.Option<PlayerName>>(Option.none())
    const drainFiberRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(
      Option.none(),
    )

    const startDrain: Effect.Effect<void, never> = Effect.gen(function* () {
      yield* Effect.forkDaemon(
        client.receiveMessages().pipe(
          Effect.flatMap((stream) =>
            Stream.runForEach(stream, (msg: NetworkMessage) =>
              processInbound(msg, remotePlayersRef, chatMessagesRef, inboundBlockEditsRef),
            ),
          ),
          Effect.catchAll(() => Effect.void),
        ),
      ).pipe(
        Effect.flatMap((fiber) =>
          Ref.set(drainFiberRef, Option.some(fiber)),
        ),
      )
    })

    const stopDrain: Effect.Effect<void, never> = Effect.gen(function* () {
      const fiberOpt = yield* Ref.get(drainFiberRef)
      yield* Option.match(fiberOpt, {
        onNone: () => Effect.void,
        onSome: (f) => Fiber.interrupt(f).pipe(Effect.ignore),
      })
      yield* Ref.set(drainFiberRef, Option.none())
    })

    const service: MultiplayerService = {
      connect: (serverUrl, playerName) =>
        Effect.gen(function* () {
          yield* client.connect(serverUrl, playerName).pipe(
            Effect.catchAll((e) =>
              Effect.logWarning(`Multiplayer connect failed: ${String(e)}`),
            ),
          )
          yield* Ref.set(playerNameRef, Option.some(playerName))
          yield* startDrain
        }),

      disconnect: Effect.gen(function* () {
        yield* stopDrain
        yield* client.disconnect().pipe(Effect.catchAll(() => Effect.void))
      }),

      getConnectionState: () =>
        client.getConnectionState().pipe(
          Effect.catchAll(() => Effect.succeed<ConnectionState>('disconnected' as ConnectionState)),
        ),

      getRemotePlayers: () => Ref.get(remotePlayersRef),

      getChatMessages: () => Ref.get(chatMessagesRef),

      sendChat: (text) =>
        Effect.gen(function* () {
          const nameOpt = yield* Ref.get(playerNameRef)
          yield* Option.match(nameOpt, {
            onNone: () => Effect.void,
            onSome: (_name) =>
              client.sendMessage({
                type: MessageType.Chat,
                playerId: '' as PlayerId,
                playerName: '' as PlayerName,
                worldId: '' as any,
                message: text,
                timestamp: Date.now(),
              } as NetworkMessage).pipe(Effect.catchAll(() => Effect.void)),
          })
        }),

      sendPositionUpdate: (pos, rot) =>
        Effect.gen(function* () {
          const nameOpt = yield* Ref.get(playerNameRef)
          yield* Option.match(nameOpt, {
            onNone: () => Effect.void,
            onSome: (_name) =>
              client.sendMessage({
                type: MessageType.PlayerMove,
                playerId: '' as PlayerId,
                worldId: '' as any,
                position: pos as any,
                rotation: rot,
                timestamp: Date.now(),
              } as NetworkMessage).pipe(Effect.catchAll(() => Effect.void)),
          })
        }),

      sendBlockPlace: (pos, blockType) =>
        Ref.get(playerNameRef).pipe(
          Effect.flatMap((nameOpt) =>
            Option.match(nameOpt, {
              onNone: () => Effect.void,
              onSome: () =>
                client.sendMessage({
                  type: MessageType.BlockPlace,
                  playerId: '' as PlayerId,
                  worldId: '' as any,
                  position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) } as any,
                  blockType: blockType as any,
                  timestamp: Date.now(),
                } as NetworkMessage).pipe(Effect.catchAll(() => Effect.void)),
            }),
          ),
        ),

      sendBlockBreak: (pos) =>
        Ref.get(playerNameRef).pipe(
          Effect.flatMap((nameOpt) =>
            Option.match(nameOpt, {
              onNone: () => Effect.void,
              onSome: () =>
                client.sendMessage({
                  type: MessageType.BlockBreak,
                  playerId: '' as PlayerId,
                  worldId: '' as any,
                  position: { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) } as any,
                  timestamp: Date.now(),
                } as NetworkMessage).pipe(Effect.catchAll(() => Effect.void)),
            }),
          ),
        ),

      drainBlockEdits: Ref.getAndSet(inboundBlockEditsRef, []),

      drainInbound: Effect.void,
    }

    return service
  })

export const MultiplayerServiceLive = (
  client: ClientServiceShape,
): Layer.Layer<MultiplayerService, never, never> =>
  Layer.effect(MultiplayerService, MultiplayerServiceImpl(client))
