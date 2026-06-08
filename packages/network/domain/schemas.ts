import { Schema } from 'effect'

export const MessageTypeSchema = Schema.Literal(
  'PlayerJoin',
  'PlayerLeave',
  'PlayerMove',
  'BlockPlace',
  'BlockBreak',
  'Chat',
  'Ping',
  'Pong',
  'Error',
)
export type MessageType = Schema.Schema.Type<typeof MessageTypeSchema>

export const NetworkPositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type NetworkPosition = Schema.Schema.Type<typeof NetworkPositionSchema>

export const NetworkRotationSchema = Schema.Struct({
  yaw: Schema.Number,
  pitch: Schema.Number,
})
export type NetworkRotation = Schema.Schema.Type<typeof NetworkRotationSchema>

export const BaseNetworkMessageSchema = Schema.Struct({
  type: MessageTypeSchema,
})
export type BaseNetworkMessage = Schema.Schema.Type<typeof BaseNetworkMessageSchema>

export const PlayerJoinMessageSchema = Schema.Struct({
  type: Schema.Literal('PlayerJoin'),
  playerId: Schema.String,
  playerName: Schema.String,
  position: NetworkPositionSchema,
})
export type PlayerJoinMessage = Schema.Schema.Type<typeof PlayerJoinMessageSchema>

export const PlayerMoveMessageSchema = Schema.Struct({
  type: Schema.Literal('PlayerMove'),
  playerId: Schema.String,
  position: NetworkPositionSchema,
  rotation: NetworkRotationSchema,
  timestamp: Schema.Number,
})
export type PlayerMoveMessage = Schema.Schema.Type<typeof PlayerMoveMessageSchema>

export const ChatMessageSchema = Schema.Struct({
  type: Schema.Literal('Chat'),
  playerId: Schema.String,
  message: Schema.String,
  timestamp: Schema.Number,
})
export type ChatMessage = Schema.Schema.Type<typeof ChatMessageSchema>

export const NetworkMessageSchema = Schema.Union(
  PlayerJoinMessageSchema,
  PlayerMoveMessageSchema,
  ChatMessageSchema,
)
export type NetworkMessage = Schema.Schema.Type<typeof NetworkMessageSchema>
