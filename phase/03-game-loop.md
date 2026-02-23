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
- [ ] シーンがアニメーションしている（レンダリングループ）
- [ ] カメラがプレイヤーを追従している
- [ ] 平坦な地形（地面）が表示されている

### 機能的検証
- [ ] プレイヤー位置がレンダリングループで更新される
- [ ] GameStateServiceが正しく動作している
- [ ] デルタ時間計算が正確である

## 📝 タスク

### Day 1: プレイヤードメインモデル

#### プレイヤーエンティティ
- [ ] `src/domain/player.ts` の作成
  - [ ] `PlayerIdSchema`（共通カーネルから使用）
  - [ ] `Player` エンティティ定義
    - [ ] position: Position (x, y, z)
    - [ ] velocity: Vector3
    - [ ] rotation: Quaternion
  - [ ] `PlayerService = Context.GenericTag<PlayerService>('@minecraft/PlayerService')`

#### ワールド集約
- [ ] `src/domain/world.ts` の作成
  - [ ] `World` 集約ルート定義
  - [ ] `WorldIdSchema`（共通カーネルから使用）
  - [ ] ブロックストレージ（最初はシンプルなMap）
  - [ ] `WorldService = Context.GenericTag<WorldService>('@minecraft/WorldService')`

### Day 2: ゲームループ実装

#### GameStateService
- [ ] `src/rendering/services.ts` の作成/更新
  - [ ] `GameState` 型定義
    ```typescript
    type GameState = {
      playerPosition: Position
      blocks: Block[]
      lastFrameTime: number
      deltaTime: number
    }
    ```
  - [ ] Refを使ったステート管理
    ```typescript
    const gameStateRef = yield* Ref.make<GameState>(initialState)
    ```

#### レンダリングループ
- [ ] ゲームループの実装（Effect.genを使用）
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
- [ ] 正確なデルタ時間計算の実装
- [ ] デルタ時間の補間（可変フレームレート対応）

### Day 3: 平坦な地形生成

#### シンプルな地形生成
- [ ] `src/rendering/terrain/flat.ts` の作成
  - [ ] 平坦な地面の生成
  - [ ] チャンク概念の導入（簡易版）
  - [ ] 地面ブロックの配置（y=0）

#### ワールドへのブロック追加
- [ ] WorldServiceを通じたブロック追加メソッド
  - [ ] `addBlock(position, blockType)`
  - [ ] `removeBlock(position)`
  - [ ] `getBlock(position)`

#### シーンの更新
- [ ] レンダリングループでのシーン更新
  - [ ] ワールドデータからブロックメッシュを更新
  - [ ] プレイヤー位置の反映

### Day 4: カメラ追従とスムーズ化

#### カメラ追従
- [ ] `src/rendering/camera.ts` の更新
  - [ ] プレイヤー位置にカメラを追従
  - [ ] スムーズな補間（Lerp）
  - [ ] FPC（ファーストパーソンカメラ）視点の準備

#### アニメーションの最適化
- [ ] 不要な再レンダリングの削減
- [ ] デルタ時間に基づく更新
- [ ] フレームレートの安定化

#### テスト
- [ ] `src/domain/player.test.ts` の作成
  - [ ] プレイヤーエンティティのテスト
- [ ] `src/domain/world.test.ts` の作成
  - [ ] ワールドブロック操作のテスト
- [ ] `src/rendering/services.test.ts` の作成
  - [ ] ゲームループのテスト
  - [ ] デルタ時間計算のテスト

#### 最終検証
- [ ] プレイヤーが自動で動く（テスト用コード）
- [ ] カメラがプレイヤーを追従する
- [ ] スムーズなアニメーション（60 FPS付近）
- [ ] すべてのテストが成功

## 🎯 成功基準
- アニメーションするシーンが表示される
- Effect-TSのRefパターンでステート管理ができている
- プレイヤー位置とカメラが正しく連動している
- 平坦な地形が表示されている

## 📊 依存関係
- Phase 02: Visual Foundation - Three.js

## 🔗 関連ドキュメント
- [Phase 02](./02-visual-foundation.md)
- [Effect-TS Ref](https://effect.website/docs/core/ref)
- [ゲームループの実装](../docs/explanations/game-mechanics/core-features/game-loop.md)
