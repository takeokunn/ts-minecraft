---
title: 'Phase 16 - Redstone'
description: 'レッドストーン回路と部品'
phase: 16
estimated_duration: '6日間'
difficulty: 'advanced'
---

# Phase 16 - Redstone

## 目標
レッドストーン回路システムを実装する。レッドストーンコンポーネント、信号伝播、レッドストーンティックを追加する。

## ✅ 受け入れ条件（画面で確認）

### レッドストーン部品
- [x] レッドストーンを配置できる
- [x] レッドストーントーチが動作する（ON/OFF）
- [x] レバーが切り替えられる
- [x] ボタンを押せる
- [x] ピストンが動作する

### 信号伝播
- [x] レッドストーンが信号を伝える
- [x] 信号の強度（0-15）が正しい
- [x] 信号の距離制限がある

### 回路
- [x] 簡単な論理回路（NOT、AND、OR）が作れる
- [x] パルス回路が動作する

## 📝 タスク

### Day 1-2: レッドストーン基盤

#### レッドストーン定義
- [x] `src/redstone/redstone.ts` の作成
  - [x] `RedstoneBlock` 型定義
    ```typescript
    type RedstoneBlock = {
      position: Position
      power: number // 0-15
      source: Option<Position> // 信号源
    }
    ```
  - [x] `RedstoneService = Context.GenericTag<RedstoneService>('@minecraft/RedstoneService')`

#### 信号伝播ロジック
- [x] 隣接ブロックへの信号伝播
  ```typescript
  const propagateSignal = (source: Position, power: number) =>
    Effect.gen(function* () {
      const neighbors = getNeighbors(source)
      for (const neighbor of neighbors) {
        if (isRedstoneWire(neighbor)) {
          yield* setRedstonePower(neighbor, power - 1)
          yield* propagateSignal(neighbor, power - 1)
        }
      }
    })
  ```
- [x] 信号強度の減衰（距離で1ずつ減る）

#### レッドストーンティック
- [x] レッドストーン更新ループ（10ティック/秒）
- [x] 信号伝播の遅延

### Day 3: コンポーネント実装

#### レッドストーントーチ
- [x] ブロック定義
- [x] 信号ONで発光
- [x] 隣接ブロックの信号検出

#### レバー
- [x] 交互可能なスイッチ
- [x] ONで15の信号
- [x] OFFで0の信号

#### ボタン
- [x] 押し可能なスイッチ
- [x] 押している間は15の信号
- [x] リリースで0の信号

### Day 4: ピストンと繰り返し

#### ピストン
- [x] `src/redstone/piston.ts` の作成
  - [x] ピストンの定義（向き、粘着）
  - [x] プッシュ/プル動作
  ```typescript
  const extendPiston = (position: Position) =>
    Effect.gen(function* () {
      const direction = getPistonDirection(position)
      const blocksAhead = getBlocksInLine(position, direction, 1)
      yield* moveBlocks(blocksAhead, direction)
      yield* setPistonState(position, 'extended')
    })
  ```

#### 粘着ピストン
- [x] ブロックを保持して移動
- [x] ブロックを戻すとリリース

### Day 5: 高度な部品

#### リピーター
- [x] 信号の反復（IN → OUT）
- [x] 信号遅延（1ティック）
- [x] 信号強化（IN → OUTで強度維持）

#### 比較器
- [x] 2つの入力の比較
- [x] 大きい信号が出力
- [x] インジケーター（ランプ）

#### Tフリップフロップ
- [x] SET/RESET入力
- [x] 状態保持（ON/OFF）

### Day 6: 統合とテスト

#### レッドストーンワールド
- [x] レッドストーンブロックの追加
- [x] 各種コンポーネントの追加
- [x] 信号伝播の最適化

#### UI
- [x] レッドストーン強度の可視化（オプション）
- [x] 信号線の表示（デバッグモード）

#### テスト
- [x] `src/redstone/redstone.test.ts` の作成
  - [x] 信号伝播
  - [x] 強度減衰
- [x] `src/redstone/piston.test.ts` の作成
  - [x] ピストン動作
  - [x] ブロック移動
- [x] `src/redstone/components.test.ts` の作成
  - [x] 各コンポーネントの動作

#### 最終検証
- [x] レッドストーンが信号を伝える
- [x] レバー/ボタン/トーチが動作する
- [x] ピストンが動作する
- [x] 簡単な回路が作れる
- [x] 30 FPS以上
- [x] すべてのテストが成功

## 🎯 成功基準
- レッドストーンシステムが実装されている
- 主要なコンポーネントが動作している
- 信号伝播が正確である
- 簡単な回路が構築できる

## 📊 依存関係
- Phase 15: Villages and Trading

## 🔗 関連ドキュメント
- [Phase 15](./15-villages.md)
- レッドストーンシステム（ドキュメント未作成）
