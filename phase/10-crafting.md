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
- [ ] クラフト台を配置できる（専用ブロック）
- [ ] 右クリックでクラフト台UIが開く
- [ ] 3x3グリッドが表示される

### クラフト
- [ ] アイテムをグリッドに配置できる
- [ ] レシピがマッチすると結果が表示される
- [ ] クラフトボタンでアイテムを生成できる

### レシピ
- [ ] 少なくとも10種類のレシピがある
- [ ] 木の板材（4x）
- [ ] 棒（4x）
- [ ] ワークベンチ、石斧、ピッケルなど

## 📝 タスク

### Day 1: レシピ定義

#### レシピ型
- [ ] `src/crafting/recipe.ts` の作成
  - [ ] `Recipe` 型定義
    ```typescript
    type Recipe = {
      id: RecipeId
      pattern: Array<Array<Option<ItemId>>>
      result: ItemStack
      shapeless: boolean // パターンの配置順を無視するか
    }
    ```
  - [ ] `RecipeIdSchema`（ブランドタイプ）

#### レシピファイル
- [ ] JSONまたはTypeScriptでレシピ定義
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
- [ ] 木製品（板材、棒、階段、フェンス）
- [ ] 石道具（斧、ピッケル、シャベル）
- [ ] 基本的な装備（剣、ヘルメット）

### Day 2: レシピマッチング

#### レシピマッチャー
- [ ] `src/crafting/recipeMatcher.ts` の作成
  - [ ] `matchRecipe(grid)` - グリッドからマッチするレシピ検索
  - [ ] パターンの回転考慮
  - [ ] 形状のあるレシピと形状のないレシピ

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
- [ ] `src/presentation/craftingTable.ts` の作成
  - [ ] 3x3グリッド（スロット）
  - [ ] 結果スロット
  - [ ] クラフトボタン
  - [ ] レシピヒント（オプション）

#### UI統合
- [ ] クラフト台ブロックの追加
- [ ] 右クリックでUIを開く
- [ ] インベントリとの連動

#### ドラッグ＆ドロップ
- [ ] インベントリからグリッドへドラッグ
- [ ] グリッド内での移動
- [ ] Shift+クリックで一括移動

### Day 4: クラフト処理

#### CraftingService
- [ ] `src/crafting/craftingService.ts` の作成
  - [ ] `CraftingService = Context.GenericTag<CraftingService>('@minecraft/CraftingService')`

#### クラフト実行
- [ ] `craft(grid)` メソッド
  - [ ] レシピマッチング
  - [ ] 必要アイテムの消費
  - [ ] 結果アイテムの追加
  - [ ] エラーハンドリング（レシピなし）

#### アイテム消費
- [ ] グリッド内のアイテムを減らす
- [ ] スタック全体を消費
- [ ] 部分消費（レシピによる）

### Day 5: 完成とテスト

#### 装備レシピ
- [ ] 道具の追加（ツルハシ、ハサミ）
- [ ] 武器の追加（弓、矢）
- [ ] 防具の追加（チェストプレート、レギンス）

#### テスト
- [ ] `src/crafting/recipe.test.ts` の作成
  - [ ] レシピ定義のテスト
- [ ] `src/crafting/recipeMatcher.test.ts` の作成
  - [ ] マッチングロジックのテスト
  - [ ] 回転パターンのテスト
- [ ] `src/crafting/craftingService.test.ts` の作成
  - [ ] クラフト実行のテスト
  - [ ] アイテム消費のテスト

#### 最終検証
- [ ] クラフト台を配置できる
- [ ] クラフト台UIが開く
- [ ] 基本的なレシピが動作する
- [ ] アイテムが正しく消費・生成される
- [ ] すべてのテストが成功

## 🎯 成功基準
- 3x3クラフトシステムが実装されている
- レシピマッチングが正しく動作している
- 少なくとも10種類のレシピがある
- Effect-TSパターンで実装されている

## 📊 依存関係
- Phase 09: Inventory System

## 🔗 関連ドキュメント
- [Phase 09](./09-inventory.md)
- [クラフトシステム](../docs/explanations/game-mechanics/core-features/crafting-system.md)
