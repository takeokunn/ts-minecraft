---
title: 'Phase 05 - Block Operations'
description: 'ブロックの配置と破壊機能の実装'
phase: 5
estimated_duration: '3日間'
difficulty: 'intermediate'
---

# Phase 05 - Block Operations

## 目標
Minecraftのコアゲームプレイ機能であるブロックの配置と破壊を実装する。これにより「遊べる」状態に達する。

## ✅ 受け入れ条件（画面で確認）

### ブロック操作
- [x] 左クリックでブロックを破壊できる
- [x] 右クリックでブロックを配置できる
- [x] 配置するブロックの種類を選択できる（1-9キー）

### 視覚的フィードバック
- [x] ブロック破壊時にアニメーションまたは即時消去
- [x] ブロック配置時に即時表示
- [x] ワールドが正しく更新される

### UI要素
- [x] ホットバー（アイテム選択）が表示される
- [x] 現在選択中のブロックがハイライトされる
- [x] 十字線が表示されている

## 📝 タスク

### Day 1: BlockService実装

#### BlockService
- [x] `src/domain/services.ts` の作成/更新
  - [x] `BlockService = Context.GenericTag<BlockService>('@minecraft/BlockService')`

#### ブロック配置ロジック
- [x] `placeBlock(position, blockType)` メソッド
  ```typescript
  const placeBlock = (position: Position, blockType: BlockType) =>
    Effect.gen(function* () {
      const worldService = yield* WorldService
      const playerService = yield* PlayerService

      // 位置の有効性チェック
      const isValid = yield* worldService.isValidPosition(position)
      if (!isValid) return yield* Effect.fail(InvalidPositionError)

      // プレイヤーとの距離チェック
      const playerPos = yield* playerService.getPosition()
      const distance = calculateDistance(playerPos, position)
      if (distance > MAX_REACH) return yield* Effect.fail(TooFarError)

      // ブロック配置
      yield* worldService.setBlock(position, blockType)
      yield* updateRendering(position)
    })
  ```

#### ブロック破壊ロジック
- [x] `breakBlock(position)` メソッド
  - [x] 位置の有効性チェック
  - [x] ブロックの存在チェック
  - [x] 距離チェック
  - [x] ブロック削除

#### レイキャストとの統合
- [x] 左クリック: レイキャスト先のブロックを破壊
- [x] 右クリック: レイキャスト先のブロックの隣に配置
- [x] 法線ベクトルを使って配置面を決定

### Day 2: ホットバーUI

#### ホットバー実装
- [x] `src/presentation/hotbar.ts` の作成
  - [x] 9スロットのホットバー表示
  - [x] 各スロットにブロックタイプを表示
  - [x] 現在選択中のスロットのハイライト

#### ブロック選択
- [x] 1-9キーでスロット選択
- [x] 選択状態の管理（Ref）
- [x] 選択中ブロックタイプの取得

#### ホットバーUI
- [x] HTML/CSSオーバーレイの作成
  - [x] 画面下部中央に配置
  - [x] スロットの視覚的表現
  - [x] 選択ハイライト

### Day 3: 完成とテスト

#### マウスハンドラー
- [x] `src/input/handlers.ts` の作成
  - [x] 左クリックハンドラー（ブロック破壊）
  - [x] 右クリックハンドラー（ブロック配置）
  - [x] クリックのデバウンス

#### エラーハンドリング
- [x] 位置エラー（無効な位置）の処理
- [x] 距離エラー（遠すぎる）の処理
- [x] ユーザーフレンドリーなエラーメッセージ（オプション）

#### 効果音（オプション）
- [x] 破壊音の再生
- [x] 配置音の再生
- [x] 音声APIの統合

#### テスト
- [x] `src/domain/services.test.ts` の作成
  - [x] BlockServiceの配置/破壊テスト
  - [x] エラーケースのテスト
- [x] `src/input/handlers.test.ts` の作成
  - [x] マウスハンドラーのテスト

#### 最終検証
- [x] 左クリックでブロックを破壊できる
- [x] 右クリックでブロックを配置できる
- [x] 1-9キーでブロック種類を変えられる
- [x] ホットバーが正しく表示されている
- [x] ワールドが即座に更新される
- [x] コンソールにエラーがない
- [x] すべてのテストが成功

## 🎯 成功基準
- **コアゲームプレイ実装**: ブロックの配置と破壊ができる
- ホットバーでブロックを選択できる
- Effect-TSパターンでエラーハンドリングが実装されている
- ユーザーの操作に対して即座にフィードバックがある

## 📊 依存関係
- Phase 04: Input + Physics Lite

## 🔗 関連ドキュメント
- [Phase 04](./04-input-physics.md)
- ブロック操作（ドキュメント未作成）
- Effect-TSエラー処理（effect.website 参照）
