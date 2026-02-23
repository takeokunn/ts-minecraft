---
title: 'Phase 04 - Input + Physics Lite'
description: '入力処理と軽量物理システムの実装'
phase: 4
estimated_duration: '4日間'
difficulty: 'intermediate'
---

# Phase 04 - Input + Physics Lite

## 目標
キーボードとマウス入力によるプレイヤー操作と、基本的な物理（重力、衝突判定）を実装する。

## ✅ 受け入れ条件（画面で確認）

### 入力検証
- [ ] WASDキーでプレイヤーが移動する
- [ ] マウスで視点が動く（マウスルック）
- [ ] スペースキーでジャンプする

### 物理検証
- [ ] 重力が作用している（落下する）
- [ ] 衝突判定が働いている（地面をすり抜けない）
- [ ] ブロック上で止まる

### レイキャスティング
- [ ] ブロックにマウスを合わせるとハイライトされる
- [ ] 十字線が表示される

## 📝 タスク

### Day 1: 入力サービス

#### InputService
- [ ] `src/input/services.ts` の作成
  - [ ] `InputService = Context.GenericTag<InputService>('@minecraft/InputService')`
  - [ ] キーボード状態の管理（Ref with Set）
  - [ ] マウス状態の管理

#### イベントハンドラー
- [ ] キーボードイベントリスナー
  ```typescript
  window.addEventListener('keydown', ...)
  window.addEventListener('keyup', ...)
  ```
- [ ] マウスイベントリスナー
  ```typescript
  window.addEventListener('mousemove', ...)
  window.addEventListener('mousedown', ...)
  window.addEventListener('mouseup', ...)
  ```

#### 入力クエリ
- [ ] `isPressed(key: string)` - キーが押されているか
- [ ] `getMouseDelta()` - マウス移動量
- [ ] `isMouseDown()` - マウスボタンの状態

### Day 2: WASD移動

#### プレイヤー移動ロジック
- [ ] `src/player/movement.ts` の作成
  - [ ] WASD入力を速度ベクトルに変換
  - [ ] 方向キーによる移動
  - [ ] 前後左右の移動計算

#### カメラマウスルック
- [ ] `src/rendering/camera.ts` の更新
  - [ ] マウス移動によるカメラ回転
  - [ ] ヨーとピッチの制限
  - [ ] カメラの向き計算

#### 移動の統合
- [ ] ゲームループでの移動更新
- [ ] プレイヤー速度の位置への適用
- [ ] カメラ位置のプレイヤーへの追従

### Day 3: 重力と衝突判定

#### 重力システム
- [ ] `src/physics/gravity.ts` の作成
  - [ ] 一定の下向き加速度
  - [ ] 速度への重力の適用
  - [ ] ジャンプ時の初期上向き速度

#### AABB衝突判定
- [ ] `src/physics/collision.ts` の作成
  - [ ] Axis-Aligned Bounding Box実装
  - [ ] プレイヤーとブロックの衝突検出
  - [ ] 衝突応答（位置修正）

#### ジャンプ機構
- [ ] 地面検出（接地判定）
- [ ] 接地時のみジャンプ可能
- [ ] ジャンプボタンで上方向の速度

#### 物理の統合
- [ ] ゲームループでの物理更新
- [ ] 位置更新前に衝突チェック
- [ ] 地面に着地時の速度クリア

### Day 4: レイキャスティングとUI

#### 3Dレイキャスティング
- [ ] `src/physics/raycasting.ts` の作成
  - [ ] カメラ位置からのレイ生成
  - [ ] ブロックとの交差検出
  - [ ] 交差点と法線の計算

#### ブロック選択
- [ ] マウスカーソル下のブロックの特定
- [ ] 選択ブロックのハイライト表示

#### HUD要素
- [ ] 十字線の表示
  - [ ] CSSオーバーレイまたはThree.jsスプライト
  - [ ] 画面中央に配置

#### テスト
- [ ] `src/input/services.test.ts` の作成
  - [ ] 入力状態管理のテスト
- [ ] `src/physics/gravity.test.ts` の作成
  - [ ] 重力計算のテスト
- [ ] `src/physics/collision.test.ts` の作成
  - [ ] AABB衝突判定のテスト
- [ ] `src/physics/raycasting.test.ts` の作成
  - [ ] レイキャストのテスト

#### 最終検証
- [ ] WASDで移動できる
- [ ] スペースでジャンプできる
- [ ] 重力で地面に落ちる
- [ ] ブロックを通り抜けない
- [ ] ブロックにマウスを合わせるとハイライトされる
- [ ] 十字線が表示される
- [ ] すべてのテストが成功

## 🎯 成功基準
- WASDとマウスでプレイヤーを操作できる
- 重力と衝突判定が正しく動作している
- レイキャスティングでブロックを選択できる
- Effect-TSパターンで入力と物理が実装されている

## 📊 依存関係
- Phase 03: Game Loop + Simple World

## 🔗 関連ドキュメント
- [Phase 03](./03-game-loop.md)
- [物理システム](../docs/explanations/game-mechanics/core-features/physics.md)
- [AABB衝突判定](../docs/explanations/game-mechanics/core-features/collision-detection.md)
