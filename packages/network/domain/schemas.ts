import { BlockTypeSchema } from '@ts-minecraft/core'
import { Effect, Schema } from 'effect'
import { NetworkError } from './errors'

export const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>
export const PlayerId = {
  make: (s: string): PlayerId => Schema.decodeUnknownSync(PlayerIdSchema)(s),
}

export const PlayerNameSchema = Schema.String.pipe(Schema.brand('PlayerName'))
export type PlayerName = Schema.Schema.Type<typeof PlayerNameSchema>
export const PlayerName = {
  make: (s: string): PlayerName => Schema.decodeUnknownSync(PlayerNameSchema)(s),
}

export const WorldIdSchema = Schema.String.pipe(Schema.brand('WorldId'))
export type WorldId = Schema.Schema.Type<typeof WorldIdSchema>
export const WorldId = {
  make: (s: string): WorldId => Schema.decodeUnknownSync(WorldIdSchema)(s),
}

export const Vec3Schema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
})
export type Vec3 = Schema.Schema.Type<typeof Vec3Schema>

export const BlockPosSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
})
export type BlockPos = Schema.Schema.Type<typeof BlockPosSchema>

export const NetworkRotationSchema = Schema.Struct({
  yaw: Schema.Number.pipe(Schema.finite()),
  pitch: Schema.Number.pipe(Schema.finite()),
})
export type NetworkRotation = Schema.Schema.Type<typeof NetworkRotationSchema>

export const MessageType = {
  PlayerJoin: 'PlayerJoin',
  PlayerLeave: 'PlayerLeave',
  PlayerMove: 'PlayerMove',
  BlockPlace: 'BlockPlace',
  BlockBreak: 'BlockBreak',
  Chat: 'Chat',
  Ping: 'Ping',
  Pong: 'Pong',
  Error: 'Error',
} as const

export const MessageTypeSchema = Schema.Literal(
  MessageType.PlayerJoin,
  MessageType.PlayerLeave,
  MessageType.PlayerMove,
  MessageType.BlockPlace,
  MessageType.BlockBreak,
  MessageType.Chat,
  MessageType.Ping,
  MessageType.Pong,
  MessageType.Error,
)
export type MessageType = Schema.Schema.Type<typeof MessageTypeSchema>

export const TimestampSchema = Schema.Number.pipe(Schema.finite(), Schema.nonNegative())
export type Timestamp = Schema.Schema.Type<typeof TimestampSchema>

export const BaseNetworkMessageSchema = Schema.Struct({
  type: MessageTypeSchema,
  timestamp: TimestampSchema,
})
export type BaseNetworkMessage = Schema.Schema.Type<typeof BaseNetworkMessageSchema>

export const PlayerJoinMessageSchema = Schema.Struct({
  type: Schema.Literal(MessageType.PlayerJoin),
  playerId: PlayerIdSchema,
  playerName: PlayerNameSchema,
  worldId: WorldIdSchema,
  position: Vec3Schema,
  timestamp: TimestampSchema,
})
export type PlayerJoinMessage = Schema.Schema.Type<typeof PlayerJoinMessageSchema>

export const PlayerLeaveMessageSchema = Schema.Struct({
  type: Schema.Literal(MessageType.PlayerLeave),
  playerId: PlayerIdSchema,
  worldId: WorldIdSchema,
  timestamp: TimestampSchema,
})
export type PlayerLeaveMessage = Schema.Schema.Type<typeof PlayerLeaveMessageSchema>

export const PlayerMoveMessageSchema = Schema.Struct({
  type: Schema.Literal(MessageType.PlayerMove),
  playerId: PlayerIdSchema,
  worldId: WorldIdSchema,
  position: Vec3Schema,
  rotation: NetworkRotationSchema,
  timestamp: TimestampSchema,
})
export type PlayerMoveMessage = Schema.Schema.Type<typeof PlayerMoveMessageSchema>

export const BlockPlaceMessageSchema = Schema.Struct({
  type: Schema.Literal(MessageType.BlockPlace),
  playerId: PlayerIdSchema,
  worldId: WorldIdSchema,
  position: BlockPosSchema,
  blockType: BlockTypeSchema,
  timestamp: TimestampSchema,
})
export type BlockPlaceMessage = Schema.Schema.Type<typeof BlockPlaceMessageSchema>

export const BlockBreakMessageSchema = Schema.Struct({
  type: Schema.Literal(MessageType.BlockBreak),
  playerId: PlayerIdSchema,
  worldId: WorldIdSchema,
  position: BlockPosSchema,
  timestamp: TimestampSchema,
})
export type BlockBreakMessage = Schema.Schema.Type<typeof BlockBreakMessageSchema>

export const ChatMessageSchema = Schema.Struct({
  type: Schema.Literal(MessageType.Chat),
  playerId: PlayerIdSchema,
  worldId: WorldIdSchema,
  message: Schema.String,
  timestamp: TimestampSchema,
})
export type ChatMessage = Schema.Schema.Type<typeof ChatMessageSchema>

export const PingMessageSchema = Schema.Struct({
  type: Schema.Literal(MessageType.Ping),
  nonce: Schema.String,
  timestamp: TimestampSchema,
})
export type PingMessage = Schema.Schema.Type<typeof PingMessageSchema>

export const PongMessageSchema = Schema.Struct({
  type: Schema.Literal(MessageType.Pong),
  nonce: Schema.String,
  timestamp: TimestampSchema,
})
export type PongMessage = Schema.Schema.Type<typeof PongMessageSchema>

export const ErrorMessageSchema = Schema.Struct({
  type: Schema.Literal(MessageType.Error),
  code: Schema.String,
  message: Schema.String,
  timestamp: TimestampSchema,
})
export type ErrorMessage = Schema.Schema.Type<typeof ErrorMessageSchema>

export const NetworkMessageSchema = Schema.Union(
  PlayerJoinMessageSchema,
  PlayerLeaveMessageSchema,
  PlayerMoveMessageSchema,
  BlockPlaceMessageSchema,
  BlockBreakMessageSchema,
  ChatMessageSchema,
  PingMessageSchema,
  PongMessageSchema,
  ErrorMessageSchema,
)
export type NetworkMessage = Schema.Schema.Type<typeof NetworkMessageSchema>

export const serializeNetworkMessage = (
  message: NetworkMessage,
): Effect.Effect<string, NetworkError> =>
  Schema.encode(NetworkMessageSchema)(message).pipe(
    Effect.map((encoded) => JSON.stringify(encoded)),
    Effect.mapError(
      (cause) =>
        new NetworkError({
          operation: 'serialize',
          reason: 'message does not conform to the network protocol',
          cause,
        }),
    ),
  )

export const deserializeNetworkMessage = (
  serialized: string,
): Effect.Effect<NetworkMessage, NetworkError> =>
  Effect.try({
    try: () => JSON.parse(serialized) as unknown,
    catch: (cause) =>
      new NetworkError({
        operation: 'deserialize',
        reason: 'payload is not valid JSON',
        cause,
      }),
  }).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknown(NetworkMessageSchema)(json).pipe(
        Effect.mapError(
          (cause) =>
            new NetworkError({
              operation: 'deserialize',
              reason: 'payload does not conform to the network protocol',
              cause,
            }),
        ),
      ),
    ),
  )

export const NetworkPositionSchema = Vec3Schema
export type NetworkPosition = Vec3
