---
title: 'Phase 15 - Villages and Trading'
description: '村の生成と取引システム'
phase: 15
estimated_duration: '4日間'
difficulty: 'intermediate'
---

# Phase 15 - Villages and Trading

## 目標
村の生成システムと村人AI、取引システムを実装する。

## ✅ 受け入れ条件（画面で確認）

### 村生成
- [x] ワールドに村が生成されている
- [x] 家屋が建てられている
- [x] 道路がある
- [x] 井戸や畑がある

### 村人AI
- [x] 村人が動いている
- [x] 村人が仕事をしている（農業、司書）
- [x] 夜間に家に帰る

### 取引
- [x] 右クリックで取引UIが開く
- [x] エメラルドでの取引ができる
- [x] 取引レベルが上がる

## 📝 タスク

### Day 1: 村の生成

#### 村構造定義
- [x] `src/village/village.ts` の作成
  - [x] `Village` 型定義
    ```typescript
    type Village = {
      villageId: VillageId
      position: Position
      houses: House[]
      villagers: Villager[]
    }
    ```
  - [x] `House` 型定義（建物タイプ、サイズ、ドア位置）
  - [x] `VillageService = Context.GenericTag<VillageService>('@minecraft/VillageService')`

#### 家屋生成
- [x] 基本的な家屋タイプ
  - [x] 小屋（4x5x4）
  - [x] 家（7x7x6）
  - [x] 店
- [x] 家屋のランダム配置
- [x] ドアと窓の生成

#### 道路生成
- [x] 家屋間の道路
- [x] 砂利ブロック
- [x] 幅2の道

#### 村の施設
- [x] 井戸（水源）
- [x] 畑（耕地、作物）
- [x] 掲示板（オプション）

### Day 2: 村人AI

#### 村人定義
- [x] `src/village/villager.ts` の作成
  - [x] `Villager` 型定義
    ```typescript
    type Villager = {
      entityId: EntityId
      profession: VillagerProfession
      tradeLevel: number
      home: Option<House>
      workplace: Option<Position>
    }
    ```
  - [x] `VillagerProfession` enum
    - [x] Farmer（農夫）
    - [x] Librarian（司書）
    - [x] Blacksmith（鍛冶屋）

#### 農夫AI
- [x] 畑への移動
- [x] 作物の収穫
- [x] 作物の植え付け
- [x] 時間帯に応じた活動

#### 司書AI
- [x] 家屋内での移動
- [x] 本棚の確認（アニメーション）

### Day 3: 取引システム

#### 取引定義
- [x] `src/trading/trade.ts` の作成
  - [x] `Trade` 型定義
    ```typescript
    type Trade = {
      id: TradeId
      villagerProfession: VillagerProfession
      requiredLevel: number
      inputs: ItemStack[]
      output: ItemStack
      xp: number
    }
    ```
  - [x] `TradingService = Context.GenericTag<TradingService>('@minecraft/TradingService')`

#### 取引ロジック
- [x] 可能な取引のリスト表示
- [x] インベントリからの支払い
- [x] 取引レベルの更新
- [x] 経験値の獲得

#### エメラルド通貨
- [x] エメラルドの追加
- [x] 取引UIでの表示

### Day 4: 取引UIと統合

#### 取引UI
- [x] `src/presentation/trading.ts` の作成
  - [x] 右クリックで開く
  - [x] 取引候補の表示
  - [x] エメラルド残量の表示

#### 村との統合
- [x] 村のチャンク生成
- [x] 村人のスポーン
- [x] 村人のAI実行
- [x] 夜間の家への帰還

#### テスト
- [x] `src/village/village.test.ts` の作成
  - [x] 村生成
  - [x] 家屋配置
- [x] `src/village/villager.test.ts` の作成
  - [x] 村人AI
- [x] `src/trading/trade.test.ts` の作成
  - [x] 取引ロジック
  - [x] レベルアップ

#### 最終検証
- [x] 村が生成されている
- [x] 家屋がある
- [x] 村人が動いている
- [x] 右クリックで取引UIが開く
- [x] 取引ができる
- [x] 取引レベルが上がる
- [x] 30 FPS以上
- [x] すべてのテストが成功

## 🎯 成功基準
- 村生成システムが実装されている
- 村人AIが機能している
- 取引システムが動作している
- Effect-TSパターンで実装されている

## 📊 依存関係
- Phase 14: Sound and Music

## 🔗 関連ドキュメント
- [Phase 14](./14-sound-music.md)
- 村システム（ドキュメント未作成）
