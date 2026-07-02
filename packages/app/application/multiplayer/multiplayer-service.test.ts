import { describe, it, expect } from 'vitest'
import { Effect, Queue, Stream } from 'effect'
import { MessageType, PlayerId, PlayerName, WorldId, type NetworkMessage } from '@ts-minecraft/network/domain/schemas'
import type { ClientServiceShape } from '@ts-minecraft/network/application/client-service'
import {
  MultiplayerServiceImpl,
  MultiplayerServiceDefault,
} from '@ts-minecraft/app/application/multiplayer/multiplayer-service'

const worldId = WorldId.make('overworld')
const playerId = (id: string) => PlayerId.make(id)
const playerName = (name: string) => PlayerName.make(name)

type ClientOptions = {
  readonly inbound?: ReadonlyArray<NetworkMessage>
  readonly connect?: ClientServiceShape['connect']
  readonly disconnect?: ClientServiceShape['disconnect']
  readonly getConnectionState?: ClientServiceShape['getConnectionState']
  readonly sendMessage?: ClientServiceShape['sendMessage']
  readonly receiveMessages?: ClientServiceShape['receiveMessages']
}

const makeClient = (sent: NetworkMessage[], options: ClientOptions = {}): ClientServiceShape => ({
  connect: options.connect ?? (() => Effect.void),
  disconnect: options.disconnect ?? (() => Effect.void),
  getConnectionState: options.getConnectionState ?? (() => Effect.succeed('connected' as const)),
  sendMessage: options.sendMessage ?? ((m) => Effect.sync(() => { sent.push(m) })),
  receiveMessages: options.receiveMessages
    ?? (() => Effect.succeed(Stream.fromIterable(options.inbound ?? []) as Stream.Stream<NetworkMessage, never, never>)),
})

const joinMessage = (id: string, name: string, x: number, y: number, z: number): NetworkMessage => ({
  type: MessageType.PlayerJoin,
  playerId: playerId(id),
  playerName: playerName(name),
  worldId,
  position: { x, y, z },
  timestamp: 1,
})

const moveMessage = (id: string, x: number, y: number, z: number, yaw: number, pitch: number): NetworkMessage => ({
  type: MessageType.PlayerMove,
  playerId: playerId(id),
  worldId,
  position: { x, y, z },
  rotation: { yaw, pitch },
  timestamp: 2,
})

const leaveMessage = (id: string): NetworkMessage => ({
  type: MessageType.PlayerLeave,
  playerId: playerId(id),
  worldId,
  timestamp: 3,
})

const chatMessage = (id: string, index: number): NetworkMessage => ({
  type: MessageType.Chat,
  playerId: playerId(id),
  worldId,
  message: `chat-${index}`,
  timestamp: index,
})

const blockPlaceMessage = (blockType: string): NetworkMessage => ({
  type: MessageType.BlockPlace,
  playerId: playerId('remote'),
  worldId,
  position: { x: 4, y: 65, z: -3 },
  blockType,
  timestamp: 4,
})

const blockBreakMessage = (): NetworkMessage => ({
  type: MessageType.BlockBreak,
  playerId: playerId('remote'),
  worldId,
  position: { x: 5, y: 66, z: -4 },
  timestamp: 5,
})

const entitySnapshotMessage = (id: string, entityId: string, alive = true): NetworkMessage => ({
  type: MessageType.EntitySnapshot,
  playerId: playerId(id),
  worldId,
  entityId,
  entityType: 'ZOMBIE',
  position: { x: 8, y: 64, z: -2 },
  health: alive ? 12 : 0,
  alive,
  timestamp: 6,
})

describe('MultiplayerService block sync (T15a)', () => {
  it('sendBlockPlace emits a BlockPlace message with floored integer position + blockType', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          inbound: [joinMessage('self', 'alice', 0, 64, 0)],
        }))
        yield* svc.connect('ws://test', playerName('alice'))
        yield* Effect.sleep(10)
        yield* svc.sendBlockPlace({ x: 3.7, y: 64.2, z: -2.9 }, 'STONE')
      }),
    )
    const placed = sent.find((m) => m.type === MessageType.BlockPlace)
    expect(placed).toBeDefined()
    expect(placed).toMatchObject({ playerId: playerId('self') })
    expect((placed as { position: { x: number; y: number; z: number } }).position).toEqual({ x: 3, y: 64, z: -3 })
    expect((placed as { blockType: string }).blockType).toBe('STONE')
  })

  it('sendBlockBreak emits a BlockBreak message', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          inbound: [joinMessage('self', 'bob', 0, 64, 0)],
        }))
        yield* svc.connect('ws://test', playerName('bob'))
        yield* Effect.sleep(10)
        yield* svc.sendBlockBreak({ x: 10, y: 70, z: 5 })
      }),
    )
    const broken = sent.find((m) => m.type === MessageType.BlockBreak)
    expect(broken).toMatchObject({ playerId: playerId('self') })
  })

  it('sends chat and movement after connecting', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          inbound: [joinMessage('self', 'casey', 0, 64, 0)],
        }))
        yield* svc.connect('ws://test', playerName('casey'))
        yield* Effect.sleep(10)
        yield* svc.sendChat('hello')
        yield* svc.sendPositionUpdate({ x: 1.5, y: 64, z: -2.25 }, { yaw: 0.75, pitch: -0.25 })
      }),
    )
    expect(sent.map((m) => m.type)).toEqual([MessageType.Chat, MessageType.PlayerMove])
    expect(sent[0]).toMatchObject({ message: 'hello', playerId: playerId('self') })
    expect(sent[1]).toMatchObject({
      playerId: playerId('self'),
      position: { x: 1.5, y: 64, z: -2.25 },
      rotation: { yaw: 0.75, pitch: -0.25 },
    })
  })

  it('reports joining until self join assigns identity and flushes queued chat', async () => {
    const sent: NetworkMessage[] = []
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const inbound = yield* Queue.unbounded<NetworkMessage>()
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          receiveMessages: () => Effect.succeed(Stream.fromQueue(inbound)),
        }))

        yield* svc.connect('ws://test', playerName('casey'))
        const joiningState = yield* svc.getSessionState()
        yield* svc.sendChat('queued hello')
        const sentBeforeJoin = sent.length

      yield* Queue.offer(inbound, joinMessage('self', 'casey', 0, 64, 0))
      yield* Effect.sleep(10)
      const readyState = yield* svc.getSessionState()
      const sentAfterSelfJoin = sent.length
      yield* Queue.offer(inbound, joinMessage('remote', 'alex', 1, 64, 1))
      yield* Queue.offer(inbound, joinMessage('self', 'casey', 2, 64, 2))
      yield* Effect.sleep(10)
      const sentAfterRepeatedJoins = sent.length
      yield* svc.disconnect

      return { joiningState, sentBeforeJoin, readyState, sentAfterSelfJoin, sentAfterRepeatedJoins }
    }),
  )

  expect(result).toEqual({
    joiningState: 'joining',
    sentBeforeJoin: 0,
    readyState: 'ready',
    sentAfterSelfJoin: 1,
    sentAfterRepeatedJoins: 1,
  })
  expect(sent).toHaveLength(1)
  expect(sent[0]).toMatchObject({
    type: MessageType.Chat,
    message: 'queued hello',
      playerId: playerId('self'),
    })
  })

  it('sendEntitySnapshot emits an EntitySnapshot message after local identity is known', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          inbound: [joinMessage('self', 'morgan', 0, 64, 0)],
        }))
        yield* svc.connect('ws://test', playerName('morgan'))
        yield* Effect.sleep(10)
        yield* svc.sendEntitySnapshot({
          entityId: 'entity-1',
          entityType: 'ZOMBIE',
          position: { x: 8, y: 64, z: -2 },
          health: 12,
          alive: true,
        })
      }),
    )
    const snapshot = sent.find((m) => m.type === MessageType.EntitySnapshot)
    expect(snapshot).toMatchObject({
      playerId: playerId('self'),
      entityId: 'entity-1',
      entityType: 'ZOMBIE',
      position: { x: 8, y: 64, z: -2 },
      health: 12,
      alive: true,
    })
  })

  it('does not send before connecting (no player name set)', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent))
        yield* svc.sendBlockBreak({ x: 0, y: 0, z: 0 })
      }),
    )
  expect(sent).toHaveLength(0)
})

it('does not flush chat sent before connect or after disconnect on later self joins', async () => {
  const sent: NetworkMessage[] = []
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const inbound = yield* Queue.unbounded<NetworkMessage>()
      const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
        receiveMessages: () => Effect.succeed(Stream.fromQueue(inbound)),
      }))

      yield* svc.sendChat('before connect')
      yield* svc.connect('ws://test', playerName('casey'))
      yield* Queue.offer(inbound, joinMessage('self', 'casey', 0, 64, 0))
      yield* Effect.sleep(10)
      const sentAfterFirstJoin = sent.length

      yield* svc.disconnect
      yield* svc.sendChat('after disconnect')
      yield* svc.connect('ws://test', playerName('casey'))
      yield* Queue.offer(inbound, joinMessage('self', 'casey', 1, 64, 1))
      yield* Effect.sleep(10)
      const sentAfterReconnect = sent.length
      yield* svc.disconnect

      return { sentAfterFirstJoin, sentAfterReconnect }
    }),
  )

  expect(result).toEqual({ sentAfterFirstJoin: 0, sentAfterReconnect: 0 })
  expect(sent).toHaveLength(0)
})

  it('swallows send, disconnect, connection-state, and receive failures', async () => {
    const sent: NetworkMessage[] = []
    const state = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          disconnect: () => Effect.fail('disconnect failed'),
          getConnectionState: () => Effect.fail('state failed'),
          receiveMessages: () => Effect.fail('receive failed'),
          sendMessage: () => Effect.fail('send failed'),
        }))
        yield* svc.connect('ws://test', playerName('drew'))
        yield* svc.sendChat('ignored')
        const state = yield* svc.getConnectionState()
        yield* svc.disconnect
        return state
      }),
    )
    expect(state).toBe('disconnected')
    expect(sent).toHaveLength(0)
  })

  it('does not send when connect fails before local player assignment', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          connect: () => Effect.fail('connect failed'),
        }))
        yield* svc.connect('ws://test', playerName('erin'))
        yield* svc.sendChat('still sends')
      }),
    )
    expect(sent).toHaveLength(0)
  })

  it('drainBlockEdits returns an empty array initially', async () => {
    const edits = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient([]))
        return yield* svc.drainBlockEdits
      }),
    )
    expect(edits).toEqual([])
  })

  it('drains inbound block edits once', async () => {
    const edits = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient([], {
          inbound: [blockPlaceMessage('DIRT'), blockBreakMessage()],
        }))
        yield* svc.connect('ws://test', playerName('frank'))
        yield* Effect.sleep(10)
        const first = yield* svc.drainBlockEdits
        const second = yield* svc.drainBlockEdits
        return [first, second] as const
      }),
    )
    expect(edits[0]).toEqual([
      { kind: 'place', x: 4, y: 65, z: -3, blockType: 'DIRT' },
      { kind: 'break', x: 5, y: 66, z: -4 },
    ])
    expect(edits[1]).toEqual([])
  })

  it('drains remote entity snapshots once and ignores local entity echoes', async () => {
    const snapshots = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient([], {
          inbound: [
            joinMessage('self', 'nina', 0, 64, 0),
            entitySnapshotMessage('self', 'local-entity'),
            entitySnapshotMessage('remote', 'remote-entity'),
          ],
        }))
        yield* svc.connect('ws://test', playerName('nina'))
        yield* Effect.sleep(10)
        const first = yield* svc.drainEntitySnapshots
        const second = yield* svc.drainEntitySnapshots
        return [first, second] as const
      }),
    )
    expect(snapshots[0]).toEqual([
      {
        playerId: 'remote',
        worldId: 'overworld',
        entityId: 'remote-entity',
        entityType: 'ZOMBIE',
        position: { x: 8, y: 64, z: -2 },
        health: 12,
        alive: true,
        timestamp: 6,
      },
    ])
    expect(snapshots[1]).toEqual([])
  })

  it('tracks remote players from join, move, and leave messages', async () => {
    const players = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient([], {
          inbound: [
            moveMessage('missing', 9, 9, 9, 1, 1),
            joinMessage('p1', 'remote-a', 1, 2, 3),
            moveMessage('p1', 4, 5, 6, 0.5, -0.25),
            joinMessage('p2', 'remote-b', 7, 8, 9),
            leaveMessage('p2'),
          ],
        }))
        yield* svc.connect('ws://test', playerName('host'))
        yield* Effect.sleep(10)
        return yield* svc.getRemotePlayers()
      }),
    )
    expect([...players.keys()]).toEqual(['p1'])
    expect(players.get('p1')).toEqual({
      playerId: 'p1',
      playerName: 'remote-a',
      x: 4,
      y: 5,
      z: 6,
      yaw: 0.5,
      pitch: -0.25,
    })
  })

  it('keeps only the newest chat entries and ignores non-state messages', async () => {
    const chats = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient([], {
          inbound: [
            { type: MessageType.Ping, nonce: 'noop', timestamp: 1 },
            joinMessage('speaker', 'Speaker', 0, 64, 0),
            ...Array.from({ length: 55 }, (_, index) => chatMessage('speaker', index)),
          ],
        }))
        yield* svc.connect('ws://test', playerName('host'))
        yield* Effect.sleep(10)
        return yield* svc.getChatMessages()
      }),
    )
    expect(chats).toHaveLength(50)
    expect(chats[0]).toEqual({ player: 'Speaker', text: 'chat-5', timestamp: 5 })
    expect(chats.at(-1)).toEqual({ player: 'Speaker', text: 'chat-54', timestamp: 54 })
  })

  it('disconnect is a no-op when no drain fiber is running and drainInbound is currently empty work', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient([]))
        yield* svc.drainInbound
        yield* svc.disconnect
      }),
    )
  })

  it('exposes a live layer for app composition', () => {
    expect(MultiplayerServiceDefault(makeClient([]))).toBeDefined()
  })
})

const worldInfoMessage = (entityHostId?: string): NetworkMessage => ({
  type: MessageType.WorldInfo,
  worldSeed: 42,
  ...(entityHostId !== undefined ? { entityHostPlayerId: playerId(entityHostId) } : {}),
  timestamp: 7,
})

const entityDamageMessage = (attackerId: string, entityId: string): NetworkMessage => ({
  type: MessageType.EntityDamage,
  playerId: playerId(attackerId),
  worldId,
  entityId,
  damage: 6,
  knockback: { x: 3, y: 4.2, z: 0 },
  timestamp: 8,
})

describe('MultiplayerService entity host authority', () => {
  it('is the entity authority while disconnected (single-player)', async () => {
    const sent: NetworkMessage[] = []
    const authority = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          getConnectionState: () => Effect.succeed('disconnected' as const),
        }))
        return yield* svc.isEntityAuthority()
      }),
    )
    expect(authority).toBe(true)
  })

  it('stays the authority on a legacy server that announces no entity host', async () => {
    const sent: NetworkMessage[] = []
    const authority = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          inbound: [joinMessage('self', 'alice', 0, 64, 0), worldInfoMessage()],
        }))
        yield* svc.connect('ws://test', playerName('alice'))
        yield* Effect.sleep(10)
        return yield* svc.isEntityAuthority()
      }),
    )
    expect(authority).toBe(true)
  })

  it('is the authority when WorldInfo announces the local player as entity host', async () => {
    const sent: NetworkMessage[] = []
    const authority = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          inbound: [joinMessage('self', 'alice', 0, 64, 0), worldInfoMessage('self')],
        }))
        yield* svc.connect('ws://test', playerName('alice'))
        yield* Effect.sleep(10)
        return yield* svc.isEntityAuthority()
      }),
    )
    expect(authority).toBe(true)
  })

  it('is NOT the authority when WorldInfo announces someone else as entity host', async () => {
    const sent: NetworkMessage[] = []
    const authority = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          inbound: [joinMessage('self', 'alice', 0, 64, 0), worldInfoMessage('other')],
        }))
        yield* svc.connect('ws://test', playerName('alice'))
        yield* Effect.sleep(10)
        return yield* svc.isEntityAuthority()
      }),
    )
    expect(authority).toBe(false)
  })

  it('sendEntityDamage emits an EntityDamage message with the raw host entity id', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          inbound: [joinMessage('self', 'alice', 0, 64, 0)],
        }))
        yield* svc.connect('ws://test', playerName('alice'))
        yield* Effect.sleep(10)
        yield* svc.sendEntityDamage('entity-42', 6, { x: 3, y: 4.2, z: 0 })
      }),
    )
    const damage = sent.find((m) => m.type === MessageType.EntityDamage)
    expect(damage).toMatchObject({
      playerId: playerId('self'),
      entityId: 'entity-42',
      damage: 6,
      knockback: { x: 3, y: 4.2, z: 0 },
    })
  })

  it('queues inbound entity damage from other players and drains it once', async () => {
    const sent: NetworkMessage[] = []
    const { first, second } = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent, {
          inbound: [
            joinMessage('self', 'alice', 0, 64, 0),
            entityDamageMessage('other', 'entity-42'),
          ],
        }))
        yield* svc.connect('ws://test', playerName('alice'))
        yield* Effect.sleep(10)
        const first = yield* svc.drainEntityDamages
        const second = yield* svc.drainEntityDamages
        return { first, second }
      }),
    )
    expect(first).toEqual([
      { attackerId: 'other', entityId: 'entity-42', damage: 6, knockback: { x: 3, y: 4.2, z: 0 } },
    ])
    expect(second).toEqual([])
  })
})
