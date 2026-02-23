---
title: 'Phase 09 - Inventory System'
description: 'インベントリシステムとアイテム管理'
phase: 9
estimated_duration: '4日間'
difficulty: 'beginner'
---

# Phase 09 - Inventory System

## 目標
アイテムとインベントリシステムを実装する。ホットバー、メインインベントリ、アイテム操作を追加する。

## ✅ 受け入れ条件（画面で確認）

### インベントリUI
- [ ] ホットバーが表示されている（9スロット）
- [ ] EキーでインベントリUIが開く
- [ ] アイテムをドラッグ＆ドロップできる

### アイテム操作
- [ ] ブロック破壊でアイテムがドロップする
- [ ] アイテムを拾える（歩いて近づく）
- [ ] アイテムをインベントリから取り出せる
- [ ] 1-9キーでホットバー選択が変わる

### データ構造
- [ ] ItemStackが正しく機能している
- [ ] インベントリの容量チェックが動作している

## 📝 タスク

### Day 1: アイテムドメインモデル

#### アイテム定義
- [ ] `src/domain/item.ts` の作成
  - [ ] `ItemIdSchema`（ブランドタイプ）
  - [ ] `ItemType` enum
    - [ ] Block（ブロック）
    - [ ] Tool（道具）
    - [ ] Food（食料）
    - [ ] Material（素材）

#### ItemStack
- [ ] `ItemStack` 型定義
  ```typescript
  type ItemStack = {
    itemId: ItemId
    count: number
    maxStackSize: number
  }
  ```
- [ ] `ItemStackSchema`（バリデーション付き）

#### アイテムプロパティ
- [ ] `ItemProperties` 型定義
  - [ ] ブロックタイプ（ブロックの場合）
  - [ ] 道具の耐久度（道具の場合）
  - [ ] 回復量（食料の場合）

### Day 2: インベントリデータ構造

#### インベントリ定義
- [ ] `src/domain/inventory.ts` の作成
  - [ ] `Inventory` 型定義
    ```typescript
    type Inventory = {
      slots: Array<Option<ItemStack>>
      capacity: number
    }
    ```
  - [ ] `InventoryService = Context.GenericTag<InventoryService>('@minecraft/InventoryService')`

#### インベントリ操作
- [ ] `createInventory(capacity)` - インベントリ作成
- [ ] `addItem(stack)` - アイテム追加
  - [ ] 空スロット検索
  - [ ] 既存スタックに追加
  - [ ] 新スロット使用
- [ ] `removeItem(slot)` - アイテム削除
- [ ] `getItem(slot)` - アイテム取得
- [ ] `moveItem(from, to)` - アイテム移動

#### 容量チェック
- [ ] 容量超過時のエラー処理
- [ ] スタックサイズ上限のチェック

### Day 3: インベントリUI

#### メインインベントリUI
- [ ] `src/presentation/inventory.ts` の作成
  - [ ] 27スロットメインインベントリ（9x3）
  - [ ] 9スロットホットバー
  - [ ] オフキャンバス/HTMLオーバーレイ
  - [ ] Eキーで開閉

#### ホットバー統合
- [ ] 既存のホットバー（Phase 05）を更新
  - [ ] ItemStack表示
  - [ ] スタック数表示
  - [ ] 選択ハイライト

#### ドラッグ＆ドロップ
- [ ] マウスドラッグ検出
- [ ] スロット間の移動
- [ ] ホットバーとメイン間の移動

### Day 4: アイテムドロップと拾集

#### ドロップアイテム
- [ ] `src/domain/droppedItem.ts` の作成
  - [ ] `DroppedItem` 型定義
    - [ ] itemStack: ItemStack
    - [ ] position: Position
    - [ ] velocity: Vector3
  - [ ] `DroppedItemService`

#### ドロップ処理
- [ ] ブロック破壊時のドロップ
- [ ] 死亡時の全アイテムドロップ
- [ ] ドロップアイテムの物理（重力、回転）

#### 拾集処理
- [ ] プレイヤー範囲内のドロップアイテム検出
- [ ] 自動拾集（歩いて近づく）
- [ ] インベントリへの追加

#### テスト
- [ ] `src/domain/item.test.ts` の作成
  - [ ] ItemStackのバリデーション
- [ ] `src/domain/inventory.test.ts` の作成
  - [ ] アイテム追加/削除
  - [ ] 容量チェック
  - [ ] スタックサイズ
- [ ] `src/domain/droppedItem.test.ts` の作成
  - [ ] ドロップアイテムの物理

#### 最終検証
- [ ] ブロックを破壊するとアイテムが落ちる
- [ ] アイテムに近づくと拾える
- [ ] Eキーでインベントリが開く
- [ ] アイテムをドラッグ＆ドロップできる
- [ ] 1-9キーでホットバー選択が変わる
- [ ] すべてのテストが成功

## 🎯 成功基準
- 完全なインベントリシステムが実装されている
- アイテムのドロップと拾集が動作している
- UIでアイテムを操作できる
- Effect-TSパターンで実装されている

## 📊 依存関係
- Phase 08: Enhanced Terrain Generation

## 🔗 関連ドキュメント
- [Phase 08](./08-enhanced-terrain.md)
- [インベントリシステム](../docs/explanations/game-mechanics/core-features/inventory-system.md)
