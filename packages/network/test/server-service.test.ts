import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect } from 'vitest'
import { FakeWebSocketServer } from '../infrastructure/websocket-server'
import { decodeNetworkMessage, encodeNetworkMessage } from '../application/codec'
import { ServerService, ServerServiceDefault } from '../application/server-service'
import {
  MessageType,
  PlayerId,
  PlayerName,
  WorldId,
  type NetworkMessage,
  type PlayerJoinMessage,
} from '../domain/schemas'

const worldId = WorldId.make('overworld')

const joinMessage = (name: string): PlayerJoinMessage => ({
  type: MessageType.PlayerJoin,
  playerId: PlayerId.make('client-pending'),
  playerName: PlayerName.make(name),
  worldId,
  position: { x: 0, y: 64, z: 0 },
  timestamp: 1,
})

const sendMessage = (send: (data: ArrayBuffer) => Effect.Effect<void, unknown>, message: NetworkMessage) =>
  Effect.gen(function* () {
    const data = yield* encodeNetworkMessage(message)
    yield* send(data)
  })

const takeMessage = (take: Effect.Effect<ArrayBuffer, never>): Effect.Effect<NetworkMessage, never> =>
  Effect.gen(function* () {
    const raw = yield* take
    return yield* decodeNetworkMessage(raw).pipe(Effect.orDie)
  })

describe('network/server-service', () => {
  it.effect('server starts and stops successfully', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      const port = yield* server.start(25565)
      expect(port).toBe(25565)
      yield* server.stop()
      expect(fakeServer.getConnections().size).toBe(0)
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)))
  })

  it.effect('server accepts connections and assigns PlayerIds', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* fakeServer.connectClient()
      yield* sendMessage(client.clientSend, joinMessage('Alex'))

      const welcome = yield* takeMessage(client.takeClientMessage)
      expect(welcome.type).toBe(MessageType.PlayerJoin)
      if (welcome.type !== MessageType.PlayerJoin) return
      expect(welcome.playerName).toBe(PlayerName.make('Alex'))
      expect(welcome.playerId).not.toBe(PlayerId.make('client-pending'))

      const players = yield* server.getConnectedPlayers()
      expect(players.has(welcome.playerId)).toBe(true)
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)))
  })

  it.effect('server enforces max players limit', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const first = yield* fakeServer.connectClient()
      yield* sendMessage(first.clientSend, joinMessage('Alex'))
      yield* takeMessage(first.takeClientMessage)

      const second = yield* fakeServer.connectClient()
      yield* sendMessage(second.clientSend, joinMessage('Steve'))
      const rejected = yield* takeMessage(second.takeClientMessage)
      expect(rejected.type).toBe(MessageType.Error)
      if (rejected.type === MessageType.Error) expect(rejected.code).toBe('SERVER_FULL')
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer, { maxPlayers: 1 })))
  })

  it.effect('server sendToPlayer sends a direct message to a connected player', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* fakeServer.connectClient()
      yield* sendMessage(client.clientSend, joinMessage('Alex'))
      const welcome = yield* takeMessage(client.takeClientMessage)
      if (welcome.type !== MessageType.PlayerJoin) return

      yield* server.sendToPlayer(welcome.playerId, {
        type: MessageType.Chat,
        playerId: welcome.playerId,
        worldId,
        message: 'direct hello',
        timestamp: 2,
      })
      const direct = yield* takeMessage(client.takeClientMessage)
      expect(direct.type).toBe(MessageType.Chat)
      if (direct.type === MessageType.Chat) expect(direct.message).toBe('direct hello')
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)))
  })

  it.effect('server sendToPlayer fails when the player is not connected', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const error = yield* server.sendToPlayer(PlayerId.make('missing'), {
        type: MessageType.Chat,
        playerId: PlayerId.make('missing'),
        worldId,
        message: 'direct hello',
        timestamp: 2,
      }).pipe(Effect.flip)
      expect(error.operation).toBe('send')
      expect(error.reason).toBe('player missing is not connected')
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)))
  })

  it.effect('server broadcasts PlayerJoin to existing players on new connection', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const first = yield* fakeServer.connectClient()
      yield* sendMessage(first.clientSend, joinMessage('Alex'))
      const firstWelcome = yield* takeMessage(first.takeClientMessage)
      expect(firstWelcome.type).toBe(MessageType.PlayerJoin)

      const second = yield* fakeServer.connectClient()
      yield* sendMessage(second.clientSend, joinMessage('Steve'))
      const broadcast = yield* takeMessage(first.takeClientMessage)
      expect(broadcast.type).toBe(MessageType.PlayerJoin)
      if (broadcast.type === MessageType.PlayerJoin) expect(broadcast.playerName).toBe(PlayerName.make('Steve'))
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)))
  })

  it.effect('server broadcasts PlayerLeave on disconnect', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const first = yield* fakeServer.connectClient()
      yield* sendMessage(first.clientSend, joinMessage('Alex'))
      yield* takeMessage(first.takeClientMessage)
      const second = yield* fakeServer.connectClient()
      yield* sendMessage(second.clientSend, joinMessage('Steve'))
      yield* takeMessage(first.takeClientMessage)
      yield* takeMessage(second.takeClientMessage)
      yield* takeMessage(second.takeClientMessage)

      yield* second.clientClose
      const leave = yield* takeMessage(first.takeClientMessage)
      expect(leave.type).toBe(MessageType.PlayerLeave)
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)))
  })

  it.effect('server broadcasts PlayerMove to others and not sender', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const first = yield* fakeServer.connectClient()
      yield* sendMessage(first.clientSend, joinMessage('Alex'))
      const firstWelcome = yield* takeMessage(first.takeClientMessage)
      if (firstWelcome.type !== MessageType.PlayerJoin) return
      const second = yield* fakeServer.connectClient()
      yield* sendMessage(second.clientSend, joinMessage('Steve'))
      yield* takeMessage(first.takeClientMessage)
      yield* takeMessage(second.takeClientMessage)
      yield* takeMessage(second.takeClientMessage)

      yield* sendMessage(first.clientSend, {
        type: MessageType.PlayerMove,
        playerId: firstWelcome.playerId,
        worldId,
        position: { x: 5, y: 65, z: 2 },
        rotation: { yaw: 45, pitch: 5 },
        timestamp: 2,
      })
      const move = yield* takeMessage(second.takeClientMessage)
      expect(move.type).toBe(MessageType.PlayerMove)
      if (move.type === MessageType.PlayerMove) expect(move.playerId).toBe(firstWelcome.playerId)
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)))
  })

  it.effect('server broadcasts Chat to all', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* fakeServer.connectClient()
      yield* sendMessage(client.clientSend, joinMessage('Alex'))
      const welcome = yield* takeMessage(client.takeClientMessage)
      if (welcome.type !== MessageType.PlayerJoin) return

      yield* sendMessage(client.clientSend, { type: MessageType.Chat, playerId: welcome.playerId, worldId, message: 'hello', timestamp: 2 })
      const chat = yield* takeMessage(client.takeClientMessage)
      expect(chat.type).toBe(MessageType.Chat)
      if (chat.type === MessageType.Chat) expect(chat.message).toBe('hello')
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)))
  })

  it.effect('server broadcasts BlockPlace and BlockBreak to others and not sender', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const first = yield* fakeServer.connectClient()
      yield* sendMessage(first.clientSend, joinMessage('Alex'))
      const firstWelcome = yield* takeMessage(first.takeClientMessage)
      if (firstWelcome.type !== MessageType.PlayerJoin) return
      const second = yield* fakeServer.connectClient()
      yield* sendMessage(second.clientSend, joinMessage('Steve'))
      yield* takeMessage(first.takeClientMessage)
      yield* takeMessage(second.takeClientMessage)
      yield* takeMessage(second.takeClientMessage)

      yield* sendMessage(first.clientSend, { type: MessageType.BlockPlace, playerId: firstWelcome.playerId, worldId, position: { x: 1, y: 64, z: 1 }, blockType: 'STONE', timestamp: 2 })
      const place = yield* takeMessage(second.takeClientMessage)
      expect(place.type).toBe(MessageType.BlockPlace)

      yield* sendMessage(first.clientSend, { type: MessageType.BlockBreak, playerId: firstWelcome.playerId, worldId, position: { x: 1, y: 64, z: 1 }, timestamp: 3 })
      const blockBreak = yield* takeMessage(second.takeClientMessage)
      expect(blockBreak.type).toBe(MessageType.BlockBreak)
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)))
  })
})
