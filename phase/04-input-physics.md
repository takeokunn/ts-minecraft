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
- [x] WASDキーでプレイヤーが移動する
- [x] マウスで視点が動く（マウスルック）
- [x] スペースキーでジャンプする

### 物理検証
- [x] 重力が作用している（落下する）
- [x] 衝突判定が働いている（地面をすり抜けない）
- [x] ブロック上で止まる

### レイキャスティング
- [x] ブロックにマウスを合わせるとハイライトされる
- [x] 十字線が表示される

## 📝 タスク

### Day 1: 入力サービス

#### InputService
- [x] `src/input/services.ts` の作成
  - [x] `InputService = Context.GenericTag<InputService>('@minecraft/InputService')`
  - [x] キーボード状態の管理（Ref with Set）
  - [x] マウス状態の管理

#### イベントハンドラー
- [x] キーボードイベントリスナー
  ```typescript
  window.addEventListener('keydown', ...)
  window.addEventListener('keyup', ...)
  ```
- [x] マウスイベントリスナー
  ```typescript
  window.addEventListener('mousemove', ...)
  window.addEventListener('mousedown', ...)
  window.addEventListener('mouseup', ...)
  ```

#### 入力クエリ
- [x] `isPressed(key: string)` - キーが押されているか
- [x] `getMouseDelta()` - マウス移動量
- [x] `isMouseDown()` - マウスボタンの状態

### Day 2: WASD移動

#### プレイヤー移動ロジック
- [x] `src/player/movement.ts` の作成
  - [x] WASD入力を速度ベクトルに変換
  - [x] 方向キーによる移動
  - [x] 前後左右の移動計算

#### カメラマウスルック
- [x] `src/rendering/camera.ts` の更新
  - [x] マウス移動によるカメラ回転
  - [x] ヨーとピッチの制限
  - [x] カメラの向き計算

#### 移動の統合
- [x] ゲームループでの移動更新
- [x] プレイヤー速度の位置への適用
- [x] カメラ位置のプレイヤーへの追従

### Day 3: 重力と衝突判定

#### 重力システム
- [x] `src/physics/gravity.ts` の作成
  - [x] 一定の下向き加速度
  - [x] 速度への重力の適用
  - [x] ジャンプ時の初期上向き速度

#### AABB衝突判定
- [x] `src/physics/collision.ts` の作成
  - [x] Axis-Aligned Bounding Box実装
  - [x] プレイヤーとブロックの衝突検出
  - [x] 衝突応答（位置修正）

#### ジャンプ機構
- [x] 地面検出（接地判定）
- [x] 接地時のみジャンプ可能
- [x] ジャンプボタンで上方向の速度

#### 物理の統合
- [x] ゲームループでの物理更新
- [x] 位置更新前に衝突チェック
- [x] 地面に着地時の速度クリア

### Day 4: レイキャスティングとUI

#### 3Dレイキャスティング
- [x] `src/physics/raycasting.ts` の作成
  - [x] カメラ位置からのレイ生成
  - [x] ブロックとの交差検出
  - [x] 交差点と法線の計算

#### ブロック選択
- [x] マウスカーソル下のブロックの特定
- [x] 選択ブロックのハイライト表示

#### HUD要素
- [x] 十字線の表示
  - [x] CSSオーバーレイまたはThree.jsスプライト
  - [x] 画面中央に配置

#### テスト
- [x] `src/input/services.test.ts` の作成
  - [x] 入力状態管理のテスト
- [x] `src/physics/gravity.test.ts` の作成
  - [x] 重力計算のテスト
- [x] `src/physics/collision.test.ts` の作成
  - [x] AABB衝突判定のテスト
- [x] `src/physics/raycasting.test.ts` の作成
  - [x] レイキャストのテスト

#### 最終検証
- [x] WASDで移動できる
- [x] スペースでジャンプできる
- [x] 重力で地面に落ちる
- [x] ブロックを通り抜けない
- [x] ブロックにマウスを合わせるとハイライトされる
- [x] 十字線が表示される
- [x] すべてのテストが成功

## 🎯 成功基準
- WASDとマウスでプレイヤーを操作できる
- 重力と衝突判定が正しく動作している
- レイキャスティングでブロックを選択できる
- Effect-TSパターンで入力と物理が実装されている

## 📊 依存関係
- Phase 03: Game Loop + Simple World

## 🔗 関連ドキュメント
- [Phase 03](./03-game-loop.md)
- 物理システム（ドキュメント未作成）
- AABB衝突判定（ドキュメント未作成）
