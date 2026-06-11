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
  Effect.all([
    Ref.make(new Map<PlayerId, ConnectedPlayer>()),
    Ref.make(new Map<PlayerId, WebSocketConnection>()),
    Ref.make(new Map<string, PlayerId>()),
  ], { concurrency: 'unbounded' }).pipe(
    Effect.map(([connectedPlayers, connectionsByPlayerId, playerIdByConnectionId]) => ({
      connectedPlayers,
      connectionsByPlayerId,
      playerIdByConnectionId,
      maxPlayers,
    })),
  )

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

  const closeWatcher = connection.onClose.pipe(
    Effect.flatMap(() =>
      Ref.get(gameServer.playerIdByConnectionId).pipe(
        Effect.flatMap((playerIds) => {
          const playerId = playerIds.get(connection.id) ?? null
          return playerId !== null
            ? handlePlayerLeave({ gameServer, serverService: service }, playerId)
            : Effect.void
        }),
      ),
    ),
    Effect.catchAll(() => Effect.void),
  )

  return Effect.forkDaemon(readMessages).pipe(
    Effect.zipRight(Effect.forkDaemon(closeWatcher)),
    Effect.asVoid,
  )
}

const startConnectionLoop = (
  handle: WebSocketServerHandle,
  gameServer: GameServer,
  service: ServerServiceShape,
): Effect.Effect<Fiber.RuntimeFiber<void, never>, never> =>
  handle.onConnection.pipe(
    Effect.flatMap((connections) => Stream.runForEach(connections, (connection) => wireConnection(gameServer, service, connection))),
    Effect.forkDaemon,
  )

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
        port.start(serverPort).pipe(
          Effect.tap((handle) => Ref.set(handleRef, Option.some(handle))),
          Effect.tap((handle) => startConnectionLoop(handle, gameServer, service).pipe(Effect.flatMap((fiber) => Ref.set(fiberRef, Option.some(fiber))))),
          Effect.as(serverPort),
        ),
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
      getConnectedPlayers: () => Ref.get(gameServer.connectedPlayers).pipe(Effect.map((players) => new Map(players))),
      sendToPlayer: (playerId, message) =>
        Ref.get(gameServer.connectionsByPlayerId).pipe(
          Effect.flatMap((connections) => {
            const connection = connections.get(playerId) ?? null
            return connection !== null
              ? sendEncodedToConnection(connection, message)
              : Effect.fail(new NetworkError({ operation: 'send', reason: `player ${playerId} is not connected` }))
          }),
        ),
      broadcast: (message, exclude) =>
        Effect.gen(function* () {
          const connections = yield* Ref.get(gameServer.connectionsByPlayerId)
          const sends = [...connections.entries()]
            .filter(([playerId]) => playerId !== exclude)
            .map(([, connection]) => sendEncodedToConnection(connection, message))
          yield* Effect.all(sends, { concurrency: 'unbounded' }).pipe(Effect.asVoid)
        }),
    }

    return service
  })

export const ServerServiceLive = (
  port: WebSocketServerPort,
  options: ServerServiceImplOptions = {},
): Layer.Layer<ServerServiceShape> =>
  Layer.effect(ServerService, ServerServiceImpl(port, options))
