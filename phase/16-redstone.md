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
- [ ] レッドストーンを配置できる
- [ ] レッドストーントーチが動作する（ON/OFF）
- [ ] レバーが切り替えられる
- [ ] ボタンを押せる
- [ ] ピストンが動作する

### 信号伝播
- [ ] レッドストーンが信号を伝える
- [ ] 信号の強度（0-15）が正しい
- [ ] 信号の距離制限がある

### 回路
- [ ] 簡単な論理回路（NOT、AND、OR）が作れる
- [ ] パルス回路が動作する

## 📝 タスク

### Day 1-2: レッドストーン基盤

#### レッドストーン定義
- [ ] `src/redstone/redstone.ts` の作成
  - [ ] `RedstoneBlock` 型定義
    ```typescript
    type RedstoneBlock = {
      position: Position
      power: number // 0-15
      source: Option<Position> // 信号源
    }
    ```
  - [ ] `RedstoneService = Context.GenericTag<RedstoneService>('@minecraft/RedstoneService')`

#### 信号伝播ロジック
- [ ] 隣接ブロックへの信号伝播
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
- [ ] 信号強度の減衰（距離で1ずつ減る）

#### レッドストーンティック
- [ ] レッドストーン更新ループ（10ティック/秒）
- [ ] 信号伝播の遅延

### Day 3: コンポーネント実装

#### レッドストーントーチ
- [ ] ブロック定義
- [ ] 信号ONで発光
- [ ] 隣接ブロックの信号検出

#### レバー
- [ ] 交互可能なスイッチ
- [ ] ONで15の信号
- [ ] OFFで0の信号

#### ボタン
- [ ] 押し可能なスイッチ
- [ ] 押している間は15の信号
- [ ] リリースで0の信号

### Day 4: ピストンと繰り返し

#### ピストン
- [ ] `src/redstone/piston.ts` の作成
  - [ ] ピストンの定義（向き、粘着）
  - [ ] プッシュ/プル動作
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
- [ ] ブロックを保持して移動
- [ ] ブロックを戻すとリリース

### Day 5: 高度な部品

#### リピーター
- [ ] 信号の反復（IN → OUT）
- [ ] 信号遅延（1ティック）
- [ ] 信号強化（IN → OUTで強度維持）

#### 比較器
- [ ] 2つの入力の比較
- [ ] 大きい信号が出力
- [ ] インジケーター（ランプ）

#### Tフリップフロップ
- [ ] SET/RESET入力
- [ ] 状態保持（ON/OFF）

### Day 6: 統合とテスト

#### レッドストーンワールド
- [ ] レッドストーンブロックの追加
- [ ] 各種コンポーネントの追加
- [ ] 信号伝播の最適化

#### UI
- [ ] レッドストーン強度の可視化（オプション）
- [ ] 信号線の表示（デバッグモード）

#### テスト
- [ ] `src/redstone/redstone.test.ts` の作成
  - [ ] 信号伝播
  - [ ] 強度減衰
- [ ] `src/redstone/piston.test.ts` の作成
  - [ ] ピストン動作
  - [ ] ブロック移動
- [ ] `src/redstone/components.test.ts` の作成
  - [ ] 各コンポーネントの動作

#### 最終検証
- [ ] レッドストーンが信号を伝える
- [ ] レバー/ボタン/トーチが動作する
- [ ] ピストンが動作する
- [ ] 簡単な回路が作れる
- [ ] 30 FPS以上
- [ ] すべてのテストが成功

## 🎯 成功基準
- レッドストーンシステムが実装されている
- 主要なコンポーネントが動作している
- 信号伝播が正確である
- 簡単な回路が構築できる

## 📊 依存関係
- Phase 15: Villages and Trading

## 🔗 関連ドキュメント
- [Phase 15](./15-villages.md)
- [レッドストーンシステム](../docs/explanations/game-mechanics/core-features/redstone.md)
