import { describe, it } from '@effect/vitest'
import { Effect, Either, Ref } from 'effect'
import { expect } from 'vitest'
import { decodeNetworkMessage, encodeNetworkMessage } from '../application/codec'
import { dispatchMessage, handleBlockBreak, handleBlockPlace, handleEntityDamage, handleEntitySnapshot, handlePlayerJoin, handlePlayerLeave, handlePlayerMove, makeJoinMessage } from '../application/server-handlers'
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
  Effect.succeed({
    playerId,
    playerName: PlayerName.make(playerName),
    worldId,
    position: { x: 0, y: 64, z: 0 },
    rotation: { yaw: 0, pitch: 0 },
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
  it.effect('sends the assigned join message before existing players', () =>
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

      const assigned = yield* takeMessage(pair)
      expect(assigned.type).toBe(MessageType.PlayerJoin)
      if (assigned.type === MessageType.PlayerJoin) {
        expect(assigned.playerId).toBe(assignedPlayerId)
        expect(assigned.playerName).toBe(PlayerName.make('Steve'))
      }

      const existing = yield* takeMessage(pair)
      expect(existing.type).toBe(MessageType.PlayerJoin)
      if (existing.type === MessageType.PlayerJoin) {
        expect(existing.playerId).toBe(firstPlayerId)
        expect(existing.playerName).toBe(PlayerName.make('Alex'))
      }

      const broadcasts = yield* Ref.get(harness.broadcasts)
      expect(broadcasts).toHaveLength(1)
      expect(broadcasts[0]?.exclude).toBe(assignedPlayerId)
    }),
  )

  it.effect('adopts the first joiner\'s world seed and echoes it via WorldInfo', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()
      const pair = yield* makePair()

      yield* handlePlayerJoin(
        harness,
        {
          type: MessageType.PlayerJoin,
          playerId: PlayerId.make('pending'),
          playerName: PlayerName.make('Steve'),
          worldId,
          position: { x: 0, y: 64, z: 0 },
          timestamp: 1,
          worldSeed: 12345,
        },
        pair.connection,
      )

      const assigned = yield* takeMessage(pair)
      expect(assigned.type).toBe(MessageType.PlayerJoin)
      const worldInfo = yield* takeMessage(pair)
      expect(worldInfo.type).toBe(MessageType.WorldInfo)
      if (worldInfo.type === MessageType.WorldInfo) {
        expect(worldInfo.worldSeed).toBe(12345)
      }
      expect(yield* Ref.get(harness.gameServer.worldSeed)).toBe(12345)
    }),
  )

  it.effect('sends the session seed (not the joiner\'s) to later joiners', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()
      yield* Ref.set(harness.gameServer.worldSeed, 111)
      const pair = yield* makePair()

      yield* handlePlayerJoin(
        harness,
        {
          type: MessageType.PlayerJoin,
          playerId: PlayerId.make('pending'),
          playerName: PlayerName.make('Alex'),
          worldId,
          position: { x: 0, y: 64, z: 0 },
          timestamp: 1,
          worldSeed: 222,
        },
        pair.connection,
      )

      yield* takeMessage(pair) // assigned join
      const worldInfo = yield* takeMessage(pair)
      expect(worldInfo.type).toBe(MessageType.WorldInfo)
      if (worldInfo.type === MessageType.WorldInfo) {
        expect(worldInfo.worldSeed).toBe(111)
      }
      // The session seed must not be overwritten by the second joiner.
      expect(yield* Ref.get(harness.gameServer.worldSeed)).toBe(111)
    }),
  )

  it.effect('adopts the first joiner\'s time of day and echoes it via WorldInfo', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()
      const pair = yield* makePair()

      yield* handlePlayerJoin(
        harness,
        {
          type: MessageType.PlayerJoin,
          playerId: PlayerId.make('pending'),
          playerName: PlayerName.make('Steve'),
          worldId,
          position: { x: 0, y: 64, z: 0 },
          timestamp: 1,
          worldSeed: 12345,
          timeOfDay: 0.42,
        },
        pair.connection,
      )

      yield* takeMessage(pair) // assigned join
      const worldInfo = yield* takeMessage(pair)
      expect(worldInfo.type).toBe(MessageType.WorldInfo)
      if (worldInfo.type === MessageType.WorldInfo) {
        expect(worldInfo.timeOfDay).toBe(0.42)
      }
      expect(yield* Ref.get(harness.gameServer.timeOfDay)).toBe(0.42)
    }),
  )

  it.effect('sends the session time (not the joiner\'s) to later joiners', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()
      yield* Ref.set(harness.gameServer.worldSeed, 111)
      yield* Ref.set(harness.gameServer.timeOfDay, 0.5)
      const pair = yield* makePair()

      yield* handlePlayerJoin(
        harness,
        {
          type: MessageType.PlayerJoin,
          playerId: PlayerId.make('pending'),
          playerName: PlayerName.make('Alex'),
          worldId,
          position: { x: 0, y: 64, z: 0 },
          timestamp: 1,
          worldSeed: 222,
          timeOfDay: 0.9,
        },
        pair.connection,
      )

      yield* takeMessage(pair) // assigned join
      const worldInfo = yield* takeMessage(pair)
      expect(worldInfo.type).toBe(MessageType.WorldInfo)
      if (worldInfo.type === MessageType.WorldInfo) {
        expect(worldInfo.timeOfDay).toBe(0.5)
      }
      expect(yield* Ref.get(harness.gameServer.timeOfDay)).toBe(0.5)
    }),
  )

  it.effect('replays accumulated block edits to a late joiner (last-write-wins, replay id)', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()

      // First player joins and edits the world.
      yield* handleBlockPlace(harness, {
        type: MessageType.BlockPlace,
        playerId: firstPlayerId,
        worldId,
        position: { x: 1, y: 64, z: 2 },
        blockType: 'STONE',
        timestamp: 1,
      })
      yield* handleBlockPlace(harness, {
        type: MessageType.BlockPlace,
        playerId: firstPlayerId,
        worldId,
        position: { x: 1, y: 64, z: 2 },
        blockType: 'PLANKS',
        timestamp: 2,
      })
      yield* handleBlockBreak(harness, {
        type: MessageType.BlockBreak,
        playerId: firstPlayerId,
        worldId,
        position: { x: 5, y: 64, z: 5 },
        timestamp: 3,
      })

      // Late joiner connects; the log must replay after the join ack.
      const pair = yield* makePair()
      yield* handlePlayerJoin(
        harness,
        {
          type: MessageType.PlayerJoin,
          playerId: PlayerId.make('pending'),
          playerName: PlayerName.make('Late'),
          worldId,
          position: { x: 0, y: 64, z: 0 },
          timestamp: 4,
        },
        pair.connection,
      )

      yield* takeMessage(pair) // assigned join
      const replay1 = yield* takeMessage(pair)
      const replay2 = yield* takeMessage(pair)
      const types = [replay1.type, replay2.type].sort()
      expect(types).toEqual([MessageType.BlockBreak, MessageType.BlockPlace].sort())
      const place = [replay1, replay2].find((m) => m.type === MessageType.BlockPlace)
      expect(place).toBeDefined()
      if (place !== undefined && place.type === MessageType.BlockPlace) {
        // last-write-wins: PLANKS overwrote STONE at the same voxel
        expect(place.blockType).toBe('PLANKS')
        // editor id rewritten so a rejoining editor still applies its own edits
        expect(place.playerId).toBe(PlayerId.make('server:replay'))
      }
    }),
  )

  it.effect('sends no WorldInfo when neither the session nor the joiner has a seed', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()
      const pair = yield* makePair()
      const existingPlayer = yield* connectedPlayer(firstPlayerId, 'Alex')
      yield* Ref.set(harness.gameServer.connectedPlayers, new Map([[firstPlayerId, existingPlayer]]))

      yield* handlePlayerJoin(
        harness,
        {
          type: MessageType.PlayerJoin,
          playerId: PlayerId.make('pending'),
          playerName: PlayerName.make('Steve'),
          worldId,
          position: { x: 0, y: 64, z: 0 },
          timestamp: 1,
        },
        pair.connection,
      )

      yield* takeMessage(pair) // assigned join
      const next = yield* takeMessage(pair) // existing player, NOT WorldInfo
      expect(next.type).toBe(MessageType.PlayerJoin)
      expect(yield* Ref.get(harness.gameServer.worldSeed)).toBe(null)
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

  it.effect('dispatches an owned entity snapshot to other players', () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness()
      const pair = yield* makePair()
      yield* Ref.set(harness.gameServer.playerIdByConnectionId, new Map([[pair.connection.id, firstPlayerId]]))

      const raw = yield* encodeNetworkMessage({
        type: MessageType.EntitySnapshot,
        playerId: firstPlayerId,
        worldId,
        entityId: 'entity-1',
        entityType: 'ZOMBIE',
        position: { x: 3, y: 64, z: -2 },
        health: 8,
        alive: true,
        timestamp: 5,
      }).pipe(Effect.orDie)
      yield* dispatchMessage(harness, pair.connection, raw)

      const broadcasts = yield* Ref.get(harness.broadcasts)
      expect(broadcasts).toHaveLength(1)
      expect(broadcasts[0]?.exclude).toBe(firstPlayerId)
      expect(broadcasts[0]?.message).toMatchObject({
        type: MessageType.EntitySnapshot,
        entityId: 'entity-1',
        alive: true,
      })
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

describe('entity host authority', () => {
  const makeHostHarness = () =>
    Effect.gen(function* () {
      const base = yield* makeHarness()
      const directSends = yield* Ref.make<ReadonlyArray<{ readonly playerId: PlayerId; readonly message: NetworkMessage }>>([])
      const serverService: ServerServiceShape = {
        ...base.serverService,
        sendToPlayer: (playerId, message) => Ref.update(directSends, (calls) => [...calls, { playerId, message }]),
      }
      return { gameServer: base.gameServer, serverService, broadcasts: base.broadcasts, directSends }
    })

  const joinMessage = (name: string) => ({
    type: MessageType.PlayerJoin,
    playerId: PlayerId.make('pending'),
    playerName: PlayerName.make(name),
    worldId,
    position: { x: 0, y: 64, z: 0 },
    worldSeed: 42,
    timestamp: 1,
  }) as const

  it.effect('adopts the first joiner as entity host and echoes it via WorldInfo', () =>
    Effect.gen(function* () {
      const harness = yield* makeHostHarness()
      const pair = yield* makePair()

      const hostId = yield* handlePlayerJoin(harness, joinMessage('Steve'), pair.connection)

      expect(yield* Ref.get(harness.gameServer.entityHost)).toBe(hostId)
      yield* takeMessage(pair) // assigned join echo
      const worldInfo = yield* takeMessage(pair)
      expect(worldInfo.type).toBe(MessageType.WorldInfo)
      if (worldInfo.type === MessageType.WorldInfo) {
        expect(worldInfo.entityHostPlayerId).toBe(hostId)
      }
    }),
  )

  it.effect('keeps the original entity host when a second player joins', () =>
    Effect.gen(function* () {
      const harness = yield* makeHostHarness()
      const pairA = yield* makePair()
      const pairB = yield* makePair()

      const hostId = yield* handlePlayerJoin(harness, joinMessage('Steve'), pairA.connection)
      yield* handlePlayerJoin(harness, joinMessage('Alex'), pairB.connection)

      expect(yield* Ref.get(harness.gameServer.entityHost)).toBe(hostId)
      yield* takeMessage(pairB) // assigned join echo
      const worldInfo = yield* takeMessage(pairB)
      expect(worldInfo.type).toBe(MessageType.WorldInfo)
      if (worldInfo.type === MessageType.WorldInfo) {
        expect(worldInfo.entityHostPlayerId).toBe(hostId)
      }
    }),
  )

  it.effect('drops entity snapshots from a non-host sender but relays the host\'s', () =>
    Effect.gen(function* () {
      const harness = yield* makeHostHarness()
      const pairA = yield* makePair()
      const pairB = yield* makePair()
      const hostId = yield* handlePlayerJoin(harness, joinMessage('Steve'), pairA.connection)
      const otherId = yield* handlePlayerJoin(harness, joinMessage('Alex'), pairB.connection)
      yield* Ref.set(harness.broadcasts, [])

      const snapshotFrom = (playerId: PlayerId) => ({
        type: MessageType.EntitySnapshot,
        playerId,
        worldId,
        entityId: 'entity-1',
        entityType: 'ZOMBIE',
        position: { x: 0, y: 64, z: 0 },
        health: 8,
        alive: true,
        timestamp: 5,
      }) as const

      yield* handleEntitySnapshot(harness, snapshotFrom(otherId))
      expect(yield* Ref.get(harness.broadcasts)).toHaveLength(0)

      yield* handleEntitySnapshot(harness, snapshotFrom(hostId))
      const broadcasts = yield* Ref.get(harness.broadcasts)
      expect(broadcasts).toHaveLength(1)
      expect(broadcasts[0]?.exclude).toBe(hostId)
    }),
  )

  it.effect('relays entity damage to the host only and ignores the host\'s own', () =>
    Effect.gen(function* () {
      const harness = yield* makeHostHarness()
      const pairA = yield* makePair()
      const pairB = yield* makePair()
      const hostId = yield* handlePlayerJoin(harness, joinMessage('Steve'), pairA.connection)
      const otherId = yield* handlePlayerJoin(harness, joinMessage('Alex'), pairB.connection)

      const damageFrom = (playerId: PlayerId) => ({
        type: MessageType.EntityDamage,
        playerId,
        worldId,
        entityId: 'entity-9',
        damage: 6,
        knockback: { x: 3, y: 4.2, z: 0 },
        timestamp: 6,
      }) as const

      yield* handleEntityDamage(harness, damageFrom(otherId))
      const sends = yield* Ref.get(harness.directSends)
      expect(sends).toHaveLength(1)
      expect(sends[0]?.playerId).toBe(hostId)
      expect(sends[0]?.message).toMatchObject({ type: MessageType.EntityDamage, entityId: 'entity-9', damage: 6 })

      yield* handleEntityDamage(harness, damageFrom(hostId))
      expect(yield* Ref.get(harness.directSends)).toHaveLength(1)
    }),
  )

  it.effect('promotes a surviving player and broadcasts the new host when the host leaves', () =>
    Effect.gen(function* () {
      const harness = yield* makeHostHarness()
      const pairA = yield* makePair()
      const pairB = yield* makePair()
      const hostId = yield* handlePlayerJoin(harness, joinMessage('Steve'), pairA.connection)
      const otherId = yield* handlePlayerJoin(harness, joinMessage('Alex'), pairB.connection)
      yield* Ref.set(harness.broadcasts, [])

      yield* handlePlayerLeave(harness, hostId)

      expect(yield* Ref.get(harness.gameServer.entityHost)).toBe(otherId)
      const broadcasts = yield* Ref.get(harness.broadcasts)
      const worldInfoBroadcast = broadcasts.find((call) => call.message.type === MessageType.WorldInfo)
      expect(worldInfoBroadcast).toBeDefined()
      expect(worldInfoBroadcast?.message).toMatchObject({
        type: MessageType.WorldInfo,
        entityHostPlayerId: otherId,
      })
    }),
  )

  it.effect('clears the entity host when the last player leaves', () =>
    Effect.gen(function* () {
      const harness = yield* makeHostHarness()
      const pair = yield* makePair()
      const hostId = yield* handlePlayerJoin(harness, joinMessage('Steve'), pair.connection)

      yield* handlePlayerLeave(harness, hostId)

      expect(yield* Ref.get(harness.gameServer.entityHost)).toBeNull()
    }),
  )
})
