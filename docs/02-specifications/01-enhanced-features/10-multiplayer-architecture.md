---
title: "マルチプレイヤーアーキテクチャ仕様 - ネットワーク同期・並行処理"
description: "マルチプレイヤーゲームのネットワークアーキテクチャ、リアルタイム同期、冪突解決の完全仕様。サーバー・クライアントアーキテクチャ。"
category: "specification"
difficulty: "advanced"
tags: ["multiplayer", "networking", "real-time-sync", "conflict-resolution", "server-client", "websocket", "distributed-systems"]
prerequisites: ["effect-ts-fundamentals", "networking-concepts", "distributed-systems", "concurrent-programming"]
estimated_reading_time: "25分"
related_patterns: ["concurrent-patterns", "event-driven-patterns", "network-sync-patterns"]
related_docs: ["../00-core-features/22-game-loop-system.md", "../../01-architecture/06-effect-ts-patterns.md"]
---

# Multiplayer Architecture 設計書

## 1. 概要

### 1.1 アーキテクチャ目標
- **リアルタイム通信**: WebSocket/WebRTCベースの低遅延通信
- **状態同期**: Effect-TS StreamとSTMを活用した一貫性のある状態管理
- **スケーラビリティ**: Fiberベースの並行処理による高並行接続対応
- **チート対策**: サーバーサイド権威による不正行為防止
- **遅延補償**: クライアント予測とサーバーサイドロールバック

### 1.2 技術スタック
- **Effect-TS 3.17+**: Stream, Fiber, STM, Schema.Struct
- **ネットワーク**: WebSocket (制御) + WebRTC (データ転送)
- **状態管理**: STM (Software Transactional Memory)
- **並行処理**: Fiber based concurrency
- **データ検証**: Schema-based validation

## 2. アーキテクチャ設計

### 2.1 システム構成図

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client A      │    │   Client B      │    │   Client C      │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │Prediction   │ │    │ │Prediction   │ │    │ │Prediction   │ │
│ │Engine       │ │    │ │Engine       │ │    │ │Engine       │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │State Sync   │ │    │ │State Sync   │ │    │ │State Sync   │ │
│ │Manager      │ │    │ │Manager      │ │    │ │Manager      │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │          WebSocket/WebRTC                     │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────┐
│                     Server     │                                │
│                                │                                │
│ ┌─────────────┐ ┌──────────────┼──────────────┐ ┌─────────────┐ │
│ │Room Manager │ │   Authority  │  Validation  │ │Game State   │ │
│ │             │ │   System     │  Layer       │ │Manager      │ │
│ │- Room Logic │ │              │              │ │             │ │
│ │- Player Mgmt│ │- Action Auth │- Input Valid │ │- World State│ │
│ │- Load Balance│ │- Rollback   │- Rate Limit  │ │- Player Data│ │
│ └─────────────┘ │- Reconcile   │- Anti-cheat  │ │- Entity Sync│ │
│                 └──────────────┼──────────────┘ └─────────────┘ │
│                                │                                │
│ ┌─────────────────────────────┼─────────────────────────────┐  │
│ │          Network Layer       │                             │  │
│ │                              │                             │  │
│ │ ┌─────────────┐ ┌───────────┼───────────┐ ┌─────────────┐ │  │
│ │ │WebSocket    │ │  WebRTC   │ P2P Relay │ │Message      │ │  │
│ │ │Control      │ │  Data     │ Fallback  │ │Broadcasting │ │  │
│ │ │Channel      │ │  Channel  │           │ │System       │ │  │
│ │ └─────────────┘ └───────────┼───────────┘ └─────────────┘ │  │
│ └─────────────────────────────┼─────────────────────────────┘  │
└────────────────────────────────┼────────────────────────────────┘
```

### 2.2 ネットワーク層設計

#### 2.2.1 デュアルプロトコル実装

```typescript
// ネットワーク接続タイプ定義
const ConnectionType = Schema.Struct({
  _tag: Schema.Literal("ConnectionType"),
  protocol: Schema.Union(
    Schema.Literal("WebSocket"),
    Schema.Literal("WebRTC")
  ),
  priority: Schema.Number,
  reliability: Schema.Boolean
})

type ConnectionType = Schema.Schema.Type<typeof ConnectionType>

// メッセージ種別定義
type NetworkMessage =
  | { readonly _tag: "Control"; readonly data: ControlMessage }
  | { readonly _tag: "GameData"; readonly data: GameDataMessage }
  | { readonly _tag: "StateSync"; readonly data: StateSyncMessage }

const NetworkMessage = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("Control"),
    data: ControlMessage
  }),
  Schema.Struct({
    _tag: Schema.Literal("GameData"),
    data: GameDataMessage
  }),
  Schema.Struct({
    _tag: Schema.Literal("StateSync"),
    data: StateSyncMessage
  })
)
```

#### 2.2.2 ネットワークサービス実装

```typescript
interface NetworkServiceInterface {
  readonly sendMessage: (
    playerId: string,
    message: NetworkMessage
  ) => Effect.Effect<void, NetworkError>

  readonly broadcastToRoom: (
    roomId: string,
    message: NetworkMessage,
    excludePlayer?: string
  ) => Effect.Effect<void, NetworkError>

  readonly createConnection: (
    playerId: string,
    connectionType: ConnectionType
  ) => Effect.Effect<Connection, NetworkError>
}

const NetworkService = Context.GenericTag<NetworkServiceInterface>("@multiplayer/NetworkService")

const makeNetworkServiceLive = Effect.gen(function* () {
  const websocketPool = yield* WebSocketPool
  const webrtcManager = yield* WebRTCManager

  return NetworkService.of({
    sendMessage: (playerId, message) =>
      Effect.gen(function* () {
        const connection = yield* findConnection(playerId)

        return yield* Match.value(message).pipe(
          Match.tag("Control", ({ data }) =>
            sendViaWebSocket(connection, data)
          ),
          Match.tag("GameData", ({ data }) =>
            sendViaWebRTC(connection, data)
          ),
          Match.tag("StateSync", ({ data }) =>
            sendViaBestRoute(connection, data)
          ),
          Match.exhaustive
        )
      }),

    broadcastToRoom: (roomId, message, excludePlayer) =>
      Effect.gen(function* () {
        const room = yield* getRoomById(roomId)
        const players = excludePlayer
          ? room.players.filter(p => p.id !== excludePlayer)
          : room.players

        yield* Effect.forEach(
          players,
          player => sendMessage(player.id, message),
          { concurrency: "unbounded" }
        )
      }),

    createConnection: (playerId, connectionType) =>
      Match.value(connectionType.protocol).pipe(
        Match.when("WebSocket", () => createWebSocketConnection(playerId)),
        Match.when("WebRTC", () => createWebRTCConnection(playerId)),
        Match.exhaustive
      )
  })
})

const NetworkServiceLive = Layer.effect(NetworkService, makeNetworkServiceLive)
```

### 2.3 同期システム設計

#### 2.3.1 状態同期メカニズム

```typescript
// 同期可能状態の定義
const SyncableState = Schema.Struct({
  _tag: Schema.Literal("SyncableState"),
  version: Schema.Number,
  timestamp: Schema.Number,
  checksum: Schema.String,
  data: Schema.Unknown
})

type SyncableState = Schema.Schema.Type<typeof SyncableState>

// 状態差分定義
type StateDiff =
  | { readonly _tag: "PlayerUpdate"; readonly playerId: string; readonly changes: PlayerChanges }
  | { readonly _tag: "WorldUpdate"; readonly chunkId: string; readonly changes: WorldChanges }
  | { readonly _tag: "EntityUpdate"; readonly entityId: string; readonly changes: EntityChanges }

// STMベースの状態管理
interface StateSyncManagerInterface {
  readonly syncPlayerState: (
    playerId: string,
    state: PlayerState
  ) => Effect.Effect<void, SyncError>

  readonly getWorldState: (
    chunkId: string
  ) => Effect.Effect<WorldState, SyncError>

  readonly applyStateDiff: (
    diff: StateDiff
  ) => Effect.Effect<void, SyncError>
}

const StateSyncManager = Context.GenericTag<StateSyncManagerInterface>("@multiplayer/StateSyncManager")

const makeStateSyncManagerLive = Effect.gen(function* () {
  // STMベースの共有状態
  const playerStates = yield* STM.map.make<string, PlayerState>()
  const worldStates = yield* STM.map.make<string, WorldState>()
  const entityStates = yield* STM.map.make<string, EntityState>()

  return StateSyncManager.of({
    syncPlayerState: (playerId, state) =>
      STM.map.set(playerStates, playerId, state).pipe(
        STM.commit,
        Effect.tap(() => broadcastStateDiff({
          _tag: "PlayerUpdate",
          playerId,
          changes: calculatePlayerChanges(state)
        }))
      ),

    getWorldState: (chunkId) =>
      STM.map.get(worldStates, chunkId).pipe(
        STM.commit,
        Effect.flatMap(Option.match({
          onNone: () => Effect.fail(createSyncError("Chunk not found", chunkId)),
          onSome: Effect.succeed
        }))
      ),

    applyStateDiff: (diff) =>
      Match.value(diff).pipe(
        Match.tag("PlayerUpdate", ({ playerId, changes }) =>
          STM.gen(function* () {
            const currentState = yield* STM.map.get(playerStates, playerId)
            const newState = yield* Option.match(currentState, {
              onNone: () => STM.fail(createSyncError("Player not found", playerId)),
              onSome: (state) => STM.succeed(applyPlayerChanges(state, changes))
            })
            yield* STM.map.set(playerStates, playerId, newState)
          }).pipe(STM.commit)
        ),
        Match.tag("WorldUpdate", ({ chunkId, changes }) =>
          STM.gen(function* () {
            const currentState = yield* STM.map.get(worldStates, chunkId)
            const newState = yield* Option.match(currentState, {
              onNone: () => STM.fail(createSyncError("Chunk not found", chunkId)),
              onSome: (state) => STM.succeed(applyWorldChanges(state, changes))
            })
            yield* STM.map.set(worldStates, chunkId, newState)
          }).pipe(STM.commit)
        ),
        Match.tag("EntityUpdate", ({ entityId, changes }) =>
          STM.gen(function* () {
            const currentState = yield* STM.map.get(entityStates, entityId)
            const newState = yield* Option.match(currentState, {
              onNone: () => STM.fail(createSyncError("Entity not found", entityId)),
              onSome: (state) => STM.succeed(applyEntityChanges(state, changes))
            })
            yield* STM.map.set(entityStates, entityId, newState)
          }).pipe(STM.commit)
        ),
        Match.exhaustive
      )
  })
})
```

## 3. クライアント・サーバー実装

### 3.1 クライアント側予測システム

```typescript
// クライアント予測エンジン
interface PredictionEngineInterface {
  readonly predictPlayerMovement: (
    input: PlayerInput,
    currentState: PlayerState
  ) => Effect.Effect<PlayerState, PredictionError>

  readonly rollbackToState: (
    timestamp: number
  ) => Effect.Effect<void, PredictionError>

  readonly reconcileWithServer: (
    serverState: PlayerState,
    timestamp: number
  ) => Effect.Effect<void, PredictionError>
}

const PredictionEngine = Context.GenericTag<PredictionEngineInterface>("@client/PredictionEngine")

const makePredictionEngineLive = Effect.gen(function* () {
  // 予測履歴の管理
  const predictionHistory = yield* Ref.make<Map<number, PlayerState>>(new Map())
  const pendingInputs = yield* Ref.make<Map<number, PlayerInput>>(new Map())

  return PredictionEngine.of({
    predictPlayerMovement: (input, currentState) =>
      Effect.gen(function* () {
        // 入力の即座な適用
        const predictedState = applyMovementPhysics(currentState, input)

        // 予測履歴に記録
        const timestamp = Date.now()
        yield* Ref.update(predictionHistory, map =>
          map.set(timestamp, predictedState)
        )
        yield* Ref.update(pendingInputs, map =>
          map.set(timestamp, input)
        )

        // サーバーに送信
        yield* sendInputToServer(input, timestamp)

        return predictedState
      }),

    rollbackToState: (timestamp) =>
      Effect.gen(function* () {
        const history = yield* Ref.get(predictionHistory)
        const targetState = history.get(timestamp)

        if (!targetState) {
          return yield* Effect.fail(createPredictionError("State not found", timestamp))
        }

        // ロールバック実行
        yield* restoreGameState(targetState)

        // その後の予測を再適用
        const pendingInputsMap = yield* Ref.get(pendingInputs)
        const futureInputs = Array.from(pendingInputsMap.entries())
          .filter(([ts]) => ts > timestamp)
          .sort(([a], [b]) => a - b)

        yield* Effect.forEach(
          futureInputs,
          ([ts, input]) => reapplyPrediction(input, ts),
          { concurrency: 1 }
        )
      }),

    reconcileWithServer: (serverState, timestamp) =>
      Effect.gen(function* () {
        const history = yield* Ref.get(predictionHistory)
        const clientState = history.get(timestamp)

        if (!clientState) return

        // サーバーとクライアント状態の比較
        const discrepancy = calculateStateDiscrepancy(clientState, serverState)

        if (discrepancy > ACCEPTABLE_DISCREPANCY_THRESHOLD) {
          // 大きな差異がある場合はロールバック
          yield* rollbackToState(timestamp)
          yield* forceUpdateState(serverState)
        }

        // 古い履歴をクリーンアップ
        yield* Ref.update(predictionHistory, map => {
          const newMap = new Map(map)
          for (const [ts] of map) {
            if (ts < timestamp - HISTORY_RETENTION_TIME) {
              newMap.delete(ts)
            }
          }
          return newMap
        })
      })
  })
})
```

### 3.2 サーバー側権威システム

```typescript
// サーバー権威エンジン
interface AuthorityEngineInterface {
  readonly validatePlayerInput: (
    playerId: string,
    input: PlayerInput,
    timestamp: number
  ) => Effect.Effect<ValidationResult, ValidationError>

  readonly processPlayerAction: (
    playerId: string,
    action: PlayerAction
  ) => Effect.Effect<ActionResult, ActionError>

  readonly detectCheatAttempt: (
    playerId: string,
    suspiciousAction: PlayerAction
  ) => Effect.Effect<CheatDetectionResult, CheatDetectionError>
}

const AuthorityEngine = Context.GenericTag<AuthorityEngineInterface>("@server/AuthorityEngine")

const makeAuthorityEngineLive = Effect.gen(function* () {
  const playerStates = yield* STM.map.make<string, PlayerState>()
  const cheatDetector = yield* CheatDetector
  const rateLimit = yield* RateLimiter

  return AuthorityEngine.of({
    validatePlayerInput: (playerId, input, timestamp) =>
      Effect.gen(function* () {
        // レート制限チェック
        const rateLimitOk = yield* rateLimit.checkPlayer(playerId)
        if (!rateLimitOk) {
          return yield* Effect.fail(createValidationError("Rate limit exceeded", playerId))
        }

        // 入力の基本検証
        const basicValidation = validateInputBasics(input)
        if (!basicValidation.isValid) {
          return yield* Effect.fail(createValidationError(basicValidation.error, playerId))
        }

        // 物理的制約チェック
        const currentState = yield* STM.map.get(playerStates, playerId).pipe(STM.commit)
        const physicsValid = yield* Option.match(currentState, {
          onNone: () => Effect.fail(createValidationError("Player state not found", playerId)),
          onSome: (state) => Effect.succeed(validatePhysicsConstraints(state, input))
        })

        if (!physicsValid.isValid) {
          // チート検知の可能性
          yield* cheatDetector.reportSuspiciousActivity(playerId, input)
          return yield* Effect.fail(createValidationError(physicsValid.error, playerId))
        }

        return { isValid: true, timestamp }
      }),

    processPlayerAction: (playerId, action) =>
      Effect.gen(function* () {
        // アクション種別による処理分岐
        return yield* Match.value(action).pipe(
          Match.tag("Move", ({ direction, velocity }) =>
            Effect.gen(function* () {
              const validation = yield* validatePlayerInput(playerId, { direction, velocity }, Date.now())

              if (!validation.isValid) {
                return yield* Effect.fail(createActionError("Invalid movement", playerId))
              }

              // STMでの原子的状態更新
              const newState = yield* STM.gen(function* () {
                const currentState = yield* STM.map.get(playerStates, playerId)
                const updated = yield* Option.match(currentState, {
                  onNone: () => STM.fail(createActionError("Player not found", playerId)),
                  onSome: (state) => {
                    const newPos = calculateNewPosition(state.position, direction, velocity)
                    const updatedState = { ...state, position: newPos, velocity }
                    return STM.succeed(updatedState)
                  }
                })
                yield* STM.map.set(playerStates, playerId, updated)
                return updated
              }).pipe(STM.commit)

              // 他のプレイヤーに同期
              yield* broadcastPlayerUpdate(playerId, newState)

              return { success: true, newState }
            })
          ),
          Match.tag("PlaceBlock", ({ position, blockType }) =>
            Effect.gen(function* () {
              // ブロック設置権限チェック
              const hasPermission = yield* checkBuildPermission(playerId, position)
              if (!hasPermission) {
                return yield* Effect.fail(createActionError("No build permission", playerId))
              }

              // ワールド状態への反映
              yield* updateWorldState(position, blockType)
              yield* broadcastWorldUpdate(position, blockType)

              return { success: true, position, blockType }
            })
          ),
          Match.exhaustive
        )
      }),

    detectCheatAttempt: (playerId, suspiciousAction) =>
      cheatDetector.analyze(playerId, suspiciousAction)
  })
})
```

## 4. 状態同期メカニズム

### 4.1 リアルタイム状態同期

```typescript
// 状態同期ストリーム
const createStateSyncStream = (roomId: string): Stream.Stream<StateDiff, SyncError> =>
  Stream.make(
    // プレイヤー状態変更の監視
    Stream.fromSTM(
      STM.map.values(playerStates).pipe(
        STM.map(players => Array.from(players.entries()).map(([id, state]) => ({
          _tag: "PlayerUpdate" as const,
          playerId: id,
          changes: state
        })))
      )
    ),

    // ワールド状態変更の監視
    Stream.fromSTM(
      STM.map.values(worldStates).pipe(
        STM.map(chunks => Array.from(chunks.entries()).map(([id, state]) => ({
          _tag: "WorldUpdate" as const,
          chunkId: id,
          changes: state
        })))
      )
    ),

    // エンティティ状態変更の監視
    Stream.fromSTM(
      STM.map.values(entityStates).pipe(
        STM.map(entities => Array.from(entities.entries()).map(([id, state]) => ({
          _tag: "EntityUpdate" as const,
          entityId: id,
          changes: state
        })))
      )
    )
  ).pipe(
    Stream.merge,
    Stream.debounce("16 millis"), // 60 FPS制限
    Stream.filter(diff => isRelevantToRoom(diff, roomId))
  )

// 状態同期の配信
const startStateSyncBroadcast = (roomId: string): Effect.Effect<void, SyncError> =>
  Effect.gen(function* () {
    const room = yield* getRoomById(roomId)
    const syncStream = createStateSyncStream(roomId)

    yield* Stream.runForeach(
      syncStream,
      (diff) => Effect.gen(function* () {
        const relevantPlayers = getPlayersAffectedByDiff(room.players, diff)

        yield* Effect.forEach(
          relevantPlayers,
          player => sendStateDiff(player.id, diff),
          { concurrency: 10 }
        )
      })
    ).pipe(
      Effect.forkDaemon
    )
  })
```

### 4.2 差分ベース同期

```typescript
// 状態差分計算
const calculateStateDiff = (oldState: GameState, newState: GameState): StateDiff[] => {
  const diffs: StateDiff[] = []

  // プレイヤー状態の差分
  for (const [playerId, newPlayerState] of newState.players) {
    const oldPlayerState = oldState.players.get(playerId)
    if (!oldPlayerState || !deepEqual(oldPlayerState, newPlayerState)) {
      diffs.push({
        _tag: "PlayerUpdate",
        playerId,
        changes: calculatePlayerDiff(oldPlayerState, newPlayerState)
      })
    }
  }

  // ワールド状態の差分
  for (const [chunkId, newChunkState] of newState.world) {
    const oldChunkState = oldState.world.get(chunkId)
    if (!oldChunkState || !deepEqual(oldChunkState, newChunkState)) {
      diffs.push({
        _tag: "WorldUpdate",
        chunkId,
        changes: calculateWorldDiff(oldChunkState, newChunkState)
      })
    }
  }

  return diffs
}

// 効率的な差分適用
const applyStateDiffs = (
  currentState: GameState,
  diffs: StateDiff[]
): Effect.Effect<GameState, SyncError> =>
  STM.gen(function* () {
    let workingState = currentState

    for (const diff of diffs) {
      workingState = yield* Match.value(diff).pipe(
        Match.tag("PlayerUpdate", ({ playerId, changes }) => {
          const updatedPlayers = new Map(workingState.players)
          const currentPlayer = updatedPlayers.get(playerId)

          if (currentPlayer) {
            updatedPlayers.set(playerId, applyPlayerChanges(currentPlayer, changes))
          }

          return STM.succeed({ ...workingState, players: updatedPlayers })
        }),
        Match.tag("WorldUpdate", ({ chunkId, changes }) => {
          const updatedWorld = new Map(workingState.world)
          const currentChunk = updatedWorld.get(chunkId)

          if (currentChunk) {
            updatedWorld.set(chunkId, applyWorldChanges(currentChunk, changes))
          }

          return STM.succeed({ ...workingState, world: updatedWorld })
        }),
        Match.exhaustive
      )
    }

    return workingState
  }).pipe(STM.commit)
```

## 5. セキュリティ・チート対策

### 5.1 サーバーサイド検証システム

```typescript
// チート検知パターン
type CheatPattern =
  | { readonly _tag: "SpeedHack"; readonly maxSpeed: number; readonly detectedSpeed: number }
  | { readonly _tag: "Teleport"; readonly maxDistance: number; readonly detectedDistance: number }
  | { readonly _tag: "NoClip"; readonly invalidPosition: Position }
  | { readonly _tag: "DuplicateItem"; readonly itemId: string; readonly duplicateCount: number }

// チート検知システム
interface CheatDetectorInterface {
  readonly analyzeMovement: (
    playerId: string,
    movement: MovementData
  ) => Effect.Effect<CheatDetectionResult, CheatDetectionError>

  readonly checkInventoryIntegrity: (
    playerId: string,
    inventory: Inventory
  ) => Effect.Effect<boolean, CheatDetectionError>

  readonly validateBlockPlacement: (
    playerId: string,
    position: Position,
    blockType: BlockType
  ) => Effect.Effect<boolean, CheatDetectionError>
}

const CheatDetector = Context.GenericTag<CheatDetectorInterface>("@security/CheatDetector")

const makeCheatDetectorLive = Effect.gen(function* () {
  const suspicionLevels = yield* Ref.make<Map<string, number>>(new Map())
  const recentActions = yield* Ref.make<Map<string, TimestampedAction[]>>(new Map())

  return CheatDetector.of({
    analyzeMovement: (playerId, movement) =>
      Effect.gen(function* () {
        const playerHistory = yield* getPlayerHistory(playerId)
        const lastPosition = playerHistory.positions[playerHistory.positions.length - 1]

        if (!lastPosition) {
          return { isCheat: false, confidence: 0 }
        }

        const timeDiff = movement.timestamp - lastPosition.timestamp
        const distance = calculateDistance(lastPosition.position, movement.position)
        const speed = distance / (timeDiff / 1000)

        // 物理的制約チェック
        const violations: CheatPattern[] = []

        // スピードハックチェック
        if (speed > MAX_PLAYER_SPEED) {
          violations.push({
            _tag: "SpeedHack",
            maxSpeed: MAX_PLAYER_SPEED,
            detectedSpeed: speed
          })
        }

        // テレポートチェック
        if (distance > MAX_SINGLE_MOVE_DISTANCE) {
          violations.push({
            _tag: "Teleport",
            maxDistance: MAX_SINGLE_MOVE_DISTANCE,
            detectedDistance: distance
          })
        }

        // NoClipチェック
        const isValidPath = yield* validateMovementPath(
          lastPosition.position,
          movement.position
        )

        if (!isValidPath) {
          violations.push({
            _tag: "NoClip",
            invalidPosition: movement.position
          })
        }

        if (violations.length > 0) {
          yield* increaseSuspicionLevel(playerId, violations.length)
          return {
            isCheat: true,
            confidence: calculateConfidence(violations),
            patterns: violations
          }
        }

        return { isCheat: false, confidence: 0 }
      }),

    checkInventoryIntegrity: (playerId, inventory) =>
      Effect.gen(function* () {
        const serverInventory = yield* getServerInventory(playerId)

        // アイテム数の整合性チェック
        for (const [itemId, clientCount] of inventory.items) {
          const serverCount = serverInventory.items.get(itemId) || 0

          if (clientCount > serverCount) {
            // アイテム複製の疑い
            yield* reportCheatAttempt(playerId, {
              _tag: "DuplicateItem",
              itemId,
              duplicateCount: clientCount - serverCount
            })
            return false
          }
        }

        return true
      }),

    validateBlockPlacement: (playerId, position, blockType) =>
      Effect.gen(function* () {
        const player = yield* getPlayerState(playerId)
        const distance = calculateDistance(player.position, position)

        // リーチ距離チェック
        if (distance > MAX_BLOCK_PLACE_DISTANCE) {
          yield* reportCheatAttempt(playerId, {
            _tag: "TeleportBlock",
            position,
            playerPosition: player.position,
            distance
          })
          return false
        }

        // 建築権限チェック
        const hasPermission = yield* checkBuildPermission(playerId, position)
        if (!hasPermission) {
          return false
        }

        // インベントリ検証
        const hasBlock = yield* checkPlayerHasBlock(playerId, blockType)
        if (!hasBlock) {
          yield* reportCheatAttempt(playerId, {
            _tag: "UnauthorizedBlock",
            blockType,
            position
          })
          return false
        }

        return true
      })
  })
})
```

### 5.2 レート制限・DoS対策

```typescript
// レート制限システム
interface RateLimiterInterface {
  readonly checkPlayerAction: (
    playerId: string,
    actionType: string
  ) => Effect.Effect<boolean, RateLimitError>

  readonly checkConnectionRate: (
    ipAddress: string
  ) => Effect.Effect<boolean, RateLimitError>

  readonly reportAbuse: (
    identifier: string,
    severity: AbuseSeverity
  ) => Effect.Effect<void, RateLimitError>
}

const RateLimiter = Context.GenericTag<RateLimiterInterface>("@security/RateLimiter")

const makeRateLimiterLive = Effect.gen(function* () {
  const actionCounts = yield* Ref.make<Map<string, ActionCounter>>(new Map())
  const connectionCounts = yield* Ref.make<Map<string, ConnectionCounter>>(new Map())

  return RateLimiter.of({
    checkPlayerAction: (playerId, actionType) =>
      Effect.gen(function* () {
        const limits = getActionLimits(actionType)
        const counter = yield* getOrCreateActionCounter(playerId, actionType)

        const now = Date.now()
        const windowStart = now - limits.windowMs

        // 古いカウントをクリーンアップ
        const recentActions = counter.timestamps.filter(ts => ts > windowStart)

        if (recentActions.length >= limits.maxActions) {
          // 制限を超過
          yield* reportAbuse(playerId, "High")
          return false
        }

        // カウンターを更新
        yield* Ref.update(actionCounts, map => {
          const updated = new Map(map)
          updated.set(`${playerId}:${actionType}`, {
            ...counter,
            timestamps: [...recentActions, now]
          })
          return updated
        })

        return true
      }),

    checkConnectionRate: (ipAddress) =>
      Effect.gen(function* () {
        const counter = yield* getOrCreateConnectionCounter(ipAddress)
        const now = Date.now()
        const recentConnections = counter.connections.filter(
          conn => now - conn.timestamp < CONNECTION_WINDOW_MS
        )

        if (recentConnections.length >= MAX_CONNECTIONS_PER_IP) {
          yield* reportAbuse(ipAddress, "Critical")
          return false
        }

        return true
      }),

    reportAbuse: (identifier, severity) =>
      Effect.gen(function* () {
        const report: AbuseReport = {
          identifier,
          severity,
          timestamp: Date.now(),
          details: {
            userAgent: getCurrentUserAgent(),
            ipAddress: getCurrentIP()
          }
        }

        yield* logSecurityEvent(report)

        // 重大な違反の場合は即座にブロック
        if (severity === "Critical") {
          yield* blockIdentifier(identifier)
        }
      })
  })
})
```

## 6. パフォーマンス最適化

### 6.1 ネットワーク最適化

```typescript
// メッセージ圧縮・バッチング
interface MessageOptimizerInterface {
  readonly compressMessage: (
    message: NetworkMessage
  ) => Effect.Effect<CompressedMessage, CompressionError>

  readonly batchMessages: (
    messages: NetworkMessage[]
  ) => Effect.Effect<BatchedMessage, BatchingError>

  readonly optimizeForConnection: (
    message: NetworkMessage,
    connectionQuality: ConnectionQuality
  ) => Effect.Effect<OptimizedMessage, OptimizationError>
}

const MessageOptimizer = Context.GenericTag<MessageOptimizerInterface>("@performance/MessageOptimizer")

const makeMessageOptimizerLive = Effect.gen(function* () {
  const compressionCache = yield* Ref.make<Map<string, CompressedMessage>>(new Map())

  return MessageOptimizer.of({
    compressMessage: (message) =>
      Effect.gen(function* () {
        const messageHash = calculateMessageHash(message)
        const cached = yield* Ref.get(compressionCache).pipe(
          Effect.map(cache => cache.get(messageHash))
        )

        if (cached) {
          return cached
        }

        const compressed = yield* Match.value(message).pipe(
          Match.tag("GameData", ({ data }) => {
            // ゲームデータは積極的に圧縮
            return compressWithDelta(data)
          }),
          Match.tag("StateSync", ({ data }) => {
            // 状態同期は差分圧縮
            return compressWithStateDiff(data)
          }),
          Match.tag("Control", ({ data }) => {
            // 制御メッセージは軽い圧縮
            return compressWithMinimal(data)
          }),
          Match.exhaustive
        )

        // キャッシュに保存
        yield* Ref.update(compressionCache, cache =>
          cache.set(messageHash, compressed)
        )

        return compressed
      }),

    batchMessages: (messages) =>
      Effect.gen(function* () {
        // メッセージ種別でグループ化
        const grouped = groupMessagesByType(messages)
        const batches: BatchedMessage[] = []

        for (const [messageType, typeMessages] of grouped) {
          if (typeMessages.length >= BATCH_MIN_SIZE) {
            const batch = yield* createBatch(messageType, typeMessages)
            batches.push(batch)
          } else {
            // バッチサイズ未満は個別送信
            batches.push(...typeMessages.map(createIndividualMessage))
          }
        }

        return mergeBatches(batches)
      }),

    optimizeForConnection: (message, connectionQuality) =>
      Match.value(connectionQuality.type).pipe(
        Match.when("HighLatency", () =>
          prioritizeReliability(message).pipe(
            Effect.flatMap(optimizeForLatency)
          )
        ),
        Match.when("LowBandwidth", () =>
          maximizeCompression(message).pipe(
            Effect.flatMap(reducePayloadSize)
          )
        ),
        Match.when("Unstable", () =>
          addRedundancy(message).pipe(
            Effect.flatMap(enableRetransmission)
          )
        ),
        Match.when("Optimal", () =>
          Effect.succeed(message)
        ),
        Match.exhaustive
      )
  })
})
```

### 6.2 空間パーティション最適化

```typescript
// 空間分割による同期最適化
interface SpatialPartitionInterface {
  readonly getRelevantPlayers: (
    position: Position,
    radius: number
  ) => Effect.Effect<string[], PartitionError>

  readonly updatePlayerPosition: (
    playerId: string,
    position: Position
  ) => Effect.Effect<void, PartitionError>

  readonly getVisibleChunks: (
    playerId: string
  ) => Effect.Effect<string[], PartitionError>
}

const SpatialPartition = Context.GenericTag<SpatialPartitionInterface>("@performance/SpatialPartition")

const makeSpatialPartitionLive = Effect.gen(function* () {
  // 空間ハッシュテーブル
  const spatialGrid = yield* Ref.make<Map<string, Set<string>>>(new Map())
  const playerPositions = yield* Ref.make<Map<string, Position>>(new Map())

  const hashPosition = (position: Position): string => {
    const gridX = Math.floor(position.x / GRID_CELL_SIZE)
    const gridY = Math.floor(position.y / GRID_CELL_SIZE)
    const gridZ = Math.floor(position.z / GRID_CELL_SIZE)
    return `${gridX}:${gridY}:${gridZ}`
  }

  return SpatialPartition.of({
    getRelevantPlayers: (position, radius) =>
      Effect.gen(function* () {
        const relevantCells = calculateRelevantCells(position, radius)
        const grid = yield* Ref.get(spatialGrid)

        const relevantPlayers = new Set<string>()

        for (const cellHash of relevantCells) {
          const playersInCell = grid.get(cellHash)
          if (playersInCell) {
            for (const playerId of playersInCell) {
              relevantPlayers.add(playerId)
            }
          }
        }

        return Array.from(relevantPlayers)
      }),

    updatePlayerPosition: (playerId, position) =>
      Effect.gen(function* () {
        const oldPositions = yield* Ref.get(playerPositions)
        const oldPosition = oldPositions.get(playerId)
        const newCellHash = hashPosition(position)

        // 古いセルから削除
        if (oldPosition) {
          const oldCellHash = hashPosition(oldPosition)
          if (oldCellHash !== newCellHash) {
            yield* Ref.update(spatialGrid, grid => {
              const updated = new Map(grid)
              const oldCell = updated.get(oldCellHash)
              if (oldCell) {
                const newOldCell = new Set(oldCell)
                newOldCell.delete(playerId)
                if (newOldCell.size === 0) {
                  updated.delete(oldCellHash)
                } else {
                  updated.set(oldCellHash, newOldCell)
                }
              }
              return updated
            })
          }
        }

        // 新しいセルに追加
        yield* Ref.update(spatialGrid, grid => {
          const updated = new Map(grid)
          const currentCell = updated.get(newCellHash) || new Set()
          updated.set(newCellHash, new Set([...currentCell, playerId]))
          return updated
        })

        // プレイヤー位置を更新
        yield* Ref.update(playerPositions, positions =>
          new Map(positions).set(playerId, position)
        )
      }),

    getVisibleChunks: (playerId) =>
      Effect.gen(function* () {
        const positions = yield* Ref.get(playerPositions)
        const playerPosition = positions.get(playerId)

        if (!playerPosition) {
          return yield* Effect.fail(createPartitionError("Player not found", playerId))
        }

        const visibleChunks: string[] = []
        const viewDistance = PLAYER_VIEW_DISTANCE

        for (let x = -viewDistance; x <= viewDistance; x++) {
          for (let z = -viewDistance; z <= viewDistance; z++) {
            const chunkX = Math.floor(playerPosition.x / CHUNK_SIZE) + x
            const chunkZ = Math.floor(playerPosition.z / CHUNK_SIZE) + z
            const chunkId = `${chunkX}:${chunkZ}`
            visibleChunks.push(chunkId)
          }
        }

        return visibleChunks
      })
  })
})
```

## 7. テスト戦略

### 7.1 ネットワーク統合テスト

```typescript
// ネットワーク遅延シミュレーション
const createNetworkSimulator = (config: NetworkSimConfig) =>
  Effect.gen(function* () {
    const latency = config.latency || 0
    const packetLoss = config.packetLoss || 0
    const jitter = config.jitter || 0

    return {
      simulateMessage: <A>(message: A): Effect.Effect<A, NetworkError> =>
        Effect.gen(function* () {
          // パケットロスシミュレーション
          if (Math.random() < packetLoss) {
            return yield* Effect.fail(createNetworkError("Packet lost"))
          }

          // 遅延シミュレーション
          const actualLatency = latency + (Math.random() * jitter)
          yield* Effect.sleep(`${actualLatency} millis`)

          return message
        }),

      simulateConnectionQuality: (): ConnectionQuality => ({
        type: latency > 200 ? "HighLatency" :
              packetLoss > 0.01 ? "Unstable" :
              "Optimal",
        latency,
        packetLoss,
        bandwidth: calculateBandwidth(config)
      })
    }
  })

// マルチプレイヤーシナリオテスト
const testMultiplayerScenario = (scenario: TestScenario) =>
  Effect.gen(function* () {
    const simulator = yield* createNetworkSimulator(scenario.networkConfig)
    const players = yield* Effect.forEach(
      scenario.players,
      playerConfig => createTestPlayer(playerConfig),
      { concurrency: "unbounded" }
    )

    // 並行プレイヤーアクション実行
    yield* Effect.forEach(
      scenario.actions,
      action => executePlayerAction(action, simulator),
      { concurrency: scenario.concurrency }
    )

    // 結果検証
    const finalStates = yield* Effect.forEach(
      players,
      player => getPlayerFinalState(player.id)
    )

    return validateScenarioOutcome(scenario.expectedOutcome, finalStates)
  })
```

### 7.2 チート検知テスト

```typescript
// チート検知システムのテスト
const testCheatDetection = Effect.gen(function* () {
  const cheatDetector = yield* CheatDetector

  // スピードハックテスト
  const speedHackTest = yield* Effect.gen(function* () {
    const playerId = "test-player-1"
    const suspiciousMovement = {
      position: { x: 1000, y: 64, z: 1000 },
      timestamp: Date.now(),
      velocity: { x: 100, y: 0, z: 0 } // 異常に高速
    }

    const result = yield* cheatDetector.analyzeMovement(playerId, suspiciousMovement)

    expect(result.isCheat).toBe(true)
    expect(result.patterns).toContain("SpeedHack")
  })

  // テレポートハックテスト
  const teleportTest = yield* Effect.gen(function* () {
    const playerId = "test-player-2"

    // 正常な位置設定
    yield* setPlayerPosition(playerId, { x: 0, y: 64, z: 0 })
    yield* Effect.sleep("100 millis")

    // 異常な瞬間移動
    const teleportMovement = {
      position: { x: 1000, y: 64, z: 1000 },
      timestamp: Date.now()
    }

    const result = yield* cheatDetector.analyzeMovement(playerId, teleportMovement)

    expect(result.isCheat).toBe(true)
    expect(result.patterns).toContain("Teleport")
  })

  yield* speedHackTest
  yield* teleportTest
})

// PBTによるランダム入力テスト
const propertyBasedNetworkTest = Effect.gen(function* () {
  const playerInputArbitrary = fc.record({
    direction: fc.record({
      x: fc.float({ min: -1, max: 1 }),
      y: fc.float({ min: -1, max: 1 }),
      z: fc.float({ min: -1, max: 1 })
    }),
    velocity: fc.float({ min: 0, max: 10 }),
    timestamp: fc.nat()
  })

  yield* Effect.fromPromise(() =>
    fc.assert(
      fc.property(
        fc.array(playerInputArbitrary, { minLength: 1, maxLength: 100 }),
        (inputs) => {
          return Effect.gen(function* () {
            const playerId = generateTestPlayerId()
            let isValid = true

            for (const input of inputs) {
              const result = yield* validatePlayerInput(playerId, input, input.timestamp)
              if (!result.isValid && !isExpectedInvalid(input)) {
                isValid = false
                break
              }
            }

            return isValid
          }).pipe(Effect.runSync)
        }
      )
    )
  )
})
```

### 7.3 パフォーマンステスト

```typescript
// 大規模同時接続テスト
const testMassiveMultiplayer = (playerCount: number) =>
  Effect.gen(function* () {
    const startTime = Date.now()

    // 大量のプレイヤーを同時接続
    const players = yield* Effect.forEach(
      Array.from({ length: playerCount }, (_, i) => `player-${i}`),
      playerId => connectPlayer(playerId),
      { concurrency: 50 } // 接続の並行度制限
    )

    const connectionTime = Date.now() - startTime
    console.log(`${playerCount} players connected in ${connectionTime}ms`)

    // 同時アクション実行
    const actionStartTime = Date.now()

    yield* Effect.forEach(
      players,
      player => simulatePlayerActivity(player.id, 1000), // 1秒間活動
      { concurrency: "unbounded" }
    )

    const actionTime = Date.now() - actionStartTime
    console.log(`Player actions completed in ${actionTime}ms`)

    // メモリ使用量確認
    const memoryUsage = process.memoryUsage()
    console.log(`Memory usage: ${memoryUsage.heapUsed / 1024 / 1024}MB`)

    // 接続解除
    yield* Effect.forEach(
      players,
      player => disconnectPlayer(player.id),
      { concurrency: 50 }
    )

    // パフォーマンス評価
    return {
      playerCount,
      connectionTime,
      actionTime,
      memoryUsage: memoryUsage.heapUsed,
      avgLatency: calculateAverageLatency(),
      throughput: calculateThroughput()
    }
  })

// ネットワーク負荷テスト
const testNetworkLoad = Effect.gen(function* () {
  const messageVolumes = [100, 500, 1000, 5000, 10000]
  const results: LoadTestResult[] = []

  for (const volume of messageVolumes) {
    const result = yield* Effect.gen(function* () {
      const startTime = Date.now()

      yield* Effect.forEach(
        Array.from({ length: volume }, (_, i) => createTestMessage(i)),
        message => sendMessage(message),
        { concurrency: 100 }
      )

      const endTime = Date.now()
      const duration = endTime - startTime

      return {
        messageCount: volume,
        duration,
        messagesPerSecond: volume / (duration / 1000),
        networkErrors: getNetworkErrorCount()
      }
    })

    results.push(result)

    // テスト間のクールダウン
    yield* Effect.sleep("5 seconds")
  }

  return results
})
```

この設計書は、Effect-TS 3.17+の最新パターンを活用したマルチプレイヤーアーキテクチャの包括的な実装指針を提供します。STMによる状態管理、Fiberベースの並行処理、Streamによるリアルタイム同期など、関数型プログラミングの利点を最大限活用した設計となっています。