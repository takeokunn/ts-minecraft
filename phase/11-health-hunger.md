---
title: 'Phase 11 - Health and Hunger'
description: '体力・空腹システムと食料'
phase: 11
estimated_duration: '3日間'
difficulty: 'beginner'
---

# Phase 11 - Health and Hunger

## 目標
体力と空腹システムを実装する。食料アイテム、回復メカニクス、死亡処理を追加する。

## ✅ 受け入れ条件（画面で確認）

### HUD表示
- [x] 体力バーが表示されている（ハート）
- [x] 空腹バーが表示されている（ドロップ）
- [x] HP回復時のアニメーションがある

### 機能的検証
- [x] ダメージを受けると体力が減る
- [x] 時間経過で空腹が進む
- [x] 食料を食べると空腹が回復する
- [x] 食料で体力が回復する

### 死亡
- [x] 体力ゼロで死亡する
- [x] 画面が暗くなる/死亡メッセージ
- [x] リスポーン処理が動作する

## 📝 タスク

### Day 1: 体力システム

#### 体力定義
- [x] `src/domain/health.ts` の作成
  - [x] `Health` 型定義
    ```typescript
    type Health = {
      current: number
      max: number
    }
    ```
  - [x] `HealthService = Context.GenericTag<HealthService>('@minecraft/HealthService')`

#### 体力管理
- [x] `takeDamage(amount)` メソッド
  - [x] ダメージの適用
  - [x] 0以下のチェック
  - [x] ダメージイベントの発火
- [x] `heal(amount)` メソッド
  - [x] 回復量の適用
  - [x] 最大値の上限
  - [x] 回復イベントの発火

#### 体力HUD
- [x] `src/presentation/healthHUD.ts` の作成
  - [x] ハートの表示（10個）
  - [x] 満タン/空タンの区別
  - [x] ダメージ時のアニメーション

### Day 2: 空腹システム

#### 空腹定義
- [x] `src/domain/hunger.ts` の作成
  - [x] `Hunger` 型定義
    ```typescript
    type Hunger = {
      current: number
      max: number
    }
    ```
  - [x] `HungerService = Context.GenericTag<HungerService>('@minecraft/HungerService')`

#### 空腹進行
- [x] 時間経過による空腹進行
  ```typescript
  const tickHunger = (deltaTime: number) =>
    Ref.update(hungerRef, h => ({
      ...h,
      current: Math.max(0, h.current - deltaTime * HUNGER_RATE)
    }))
  ```
- [x] 空腹による体力ダメージ（空腹ゼロで体力減少）

#### 空腹HUD
- [x] `src/presentation/hungerHUD.ts` の作成
  - [x] 10個のドロップ表示
  - [x] 満タン/空タンの区別
  - [x] 空腹警告時の点滅

### Day 3: 食料と死亡

#### 食料アイテム
- [x] 食料タイプの追加
  - [x] リンゴ、肉、パンなど
  - [x] 食料プロパティ
    ```typescript
    type FoodProperties = {
      hungerRestore: number
      healthRestore: number
      saturation: number
    }
    ```

#### 食料消費
- [x] 右クリック長押しで食べる
- [x] 食べるアニメーション
- [x] 空腹と体力の回復
- [x] アイテムの消費

#### 死亡処理
- [x] `src/domain/death.ts` の作成
  - [x] `onDeath()` ハンドラー
  - [x] 画面暗転
  - [x] 死亡メッセージ表示
  - [x] リスポーンボタン

#### リスポーン
- [x] リスポーン位置の設定
- [x] 全回復（体力、空腹）
- [x] ワールドへの戻り

#### テスト
- [x] `src/domain/health.test.ts` の作成
  - [x] ダメージ計算
  - [x] 回復制限
- [x] `src/domain/hunger.test.ts` の作成
  - [x] 空腹進行
  - [x] 回復ロジック
- [x] `src/domain/food.test.ts` の作成
  - [x] 食料消費

#### 最終検証
- [x] 体力バーが表示されている
- [x] 空腹バーが表示されている
- [x] 時間で空腹が進む
- [x] 食料を食べると回復する
- [x] 死亡してリスポーンできる
- [x] すべてのテストが成功

## 🎯 成功基準
- 体力と空腹システムが実装されている
- HUDで状態が表示されている
- 食料による回復が動作している
- 死亡とリスポーンが機能している

## 📊 依存関係
- Phase 10: Crafting System

## 🔗 関連ドキュメント
- [Phase 10](./10-crafting.md)
- 体力・空腹システム（ドキュメント未作成）
