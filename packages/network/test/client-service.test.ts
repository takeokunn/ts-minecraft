import { describe, it } from '@effect/vitest'
import { Effect, Option, Stream, TestClock, TestContext } from 'effect'
import { expect } from 'vitest'
import { FakeWebSocketClient } from '../infrastructure/websocket-client'
import { FakeWebSocketServer } from '../infrastructure/websocket-server'
import {
  ClientService,
  ClientServiceDefault,
  MessageType,
  NetworkError,
  PlayerId,
  PlayerName,
  ServerService,
  ServerServiceDefault,
  WorldId,
  encodeNetworkMessage,
  type NetworkMessage,
} from '@ts-minecraft/network'

const takeFromClient = (stream: Stream.Stream<NetworkMessage, never, never>): Effect.Effect<NetworkMessage, never> =>
  Effect.gen(function* () {
    const message = yield* Stream.runHead(stream)
    return Option.getOrThrow(message)
  })

const newestConnection = (server: FakeWebSocketServer) => {
  const connection = Array.from(server.getConnections().values()).at(-1)
  if (connection === undefined) throw new Error('expected an active fake socket connection')
  return connection
}

describe('network/client-service', () => {
  it.effect('receiveMessages is empty before a connection is opened', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const client = yield* ClientService
      const messages = yield* client.receiveMessages()
      const collected = yield* Stream.runCollect(messages)
      expect(Array.from(collected)).toEqual([])
    }).pipe(Effect.provide(ClientServiceDefault(new FakeWebSocketClient(fakeServer))))
  })

  it.effect('sendMessage fails before a connection is opened', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const client = yield* ClientService
      const error = yield* client.sendMessage({
        type: MessageType.Chat,
        playerId: PlayerId.make('alex'),
        worldId: WorldId.make('overworld'),
        message: 'hello',
        timestamp: 1,
      }).pipe(Effect.flip)
      expect(error).toBeInstanceOf(NetworkError)
      expect(error.operation).toBe('send')
    }).pipe(Effect.provide(ClientServiceDefault(new FakeWebSocketClient(fakeServer))))
  })

  it.effect('connect failure marks the client as failed', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const client = yield* ClientService
      const error = yield* client.connect('ws://localhost:25565', PlayerName.make('Alex')).pipe(Effect.flip)
      expect(error).toBeInstanceOf(NetworkError)
      expect(error.operation).toBe('connect')
      expect(yield* client.getConnectionState()).toBe('failed')
    }).pipe(Effect.provide(ClientServiceDefault(new FakeWebSocketClient(fakeServer))))
  })

  it.effect('client connects and receives welcome message', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* ClientService
      yield* client.connect('ws://localhost:25565', PlayerName.make('Alex'))
      const messages = yield* client.receiveMessages()
      const welcome = yield* takeFromClient(messages)
      expect(welcome.type).toBe(MessageType.PlayerJoin)
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)), Effect.provide(ClientServiceDefault(new FakeWebSocketClient(fakeServer))))
  })

  it.effect('client connection state transitions from idle to connecting to connected', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* ClientService
      expect(yield* client.getConnectionState()).toBe('idle')
      yield* client.connect('ws://localhost:25565', PlayerName.make('Alex'))
      expect(yield* client.getConnectionState()).toBe('connected')
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)), Effect.provide(ClientServiceDefault(new FakeWebSocketClient(fakeServer))))
  })

  it.effect('client sends messages through the active connection', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* ClientService
      yield* client.connect('ws://localhost:25565', PlayerName.make('Alex'))
      const messages = yield* client.receiveMessages()
      const welcome = yield* takeFromClient(messages)
      if (welcome.type !== MessageType.PlayerJoin) return

      yield* client.sendMessage({
        type: MessageType.Chat,
        playerId: welcome.playerId,
        worldId: welcome.worldId,
        message: 'hello',
        timestamp: 2,
      })
      const chat = yield* takeFromClient(messages)
      expect(chat.type).toBe(MessageType.Chat)
      if (chat.type === MessageType.Chat) expect(chat.message).toBe('hello')
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)), Effect.provide(ClientServiceDefault(new FakeWebSocketClient(fakeServer))))
  })

  it.effect('client receives broadcast messages', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const first = yield* ClientService
      yield* first.connect('ws://localhost:25565', PlayerName.make('Alex'))
      const firstMessages = yield* first.receiveMessages()
      yield* takeFromClient(firstMessages)

      const second = yield* fakeServer.connectClient()
      const encoded = yield* encodeNetworkMessage({
        type: MessageType.PlayerJoin,
        playerId: PlayerId.make('pending'),
        playerName: PlayerName.make('Steve'),
        worldId: WorldId.make('overworld'),
        position: { x: 0, y: 64, z: 0 },
        timestamp: 2,
      })
      yield* second.clientSend(encoded)
      const broadcast = yield* takeFromClient(firstMessages)
      expect(broadcast.type).toBe(MessageType.PlayerJoin)
      if (broadcast.type === MessageType.PlayerJoin) expect(broadcast.playerName).toBe(PlayerName.make('Steve'))
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)), Effect.provide(ClientServiceDefault(new FakeWebSocketClient(fakeServer))))
  })

  it.effect('client disconnects cleanly', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* ClientService
      yield* client.connect('ws://localhost:25565', PlayerName.make('Alex'))
      yield* client.disconnect()
      yield* Effect.yieldNow()
      expect(yield* client.getConnectionState()).toBe('disconnected')
    }).pipe(Effect.provide(ServerServiceDefault(fakeServer)), Effect.provide(ClientServiceDefault(new FakeWebSocketClient(fakeServer))))
  })

  it.effect('client reconnects after an unexpected transport close', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* ClientService
      yield* client.connect('ws://localhost:25565', PlayerName.make('Alex'))
      yield* takeFromClient(yield* client.receiveMessages())

      const originalConnection = newestConnection(fakeServer)
      yield* originalConnection.close
      yield* Effect.yieldNow()
      yield* TestClock.adjust('10 millis')
      yield* Effect.yieldNow()

      expect(yield* client.getConnectionState()).toBe('connected')
      expect(newestConnection(fakeServer)).not.toBe(originalConnection)

      const messages = yield* client.receiveMessages()
      const welcome = yield* takeFromClient(messages)
      expect(welcome.type).toBe(MessageType.PlayerJoin)
    }).pipe(
      Effect.provide(ServerServiceDefault(fakeServer)),
      Effect.provide(ClientServiceDefault(new FakeWebSocketClient(fakeServer))),
      Effect.provide(TestContext.TestContext),
    )
  })

  it.effect('client marks the connection failed when reconnect attempts are exhausted', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* ClientService
      yield* client.connect('ws://localhost:25565', PlayerName.make('Alex'))

      yield* server.stop()
      yield* Effect.yieldNow()
      yield* TestClock.adjust('10 millis')
      yield* Effect.yieldNow()

      expect(yield* client.getConnectionState()).toBe('failed')
    }).pipe(
      Effect.provide(ServerServiceDefault(fakeServer)),
      Effect.provide(ClientServiceDefault(new FakeWebSocketClient(fakeServer), { maxReconnectAttempts: 1 })),
      Effect.provide(TestContext.TestContext),
    )
  })

  it.effect('client disconnect interrupts an active reconnect attempt', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* ClientService
      yield* client.connect('ws://localhost:25565', PlayerName.make('Alex'))

      yield* newestConnection(fakeServer).close
      yield* client.disconnect()
      yield* TestClock.adjust('10 millis')
      yield* Effect.yieldNow()

      expect(yield* client.getConnectionState()).toBe('disconnected')
    }).pipe(
      Effect.provide(ServerServiceDefault(fakeServer)),
      Effect.provide(ClientServiceDefault(new FakeWebSocketClient(fakeServer))),
      Effect.provide(TestContext.TestContext),
    )
  })
})
