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

## ✅ 受け入れ条件（画面で確認）

### サーバー
- [ ] サーバーが起動する
- [ ] WebSocketサーバーが接続を受け付ける
- [ ] プレイヤー管理ができる

### クライアント
- [ ] サーバーに接続できる
- [ ] 接続状態が表示される
- [ ] 切断時の再接続

### メッセージ
- [ ] メッセージの送受信ができる
- [ ] メッセージ型が定義されている
- [ ] シリアライズ/デシリアライズが動作している

## 📝 タスク

### Day 1: メッセージプロトコル

#### メッセージ定義
- [ ] `src/network/protocol.ts` の作成
  - [ ] `MessageType` enum
    - [ ] PlayerJoin（プレイヤー参加）
    - [ ] PlayerLeave（プレイヤー退出）
    - [ ] PlayerMove（プレイヤー移動）
    - [ ] BlockPlace（ブロック配置）
    - [ ] BlockBreak（ブロック破壊）
    - [ ] Chat（チャット）

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
- [ ] JSONまたはMessagePackによるシリアライズ
- [ ] 型安全なデシリアライズ
  ```typescript
  const deserialize = <T>(buffer: ArrayBuffer): Message<T> => {
    const json = JSON.parse(new TextDecoder().decode(buffer))
    return Schema.decodeUnknown(MessageSchema(json))
  }
  ```

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
- [ ] `src/network/protocol.test.ts` の作成
  - [ ] メッセージ定義
  - [ ] シリアライズ/デシリアライズ
- [ ] `src/server/handlers.test.ts` の作成
  - [ ] サーバーハンドラー
- [ ] `src/client/handlers.test.ts` の作成
  - [ ] クライアントハンドラー

#### 最終検証
- [ ] サーバーが起動する
- [ ] クライアントが接続できる
- [ ] メッセージの送受信ができる
- [ ] 接続中のプレイヤー管理ができる
- [ ] すべてのテストが成功

## 🎯 成功基準
- WebSocketサーバーが実装されている
- WebSocketクライアントが実装されている
- メッセージプロトコルが定義されている
- サーバー/クライアントが通信できる

## 📊 依存関係
- Phase 18: The End

## 🔗 関連ドキュメント
- [Phase 18](./18-end.md)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
