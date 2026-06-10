import { describe, it, expect } from 'vitest'
import { Effect, Stream } from 'effect'
import { PlayerName, type NetworkMessage, type ClientServiceShape } from '@ts-minecraft/network'
import { MultiplayerServiceImpl } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'

const makeClient = (sent: NetworkMessage[]): ClientServiceShape => ({
  connect: () => Effect.void,
  disconnect: () => Effect.void,
  getConnectionState: () => Effect.succeed('connected' as const),
  sendMessage: (m) => Effect.sync(() => { sent.push(m) }),
  receiveMessages: () => Effect.succeed(Stream.empty as Stream.Stream<NetworkMessage, never, never>),
})

describe('MultiplayerService block sync (T15a)', () => {
  it('sendBlockPlace emits a BlockPlace message with floored integer position + blockType', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent))
        yield* svc.connect('ws://test', PlayerName.make('alice'))
        yield* svc.sendBlockPlace({ x: 3.7, y: 64.2, z: -2.9 }, 'STONE')
      }),
    )
    const placed = sent.find((m) => m.type === 'BlockPlace')
    expect(placed).toBeDefined()
    expect((placed as { position: { x: number; y: number; z: number } }).position).toEqual({ x: 3, y: 64, z: -3 })
    expect((placed as { blockType: string }).blockType).toBe('STONE')
  })

  it('sendBlockBreak emits a BlockBreak message', async () => {
    const sent: NetworkMessage[] = []
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient(sent))
        yield* svc.connect('ws://test', PlayerName.make('bob'))
        yield* svc.sendBlockBreak({ x: 10, y: 70, z: 5 })
      }),
    )
    expect(sent.some((m) => m.type === 'BlockBreak')).toBe(true)
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

  it('drainBlockEdits returns an empty array initially', async () => {
    const edits = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* MultiplayerServiceImpl(makeClient([]))
        return yield* svc.drainBlockEdits
      }),
    )
    expect(edits).toEqual([])
  })
})
