import { describe, it, expect } from 'vitest'
import { Effect, Stream } from 'effect'
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

describe('MultiplayerService block sync (T15a)', () => {
  it('sendBlockPlace emits a BlockPlace message with floored integer position + blockType', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent))
        yield* svc.connect('ws://test', playerName('alice'))
        yield* svc.sendBlockPlace({ x: 3.7, y: 64.2, z: -2.9 }, 'STONE')
      }),
    )
    const placed = sent.find((m) => m.type === MessageType.BlockPlace)
    expect(placed).toBeDefined()
    expect((placed as { position: { x: number; y: number; z: number } }).position).toEqual({ x: 3, y: 64, z: -3 })
    expect((placed as { blockType: string }).blockType).toBe('STONE')
  })

  it('sendBlockBreak emits a BlockBreak message', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent))
        yield* svc.connect('ws://test', playerName('bob'))
        yield* svc.sendBlockBreak({ x: 10, y: 70, z: 5 })
      }),
    )
    expect(sent.some((m) => m.type === MessageType.BlockBreak)).toBe(true)
  })

  it('sends chat and movement after connecting', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent))
        yield* svc.connect('ws://test', playerName('casey'))
        yield* svc.sendChat('hello')
        yield* svc.sendPositionUpdate({ x: 1.5, y: 64, z: -2.25 }, { yaw: 0.75, pitch: -0.25 })
      }),
    )
    expect(sent.map((m) => m.type)).toEqual([MessageType.Chat, MessageType.PlayerMove])
    expect(sent[0]).toMatchObject({ message: 'hello' })
    expect(sent[1]).toMatchObject({
      position: { x: 1.5, y: 64, z: -2.25 },
      rotation: { yaw: 0.75, pitch: -0.25 },
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

  it('sets player name and starts receiving even when connect fails', async () => {
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
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ type: MessageType.Chat, message: 'still sends' })
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
            ...Array.from({ length: 55 }, (_, index) => chatMessage('speaker', index)),
          ],
        }))
        yield* svc.connect('ws://test', playerName('host'))
        yield* Effect.sleep(10)
        return yield* svc.getChatMessages()
      }),
    )
    expect(chats).toHaveLength(50)
    expect(chats[0]).toEqual({ player: 'speaker', text: 'chat-5', timestamp: 5 })
    expect(chats.at(-1)).toEqual({ player: 'speaker', text: 'chat-54', timestamp: 54 })
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
