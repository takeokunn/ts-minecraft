import { Effect, Ref } from 'effect'
import { NetworkError } from '../domain/errors'
import { MessageType, PlayerId, WorldId } from '../domain/schemas'
import type { BlockBreakMessage, BlockPlaceMessage, ChatMessage, EntityDamageMessage, EntitySnapshotMessage, NetworkMessage, PlayerJoinMessage, PlayerMoveMessage } from '../domain/schemas'
import type { WebSocketConnection } from '../domain/websocket-ports'
import { decodeNetworkMessage, sendEncodedToConnection } from './codec'
import type { ConnectedPlayer, GameServer, ServerServiceShape } from './server-service'

export type ServerHandlerServices = {
  readonly gameServer: GameServer
  readonly serverService: ServerServiceShape
}

const defaultRotation = { yaw: 0, pitch: 0 }

const nextPlayerId = (): PlayerId => PlayerId.make(crypto.randomUUID())
const REPLAY_PLAYER_ID: PlayerId = PlayerId.make('server:replay')
const defaultWorldId = (): WorldId => WorldId.make('overworld')

const verifyPlayerOwnership = (
  services: ServerHandlerServices,
  connectionId: string,
  playerId: PlayerId,
): Effect.Effect<void, NetworkError> =>
  Effect.gen(function* () {
    const playerIds = yield* Ref.get(services.gameServer.playerIdByConnectionId)
    const ownerId = playerIds.get(connectionId)
    if (!ownerId || ownerId !== playerId) {
      return yield* Effect.fail(new NetworkError({ operation: 'dispatch', reason: `playerId ${playerId} does not belong to connection ${connectionId}` }))
    }
  })

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
      return yield* Effect.fail(new NetworkError({ operation: 'capacity', reason: 'server is full' }))
    }

    const playerId = nextPlayerId()
    const connectedPlayer: ConnectedPlayer = {
      playerId,
      playerName: message.playerName,
      worldId: message.worldId,
      position: message.position,
      rotation: defaultRotation,
    }

    yield* Ref.update(services.gameServer.connectedPlayers, (players) => new Map(players).set(playerId, connectedPlayer))
    yield* Ref.update(services.gameServer.connectionsByPlayerId, (connections) => new Map(connections).set(playerId, connection))
    yield* Ref.update(services.gameServer.playerIdByConnectionId, (ids) => new Map(ids).set(connection.id, playerId))

    // The direct echo is flagged isSelf so the joiner adopts its assigned id
    // exactly — never by name, which cross-binds when two players share one.
    // Broadcast/replay joins carry an explicit isSelf:false so a same-named
    // joiner's legacy name-matcher can never bind them either.
    const assignedJoin: PlayerJoinMessage = { ...message, playerId, timestamp: Date.now(), isSelf: false }
    yield* sendEncodedToConnection(connection, { ...assignedJoin, isSelf: true })
    // First joiner's seed becomes the session's authoritative seed; every
    // joiner (including the first) gets it echoed back so mismatched clients
    // can warn that their terrain will not match the host's.
    const sessionSeed = yield* Ref.updateAndGet(services.gameServer.worldSeed, (current) =>
      current !== null ? current : (message.worldSeed ?? null),
    )
    // Likewise the first joiner's clock becomes the session's time of day, so
    // every client sees the same day/night phase.
    const sessionTimeOfDay = yield* Ref.updateAndGet(services.gameServer.timeOfDay, (current) =>
      current !== null ? current : (message.timeOfDay ?? null),
    )
    // The first joiner also becomes the entity host: the one client whose mobs
    // are authoritative for the session (everyone else's snapshots are dropped).
    const sessionEntityHost = yield* Ref.updateAndGet(services.gameServer.entityHost, (current) =>
      current !== null ? current : playerId,
    )
    if (sessionSeed !== null) {
      yield* sendEncodedToConnection(connection, {
        type: MessageType.WorldInfo,
        worldSeed: sessionSeed,
        ...(sessionTimeOfDay !== null ? { timeOfDay: sessionTimeOfDay } : {}),
        ...(sessionEntityHost !== null ? { entityHostPlayerId: sessionEntityHost } : {}),
        timestamp: Date.now(),
      })
    }
    // Replay the session's accumulated block edits (last-write-wins per voxel)
    // so a late joiner's world converges with everyone's changes. The editor id
    // is rewritten to a reserved id: clients skip inbound edits carrying their
    // OWN player id, and a rejoining editor must still apply their past edits.
    const editLog = yield* Ref.get(services.gameServer.blockEdits)
    for (const edit of editLog.values()) {
      yield* sendEncodedToConnection(connection, { ...edit, playerId: REPLAY_PLAYER_ID, timestamp: Date.now() })
    }
    for (const existingPlayer of currentPlayers.values()) {
      yield* sendEncodedToConnection(connection, {
        type: MessageType.PlayerJoin,
        playerId: existingPlayer.playerId,
        playerName: existingPlayer.playerName,
        worldId: existingPlayer.worldId,
        position: existingPlayer.position,
        timestamp: Date.now(),
        isSelf: false,
      })
    }
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
    // If the entity host left, promote a surviving player and announce it via
    // WorldInfo so exactly one client resumes simulating & broadcasting mobs.
    const currentHost = yield* Ref.get(services.gameServer.entityHost)
    if (currentHost === playerId) {
      const remainingConnections = yield* Ref.get(services.gameServer.connectionsByPlayerId)
      const nextHost = remainingConnections.keys().next().value ?? null
      yield* Ref.set(services.gameServer.entityHost, nextHost)
      const sessionSeed = yield* Ref.get(services.gameServer.worldSeed)
      const sessionTimeOfDay = yield* Ref.get(services.gameServer.timeOfDay)
      if (nextHost !== null && sessionSeed !== null) {
        yield* services.serverService.broadcast({
          type: MessageType.WorldInfo,
          worldSeed: sessionSeed,
          ...(sessionTimeOfDay !== null ? { timeOfDay: sessionTimeOfDay } : {}),
          entityHostPlayerId: nextHost,
          timestamp: Date.now(),
        })
      }
    }
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

export const handleEntitySnapshot = (
  services: ServerHandlerServices,
  message: EntitySnapshotMessage,
): Effect.Effect<void, NetworkError> =>
  Effect.gen(function* () {
    // Only the entity host's snapshots are authoritative; drop everyone else's
    // so per-client mob populations can't multiply across the session.
    const entityHost = yield* Ref.get(services.gameServer.entityHost)
    if (entityHost !== null && entityHost !== message.playerId) return
    yield* services.serverService.broadcast(message, message.playerId)
  })

export const handleEntityDamage = (
  services: ServerHandlerServices,
  message: EntityDamageMessage,
): Effect.Effect<void, NetworkError> =>
  Effect.gen(function* () {
    // Relay a non-host player's hit to the entity host only — the host applies
    // it and the outcome converges back through its EntitySnapshot broadcasts.
    const entityHost = yield* Ref.get(services.gameServer.entityHost)
    if (entityHost === null || entityHost === message.playerId) return
    yield* services.serverService.sendToPlayer(entityHost, message).pipe(
      Effect.catchAll(() => Effect.void),
    )
  })

const blockEditKey = (position: { readonly x: number; readonly y: number; readonly z: number }): string =>
  `${position.x},${position.y},${position.z}`

const recordBlockEdit = (
  services: ServerHandlerServices,
  message: BlockPlaceMessage | BlockBreakMessage,
): Effect.Effect<void, never> =>
  Ref.update(services.gameServer.blockEdits, (edits) => {
    const next = new Map(edits)
    next.set(blockEditKey(message.position), message)
    return next
  })

export const handleBlockPlace = (
  services: ServerHandlerServices,
  message: BlockPlaceMessage,
): Effect.Effect<void, NetworkError> =>
  recordBlockEdit(services, message).pipe(
    Effect.flatMap(() => services.serverService.broadcast(message, message.playerId)),
  )

export const handleBlockBreak = (
  services: ServerHandlerServices,
  message: BlockBreakMessage,
): Effect.Effect<void, NetworkError> =>
  recordBlockEdit(services, message).pipe(
    Effect.flatMap(() => services.serverService.broadcast(message, message.playerId)),
  )

export const handleChat = (
  services: ServerHandlerServices,
  message: ChatMessage,
): Effect.Effect<void, NetworkError> => services.serverService.broadcast(message)

const handlePing = (connection: WebSocketConnection, message: Extract<NetworkMessage, { type: typeof MessageType.Ping }>): Effect.Effect<void, NetworkError> =>
  sendEncodedToConnection(connection, {
    type: MessageType.Pong,
    nonce: message.nonce,
    timestamp: Date.now(),
  })

export const dispatchMessage = (
  services: ServerHandlerServices,
  connection: WebSocketConnection,
  raw: ArrayBuffer,
): Effect.Effect<void, NetworkError> =>
  Effect.gen(function* () {
    const message = yield* decodeNetworkMessage(raw)
    switch (message.type) {
      case MessageType.PlayerJoin:
        yield* handlePlayerJoin(services, message, connection)
        return
      case MessageType.PlayerLeave:
        yield* verifyPlayerOwnership(services, connection.id, message.playerId)
        yield* handlePlayerLeave(services, message.playerId)
        return
      case MessageType.PlayerMove:
        yield* verifyPlayerOwnership(services, connection.id, message.playerId)
        yield* handlePlayerMove(services, message)
        return
      case MessageType.EntitySnapshot:
        yield* verifyPlayerOwnership(services, connection.id, message.playerId)
        yield* handleEntitySnapshot(services, message)
        return
      case MessageType.EntityDamage:
        yield* verifyPlayerOwnership(services, connection.id, message.playerId)
        yield* handleEntityDamage(services, message)
        return
      case MessageType.BlockPlace:
        yield* verifyPlayerOwnership(services, connection.id, message.playerId)
        yield* handleBlockPlace(services, message)
        return
      case MessageType.BlockBreak:
        yield* verifyPlayerOwnership(services, connection.id, message.playerId)
        yield* handleBlockBreak(services, message)
        return
      case MessageType.Chat:
        yield* verifyPlayerOwnership(services, connection.id, message.playerId)
        yield* handleChat(services, message)
        return
      case MessageType.Ping:
        yield* handlePing(connection, message)
        return
      case MessageType.Pong:
      case MessageType.Error:
        return
    }
  })

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
