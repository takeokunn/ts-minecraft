import { Context, Effect, Fiber, Layer, Option, Queue, Ref, Stream } from 'effect'
import { NetworkError } from '../domain/errors'
import { MessageType, PlayerId, type NetworkMessage, type NetworkRotation, type PlayerName, type Vec3, type WorldId } from '../domain/schemas'
import type { WebSocketConnection, WebSocketServerHandle, WebSocketServerPort } from '../infrastructure/websocket-server'
import { sendEncodedToConnection } from './codec'
import { dispatchMessage, handlePlayerLeave } from './server-handlers'

export type ServerPort = number

export type ConnectedPlayer = {
  readonly playerId: PlayerId
  readonly playerName: PlayerName
  readonly worldId: WorldId
  readonly position: Vec3
  readonly rotation: NetworkRotation
  readonly sendQueue: Queue.Queue<ArrayBuffer>
}

export type GameServer = {
  readonly connectedPlayers: Ref.Ref<Map<PlayerId, ConnectedPlayer>>
  readonly connectionsByPlayerId: Ref.Ref<Map<PlayerId, WebSocketConnection>>
  readonly playerIdByConnectionId: Ref.Ref<Map<string, PlayerId>>
  readonly maxPlayers: number
}

export type ServerServiceShape = {
  readonly start: (port: number) => Effect.Effect<ServerPort, NetworkError>
  readonly stop: () => Effect.Effect<void, NetworkError>
  readonly getConnectedPlayers: () => Effect.Effect<ReadonlyMap<PlayerId, ConnectedPlayer>, never>
  readonly sendToPlayer: (playerId: PlayerId, message: NetworkMessage) => Effect.Effect<void, NetworkError>
  readonly broadcast: (message: NetworkMessage, exclude?: PlayerId) => Effect.Effect<void, NetworkError>
}

export const ServerService = Context.GenericTag<ServerServiceShape>('@minecraft/network/ServerService')

export type ServerServiceImplOptions = {
  readonly maxPlayers?: number
}

export const makeGameServer = (maxPlayers = 20): Effect.Effect<GameServer, never> =>
  Effect.gen(function* () {
    const connectedPlayers = yield* Ref.make(new Map<PlayerId, ConnectedPlayer>())
    const connectionsByPlayerId = yield* Ref.make(new Map<PlayerId, WebSocketConnection>())
    const playerIdByConnectionId = yield* Ref.make(new Map<string, PlayerId>())
    return { connectedPlayers, connectionsByPlayerId, playerIdByConnectionId, maxPlayers }
  })

const wireConnection = (
  gameServer: GameServer,
  service: ServerServiceShape,
  connection: WebSocketConnection,
): Effect.Effect<void, never> => {
  const readMessages = Stream.runForEach(connection.messages, (raw) =>
    dispatchMessage({ gameServer, serverService: service }, connection, raw).pipe(
      Effect.catchAll((error) =>
        sendEncodedToConnection(connection, {
          type: MessageType.Error,
          code: 'NETWORK_ERROR',
          message: error.message,
          timestamp: Date.now(),
        }).pipe(Effect.catchAll(() => Effect.void)),
      ),
    ),
  )

  const closeWatcher = Effect.gen(function* () {
    yield* connection.onClose
    const playerIds = yield* Ref.get(gameServer.playerIdByConnectionId)
    const playerId = playerIds.get(connection.id) ?? null
    if (playerId !== null) yield* handlePlayerLeave({ gameServer, serverService: service }, playerId)
  }).pipe(Effect.catchAll(() => Effect.void))

  return Effect.gen(function* () {
    yield* Effect.forkDaemon(readMessages)
    yield* Effect.forkDaemon(closeWatcher)
  })
}

const startConnectionLoop = (
  handle: WebSocketServerHandle,
  gameServer: GameServer,
  service: ServerServiceShape,
): Effect.Effect<Fiber.RuntimeFiber<void, never>, never> =>
  Effect.forkDaemon(Effect.gen(function* () {
    const connections = yield* handle.onConnection
    yield* Stream.runForEach(connections, (connection) => wireConnection(gameServer, service, connection))
  }))

export const ServerServiceImpl = (
  port: WebSocketServerPort,
  options: ServerServiceImplOptions = {},
): Effect.Effect<ServerServiceShape, never> =>
  Effect.gen(function* () {
    const gameServer = yield* makeGameServer(options.maxPlayers ?? 20)
    const handleRef = yield* Ref.make<Option.Option<WebSocketServerHandle>>(Option.none())
    const fiberRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, never>>>(Option.none())

    const service: ServerServiceShape = {
      start: (serverPort) =>
        Effect.gen(function* () {
          const handle = yield* port.start(serverPort)
          yield* Ref.set(handleRef, Option.some(handle))
          const fiber = yield* startConnectionLoop(handle, gameServer, service)
          yield* Ref.set(fiberRef, Option.some(fiber))
          return serverPort
        }),
      stop: () =>
        Effect.gen(function* () {
          const fiber = Option.getOrNull(yield* Ref.get(fiberRef))
          if (fiber !== null) {
            yield* Fiber.interrupt(fiber).pipe(Effect.asVoid)
          }
          yield* Ref.set(fiberRef, Option.none())
          const handle = Option.getOrNull(yield* Ref.get(handleRef))
          if (handle !== null) {
            yield* handle.stop
          }
          yield* Ref.set(handleRef, Option.none())
          yield* Ref.set(gameServer.connectedPlayers, new Map())
          yield* Ref.set(gameServer.connectionsByPlayerId, new Map())
          yield* Ref.set(gameServer.playerIdByConnectionId, new Map())
        }).pipe(
          Effect.mapError((cause) => new NetworkError({ operation: 'stop', reason: 'failed to stop server', cause })),
        ),
      getConnectedPlayers: () => Effect.gen(function* () {
        const players = yield* Ref.get(gameServer.connectedPlayers)
        return new Map(players)
      }),
      sendToPlayer: (playerId, message) =>
        Effect.gen(function* () {
          const connections = yield* Ref.get(gameServer.connectionsByPlayerId)
          const connection = connections.get(playerId) ?? null
          if (connection === null) yield* Effect.fail(new NetworkError({ operation: 'send', reason: `player ${playerId} is not connected` }))
          else yield* sendEncodedToConnection(connection, message)
        }),
      broadcast: (message, exclude) =>
        Effect.gen(function* () {
          const connections = yield* Ref.get(gameServer.connectionsByPlayerId)
          for (const [playerId, connection] of connections.entries()) {
            if (playerId !== exclude) {
              yield* sendEncodedToConnection(connection, message)
            }
          }
        }),
    }

    return service
  })

export const ServerServiceLive = (
  port: WebSocketServerPort,
  options: ServerServiceImplOptions = {},
): Layer.Layer<ServerServiceShape> =>
  Layer.effect(ServerService, ServerServiceImpl(port, options))
