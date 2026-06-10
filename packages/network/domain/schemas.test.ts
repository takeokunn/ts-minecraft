import { describe, it } from '@effect/vitest'
import { Effect, Either, Schema } from 'effect'
import { expect, expectTypeOf } from 'vitest'
import {
  BlockPosSchema,
  MessageType,
  NetworkMessageSchema,
  PlayerId,
  PlayerName,
  Vec3Schema,
  WorldId,
  deserializeNetworkMessage,
  serializeNetworkMessage,
} from './schemas'
import type {
  BlockBreakMessage,
  BlockPlaceMessage,
  ChatMessage,
  ErrorMessage,
  NetworkMessage,
  PingMessage,
  PlayerJoinMessage,
  PlayerLeaveMessage,
  PlayerMoveMessage,
  PongMessage,
} from './schemas'

const playerId = PlayerId.make('player-1')
const playerName = PlayerName.make('Alex')
const worldId = WorldId.make('overworld')

const messagesByType = {
  [MessageType.PlayerJoin]: {
    type: MessageType.PlayerJoin,
    playerId,
    playerName,
    worldId,
    position: { x: 1.5, y: 64, z: -2.25 },
    timestamp: 1,
  },
  [MessageType.PlayerLeave]: {
    type: MessageType.PlayerLeave,
    playerId,
    worldId,
    timestamp: 2,
  },
  [MessageType.PlayerMove]: {
    type: MessageType.PlayerMove,
    playerId,
    worldId,
    position: { x: 3, y: 65.25, z: 4 },
    rotation: { yaw: 90, pitch: -15 },
    timestamp: 3,
  },
  [MessageType.BlockPlace]: {
    type: MessageType.BlockPlace,
    playerId,
    worldId,
    position: { x: 10, y: 63, z: -8 },
    blockType: 'STONE',
    timestamp: 4,
  },
  [MessageType.BlockBreak]: {
    type: MessageType.BlockBreak,
    playerId,
    worldId,
    position: { x: 11, y: 64, z: -8 },
    timestamp: 5,
  },
  [MessageType.Chat]: {
    type: MessageType.Chat,
    playerId,
    worldId,
    message: 'hello world',
    timestamp: 6,
  },
  [MessageType.Ping]: {
    type: MessageType.Ping,
    nonce: 'ping-1',
    timestamp: 7,
  },
  [MessageType.Pong]: {
    type: MessageType.Pong,
    nonce: 'ping-1',
    timestamp: 8,
  },
  [MessageType.Error]: {
    type: MessageType.Error,
    code: 'INVALID_MESSAGE',
    message: 'invalid payload',
    timestamp: 9,
  },
} satisfies Record<NetworkMessage['type'], NetworkMessage>

const messages = Object.values(messagesByType)

describe('network protocol schemas', () => {
  it('defines a discriminated union for every protocol message type', () => {
    expectTypeOf(messagesByType[MessageType.PlayerJoin]).toEqualTypeOf<PlayerJoinMessage>()
    expectTypeOf(messagesByType[MessageType.PlayerLeave]).toEqualTypeOf<PlayerLeaveMessage>()
    expectTypeOf(messagesByType[MessageType.PlayerMove]).toEqualTypeOf<PlayerMoveMessage>()
    expectTypeOf(messagesByType[MessageType.BlockPlace]).toEqualTypeOf<BlockPlaceMessage>()
    expectTypeOf(messagesByType[MessageType.BlockBreak]).toEqualTypeOf<BlockBreakMessage>()
    expectTypeOf(messagesByType[MessageType.Chat]).toEqualTypeOf<ChatMessage>()
    expectTypeOf(messagesByType[MessageType.Ping]).toEqualTypeOf<PingMessage>()
    expectTypeOf(messagesByType[MessageType.Pong]).toEqualTypeOf<PongMessage>()
    expectTypeOf(messagesByType[MessageType.Error]).toEqualTypeOf<ErrorMessage>()
  })

  it['each'](messages)('round-trips $type through JSON serialization', (message) => {
    const serialized = Effect.runSync(serializeNetworkMessage(message))
    const deserialized = Effect.runSync(deserializeNetworkMessage(serialized))
    expect(deserialized).toEqual(message)
  })

  it['each'](messages)('decodes $type through the protocol union schema', (message) => {
    const result = Schema.decodeUnknownEither(NetworkMessageSchema)(message)
    expect(Either.isRight(result)).toBe(true)
  })

  it('serializes to plain JSON that preserves branded IDs as strings', () => {
    const serialized = Effect.runSync(serializeNetworkMessage(messagesByType.PlayerJoin))
    expect(JSON.parse(serialized)).toEqual({
      type: 'PlayerJoin',
      playerId: 'player-1',
      playerName: 'Alex',
      worldId: 'overworld',
      position: { x: 1.5, y: 64, z: -2.25 },
      timestamp: 1,
    })
  })

  it('rejects unknown message types', () => {
    const result = Schema.decodeUnknownEither(NetworkMessageSchema)({
      type: 'Unknown',
      timestamp: 1,
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects non-finite Vec3 coordinates', () => {
    const result = Schema.decodeUnknownEither(Vec3Schema)({ x: NaN, y: 0, z: 0 })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects non-integer block coordinates', () => {
    const result = Schema.decodeUnknownEither(BlockPosSchema)({ x: 1.5, y: 64, z: 0 })
    expect(Either.isLeft(result)).toBe(true)
  })
})
