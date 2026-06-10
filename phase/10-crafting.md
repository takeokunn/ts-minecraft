---
title: 'Phase 10 - Crafting System'
description: 'クラフトシステムとレシピ管理'
phase: 10
estimated_duration: '5日間'
difficulty: 'intermediate'
---

# Phase 10 - Crafting System

## 目標
クラフト台とレシピシステムを実装する。3x3クラフトグリッド、レシピマッチング、クラフト結果を追加する。

## ✅ 受け入れ条件（画面で確認）

### クラフト台
- [x] クラフト台を配置できる（専用ブロック）
- [x] 右クリックでクラフト台UIが開く
- [x] 3x3グリッドが表示される

### クラフト
- [x] アイテムをグリッドに配置できる
- [x] レシピがマッチすると結果が表示される
- [x] クラフトボタンでアイテムを生成できる

### レシピ
- [x] 少なくとも10種類のレシピがある
- [x] 木の板材（4x）
- [x] 棒（4x）
- [x] ワークベンチ、石斧、ピッケルなど

## 📝 タスク

### Day 1: レシピ定義

#### レシピ型
- [x] `src/crafting/recipe.ts` の作成
  - [x] `Recipe` 型定義
    ```typescript
    type Recipe = {
      id: RecipeId
      pattern: Array<Array<Option<ItemId>>>
      result: ItemStack
      shapeless: boolean // パターンの配置順を無視するか
    }
    ```
  - [x] `RecipeIdSchema`（ブランドタイプ）

#### レシピファイル
- [x] JSONまたはTypeScriptでレシピ定義
  ```typescript
  const recipes: Recipe[] = [
    {
      id: 'planks',
      pattern: [
        ['log'],
      ],
      result: { itemId: 'planks', count: 4 }
    },
    // ... 他のレシピ
  ]
  ```

#### 基本レシピ
- [x] 木製品（板材、棒、階段、フェンス）
- [x] 石道具（斧、ピッケル、シャベル）
- [x] 基本的な装備（剣、ヘルメット）

### Day 2: レシピマッチング

#### レシピマッチャー
- [x] `src/crafting/recipeMatcher.ts` の作成
  - [x] `matchRecipe(grid)` - グリッドからマッチするレシピ検索
  - [x] パターンの回転考慮
  - [x] 形状のあるレシピと形状のないレシピ

#### マッチングロジック
  ```typescript
  const matchRecipe = (grid: ItemStack[][]) => {
    for (const recipe of recipes) {
      if (matchesPattern(grid, recipe.pattern, recipe.shapeless)) {
        return recipe.result
      }
    }
    return null
  }
  ```

### Day 3: クラフトUI

#### クラフトテーブルUI
- [x] `src/presentation/craftingTable.ts` の作成
  - [x] 3x3グリッド（スロット）
  - [x] 結果スロット
  - [x] クラフトボタン
  - [x] レシピヒント（オプション）

#### UI統合
- [x] クラフト台ブロックの追加
- [x] 右クリックでUIを開く
- [x] インベントリとの連動

#### ドラッグ＆ドロップ
- [x] インベントリからグリッドへドラッグ
- [x] グリッド内での移動
- [x] Shift+クリックで一括移動

### Day 4: クラフト処理

#### CraftingService
- [x] `src/crafting/craftingService.ts` の作成
  - [x] `CraftingService = Context.GenericTag<CraftingService>('@minecraft/CraftingService')`

#### クラフト実行
- [x] `craft(grid)` メソッド
  - [x] レシピマッチング
  - [x] 必要アイテムの消費
  - [x] 結果アイテムの追加
  - [x] エラーハンドリング（レシピなし）

#### アイテム消費
- [x] グリッド内のアイテムを減らす
- [x] スタック全体を消費
- [x] 部分消費（レシピによる）

### Day 5: 完成とテスト

#### 装備レシピ
- [x] 道具の追加（ツルハシ、ハサミ）
- [x] 武器の追加（弓、矢）
- [x] 防具の追加（チェストプレート、レギンス）

#### テスト
- [x] `src/crafting/recipe.test.ts` の作成
  - [x] レシピ定義のテスト
- [x] `src/crafting/recipeMatcher.test.ts` の作成
  - [x] マッチングロジックのテスト
  - [x] 回転パターンのテスト
- [x] `src/crafting/craftingService.test.ts` の作成
  - [x] クラフト実行のテスト
  - [x] アイテム消費のテスト

#### 最終検証
- [x] クラフト台を配置できる
- [x] クラフト台UIが開く
- [x] 基本的なレシピが動作する
- [x] アイテムが正しく消費・生成される
- [x] すべてのテストが成功

## 🎯 成功基準
- 3x3クラフトシステムが実装されている
- レシピマッチングが正しく動作している
- 少なくとも10種類のレシピがある
- Effect-TSパターンで実装されている

## 📊 依存関係
- Phase 09: Inventory System

## 🔗 関連ドキュメント
- [Phase 09](./09-inventory.md)
- クラフトシステム（ドキュメント未作成）
