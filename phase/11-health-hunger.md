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
- [ ] 体力バーが表示されている（ハート）
- [ ] 空腹バーが表示されている（ドロップ）
- [ ] HP回復時のアニメーションがある

### 機能的検証
- [ ] ダメージを受けると体力が減る
- [ ] 時間経過で空腹が進む
- [ ] 食料を食べると空腹が回復する
- [ ] 食料で体力が回復する

### 死亡
- [ ] 体力ゼロで死亡する
- [ ] 画面が暗くなる/死亡メッセージ
- [ ] リスポーン処理が動作する

## 📝 タスク

### Day 1: 体力システム

#### 体力定義
- [ ] `src/domain/health.ts` の作成
  - [ ] `Health` 型定義
    ```typescript
    type Health = {
      current: number
      max: number
    }
    ```
  - [ ] `HealthService = Context.GenericTag<HealthService>('@minecraft/HealthService')`

#### 体力管理
- [ ] `takeDamage(amount)` メソッド
  - [ ] ダメージの適用
  - [ ] 0以下のチェック
  - [ ] ダメージイベントの発火
- [ ] `heal(amount)` メソッド
  - [ ] 回復量の適用
  - [ ] 最大値の上限
  - [ ] 回復イベントの発火

#### 体力HUD
- [ ] `src/presentation/healthHUD.ts` の作成
  - [ ] ハートの表示（10個）
  - [ ] 満タン/空タンの区別
  - [ ] ダメージ時のアニメーション

### Day 2: 空腹システム

#### 空腹定義
- [ ] `src/domain/hunger.ts` の作成
  - [ ] `Hunger` 型定義
    ```typescript
    type Hunger = {
      current: number
      max: number
    }
    ```
  - [ ] `HungerService = Context.GenericTag<HungerService>('@minecraft/HungerService')`

#### 空腹進行
- [ ] 時間経過による空腹進行
  ```typescript
  const tickHunger = (deltaTime: number) =>
    Ref.update(hungerRef, h => ({
      ...h,
      current: Math.max(0, h.current - deltaTime * HUNGER_RATE)
    }))
  ```
- [ ] 空腹による体力ダメージ（空腹ゼロで体力減少）

#### 空腹HUD
- [ ] `src/presentation/hungerHUD.ts` の作成
  - [ ] 10個のドロップ表示
  - [ ] 満タン/空タンの区別
  - [ ] 空腹警告時の点滅

### Day 3: 食料と死亡

#### 食料アイテム
- [ ] 食料タイプの追加
  - [ ] リンゴ、肉、パンなど
  - [ ] 食料プロパティ
    ```typescript
    type FoodProperties = {
      hungerRestore: number
      healthRestore: number
      saturation: number
    }
    ```

#### 食料消費
- [ ] 右クリック長押しで食べる
- [ ] 食べるアニメーション
- [ ] 空腹と体力の回復
- [ ] アイテムの消費

#### 死亡処理
- [ ] `src/domain/death.ts` の作成
  - [ ] `onDeath()` ハンドラー
  - [ ] 画面暗転
  - [ ] 死亡メッセージ表示
  - [ ] リスポーンボタン

#### リスポーン
- [ ] リスポーン位置の設定
- [ ] 全回復（体力、空腹）
- [ ] ワールドへの戻り

#### テスト
- [ ] `src/domain/health.test.ts` の作成
  - [ ] ダメージ計算
  - [ ] 回復制限
- [ ] `src/domain/hunger.test.ts` の作成
  - [ ] 空腹進行
  - [ ] 回復ロジック
- [ ] `src/domain/food.test.ts` の作成
  - [ ] 食料消費

#### 最終検証
- [ ] 体力バーが表示されている
- [ ] 空腹バーが表示されている
- [ ] 時間で空腹が進む
- [ ] 食料を食べると回復する
- [ ] 死亡してリスポーンできる
- [ ] すべてのテストが成功

## 🎯 成功基準
- 体力と空腹システムが実装されている
- HUDで状態が表示されている
- 食料による回復が動作している
- 死亡とリスポーンが機能している

## 📊 依存関係
- Phase 10: Crafting System

## 🔗 関連ドキュメント
- [Phase 10](./10-crafting.md)
- [体力・空腹システム](../docs/explanations/game-mechanics/core-features/health-hunger.md)
