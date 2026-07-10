import { Context, Effect, Fiber, Layer, Option, Ref, Stream } from 'effect'
import { NetworkError } from '../domain/errors'
import { MessageType, PlayerId, type BlockBreakMessage, type BlockPlaceMessage, type ContainerUpdateMessage, type ParkedVehicleUpdateMessage, type NetworkMessage, type NetworkRotation, type PlayerName, type Vec3, type WorldId } from '../domain/schemas'
import type { WebSocketConnection, WebSocketServerHandle, WebSocketServerPort } from '../domain/websocket-ports'
import { sendEncodedToConnection } from './codec'
import { dispatchMessage, handlePlayerLeave } from './server-handlers'

export type ServerPort = number

export type ConnectedPlayer = {
  readonly playerId: PlayerId
  readonly playerName: PlayerName
  readonly worldId: WorldId
  readonly position: Vec3
  readonly rotation: NetworkRotation
}

export type GameServer = {
  readonly connectedPlayers: Ref.Ref<Map<PlayerId, ConnectedPlayer>>
  readonly connectionsByPlayerId: Ref.Ref<Map<PlayerId, WebSocketConnection>>
  readonly playerIdByConnectionId: Ref.Ref<Map<string, PlayerId>>
  // Authoritative terrain seed for the session: the first joiner's seed.
  // null until a client that knows its seed joins.
  readonly worldSeed: Ref.Ref<number | null>
  // Authoritative time of day for the session: the first joiner's clock,
  // echoed to every later joiner via WorldInfo so day/night matches.
  readonly timeOfDay: Ref.Ref<number | null>
  readonly timeCapturedAtMs: Ref.Ref<number | null>
  readonly dayLengthSeconds: Ref.Ref<number | null>
  // The single client that simulates & broadcasts entities (first joiner;
  // reassigned to a surviving player on leave). Snapshots from anyone else
  // are dropped so mob populations converge instead of multiplying per client.
  readonly entityHost: Ref.Ref<PlayerId | null>
  // Last block edit per voxel (last-write-wins), replayed to late joiners so
  // their world converges with everyone else's edits.
  readonly blockEdits: Ref.Ref<Map<string, BlockPlaceMessage | BlockBreakMessage>>
  // Last full container state per (dimension, position), replayed to late
  // joiners so chest contents converge the same way block edits do.
  readonly containerUpdates: Ref.Ref<Map<string, ContainerUpdateMessage>>
  // Live parked vehicles per (dimension, owner, vehicleId): replayed to late
  // joiners; entries removed when the vehicle is claimed or picked up.
  readonly parkedVehicles: Ref.Ref<Map<string, ParkedVehicleUpdateMessage>>
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
    const worldSeed = yield* Ref.make<number | null>(null)
    const timeOfDay = yield* Ref.make<number | null>(null)
    const timeCapturedAtMs = yield* Ref.make<number | null>(null)
    const dayLengthSeconds = yield* Ref.make<number | null>(null)
    const entityHost = yield* Ref.make<PlayerId | null>(null)
    const blockEdits = yield* Ref.make(new Map<string, BlockPlaceMessage | BlockBreakMessage>())
    const containerUpdates = yield* Ref.make(new Map<string, ContainerUpdateMessage>())
    const parkedVehicles = yield* Ref.make(new Map<string, ParkedVehicleUpdateMessage>())
    return { connectedPlayers, connectionsByPlayerId, playerIdByConnectionId, worldSeed, timeOfDay, timeCapturedAtMs, dayLengthSeconds, entityHost, blockEdits, containerUpdates, parkedVehicles, maxPlayers }
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

export const ServerServiceDefault = (
  port: WebSocketServerPort,
  options: ServerServiceImplOptions = {},
): Layer.Layer<ServerServiceShape> =>
  Layer.effect(ServerService, ServerServiceImpl(port, options))
