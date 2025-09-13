---
title: "20 Sign Book System"
description: "20 Sign Book Systemに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "5分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Sign & Book System（文字・情報システム）

## 概要

Sign & Book Systemは、プレイヤーがゲーム内で情報を記録・伝達するためのシステムです。看板（Sign）による短いメッセージの表示と、本と羽ペン（Book and Quill）による長文の記述を可能にします。

## システム設計

### 1. 看板 (Sign)

#### 1.1 機能
- **設置**: 壁や地面に設置可能
- **テキスト入力**: 4行、各行15文字までのテキストを入力
- **編集**: 設置後に一度だけ編集可能
- **表示**: 設置された看板のテキストは常に表示される
- **色と書式**: カラーコードや書式コードに対応

```typescript
// SignBlockEntityスキーマ
export const SignBlockEntity = Schema.Struct({
  id: Schema.Literal("Sign"),
  position: Position,
  text: Schema.Array(Schema.String).pipe(Schema.itemsCount(4)),
  color: Schema.String,
  isGlowing: Schema.Boolean
});

// 看板UIサービス
export interface SignUIService {
  readonly openEditor: (position: Position) => Effect.Effect<void, UIError>;
  readonly saveText: (position: Position, text: string[]) => Effect.Effect<void, WorldError>;
}
```

#### 1.2 実装のポイント
- **テキストレンダリング**: ゲーム内の3D空間にテキストをレンダリングする
- **UI**: テキスト入力用のUIを作成
- **データ永続化**: 看板のテキストデータをチャンクデータと共に保存

### 2. 本と羽ペン (Book and Quill)

#### 2.1 機能
- **作成**: 本、羽、墨袋からクラフト
- **執筆**: UIを開いて複数ページのテキストを入力
- **ページ**: 最大50ページ、各ページ14行 x 19文字
- **署名**: 執筆完了後、タイトルと著者名で署名すると編集不可になる
- **複製**: 署名済みの本は複製可能

```typescript
// BookItemスキーマ
export const BookItem = Schema.Struct({
  id: Schema.Literal("writable_book", "written_book"),
  pages: Schema.Array(Schema.String),
  author: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  generation: Schema.optional(Schema.Number) // 複製世代
});

// 本UIサービス
export interface BookUIService {
  readonly openBook: (book: BookItem) => Effect.Effect<void, UIError>;
  readonly savePage: (pageIndex: number, content: string) => Effect.Effect<void, InventoryError>;
  readonly signBook: (title: string, author: string) => Effect.Effect<WrittenBook, InventoryError>;
}
```

#### 2.2 実装のポイント
- **ページネーションUI**: 複数ページをめくることができるUI
- **テキストフォーマット**: JSONベースのテキストフォーマットで色やスタイルをサポート
- **アイテムデータ**: 本の内容はアイテムのNBTデータとして保存

## UI統合

- **看板**: 看板を右クリックするとテキスト入力UIが開く
- **本**: 本と羽ペンを手に持って右クリックすると執筆UIが開く

## テストケース

- [ ] 看板にテキストを入力し、正しく表示されること
- [ ] 本に複数ページのテキストを書き、保存できること
- [ ] 本に署名すると編集不可になり、タイトルと著者名が表示されること
- [ ] 署名済みの本が複製できること
