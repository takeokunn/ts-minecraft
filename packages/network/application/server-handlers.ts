import { Effect, Queue, Ref } from 'effect'
import { NetworkError } from '../domain/errors'
import { MessageType, PlayerId, WorldId } from '../domain/schemas'
import type { BlockBreakMessage, BlockPlaceMessage, ChatMessage, NetworkMessage, PlayerJoinMessage, PlayerMoveMessage } from '../domain/schemas'
import type { WebSocketConnection } from '../infrastructure/websocket-server'
import { decodeNetworkMessage, sendEncodedToConnection } from './codec'
import type { ConnectedPlayer, GameServer, ServerServiceShape } from './server-service'

export type ServerHandlerServices = {
  readonly gameServer: GameServer
  readonly serverService: ServerServiceShape
}

const defaultRotation = { yaw: 0, pitch: 0 }

const nextPlayerId = (): PlayerId => PlayerId.make(crypto.randomUUID())
const defaultWorldId = (): WorldId => WorldId.make('overworld')

const verifyPlayerOwnership = (
  services: ServerHandlerServices,
  connectionId: string,
  playerId: PlayerId,
): Effect.Effect<void, NetworkError> =>
  Ref.get(services.gameServer.playerIdByConnectionId).pipe(
    Effect.flatMap((playerIds) => {
      const ownerId = playerIds.get(connectionId)
      if (!ownerId || ownerId !== playerId) {
        return Effect.fail(new NetworkError({ operation: 'dispatch', reason: `playerId ${playerId} does not belong to connection ${connectionId}` }))
      }
      return Effect.void
    }),
  )

export const handlePlayerJoin = (
  services: ServerHandlerServices,
  message: PlayerJoinMessage,
  connection: WebSocketConnection,
): Effect.Effect<PlayerId, NetworkError> =>
  Effect.gen(function* () {
    const currentPlayers = yield* Ref.get(services.gameServer.connectedPlayers)
    if (currentPlayers.size >= services.gameServer.maxPlayers) {
      yield* sendEncodedToConnection(connection, {
        type: MessageType.Error,
        code: 'SERVER_FULL',
        message: 'Server is full',
        timestamp: Date.now(),
      })
      yield* Effect.fail(new NetworkError({ operation: 'capacity', reason: 'server is full' }))
    }

    const playerId = nextPlayerId()
    const sendQueue = yield* Queue.unbounded<ArrayBuffer>()
    const connectedPlayer: ConnectedPlayer = {
      playerId,
      playerName: message.playerName,
      worldId: message.worldId,
      position: message.position,
      rotation: defaultRotation,
      sendQueue,
    }

    yield* Ref.update(services.gameServer.connectedPlayers, (players) => new Map(players).set(playerId, connectedPlayer))
    yield* Ref.update(services.gameServer.connectionsByPlayerId, (connections) => new Map(connections).set(playerId, connection))
    yield* Ref.update(services.gameServer.playerIdByConnectionId, (ids) => new Map(ids).set(connection.id, playerId))

    const assignedJoin: PlayerJoinMessage = { ...message, playerId, timestamp: Date.now() }
    for (const existingPlayer of currentPlayers.values()) {
      yield* sendEncodedToConnection(connection, {
        type: MessageType.PlayerJoin,
        playerId: existingPlayer.playerId,
        playerName: existingPlayer.playerName,
        worldId: existingPlayer.worldId,
        position: existingPlayer.position,
        timestamp: Date.now(),
      })
    }
    yield* sendEncodedToConnection(connection, assignedJoin)
    yield* services.serverService.broadcast(assignedJoin, playerId)
    return playerId
  })

export const handlePlayerLeave = (
  services: ServerHandlerServices,
  playerId: PlayerId,
): Effect.Effect<void, NetworkError> =>
  Effect.gen(function* () {
    const players = yield* Ref.get(services.gameServer.connectedPlayers)
    const leavingPlayer = players.get(playerId)
    if (!leavingPlayer) return

    yield* Ref.update(services.gameServer.connectedPlayers, (current) => {
      const next = new Map(current)
      next.delete(playerId)
      return next
    })
    yield* Ref.update(services.gameServer.connectionsByPlayerId, (current) => {
      const next = new Map(current)
      next.delete(playerId)
      return next
    })
    yield* Ref.update(services.gameServer.playerIdByConnectionId, (current) => {
      const next = new Map(current)
      for (const [connectionId, mappedPlayerId] of next.entries()) {
        if (mappedPlayerId === playerId) next.delete(connectionId)
      }
      return next
    })
    yield* services.serverService.broadcast({
      type: MessageType.PlayerLeave,
      playerId,
      worldId: leavingPlayer.worldId,
      timestamp: Date.now(),
    })
  })

export const handlePlayerMove = (
  services: ServerHandlerServices,
  message: PlayerMoveMessage,
): Effect.Effect<void, NetworkError> =>
  Effect.gen(function* () {
    yield* Ref.update(services.gameServer.connectedPlayers, (players) => {
      const existing = players.get(message.playerId)
      if (!existing) return players
      return new Map(players).set(message.playerId, { ...existing, position: message.position, rotation: message.rotation })
    })
    yield* services.serverService.broadcast(message, message.playerId)
  })

export const handleBlockPlace = (
  services: ServerHandlerServices,
  message: BlockPlaceMessage,
): Effect.Effect<void, NetworkError> => services.serverService.broadcast(message, message.playerId)

export const handleBlockBreak = (
  services: ServerHandlerServices,
  message: BlockBreakMessage,
): Effect.Effect<void, NetworkError> => services.serverService.broadcast(message, message.playerId)

export const handleChat = (
  services: ServerHandlerServices,
  message: ChatMessage,
): Effect.Effect<void, NetworkError> => services.serverService.broadcast(message)

const handlePing = (connection: WebSocketConnection, message: NetworkMessage): Effect.Effect<void, NetworkError> => {
  if (message.type !== MessageType.Ping) return Effect.void
  return sendEncodedToConnection(connection, {
    type: MessageType.Pong,
    nonce: message.nonce,
    timestamp: Date.now(),
  })
}

export const dispatchMessage = (
  services: ServerHandlerServices,
  connection: WebSocketConnection,
  raw: ArrayBuffer,
): Effect.Effect<void, NetworkError> =>
  decodeNetworkMessage(raw).pipe(
    Effect.flatMap((message) => {
      switch (message.type) {
        case MessageType.PlayerJoin:
          return handlePlayerJoin(services, message, connection).pipe(Effect.asVoid)
        case MessageType.PlayerLeave:
          return verifyPlayerOwnership(services, connection.id, message.playerId).pipe(
            Effect.zipRight(handlePlayerLeave(services, message.playerId)),
          )
        case MessageType.PlayerMove:
          return verifyPlayerOwnership(services, connection.id, message.playerId).pipe(
            Effect.zipRight(handlePlayerMove(services, message)),
          )
        case MessageType.BlockPlace:
          return verifyPlayerOwnership(services, connection.id, message.playerId).pipe(
            Effect.zipRight(handleBlockPlace(services, message)),
          )
        case MessageType.BlockBreak:
          return verifyPlayerOwnership(services, connection.id, message.playerId).pipe(
            Effect.zipRight(handleBlockBreak(services, message)),
          )
        case MessageType.Chat:
          return verifyPlayerOwnership(services, connection.id, message.playerId).pipe(
            Effect.zipRight(handleChat(services, message)),
          )
        case MessageType.Ping:
          return handlePing(connection, message)
        case MessageType.Pong:
        case MessageType.Error:
          return Effect.void
      }
    }),
  )

export const makeJoinMessage = (
  playerName: PlayerJoinMessage['playerName'],
): PlayerJoinMessage => ({
  type: MessageType.PlayerJoin,
  playerId: PlayerId.make('pending'),
  playerName,
  worldId: defaultWorldId(),
  position: { x: 0, y: 64, z: 0 },
  timestamp: Date.now(),
})
