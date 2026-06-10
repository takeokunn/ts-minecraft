---
title: 'Phase 20 - Multiplayer Features'
description: 'マルチプレイヤー機能の完全実装'
phase: 20
estimated_duration: '6日間'
difficulty: 'advanced'
---

# Phase 20 - Multiplayer Features

> **実装状況 (2026-06-09)**: Phase 20 は進行中。基盤は完了（protocol + transport + service）だが、アプリ統合・リモートプレイヤー表示・チャット UI は未実装。
> - ✅ **ネットワーク基盤**: `packages/network/` — 35 tests、全9メッセージ型、ブラウザ/Node WebSocket アダプター、サーバー/クライアントサービス
> - ✅ **マルチプレイヤーサービス**: `packages/app/application/multiplayer/multiplayer-service.ts` — Effect Tag + Layer、状態管理、inbound/outbound 委譲
> - ✅ **フレームステージ**: `packages/app/application/frame/stages/multiplayer-stage.ts` — 位置同期送信
> - ✅ **接続UI**: `packages/presentation/multiplayer/connection-panel.ts` — 6 tests、DOM ベース
> - ✅ **リモートプレイヤーレンダラー**: `packages/rendering/infrastructure/player/remote-player-renderer.ts` — 6 tests、Three.js Group 管理
> - ✅ **フレーム統合点**: `FrameHandlerServices.multiplayer` + `frame-stage-executor.ts` 配線済み。ただし `session.ts` で `Option.none()`（デフォルト無効）。有効化には `Option.some(MultiplayerServiceLive(client))` への変更が必要。
> - ⏳ **チャット UI**: T キー開閉、メッセージ履歴、送信 UI
> - ⏳ **他プレイヤー表示**: remote-player-renderer の実 camera/scene への接続
> - ⏳ **E2E テスト**: 2ブラウザ Playwright マルチプレイヤーシナリオ

## 目標
完全なマルチプレイヤー体験を実装する。プレイヤースポーン、チャット、同期、モブ同期を追加する。

## ✅ 受け入れ条件（画面で確認）

### マルチプレイヤー
- [ ] 他プレイヤーが表示される
- [ ] 他プレイヤーの動きが同期されている
- [ ] 他プレイヤーの名前が見える

### チャット
- [ ] Tキーでチャットが開く
- [ ] メッセージを送信できる
- [ ] 他プレイヤーのメッセージが見える

### 同期
- [ ] ブロックの配置/破壊が同期される
- [ ] モブの位置が同期されている
- [ ] プレイヤー間のラグ補間がされている

## 📝 タスク

### Day 1-2: プレイヤースポーン

#### サーバー側
- [ ] プレイヤースポーンロジック
  ```typescript
  const spawnPlayer = (playerId: PlayerId, position: Position) =>
    Effect.gen(function* () {
      const spawnPoint = findSafeSpawnPoint(position)
      const player = createPlayerEntity(spawnPoint)
      yield* addEntity(player)
      yield* broadcast({
        type: MessageType.PlayerJoin,
        data: { playerId, position: player.position }
      })
    })
  ```
- [ ] 初期インベントリの付与

#### クライアント側
- [ ] 他プレイヤーのレンダリング
  - [ ] プレイヤーのメッシュ
  - [ ] 名前タグの表示
- [ ] 他プレイヤーのアニメーション
  - [ ] 歩行
  - [ ] 手の振り

### Day 3-4: チャットシステム

#### サーバー側
- [ ] `src/server/chat.ts` の作成
  - [ ] `ChatService = Context.GenericTag<ChatService>('@minecraft/ChatService')`
  - [ ] チャットメッセージのブロードキャスト
  ```typescript
  const sendChat = (playerId: PlayerId, message: string) =>
    Effect.gen(function* () {
      const chatMessage = {
        type: MessageType.Chat,
        data: { playerId, message, timestamp: Date.now() }
      }
      yield* broadcast(chatMessage)
    })
  ```

#### クライアント側
- [ ] `src/client/chat.ts` の作成
  - [ ] チャットUIの実装
    - [ ] メッセージ履歴
    - [ ] 入力欄
    - [ ] 送信ボタン
  - [ ] Tキーで開閉

#### チャット機能
- [ ] プレイヤー名の色分け
- [ ] メッセージの制限（文字数、フィルタ）
- [ ] /コマンド（オプション）
  - [ ] /op - オペレーター権限
  - [ ] /kick - プレイヤー追放
  - [ ] /tp - テレポート

### Day 5: 完全な同期

#### 位置同期
- [ ] プレイヤー位置の定期送信
  ```typescript
  const syncPosition = (playerId: PlayerId) =>
    Effect.gen(function* () {
      while (true) {
        const position = yield* getPlayerPosition(playerId)
        yield* sendMessage({
          type: MessageType.PlayerMove,
          data: { playerId, position }
        })
        yield* Effect.sleep(50) // 20回/秒
      }
    })
  ```
- [ ] クライアント側の補間
  - [ ] スムーズな移動
  - [ ] ラグ補償

#### ブロック同期
- [ ] BlockPlace/Breakの即時同期
- [ ] クライアントでの予測（オプション）
- [ ] 衝突時の修正

#### モブ同期
- [ ] モブ位置のブロードキャスト
- [ ] クライアントでのモブ補間
- [ ] サーバー認証のモブアクション

### Day 6: 完成とテスト

#### サーバー完成
- [ ] 設定ファイルの完全化
  - [ ] ポート番号
  - [ ] 最大プレイヤー数
  - [ ] ワールド設定
- [ ] ロギングの追加
- [ ] パフォーマンスモニタリング

#### クライアント完成
- [ ] 接続UIの完成
  - [ ] サーバーURL入力
  - [ ] プレイヤー名入力
  - [ ] 接続ボタン
- [ ] ロビー画面（オプション）

#### 負荷テスト
- [ ] 複数プレイヤーのテスト
- [ ] メッセージ量の計測
- [ ] 同期精度の確認

#### テスト
- [ ] `src/server/multiplayer.test.ts` の作成
  - [ ] プレイヤースポーン
  - [ ] チャット
- [ ] `src/client/multiplayer.test.ts` の作成
  - [ ] 位置同期
  - [ ] ブロック同期

#### 最終検証
- [ ] サーバーに接続できる
- [ ] 他プレイヤーが表示される
- [ ] 他プレイヤーの動きが滑らか
- [ ] Tキーでチャットが開く
- [ ] メッセージを送受信できる
- [ ] ブロック操作が同期される
- [ ] 30 FPS以上
- [ ] すべてのテストが成功

## 🎯 成功基準
- 完全なマルチプレイヤーが実装されている
- プレイヤースポーンが機能している
- チャットシステムが動作している
- 位置、ブロック、モブが同期されている

## 📊 依存関係
- Phase 19: Network Architecture

## 🔗 関連ドキュメント
- [Phase 19](./19-network-architecture.md)
- ネットワーク同期 — 未実装（v1.1 計画中、ドキュメント未作成）

---

## 📈 v1.1 マルチプレイヤー（開発中）

v1.0 シングルプレイヤーは Phase 1-18 で完了しました。Phase 19-20 は v1.1 マルチプレイヤーとして開発中です。

**総期間: 約95日間（約3ヶ月）で v1.0 シングルプレイヤー完成**

### v1.0 達成マイルストーン

| フェーズ | 日数 | マイルストーン |
|---------|------|--------------|
| 02 | 6 | **初めての3Dブロック** 🎨 |
| 05 | 17 | **ブロック配置・破壊** 🧱 |
| 07 | 25 | **完全なMVP** 🎮 |
| 13 | 52 | **モブシステム** 👾 |
| 16 | 80 | **レッドストーン** 🔴 |
| 17 | 84 | **ネザー次元** 🔥 |
| 18 | 89 | **エンド次元** 🐉 |

### v1.1 マイルストーン（開発中）

| フェーズ | 日数 | マイルストーン |
|---------|------|--------------|
| 20 | 95 | **マルチプレイヤー基盤**（統合開発中） 🌐 |

### 実装された機能

**コア機能:**
- ✅ Three.jsレンダリング
- ✅ プレイヤー移動
- ✅ ブロック操作
- ✅ チャンクシステム
- ✅ 地形生成
- ✅ 物理システム

**ゲーム機能:**
- ✅ インベントリシステム
- ✅ クラフトシステム
- ✅ 体力・空腹
- ✅ 戦闘システム
- ✅ モブとAI
- ✅ 村と取引
- ✅ 効果音と音楽

**拡張機能:**
- ✅ レッドストーン回路
- ✅ ネザー次元
- ✅ エンド次元
- ⏳ マルチプレイヤー（v1.1 開発中、基盤完了・統合未了）

**技術的達成:**
- ✅ Effect-TSパターン全適用
- ✅ DDDアーキテクチャャ
- ✅ 関数型プログラミング
- ✅ TypeScript厳格モード
- ✅ 高パフォーマンス（貪欲メッシュ化、カリング）

---

**Happy Coding! 🎉✨**
