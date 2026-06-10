---
title: 'Phase 03 - Game Loop + Simple World'
description: 'ゲームループと平坦なワールドの実装'
phase: 3
estimated_duration: '4日間'
difficulty: 'intermediate'
---

# Phase 03 - Game Loop + Simple World

## 目標
アニメーションするゲームループと平坦なワールドを実装する。プレイヤーエンティティとカメラ追従を追加する。

## ✅ 受け入れ条件（画面で確認）

### 視覚的出力
- [x] シーンがアニメーションしている（レンダリングループ）
- [x] カメラがプレイヤーを追従している
- [x] 平坦な地形（地面）が表示されている

### 機能的検証
- [x] プレイヤー位置がレンダリングループで更新される
- [x] GameStateServiceが正しく動作している
- [x] デルタ時間計算が正確である

## 📝 タスク

### Day 1: プレイヤードメインモデル

#### プレイヤーエンティティ
- [x] `src/domain/player.ts` の作成
  - [x] `PlayerIdSchema`（共通カーネルから使用）
  - [x] `Player` エンティティ定義
    - [x] position: Position (x, y, z)
    - [x] velocity: Vector3
    - [x] rotation: Quaternion
  - [x] `PlayerService = Context.GenericTag<PlayerService>('@minecraft/PlayerService')`

#### ワールド集約
- [x] `src/domain/world.ts` の作成
  - [x] `World` 集約ルート定義
  - [x] `WorldIdSchema`（共通カーネルから使用）
  - [x] ブロックストレージ（最初はシンプルなMap）
  - [x] `WorldService = Context.GenericTag<WorldService>('@minecraft/WorldService')`

### Day 2: ゲームループ実装

#### GameStateService
- [x] `src/rendering/services.ts` の作成/更新
  - [x] `GameState` 型定義
    ```typescript
    type GameState = {
      playerPosition: Position
      blocks: Block[]
      lastFrameTime: number
      deltaTime: number
    }
    ```
  - [x] Refを使ったステート管理
    ```typescript
    const gameStateRef = yield* Ref.make<GameState>(initialState)
    ```

#### レンダリングループ
- [x] ゲームループの実装（Effect.genを使用）
  ```typescript
  const gameLoop = Effect.gen(function* () {
    while (true) {
      const now = yield* Clock.currentTimeMillis
      const deltaTime = now - lastFrameTime
      yield* update(deltaTime)
      yield* render()
      yield* Effect.sleep(16) // ~60 FPS
    }
  })
  ```

#### デルタ時間計算
- [x] 正確なデルタ時間計算の実装
- [x] デルタ時間の補間（可変フレームレート対応）

### Day 3: 平坦な地形生成

#### シンプルな地形生成
- [x] `src/rendering/terrain/flat.ts` の作成
  - [x] 平坦な地面の生成
  - [x] チャンク概念の導入（簡易版）
  - [x] 地面ブロックの配置（y=0）

#### ワールドへのブロック追加
- [x] WorldServiceを通じたブロック追加メソッド
  - [x] `addBlock(position, blockType)`
  - [x] `removeBlock(position)`
  - [x] `getBlock(position)`

#### シーンの更新
- [x] レンダリングループでのシーン更新
  - [x] ワールドデータからブロックメッシュを更新
  - [x] プレイヤー位置の反映

### Day 4: カメラ追従とスムーズ化

#### カメラ追従
- [x] `src/rendering/camera.ts` の更新
  - [x] プレイヤー位置にカメラを追従
  - [x] スムーズな補間（Lerp）
  - [x] FPC（ファーストパーソンカメラ）視点の準備

#### アニメーションの最適化
- [x] 不要な再レンダリングの削減
- [x] デルタ時間に基づく更新
- [x] フレームレートの安定化

#### テスト
- [x] `src/domain/player.test.ts` の作成
  - [x] プレイヤーエンティティのテスト
- [x] `src/domain/world.test.ts` の作成
  - [x] ワールドブロック操作のテスト
- [x] `src/rendering/services.test.ts` の作成
  - [x] ゲームループのテスト
  - [x] デルタ時間計算のテスト

#### 最終検証
- [x] プレイヤーが自動で動く（テスト用コード）
- [x] カメラがプレイヤーを追従する
- [x] スムーズなアニメーション（60 FPS付近）
- [x] すべてのテストが成功

## 🎯 成功基準
- アニメーションするシーンが表示される
- Effect-TSのRefパターンでステート管理ができている
- プレイヤー位置とカメラが正しく連動している
- 平坦な地形が表示されている

## 📊 依存関係
- Phase 02: Visual Foundation - Three.js

## 🔗 関連ドキュメント
- [Phase 02](./02-visual-foundation.md)
- Effect-TS Ref（effect.website 参照）
- ゲームループの実装（ドキュメント未作成）
