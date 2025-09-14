---
title: "04 Security Specification"
description: "04 Security Specificationに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "15分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# セキュリティ仕様

## 概要

TypeScript Minecraftのセキュリティ実装仕様です。入力検証、サニタイゼーション、チート対策、データ暗号化など、ゲームの完全性とユーザーデータ保護を実現します。

## 入力検証

### クライアント入力の検証

```typescript
import { Schema, Effect, pipe } from "effect"

// 入力検証スキーマ
export const PlayerInputSchema = Schema.Struct({
  // 移動入力
  movement: Schema.Struct({
    x: Schema.Number.pipe(
      Schema.clamp(-1, 1) // 正規化された値のみ許可
    ),
    y: Schema.Number.pipe(
      Schema.clamp(-1, 1)
    ),
    z: Schema.Number.pipe(
      Schema.clamp(-1, 1)
    )
  }),

  // 回転入力
  rotation: Schema.Struct({
    yaw: Schema.Number.pipe(
      Schema.clamp(-180, 180)
    ),
    pitch: Schema.Number.pipe(
      Schema.clamp(-90, 90)
    )
  }),

  // アクション入力
  action: Schema.optional(
    Schema.Literal(
      'attack',
      'use',
      'jump',
      'sneak',
      'sprint'
    )
  ),

  // タイムスタンプ（リプレイ攻撃防止）
  timestamp: Schema.Number.pipe(
    Schema.filter(ts => {
      const now = Date.now()
      const diff = Math.abs(now - ts)
      return diff < 5000 // 5秒以内のみ有効
    })
  )
})

// 入力検証ミドルウェア
export const validateInput = <T>(schema: Schema.Schema<T>) =>
  (input: unknown) =>
    pipe(
      Schema.decodeUnknownSync(schema)(input),
      Effect.mapError(error => ({
        type: 'ValidationError',
        message: 'Invalid input',
        details: error
      }))
    )
```

### コマンド入力のサニタイゼーション

```typescript
// コマンド検証
export const CommandSchema = Schema.Struct({
  command: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(256),
    // 危険な文字のエスケープ
    Schema.transform(
      Schema.String,
      Schema.String,
      {
        decode: (str) => sanitizeCommand(str),
        encode: (str) => str
      }
    )
  ),

  args: Schema.Array(
    Schema.String.pipe(
      Schema.maxLength(100),
      // 引数のサニタイゼーション
      Schema.transform(
        Schema.String,
        Schema.String,
        {
          decode: (str) => sanitizeArgument(str),
          encode: (str) => str
        }
      )
    )
  ).pipe(
    Schema.maxItems(10) // 最大引数数制限
  )
})

// サニタイゼーション関数
const sanitizeCommand = (input: string): string => {
  // 危険な文字を除去
  return input
    .replace(/[<>'"]/g, '') // HTMLタグ文字
    .replace(/[\x00-\x1F\x7F]/g, '') // 制御文字
    .replace(/[;|&$`]/g, '') // シェルメタ文字
    .trim()
}

const sanitizeArgument = (input: string): string => {
  // 英数字と一部記号のみ許可
  return input.replace(/[^a-zA-Z0-9_\-\.]/g, '')
}
```

## チート対策

### 移動速度検証

```typescript
export const AntiCheatService = Context.GenericTag<AntiCheatService, {
  validateMovement: (params: {
    playerId: string
    from: Position
    to: Position
    deltaTime: number
  }) => Effect.Effect<boolean, CheatDetectionError>

  validateAction: (params: {
    playerId: string
    action: PlayerAction
    target?: Position
  }) => Effect.Effect<boolean, CheatDetectionError>
}>('AntiCheatService')

export const AntiCheatServiceLive = Layer.succeed(
  AntiCheatService,
  {
    validateMovement: (params) => Effect.gen(function* () {
      const { from, to, deltaTime } = params

      // 最大移動速度の計算
      const distance = calculateDistance(from, to)
      const maxSpeed = getMaxSpeed(params.playerId)
      const maxDistance = maxSpeed * (deltaTime / 1000)

      // 速度違反チェック
      if (distance > maxDistance * 1.1) { // 10%の余裕
        yield* logCheatAttempt({
          playerId: params.playerId,
          type: 'SpeedHack',
          details: { distance, maxDistance, deltaTime }
        })
        return false
      }

      // 壁抜けチェック
      const path = calculatePath(from, to)
      const collision = yield* checkCollisions(path)

      if (collision) {
        yield* logCheatAttempt({
          playerId: params.playerId,
          type: 'NoClip',
          details: { from, to, collision }
        })
        return false
      }

      // 飛行チェック（クリエイティブモード以外）
      const gameMode = yield* getPlayerGameMode(params.playerId)
      if (gameMode !== 'creative') {
        const isFlying = to.y > from.y && !isOnGround(from)
        const jumpHeight = to.y - from.y

        if (isFlying && jumpHeight > MAX_JUMP_HEIGHT) {
          yield* logCheatAttempt({
            playerId: params.playerId,
            type: 'Fly',
            details: { jumpHeight, maxJumpHeight: MAX_JUMP_HEIGHT }
          })
          return false
        }
      }

      return true
    }),

    validateAction: (params) => Effect.gen(function* () {
      const { playerId, action, target } = params

      // リーチ距離チェック
      if (target) {
        const playerPos = yield* getPlayerPosition(playerId)
        const distance = calculateDistance(playerPos, target)

        const maxReach = action === 'attack' ? 3.0 : 4.5
        if (distance > maxReach) {
          yield* logCheatAttempt({
            playerId,
            type: 'Reach',
            details: { distance, maxReach, action }
          })
          return false
        }
      }

      // アクション頻度チェック
      const actionRate = yield* getActionRate(playerId, action)
      const maxRate = getMaxActionRate(action)

      if (actionRate > maxRate) {
        yield* logCheatAttempt({
          playerId,
          type: 'AutoClick',
          details: { actionRate, maxRate, action }
        })
        return false
      }

      return true
    })
  }
)
```

### インベントリ検証

```typescript
// アイテム複製防止
export const validateInventoryTransaction = (
  transaction: InventoryTransaction
) => Effect.gen(function* () {
  const { from, to, item, amount } = transaction

  // アイテムの存在確認
  const sourceItem = yield* getSlotItem(from)
  if (!sourceItem || sourceItem.id !== item.id) {
    yield* Effect.fail(new InvalidTransactionError('Item mismatch'))
  }

  // 数量チェック
  if (amount > sourceItem.count) {
    yield* logCheatAttempt({
      playerId: transaction.playerId,
      type: 'ItemDupe',
      details: { requested: amount, available: sourceItem.count }
    })
    yield* Effect.fail(new InvalidTransactionError('Insufficient items'))
  }

  // スタック制限チェック
  const maxStack = getMaxStackSize(item.id)
  if (amount > maxStack) {
    yield* Effect.fail(new InvalidTransactionError('Stack size exceeded'))
  }

  // トランザクションIDで重複防止
  const transactionId = generateTransactionId(transaction)
  const isDuplicate = yield* checkTransactionDuplicate(transactionId)

  if (isDuplicate) {
    yield* logCheatAttempt({
      playerId: transaction.playerId,
      type: 'TransactionReplay',
      details: { transactionId }
    })
    yield* Effect.fail(new DuplicateTransactionError())
  }

  return true
})
```

## データ暗号化

### ワールドデータ暗号化

```typescript
export const EncryptionService = Context.GenericTag<EncryptionService, {
  encryptWorld: (
    data: WorldData
  ) => Effect.Effect<EncryptedData, EncryptionError>

  decryptWorld: (
    encrypted: EncryptedData
  ) => Effect.Effect<WorldData, DecryptionError>

  generateKey: () => Effect.Effect<CryptoKey, KeyGenerationError>
}>('EncryptionService')

export const EncryptionServiceLive = Layer.succeed(
  EncryptionService,
  {
    encryptWorld: (data) => Effect.gen(function* () {
      // データシリアライズ
      const serialized = yield* serializeWorldData(data)

      // 暗号鍵取得
      const key = yield* getOrCreateEncryptionKey()

      // AES-GCM暗号化
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encrypted = yield* Effect.promise(() =>
        crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: iv
          },
          key,
          serialized
        )
      )

      // MAC計算（改ざん検出用）
      const mac = yield* calculateHMAC(encrypted)

      return {
        data: new Uint8Array(encrypted),
        iv: iv,
        mac: mac,
        algorithm: 'AES-GCM',
        version: 1
      }
    }),

    decryptWorld: (encrypted) => Effect.gen(function* () {
      // MAC検証
      const calculatedMac = yield* calculateHMAC(encrypted.data)
      if (!timingSafeEqual(calculatedMac, encrypted.mac)) {
        yield* Effect.fail(new TamperDetectionError())
      }

      // 暗号鍵取得
      const key = yield* getEncryptionKey()

      // 復号化
      const decrypted = yield* Effect.promise(() =>
        crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: encrypted.iv
          },
          key,
          encrypted.data
        )
      )

      // デシリアライズ
      return yield* deserializeWorldData(new Uint8Array(decrypted))
    }),

    generateKey: () => Effect.promise(() =>
      crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      )
    )
  }
)
```

### 通信暗号化

```typescript
// TLS/WebSocket Secure
export const SecureWebSocketService = {
  connect: (url: string) => Effect.gen(function* () {
    // WSS接続強制
    if (!url.startsWith('wss://')) {
      yield* Effect.fail(new InsecureConnectionError())
    }

    // 証明書検証
    const ws = new WebSocket(url)

    // ハンドシェイク
    yield* performSecureHandshake(ws)

    // セッション鍵交換
    const sessionKey = yield* exchangeSessionKey(ws)

    return {
      send: (data: Uint8Array) =>
        encryptAndSend(ws, data, sessionKey),

      receive: () =>
        Stream.async<Uint8Array>((emit) => {
          ws.onmessage = async (event) => {
            const decrypted = await decryptMessage(
              event.data,
              sessionKey
            )
            emit(Effect.succeed(Chunk.of(decrypted)))
          }
        })
    }
  })
}
```

## セッション管理

### セキュアセッション

```typescript
export const SessionManager = {
  createSession: (playerId: string) => Effect.gen(function* () {
    // セッショントークン生成
    const token = yield* generateSecureToken()
    const sessionId = yield* generateSessionId()

    // セッション情報
    const session: Session = {
      id: sessionId,
      playerId,
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION,
      ipAddress: yield* getClientIP(),
      userAgent: yield* getUserAgent()
    }

    // セッション保存（メモリ + Redis）
    yield* storeSession(session)

    // セッション固定攻撃対策
    yield* regenerateSessionId(session)

    return {
      sessionId,
      token,
      expiresIn: SESSION_DURATION
    }
  }),

  validateSession: (token: string) => Effect.gen(function* () {
    const session = yield* getSessionByToken(token)

    if (!session) {
      yield* Effect.fail(new InvalidSessionError())
    }

    // 有効期限チェック
    if (session.expiresAt < Date.now()) {
      yield* destroySession(session.id)
      yield* Effect.fail(new SessionExpiredError())
    }

    // IPアドレス検証（セッションハイジャック対策）
    const currentIP = yield* getClientIP()
    if (session.ipAddress !== currentIP) {
      yield* logSecurityEvent({
        type: 'SessionHijackAttempt',
        sessionId: session.id,
        originalIP: session.ipAddress,
        currentIP
      })
      yield* Effect.fail(new SessionHijackError())
    }

    // セッション更新
    yield* updateSessionActivity(session.id)

    return session
  })
}
```

## レート制限

### API レート制限

```typescript
export const RateLimiter = {
  // トークンバケットアルゴリズム
  createLimiter: (config: RateLimitConfig) => Effect.gen(function* () {
    const buckets = new Map<string, TokenBucket>()

    return {
      checkLimit: (clientId: string) => Effect.gen(function* () {
        let bucket = buckets.get(clientId)

        if (!bucket) {
          bucket = {
            tokens: config.burstLimit,
            lastRefill: Date.now()
          }
          buckets.set(clientId, bucket)
        }

        // トークン補充
        const now = Date.now()
        const timePassed = now - bucket.lastRefill
        const tokensToAdd = Math.floor(
          timePassed / 1000 * config.refillRate
        )

        bucket.tokens = Math.min(
          config.burstLimit,
          bucket.tokens + tokensToAdd
        )
        bucket.lastRefill = now

        // トークン消費
        if (bucket.tokens < 1) {
          yield* Effect.fail(new RateLimitExceededError({
            retryAfter: Math.ceil(1000 / config.refillRate)
          }))
        }

        bucket.tokens--
        return true
      }),

      // DDoS対策
      checkGlobalLimit: () => Effect.gen(function* () {
        const globalRate = yield* getGlobalRequestRate()

        if (globalRate > config.globalMaxRate) {
          // 緊急モード有効化
          yield* enableEmergencyMode()
          yield* Effect.fail(new GlobalRateLimitError())
        }

        return true
      })
    }
  })
}
```

## セキュリティイベントログ

### 監査ログ

```typescript
export const SecurityAuditor = {
  logEvent: (event: SecurityEvent) => Effect.gen(function* () {
    const enrichedEvent = {
      ...event,
      timestamp: Date.now(),
      serverVersion: SERVER_VERSION,
      environment: ENVIRONMENT
    }

    // ログ保存（複数の宛先）
    yield* Effect.all([
      writeToFile(enrichedEvent),
      sendToSIEM(enrichedEvent),
      storeInDatabase(enrichedEvent)
    ], { concurrency: 3 })

    // 重要度に応じてアラート
    if (event.severity === 'critical') {
      yield* sendAlert({
        type: 'SecurityAlert',
        event: enrichedEvent,
        recipients: ['admin@example.com']
      })
    }

    // 統計更新
    yield* updateSecurityMetrics(event.type)
  }),

  // 異常検知
  detectAnomalies: () => Stream.periodic(Duration.minutes(1)).pipe(
    Stream.mapEffect(() => Effect.gen(function* () {
      const recentEvents = yield* getRecentSecurityEvents()

      // パターン分析
      const patterns = analyzePatterns(recentEvents)

      for (const pattern of patterns) {
        if (pattern.isAnomaly) {
          yield* logEvent({
            type: 'AnomalyDetected',
            severity: 'high',
            details: pattern
          })

          // 自動対応
          yield* applySecurityPolicy(pattern)
        }
      }
    }))
  )
}
```

## コンテンツセキュリティポリシー

```typescript
// CSP設定（Webベース版）
export const contentSecurityPolicy = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", "data:", "blob:"],
  'connect-src': ["'self'", "wss://game.example.com"],
  'worker-src': ["'self'", "blob:"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': []
}
```