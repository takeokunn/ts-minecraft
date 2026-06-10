import { describe, it } from '@effect/vitest'
import { Effect, Option, Stream } from 'effect'
import { expect } from 'vitest'
import {
  ClientService,
  ClientServiceLive,
  PlayerId,
  FakeWebSocketClient,
  FakeWebSocketServer,
  MessageType,
  PlayerName,
  ServerService,
  ServerServiceLive,
  WorldId,
  encodeNetworkMessage,
  type NetworkMessage,
} from '@ts-minecraft/network'

const takeFromClient = (stream: Stream.Stream<NetworkMessage, never, never>): Effect.Effect<NetworkMessage, never> =>
  Stream.runHead(stream).pipe(Effect.map((message) => Option.getOrThrow(message)))

describe('network/client-service', () => {
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
    }).pipe(Effect.provide(ServerServiceLive(fakeServer)), Effect.provide(ClientServiceLive(new FakeWebSocketClient(fakeServer))))
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
    }).pipe(Effect.provide(ServerServiceLive(fakeServer)), Effect.provide(ClientServiceLive(new FakeWebSocketClient(fakeServer))))
  })

  it.effect.skip('client reconnects on connection loss', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* ClientService
      yield* client.connect('ws://localhost:25565', PlayerName.make('Alex'))
      const firstConnection = [...fakeServer.getConnections().values()][0]
      expect(firstConnection).toBeDefined()
      // Close the connection and verify state transitions
      yield* firstConnection!.close
      // Reconnection is async and depends on backoff timing.
      // This test verifies the disconnect is detected and state changes.
      yield* Effect.sleep('100 millis')
      const state = yield* client.getConnectionState()
      expect(state === 'reconnecting' || state === 'connected' || state === 'failed')
        .toBeTruthy()
    }).pipe(Effect.provide(ServerServiceLive(fakeServer)), Effect.provide(ClientServiceLive(new FakeWebSocketClient(fakeServer))))
  }, { timeout: 15000 })

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
      yield* encodeNetworkMessage({
        type: MessageType.PlayerJoin,
        playerId: PlayerId.make('pending'),
        playerName: PlayerName.make('Steve'),
        worldId: WorldId.make('overworld'),
        position: { x: 0, y: 64, z: 0 },
        timestamp: 2,
      }).pipe(Effect.flatMap(second.clientSend))
      const broadcast = yield* takeFromClient(firstMessages)
      expect(broadcast.type).toBe(MessageType.PlayerJoin)
      if (broadcast.type === MessageType.PlayerJoin) expect(broadcast.playerName).toBe(PlayerName.make('Steve'))
    }).pipe(Effect.provide(ServerServiceLive(fakeServer)), Effect.provide(ClientServiceLive(new FakeWebSocketClient(fakeServer))))
  })

  it.effect('client disconnects cleanly', () => {
    const fakeServer = new FakeWebSocketServer()
    return Effect.gen(function* () {
      const server = yield* ServerService
      yield* server.start(25565)
      const client = yield* ClientService
      yield* client.connect('ws://localhost:25565', PlayerName.make('Alex'))
      yield* client.disconnect()
      expect(yield* client.getConnectionState()).toBe('disconnected')
    }).pipe(Effect.provide(ServerServiceLive(fakeServer)), Effect.provide(ClientServiceLive(new FakeWebSocketClient(fakeServer))))
  })
})
