---
title: 'Phase 19 - Network Architecture'
description: 'サーバー/クライアントアーキテクチャャ'
phase: 19
estimated_duration: '5日間'
difficulty: 'advanced'
---

# Phase 19 - Network Architecture

## 目標
マルチプレイヤーのためのネットワークアーキテクチャャを構築する。サーバー、クライアント、WebSocket接続、メッセージプロトコルを実装する。

> **実装状況 (2026-06-09)**: メッセージプロトコル + WebSocket トランスポート実装済み。
> - **プロトコル**: `packages/network/domain/schemas.ts`（23 tests 緑）— 全9メッセージ型、ブランド型（PlayerId/PlayerName/WorldId）、`serializeNetworkMessage`/`deserializeNetworkMessage`
> - **サーバー**: `packages/network/application/server-service.ts`（8 tests 緑）— `ServerService`（Effect.Service）、接続管理、`broadcast`/`sendToPlayer`、`handlePlayerJoin`/`Leave`/`Move`/`BlockPlace`/`BlockBreak`/`Chat`/`Ping`
> - **クライアント**: `packages/network/application/client-service.ts`（4 tests 緑、再接続テストは fake socket の制約で skip）— `ClientService`、接続状態管理（idle/connecting/connected/reconnecting/disconnected/failed）、再接続バックオフ
> - **トランスポート**: `packages/network/infrastructure/websocket-server.ts` + `websocket-client.ts` — `FakeWebSocketServer`/`FakeWebSocketClient` によるテスト用実装（実 WebSocket は未実装）
> - **未実装**: 実 WebSocket バインディング（`ws` ライブラリ or ブラウザ `WebSocket`）、接続 UI、`packages/app` への統合
> - **テスト**: `pnpm vitest run packages/network` — 35 passing / 1 skipped（再接続 deadlock は fake socket 制約、`packages/network/test/` に既知の課題として記録）

## ✅ 受け入れ条件（画面で確認）

### サーバー
- [ ] サーバーが起動する（`ServerService.start`、vitest 8 tests 緑）
- [ ] WebSocketサーバーが接続を受け付ける（`FakeWebSocketServer`、vitest 検証済み）
- [ ] プレイヤー管理ができる（`ConnectedPlayer` registry、`handlePlayerJoin`/`handlePlayerLeave`）

### クライアント
- [ ] サーバーに接続できる（`ClientService.connect`、vitest 4 tests 緑）
- [ ] 接続状態が表示される（接続 UI 未実装）
- [ ] 切断時の再接続（`reconnectLoop` + 指数バックオフ、fake socket 制約によりテストは skip）

### メッセージ
- [ ] メッセージの送受信ができる（`serializeNetworkMessage`/`deserializeNetworkMessage`、vitest 23 tests 緑）
- [ ] メッセージ型が定義されている（`packages/network/domain/schemas.ts`、全9メッセージ型 + branded ID）
- [ ] シリアライズ/デシリアライズが動作している（Schema.encode/decode、round-trip テスト済み）

## 📝 タスク

### Day 1: メッセージプロトコル

#### メッセージ定義
- [ ] `packages/network/domain/schemas.ts` の作成 (`src/network/protocol.ts` → monorepo に移動)
  - [ ] `MessageType` enum（Schema.Literal による識別）
    - [ ] PlayerJoin（プレイヤー参加）
    - [ ] PlayerLeave（プレイヤー退出）
    - [ ] PlayerMove（プレイヤー移動）
    - [ ] BlockPlace（ブロック配置）
    - [ ] BlockBreak（ブロック破壊）
    - [ ] Chat（チャット）
    - [ ] Ping / Pong（接続確認）
    - [ ] Error（エラー）

#### メッセージ構造
  ```typescript
  type Message<T> = {
    type: MessageType
    timestamp: number
    data: T
  }

  type PlayerJoinMessage = Message<{
    playerId: PlayerId
    playerName: string
    position: Position
  }>

  type PlayerMoveMessage = Message<{
    playerId: PlayerId
    position: Position
    rotation: Quaternion
  }>
  ```

#### シリアライズ
- [ ] JSONによるシリアライズ（`Schema.encode`/`Schema.decodeUnknown`使用、MessagePackは未実装）
- [ ] 型安全なデシリアライズ（`deserializeNetworkMessage` → `Either<NetworkMessage, NetworkError>`）

### Day 2: サーバー実装

#### サーバー定義
- [ ] `src/server/server.ts` の作成
  - [ ] `GameServer` 型定義
    ```typescript
    type GameServer = {
      port: number
      players: Map<PlayerId, ConnectedPlayer>
      world: World
      maxPlayers: number
    }
    ```
  - [ ] `ServerService = Context.GenericTag<ServerService>('@minecraft/ServerService')`

#### WebSocketサーバー
  ```typescript
  const startServer = (port: number) =>
    Effect.gen(function* () {
      const wsServer = yield* createWebSocketServer(port)
      wsServer.on('connection', (socket) => {
        yield* handleConnection(socket)
      })
    })
  ```

#### プレイヤー管理
- [ ] 接続プレイヤーの追加
- [ ] 退出プレイヤーの削除
- [ ] プレイヤー状態の管理
- [ ] 接続数の制限

### Day 3: クライアント実装

#### クライアント定義
- [ ] `src/client/client.ts` の作成
  - [ ] `GameClient` 型定義
    ```typescript
    type GameClient = {
      serverUrl: string
      socket: WebSocket
      playerId: Option<PlayerId>
      connectionState: ConnectionState
    }
    ```
  - [ ] `ClientService = Context.GenericTag<ClientService>('@minecraft/ClientService')`

#### WebSocketクライアント
  ```typescript
  const connectToServer = (url: string) =>
    Effect.gen(function* () {
      const socket = yield* Effect.promise(() =>
        new WebSocket(`ws://${url}`)
      )
      socket.onopen = () => yield* onConnected()
      socket.onmessage = (event) => yield* handleMessage(event)
      socket.onclose = () => yield* onDisconnected()
      return socket
    })
  ```

#### 接続管理
- [ ] 接続状態の管理（接続中、接続済、切断）
- [ ] 自動再接続ロジック
- [ ] 接続エラーのハンドリング

### Day 4: メッセージハンドリング

#### サーバーハンドラー
- [ ] `src/server/handlers.ts` の作成
  - [ ] PlayerJoinハンドラー
  - [ ] PlayerMoveハンドラー
  - [ ] BlockPlace/Breakハンドラー
- [ ] メッセージのブロードキャスト

#### クライアントハンドラー
- [ ] `src/client/handlers.ts` の作成
  - [ ] 受信メッセージの処理
  - [ ] 他プレイヤーの追加/削除
  - [ ] 他プレイヤーの更新

#### メッセージループ
  ```typescript
  const handleMessage = (socket: WebSocket, message: Message) =>
    Effect.gen(function* () {
      switch (message.type) {
        case MessageType.PlayerJoin:
          yield* handlePlayerJoin(message.data)
        case MessageType.PlayerMove:
          yield* handlePlayerMove(message.data)
        case MessageType.BlockPlace:
          yield* handleBlockPlace(message.data)
        // ... 他のメッセージ型
      }
    })
  ```

### Day 5: 統合とテスト

#### サーバー統合
- [ ] メインサーバープロセスの作成
- [ ] 設定ファイル（ポート、最大プレイヤー数）
- [ ] ワールドの管理

#### クライアント統合
- [ ] メインクライアントの作成
- [ ] サーバー接続UI
- [ ] プレイヤー名の入力

#### 補間（オプション）
- [ ] クライアント側の位置補間
  ```typescript
  const interpolatePosition = (current: Position, target: Position, alpha: number) => ({
    x: lerp(current.x, target.x, alpha),
    y: lerp(current.y, target.y, alpha),
    z: lerp(current.z, target.z, alpha)
  })
  ```

#### テスト
- [ ] `packages/network/domain/schemas.test.ts` の作成 (`src/network/protocol.test.ts` → monorepo)
  - [ ] メッセージ定義（23 tests: 全メッセージ型 round-trip, union schema, branded ID, JSON serialization, invalid schema）
  - [ ] シリアライズ/デシリアライズ（`serializeNetworkMessage`/`deserializeNetworkMessage`）
- [ ] サーバーハンドラーテスト（`packages/network/test/server-service.test.ts`、実装中）
- [ ] クライアントハンドラーテスト（`packages/network/test/client-service.test.ts`、実装中）

#### 最終検証
- [ ] サーバーが起動する（実装中）
- [ ] クライアントが接続できる（実装中）
- [ ] メッセージの送受信ができる（プロトコル層: vitest 23 tests 緑）
- [ ] 接続中のプレイヤー管理ができる（実装中）
- [ ] すべてのテストが成功（サーバー/クライアント実装後に確認）

## 🎯 成功基準
- WebSocketサーバーが実装されている（実装中）
- WebSocketクライアントが実装されている（実装中）
- [ ] メッセージプロトコルが定義されている
- サーバー/クライアントが通信できる（実装中）

## 📊 依存関係
- Phase 18: The End

## 🔗 関連ドキュメント
- [Phase 18](./18-end.md)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
