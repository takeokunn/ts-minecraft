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
- [ ] ワールドに村が生成されている
- [ ] 家屋が建てられている
- [ ] 道路がある
- [ ] 井戸や畑がある

### 村人AI
- [ ] 村人が動いている
- [ ] 村人が仕事をしている（農業、司書）
- [ ] 夜間に家に帰る

### 取引
- [ ] 右クリックで取引UIが開く
- [ ] エメラルドでの取引ができる
- [ ] 取引レベルが上がる

## 📝 タスク

### Day 1: 村の生成

#### 村構造定義
- [ ] `src/village/village.ts` の作成
  - [ ] `Village` 型定義
    ```typescript
    type Village = {
      villageId: VillageId
      position: Position
      houses: House[]
      villagers: Villager[]
    }
    ```
  - [ ] `House` 型定義（建物タイプ、サイズ、ドア位置）
  - [ ] `VillageService = Context.GenericTag<VillageService>('@minecraft/VillageService')`

#### 家屋生成
- [ ] 基本的な家屋タイプ
  - [ ] 小屋（4x5x4）
  - [ ] 家（7x7x6）
  - [ ] 店
- [ ] 家屋のランダム配置
- [ ] ドアと窓の生成

#### 道路生成
- [ ] 家屋間の道路
- [ ] 砂利ブロック
- [ ] 幅2の道

#### 村の施設
- [ ] 井戸（水源）
- [ ] 畑（耕地、作物）
- [ ] 掲示板（オプション）

### Day 2: 村人AI

#### 村人定義
- [ ] `src/village/villager.ts` の作成
  - [ ] `Villager` 型定義
    ```typescript
    type Villager = {
      entityId: EntityId
      profession: VillagerProfession
      tradeLevel: number
      home: Option<House>
      workplace: Option<Position>
    }
    ```
  - [ ] `VillagerProfession` enum
    - [ ] Farmer（農夫）
    - [ ] Librarian（司書）
    - [ ] Blacksmith（鍛冶屋）

#### 農夫AI
- [ ] 畑への移動
- [ ] 作物の収穫
- [ ] 作物の植え付け
- [ ] 時間帯に応じた活動

#### 司書AI
- [ ] 家屋内での移動
- [ ] 本棚の確認（アニメーション）

### Day 3: 取引システム

#### 取引定義
- [ ] `src/trading/trade.ts` の作成
  - [ ] `Trade` 型定義
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
  - [ ] `TradingService = Context.GenericTag<TradingService>('@minecraft/TradingService')`

#### 取引ロジック
- [ ] 可能な取引のリスト表示
- [ ] インベントリからの支払い
- [ ] 取引レベルの更新
- [ ] 経験値の獲得

#### エメラルド通貨
- [ ] エメラルドの追加
- [ ] 取引UIでの表示

### Day 4: 取引UIと統合

#### 取引UI
- [ ] `src/presentation/trading.ts` の作成
  - [ ] 右クリックで開く
  - [ ] 取引候補の表示
  - [ ] エメラルド残量の表示

#### 村との統合
- [ ] 村のチャンク生成
- [ ] 村人のスポーン
- [ ] 村人のAI実行
- [ ] 夜間の家への帰還

#### テスト
- [ ] `src/village/village.test.ts` の作成
  - [ ] 村生成
  - [ ] 家屋配置
- [ ] `src/village/villager.test.ts` の作成
  - [ ] 村人AI
- [ ] `src/trading/trade.test.ts` の作成
  - [ ] 取引ロジック
  - [ ] レベルアップ

#### 最終検証
- [ ] 村が生成されている
- [ ] 家屋がある
- [ ] 村人が動いている
- [ ] 右クリックで取引UIが開く
- [ ] 取引ができる
- [ ] 取引レベルが上がる
- [ ] 30 FPS以上
- [ ] すべてのテストが成功

## 🎯 成功基準
- 村生成システムが実装されている
- 村人AIが機能している
- 取引システムが動作している
- Effect-TSパターンで実装されている

## 📊 依存関係
- Phase 14: Sound and Music

## 🔗 関連ドキュメント
- [Phase 14](./14-sound-music.md)
- [村システム](../docs/explanations/game-mechanics/core-features/village-system.md)
