import { describe, it } from '@effect/vitest'
import { Effect, Either, Queue, Ref } from 'effect'
import { expect } from 'vitest'
import { decodeNetworkMessage, encodeNetworkMessage } from '../application/codec'
import { dispatchMessage, handlePlayerJoin, handlePlayerLeave, handlePlayerMove, makeJoinMessage } from '../application/server-handlers'
import { makeGameServer, type ConnectedPlayer, type ServerServiceShape } from '../application/server-service'
import { MessageType, PlayerId, PlayerName, WorldId, type NetworkMessage } from '../domain/schemas'
import { FakeWebSocketServer, type FakeSocketPair } from '../infrastructure/websocket-server'

const worldId = WorldId.make('overworld')
const firstPlayerId = PlayerId.make('player-1')
const secondPlayerId = PlayerId.make('player-2')

type BroadcastCall = {
  readonly message: NetworkMessage
  readonly exclude: PlayerId | undefined
}

const makeHarness = (maxPlayers = 20) =>
  Effect.gen(function* () {
    const gameServer = yield* makeGameServer(maxPlayers)
    const broadcasts = yield* Ref.make<ReadonlyArray<BroadcastCall>>([])
    const serverService: ServerServiceShape = {
      start: (port) => Effect.succeed(port),
      stop: () => Effect.void,
      getConnectedPlayers: () => Ref.get(gameServer.connectedPlayers),
      sendToPlayer: () => Effect.void,
      broadcast: (message, exclude) => Ref.update(broadcasts, (calls) => [...calls, { message, exclude }]),
    }
    return { gameServer, serverService, broadcasts }
  })

const makePair = (): Effect.Effect<FakeSocketPair, never> =>
  Effect.gen(function* () {
    const socketServer = new FakeWebSocketServer()
    yield* socketServer.start(25565).pipe(Effect.orDie)
    return yield* socketServer.connectClient().pipe(Effect.orDie)
  })

const takeMessage = (pair: FakeSocketPair): Effect.Effect<NetworkMessage, never> =>
  Effect.gen(function* () {
    const raw = yield* pair.takeClientMessage
    return yield* decodeNetworkMessage(raw).pipe(Effect.orDie)
  })

const connectedPlayer = (
  playerId: PlayerId,
  playerName: string,
): Effect.Effect<ConnectedPlayer, never> =>
  Effect.gen(function* () {
    const sendQueue = yield* Queue.unbounded<ArrayBuffer>()
    return {
      playerId,
      playerName: PlayerName.make(playerName),
      worldId,
      position: { x: 0, y: 64, z: 0 },
      rotation: { yaw: 0, pitch: 0 },
      sendQueue,
    }
  })

describe('makeJoinMessage', () => {
  it('sets type to PlayerJoin', () => {
    const msg = makeJoinMessage('Alice')
    expect(msg.type).toBe(MessageType.PlayerJoin)
  })

  it('sets playerName from the argument', () => {
    expect(makeJoinMessage('Alice').playerName).toBe('Alice')
    expect(makeJoinMessage('Bob').playerName).toBe('Bob')
  })

  it('sets playerId to "pending"', () => {
    const msg = makeJoinMessage('Alice')
    expect(msg.playerId).toBe('pending')
  })

  it('sets worldId to "overworld"', () => {
    const msg = makeJoinMessage('Alice')
    expect(msg.worldId).toBe('overworld')
  })

  it('sets spawn position to origin-at-y64', () => {
    const msg = makeJoinMessage('Alice')
    expect(msg.position).toEqual({ x: 0, y: 64, z: 0 })
  })

  it('sets timestamp to a positive number', () => {
    const msg = makeJoinMessage('Alice')
    expect(typeof msg.timestamp).toBe('number')
    expect(msg.timestamp).toBeGreaterThan(0)
  })
})

describe('server handler dispatch', () => {
  it.effect('sends existing players before the assigned join message', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()
      const pair = yield* makePair()
      const existingPlayer = yield* connectedPlayer(firstPlayerId, 'Alex')
      yield* Ref.set(harness.gameServer.connectedPlayers, new Map([[firstPlayerId, existingPlayer]]))

      const assignedPlayerId = yield* handlePlayerJoin(
        harness,
        {
          type: MessageType.PlayerJoin,
          playerId: PlayerId.make('pending'),
          playerName: PlayerName.make('Steve'),
          worldId,
          position: { x: 2, y: 65, z: 3 },
          timestamp: 1,
        },
        pair.connection,
      )

      const existing = yield* takeMessage(pair)
      expect(existing.type).toBe(MessageType.PlayerJoin)
      if (existing.type === MessageType.PlayerJoin) {
        expect(existing.playerId).toBe(firstPlayerId)
        expect(existing.playerName).toBe(PlayerName.make('Alex'))
      }

      const assigned = yield* takeMessage(pair)
      expect(assigned.type).toBe(MessageType.PlayerJoin)
      if (assigned.type === MessageType.PlayerJoin) {
        expect(assigned.playerId).toBe(assignedPlayerId)
        expect(assigned.playerName).toBe(PlayerName.make('Steve'))
      }

      const broadcasts = yield* Ref.get(harness.broadcasts)
      expect(broadcasts).toHaveLength(1)
      expect(broadcasts[0]?.exclude).toBe(assignedPlayerId)
    }),
  )

  it.effect('returns without broadcasting when a leaving player is absent', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()

      yield* handlePlayerLeave(harness, firstPlayerId)

      expect(yield* Ref.get(harness.broadcasts)).toEqual([])
      expect((yield* Ref.get(harness.gameServer.connectedPlayers)).size).toBe(0)
    }),
  )

  it.effect('keeps connected players unchanged when a move references an absent player', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()
      const existingPlayer = yield* connectedPlayer(firstPlayerId, 'Alex')
      yield* Ref.set(harness.gameServer.connectedPlayers, new Map([[firstPlayerId, existingPlayer]]))

      yield* handlePlayerMove(harness, {
        type: MessageType.PlayerMove,
        playerId: secondPlayerId,
        worldId,
        position: { x: 8, y: 70, z: 8 },
        rotation: { yaw: 90, pitch: 10 },
        timestamp: 2,
      })

      const players = yield* Ref.get(harness.gameServer.connectedPlayers)
      expect(players.get(firstPlayerId)).toEqual(existingPlayer)
      expect(players.has(secondPlayerId)).toBe(false)
      const broadcasts = yield* Ref.get(harness.broadcasts)
      expect(broadcasts).toHaveLength(1)
      expect(broadcasts[0]?.exclude).toBe(secondPlayerId)
    }),
  )

  it.effect('rejects messages from a connection that does not own the player id', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()
      const pair = yield* makePair()
      yield* Ref.set(harness.gameServer.playerIdByConnectionId, new Map([[pair.connection.id, firstPlayerId]]))

      const raw = yield* encodeNetworkMessage({
        type: MessageType.Chat,
        playerId: secondPlayerId,
        worldId,
        message: 'not mine',
        timestamp: 3,
      }).pipe(Effect.orDie)
      const result = yield* Effect.either(dispatchMessage(harness, pair.connection, raw))

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.operation).toBe('dispatch')
        expect(result.left.reason).toContain('does not belong to connection')
      }
      expect(yield* Ref.get(harness.broadcasts)).toEqual([])
    }),
  )

  it.effect('dispatches an owned leave message and clears connection ownership', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()
      const pair = yield* makePair()
      const player = yield* connectedPlayer(firstPlayerId, 'Alex')
      yield* Ref.set(harness.gameServer.connectedPlayers, new Map([[firstPlayerId, player]]))
      yield* Ref.set(harness.gameServer.connectionsByPlayerId, new Map([[firstPlayerId, pair.connection]]))
      yield* Ref.set(harness.gameServer.playerIdByConnectionId, new Map([[pair.connection.id, firstPlayerId]]))

      const raw = yield* encodeNetworkMessage({
        type: MessageType.PlayerLeave,
        playerId: firstPlayerId,
        worldId,
        timestamp: 4,
      }).pipe(Effect.orDie)
      yield* dispatchMessage(harness, pair.connection, raw)

      expect((yield* Ref.get(harness.gameServer.connectedPlayers)).has(firstPlayerId)).toBe(false)
      expect((yield* Ref.get(harness.gameServer.connectionsByPlayerId)).has(firstPlayerId)).toBe(false)
      expect((yield* Ref.get(harness.gameServer.playerIdByConnectionId)).has(pair.connection.id)).toBe(false)
      const broadcasts = yield* Ref.get(harness.broadcasts)
      expect(broadcasts).toHaveLength(1)
      expect(broadcasts[0]?.message.type).toBe(MessageType.PlayerLeave)
    }),
  )

  it.effect('responds to ping and ignores pong and error messages', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()
      const pair = yield* makePair()

      const pingRaw = yield* encodeNetworkMessage({ type: MessageType.Ping, nonce: 'abc', timestamp: 1 }).pipe(Effect.orDie)
      yield* dispatchMessage(harness, pair.connection, pingRaw)
      const pong = yield* takeMessage(pair)
      expect(pong.type).toBe(MessageType.Pong)
      if (pong.type === MessageType.Pong) expect(pong.nonce).toBe('abc')

      const pongRaw = yield* encodeNetworkMessage({ type: MessageType.Pong, nonce: 'abc', timestamp: 2 }).pipe(Effect.orDie)
      yield* dispatchMessage(harness, pair.connection, pongRaw)
      const errorRaw = yield* encodeNetworkMessage({ type: MessageType.Error, code: 'NOOP', message: 'ignored', timestamp: 3 }).pipe(Effect.orDie)
      yield* dispatchMessage(harness, pair.connection, errorRaw)

      expect(yield* Ref.get(harness.broadcasts)).toEqual([])
    }),
  )
})

describe('fake websocket server', () => {
  it.effect('rejects clients before the server starts', () =>
    Effect.gen(function* () {
      const socketServer = new FakeWebSocketServer()
      const result = yield* Effect.either(socketServer.connectClient())

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.operation).toBe('connect')
        expect(result.left.reason).toBe('fake server is not running')
      }
    }),
  )

  it.effect('rejects a second start while running and can return a stored connection', () =>
    Effect.gen(function* () {
      const socketServer = new FakeWebSocketServer()
      const handle = yield* socketServer.start(25565)
      const pair = yield* socketServer.connectClient()

      expect(socketServer.getConnection(pair.connection.id)).toBe(pair.connection)
      const secondStart = yield* Effect.either(socketServer.start(25566))
      expect(Either.isLeft(secondStart)).toBe(true)
      if (Either.isLeft(secondStart)) {
        expect(secondStart.left.operation).toBe('start')
        expect(secondStart.left.reason).toBe('fake server already started')
      }

      yield* handle.stop
    }),
  )
})
