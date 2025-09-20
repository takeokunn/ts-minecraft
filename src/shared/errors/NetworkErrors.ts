import { Schema } from "effect"

/**
 * 基本的なネットワークエラー
 */
export const NetworkErrorSchema = Schema.Struct({
  _tag: Schema.Literal("NetworkError"),
  message: Schema.String,
  code: Schema.optional(Schema.String),
  statusCode: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Unknown)
})

export type NetworkError = Schema.Schema.Type<typeof NetworkErrorSchema>

export const NetworkError = (params: Omit<NetworkError, "_tag">): NetworkError => ({
  _tag: "NetworkError" as const,
  ...params
})

/**
 * 接続エラー
 * サーバーへの接続失敗
 */
export const ConnectionErrorSchema = Schema.Struct({
  _tag: Schema.Literal("ConnectionError"),
  message: Schema.String,
  serverUrl: Schema.String,
  attemptNumber: Schema.Number,
  maxAttempts: Schema.Number,
  lastError: Schema.optional(Schema.String)
})

export type ConnectionError = Schema.Schema.Type<typeof ConnectionErrorSchema>

export const ConnectionError = (params: Omit<ConnectionError, "_tag">): ConnectionError => ({
  _tag: "ConnectionError" as const,
  ...params
})

/**
 * タイムアウトエラー
 * リクエストのタイムアウト
 */
export const TimeoutErrorSchema = Schema.Struct({
  _tag: Schema.Literal("TimeoutError"),
  message: Schema.String,
  operation: Schema.String,
  timeoutMs: Schema.Number,
  elapsedMs: Schema.Number
})

export type TimeoutError = Schema.Schema.Type<typeof TimeoutErrorSchema>

export const TimeoutError = (params: Omit<TimeoutError, "_tag">): TimeoutError => ({
  _tag: "TimeoutError" as const,
  ...params
})

/**
 * プロトコルエラー
 * 通信プロトコルの不一致や不正なパケット
 */
export const ProtocolErrorSchema = Schema.Struct({
  _tag: Schema.Literal("ProtocolError"),
  message: Schema.String,
  expectedVersion: Schema.String,
  actualVersion: Schema.optional(Schema.String),
  packetType: Schema.optional(Schema.String)
})

export type ProtocolError = Schema.Schema.Type<typeof ProtocolErrorSchema>

export const ProtocolError = (params: Omit<ProtocolError, "_tag">): ProtocolError => ({
  _tag: "ProtocolError" as const,
  ...params
})

/**
 * 認証エラー
 * ユーザー認証の失敗
 */
export const AuthenticationErrorSchema = Schema.Struct({
  _tag: Schema.Literal("AuthenticationError"),
  message: Schema.String,
  username: Schema.optional(Schema.String),
  reason: Schema.Union(
    Schema.Literal("invalid_credentials"),
    Schema.Literal("token_expired"),
    Schema.Literal("account_locked"),
    Schema.Literal("permission_denied")
  ),
  retryAfter: Schema.optional(Schema.Number)
})

export type AuthenticationError = Schema.Schema.Type<typeof AuthenticationErrorSchema>

export const AuthenticationError = (params: Omit<AuthenticationError, "_tag">): AuthenticationError => ({
  _tag: "AuthenticationError" as const,
  ...params
})

/**
 * セッションエラー
 * セッション管理のエラー
 */
export const SessionErrorSchema = Schema.Struct({
  _tag: Schema.Literal("SessionError"),
  message: Schema.String,
  sessionId: Schema.String,
  reason: Schema.Union(
    Schema.Literal("expired"),
    Schema.Literal("invalid"),
    Schema.Literal("duplicate"),
    Schema.Literal("terminated")
  ),
  createdAt: Schema.optional(Schema.Number),
  expiresAt: Schema.optional(Schema.Number)
})

export type SessionError = Schema.Schema.Type<typeof SessionErrorSchema>

export const SessionError = (params: Omit<SessionError, "_tag">): SessionError => ({
  _tag: "SessionError" as const,
  ...params
})

/**
 * データ同期エラー
 * クライアント・サーバー間のデータ同期失敗
 */
export const SyncErrorSchema = Schema.Struct({
  _tag: Schema.Literal("SyncError"),
  message: Schema.String,
  dataType: Schema.String,
  localVersion: Schema.Number,
  remoteVersion: Schema.Number,
  conflictResolution: Schema.optional(
    Schema.Union(
      Schema.Literal("local"),
      Schema.Literal("remote"),
      Schema.Literal("merge"),
      Schema.Literal("manual")
    )
  )
})

export type SyncError = Schema.Schema.Type<typeof SyncErrorSchema>

export const SyncError = (params: Omit<SyncError, "_tag">): SyncError => ({
  _tag: "SyncError" as const,
  ...params
})

/**
 * レート制限エラー
 * APIレート制限に達した場合
 */
export const RateLimitErrorSchema = Schema.Struct({
  _tag: Schema.Literal("RateLimitError"),
  message: Schema.String,
  limit: Schema.Number,
  windowMs: Schema.Number,
  retryAfter: Schema.Number,
  endpoint: Schema.optional(Schema.String)
})

export type RateLimitError = Schema.Schema.Type<typeof RateLimitErrorSchema>

export const RateLimitError = (params: Omit<RateLimitError, "_tag">): RateLimitError => ({
  _tag: "RateLimitError" as const,
  ...params
})

/**
 * WebSocketエラー
 * WebSocket通信のエラー
 */
export const WebSocketErrorSchema = Schema.Struct({
  _tag: Schema.Literal("WebSocketError"),
  message: Schema.String,
  code: Schema.Number,
  reason: Schema.String,
  wasClean: Schema.Boolean,
  reconnectAttempt: Schema.optional(Schema.Number)
})

export type WebSocketError = Schema.Schema.Type<typeof WebSocketErrorSchema>

export const WebSocketError = (params: Omit<WebSocketError, "_tag">): WebSocketError => ({
  _tag: "WebSocketError" as const,
  ...params
})

/**
 * パケットエラー
 * ゲームパケットの処理エラー
 */
export const PacketErrorSchema = Schema.Struct({
  _tag: Schema.Literal("PacketError"),
  message: Schema.String,
  packetId: Schema.String,
  packetType: Schema.String,
  size: Schema.Number,
  direction: Schema.Union(
    Schema.Literal("incoming"),
    Schema.Literal("outgoing")
  ),
  malformed: Schema.Boolean
})

export type PacketError = Schema.Schema.Type<typeof PacketErrorSchema>

export const PacketError = (params: Omit<PacketError, "_tag">): PacketError => ({
  _tag: "PacketError" as const,
  ...params
})

/**
 * サーバーエラー
 * サーバー側の内部エラー
 */
export const ServerErrorSchema = Schema.Struct({
  _tag: Schema.Literal("ServerError"),
  message: Schema.String,
  statusCode: Schema.Number,
  errorCode: Schema.optional(Schema.String),
  details: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  traceId: Schema.optional(Schema.String)
})

export type ServerError = Schema.Schema.Type<typeof ServerErrorSchema>

export const ServerError = (params: Omit<ServerError, "_tag">): ServerError => ({
  _tag: "ServerError" as const,
  ...params
})

/**
 * P2Pエラー
 * ピアツーピア接続のエラー
 */
export const P2PErrorSchema = Schema.Struct({
  _tag: Schema.Literal("P2PError"),
  message: Schema.String,
  peerId: Schema.String,
  connectionState: Schema.String,
  iceState: Schema.optional(Schema.String),
  signalType: Schema.optional(Schema.String)
})

export type P2PError = Schema.Schema.Type<typeof P2PErrorSchema>

export const P2PError = (params: Omit<P2PError, "_tag">): P2PError => ({
  _tag: "P2PError" as const,
  ...params
})

/**
 * すべてのネットワークエラーのユニオン型
 */
export const NetworkErrorUnion = Schema.Union(
  NetworkErrorSchema,
  ConnectionErrorSchema,
  TimeoutErrorSchema,
  ProtocolErrorSchema,
  AuthenticationErrorSchema,
  SessionErrorSchema,
  SyncErrorSchema,
  RateLimitErrorSchema,
  WebSocketErrorSchema,
  PacketErrorSchema,
  ServerErrorSchema,
  P2PErrorSchema
)

export type AnyNetworkError = Schema.Schema.Type<typeof NetworkErrorUnion>