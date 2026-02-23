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
- [ ] 左クリックでブロックを破壊できる
- [ ] 右クリックでブロックを配置できる
- [ ] 配置するブロックの種類を選択できる（1-9キー）

### 視覚的フィードバック
- [ ] ブロック破壊時にアニメーションまたは即時消去
- [ ] ブロック配置時に即時表示
- [ ] ワールドが正しく更新される

### UI要素
- [ ] ホットバー（アイテム選択）が表示される
- [ ] 現在選択中のブロックがハイライトされる
- [ ] 十字線が表示されている

## 📝 タスク

### Day 1: BlockService実装

#### BlockService
- [ ] `src/domain/services.ts` の作成/更新
  - [ ] `BlockService = Context.GenericTag<BlockService>('@minecraft/BlockService')`

#### ブロック配置ロジック
- [ ] `placeBlock(position, blockType)` メソッド
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
- [ ] `breakBlock(position)` メソッド
  - [ ] 位置の有効性チェック
  - [ ] ブロックの存在チェック
  - [ ] 距離チェック
  - [ ] ブロック削除

#### レイキャストとの統合
- [ ] 左クリック: レイキャスト先のブロックを破壊
- [ ] 右クリック: レイキャスト先のブロックの隣に配置
- [ ] 法線ベクトルを使って配置面を決定

### Day 2: ホットバーUI

#### ホットバー実装
- [ ] `src/presentation/hotbar.ts` の作成
  - [ ] 9スロットのホットバー表示
  - [ ] 各スロットにブロックタイプを表示
  - [ ] 現在選択中のスロットのハイライト

#### ブロック選択
- [ ] 1-9キーでスロット選択
- [ ] 選択状態の管理（Ref）
- [ ] 選択中ブロックタイプの取得

#### ホットバーUI
- [ ] HTML/CSSオーバーレイの作成
  - [ ] 画面下部中央に配置
  - [ ] スロットの視覚的表現
  - [ ] 選択ハイライト

### Day 3: 完成とテスト

#### マウスハンドラー
- [ ] `src/input/handlers.ts` の作成
  - [ ] 左クリックハンドラー（ブロック破壊）
  - [ ] 右クリックハンドラー（ブロック配置）
  - [ ] クリックのデバウンス

#### エラーハンドリング
- [ ] 位置エラー（無効な位置）の処理
- [ ] 距離エラー（遠すぎる）の処理
- [ ] ユーザーフレンドリーなエラーメッセージ（オプション）

#### 効果音（オプション）
- [ ] 破壊音の再生
- [ ] 配置音の再生
- [ ] 音声APIの統合

#### テスト
- [ ] `src/domain/services.test.ts` の作成
  - [ ] BlockServiceの配置/破壊テスト
  - [ ] エラーケースのテスト
- [ ] `src/input/handlers.test.ts` の作成
  - [ ] マウスハンドラーのテスト

#### 最終検証
- [ ] 左クリックでブロックを破壊できる
- [ ] 右クリックでブロックを配置できる
- [ ] 1-9キーでブロック種類を変えられる
- [ ] ホットバーが正しく表示されている
- [ ] ワールドが即座に更新される
- [ ] コンソールにエラーがない
- [ ] すべてのテストが成功

## 🎯 成功基準
- **コアゲームプレイ実装**: ブロックの配置と破壊ができる
- ホットバーでブロックを選択できる
- Effect-TSパターンでエラーハンドリングが実装されている
- ユーザーの操作に対して即座にフィードバックがある

## 📊 依存関係
- Phase 04: Input + Physics Lite

## 🔗 関連ドキュメント
- [Phase 04](./04-input-physics.md)
- [ブロック操作](../docs/explanations/game-mechanics/core-features/block-operations.md)
- [Effect-TSエラー処理](https://effect.website/docs/core/effect/error-handling)
