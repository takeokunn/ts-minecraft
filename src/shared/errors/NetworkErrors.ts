import { Schema } from "effect"

/**
 * 基本的なネットワークエラー
 */
export class NetworkError extends Schema.TaggedError<NetworkError>()(
  "NetworkError",
  {
    message: Schema.String,
    code: Schema.optional(Schema.String),
    statusCode: Schema.optional(Schema.Number),
    cause: Schema.optional(Schema.Unknown)
  }
) {}

/**
 * 接続エラー
 * サーバーへの接続失敗
 */
export class ConnectionError extends Schema.TaggedError<ConnectionError>()(
  "ConnectionError",
  {
    message: Schema.String,
    serverUrl: Schema.String,
    attemptNumber: Schema.Number,
    maxAttempts: Schema.Number,
    lastError: Schema.optional(Schema.String)
  }
) {}

/**
 * タイムアウトエラー
 * リクエストのタイムアウト
 */
export class TimeoutError extends Schema.TaggedError<TimeoutError>()(
  "TimeoutError",
  {
    message: Schema.String,
    operation: Schema.String,
    timeoutMs: Schema.Number,
    elapsedMs: Schema.Number
  }
) {}

/**
 * プロトコルエラー
 * 通信プロトコルの不一致や不正なパケット
 */
export class ProtocolError extends Schema.TaggedError<ProtocolError>()(
  "ProtocolError",
  {
    message: Schema.String,
    expectedVersion: Schema.String,
    actualVersion: Schema.optional(Schema.String),
    packetType: Schema.optional(Schema.String)
  }
) {}

/**
 * 認証エラー
 * ユーザー認証の失敗
 */
export class AuthenticationError extends Schema.TaggedError<AuthenticationError>()(
  "AuthenticationError",
  {
    message: Schema.String,
    username: Schema.optional(Schema.String),
    reason: Schema.Union(
      Schema.Literal("invalid_credentials"),
      Schema.Literal("token_expired"),
      Schema.Literal("account_locked"),
      Schema.Literal("permission_denied")
    ),
    retryAfter: Schema.optional(Schema.Number)
  }
) {}

/**
 * セッションエラー
 * セッション管理のエラー
 */
export class SessionError extends Schema.TaggedError<SessionError>()(
  "SessionError",
  {
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
  }
) {}

/**
 * データ同期エラー
 * クライアント・サーバー間のデータ同期失敗
 */
export class SyncError extends Schema.TaggedError<SyncError>()(
  "SyncError",
  {
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
  }
) {}

/**
 * レート制限エラー
 * APIレート制限に達した場合
 */
export class RateLimitError extends Schema.TaggedError<RateLimitError>()(
  "RateLimitError",
  {
    message: Schema.String,
    limit: Schema.Number,
    windowMs: Schema.Number,
    retryAfter: Schema.Number,
    endpoint: Schema.optional(Schema.String)
  }
) {}

/**
 * WebSocketエラー
 * WebSocket通信のエラー
 */
export class WebSocketError extends Schema.TaggedError<WebSocketError>()(
  "WebSocketError",
  {
    message: Schema.String,
    code: Schema.Number,
    reason: Schema.String,
    wasClean: Schema.Boolean,
    reconnectAttempt: Schema.optional(Schema.Number)
  }
) {}

/**
 * パケットエラー
 * ゲームパケットの処理エラー
 */
export class PacketError extends Schema.TaggedError<PacketError>()(
  "PacketError",
  {
    message: Schema.String,
    packetId: Schema.String,
    packetType: Schema.String,
    size: Schema.Number,
    direction: Schema.Union(
      Schema.Literal("incoming"),
      Schema.Literal("outgoing")
    ),
    malformed: Schema.Boolean
  }
) {}

/**
 * サーバーエラー
 * サーバー側の内部エラー
 */
export class ServerError extends Schema.TaggedError<ServerError>()(
  "ServerError",
  {
    message: Schema.String,
    statusCode: Schema.Number,
    errorCode: Schema.optional(Schema.String),
    details: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
    traceId: Schema.optional(Schema.String)
  }
) {}

/**
 * P2Pエラー
 * ピアツーピア接続のエラー
 */
export class P2PError extends Schema.TaggedError<P2PError>()(
  "P2PError",
  {
    message: Schema.String,
    peerId: Schema.String,
    connectionState: Schema.String,
    iceState: Schema.optional(Schema.String),
    signalType: Schema.optional(Schema.String)
  }
) {}