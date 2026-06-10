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
- [x] ホットバーが表示されている（9スロット）
- [x] EキーでインベントリUIが開く
- [x] アイテムをドラッグ＆ドロップできる

### アイテム操作
- [x] ブロック破壊でアイテムがドロップする
- [x] アイテムを拾える（歩いて近づく）
- [x] アイテムをインベントリから取り出せる
- [x] 1-9キーでホットバー選択が変わる

### データ構造
- [x] ItemStackが正しく機能している
- [x] インベントリの容量チェックが動作している

## 📝 タスク

### Day 1: アイテムドメインモデル

#### アイテム定義
- [x] `src/domain/item.ts` の作成
  - [x] `ItemIdSchema`（ブランドタイプ）
  - [x] `ItemType` enum
    - [x] Block（ブロック）
    - [x] Tool（道具）
    - [x] Food（食料）
    - [x] Material（素材）

#### ItemStack
- [x] `ItemStack` 型定義
  ```typescript
  type ItemStack = {
    itemId: ItemId
    count: number
    maxStackSize: number
  }
  ```
- [x] `ItemStackSchema`（バリデーション付き）

#### アイテムプロパティ
- [x] `ItemProperties` 型定義
  - [x] ブロックタイプ（ブロックの場合）
  - [x] 道具の耐久度（道具の場合）
  - [x] 回復量（食料の場合）

### Day 2: インベントリデータ構造

#### インベントリ定義
- [x] `src/domain/inventory.ts` の作成
  - [x] `Inventory` 型定義
    ```typescript
    type Inventory = {
      slots: Array<Option<ItemStack>>
      capacity: number
    }
    ```
  - [x] `InventoryService = Context.GenericTag<InventoryService>('@minecraft/InventoryService')`

#### インベントリ操作
- [x] `createInventory(capacity)` - インベントリ作成
- [x] `addItem(stack)` - アイテム追加
  - [x] 空スロット検索
  - [x] 既存スタックに追加
  - [x] 新スロット使用
- [x] `removeItem(slot)` - アイテム削除
- [x] `getItem(slot)` - アイテム取得
- [x] `moveItem(from, to)` - アイテム移動

#### 容量チェック
- [x] 容量超過時のエラー処理
- [x] スタックサイズ上限のチェック

### Day 3: インベントリUI

#### メインインベントリUI
- [x] `src/presentation/inventory.ts` の作成
  - [x] 27スロットメインインベントリ（9x3）
  - [x] 9スロットホットバー
  - [x] オフキャンバス/HTMLオーバーレイ
  - [x] Eキーで開閉

#### ホットバー統合
- [x] 既存のホットバー（Phase 05）を更新
  - [x] ItemStack表示
  - [x] スタック数表示
  - [x] 選択ハイライト

#### ドラッグ＆ドロップ
- [x] マウスドラッグ検出
- [x] スロット間の移動
- [x] ホットバーとメイン間の移動

### Day 4: アイテムドロップと拾集

#### ドロップアイテム
- [x] `src/domain/droppedItem.ts` の作成
  - [x] `DroppedItem` 型定義
    - [x] itemStack: ItemStack
    - [x] position: Position
    - [x] velocity: Vector3
  - [x] `DroppedItemService`

#### ドロップ処理
- [x] ブロック破壊時のドロップ
- [x] 死亡時の全アイテムドロップ
- [x] ドロップアイテムの物理（重力、回転）

#### 拾集処理
- [x] プレイヤー範囲内のドロップアイテム検出
- [x] 自動拾集（歩いて近づく）
- [x] インベントリへの追加

#### テスト
- [x] `src/domain/item.test.ts` の作成
  - [x] ItemStackのバリデーション
- [x] `src/domain/inventory.test.ts` の作成
  - [x] アイテム追加/削除
  - [x] 容量チェック
  - [x] スタックサイズ
- [x] `src/domain/droppedItem.test.ts` の作成
  - [x] ドロップアイテムの物理

#### 最終検証
- [x] ブロックを破壊するとアイテムが落ちる
- [x] アイテムに近づくと拾える
- [x] Eキーでインベントリが開く
- [x] アイテムをドラッグ＆ドロップできる
- [x] 1-9キーでホットバー選択が変わる
- [x] すべてのテストが成功

## 🎯 成功基準
- 完全なインベントリシステムが実装されている
- アイテムのドロップと拾集が動作している
- UIでアイテムを操作できる
- Effect-TSパターンで実装されている

## 📊 依存関係
- Phase 08: Enhanced Terrain Generation

## 🔗 関連ドキュメント
- [Phase 08](./08-enhanced-terrain.md)
- インベントリシステム（ドキュメント未作成）
