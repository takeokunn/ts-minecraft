---
title: "20 Sign Book System"
description: "20 Sign Book Systemに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ["typescript", "minecraft", "specification"]
prerequisites: ["basic-typescript"]
estimated_reading_time: "5分"
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

#### 2.2 高度なテキスト処理システム

```typescript
// リッチテキスト形式のサポート
const RichTextSchema = Schema.Struct({
  text: Schema.String,
  color: Schema.optional(Schema.Literal("black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple", "gold", "gray", "dark_gray", "blue", "green", "aqua", "red", "light_purple", "yellow", "white")),
  bold: Schema.optional(Schema.Boolean),
  italic: Schema.optional(Schema.Boolean),
  underlined: Schema.optional(Schema.Boolean),
  strikethrough: Schema.optional(Schema.Boolean),
  obfuscated: Schema.optional(Schema.Boolean),
  clickEvent: Schema.optional(ClickEventSchema),
  hoverEvent: Schema.optional(HoverEventSchema)
})

const ClickEventSchema = Schema.Struct({
  action: Schema.Literal("open_url", "run_command", "suggest_command", "change_page", "copy_to_clipboard"),
  value: Schema.String
})

const HoverEventSchema = Schema.Struct({
  action: Schema.Literal("show_text", "show_item", "show_entity"),
  contents: Schema.Unknown
})

// ページ構造の詳細定義
const BookPageSchema = Schema.Struct({
  pageNumber: Schema.Number.pipe(Schema.between(1, 50)),
  content: Schema.Array(RichTextSchema),
  wordCount: Schema.Number,
  characterCount: Schema.Number,
  lastModified: Schema.DateTimeUtc
})

// 本エンティティの完全な定義
const BookEntitySchema = Schema.Struct({
  _tag: Schema.Literal("BookEntity"),
  id: ItemIdSchema,
  type: Schema.Literal("writable_book", "written_book"),
  pages: Schema.Array(BookPageSchema),
  metadata: BookMetadataSchema,
  permissions: BookPermissionsSchema
})

const BookMetadataSchema = Schema.Struct({
  title: Schema.optional(Schema.String.pipe(Schema.maxLength(64))),
  author: Schema.optional(Schema.String.pipe(Schema.maxLength(32))),
  generation: Schema.Number.pipe(Schema.between(0, 3)), // 0=original, 1=copy, 2=copy of copy, 3=tattered
  created: Schema.DateTimeUtc,
  lastEdited: Schema.DateTimeUtc,
  totalWords: Schema.Number,
  totalCharacters: Schema.Number
})

const BookPermissionsSchema = Schema.Struct({
  canEdit: Schema.Boolean,
  canCopy: Schema.Boolean,
  canShare: Schema.Boolean,
  isPublic: Schema.Boolean
})
```

#### 2.3 実装のポイント

##### **高度なページネーションUI**
```typescript
// ページネーションコンポーネント
const createBookPaginationUI = (book: BookEntity) =>
  Effect.gen(function* () {
    const uiService = yield* UIService

    const paginationData = {
      currentPage: 1,
      totalPages: book.pages.length,
      maxPagesPerView: 2, // 見開き表示
      navigationEnabled: true,
      bookmarkSupport: true
    }

    // UI要素の構築
    const paginationUI = yield* uiService.createPaginationInterface({
      ...paginationData,
      onPageChange: (newPage: number) => handlePageChange(book.id, newPage),
      onBookmarkAdd: (page: number, label: string) => addBookmark(book.id, page, label),
      onSearch: (query: string) => searchInBook(book.id, query)
    })

    return paginationUI
  })

// ページ遷移の実装
const handlePageChange = (bookId: ItemId, targetPage: number) =>
  Effect.gen(function* () {
    const bookService = yield* BookService
    const animationService = yield* AnimationService

    // ページ範囲チェック
    const book = yield* bookService.getBook(bookId)
    if (targetPage < 1 || targetPage > book.pages.length) {
      return yield* Effect.fail(new InvalidPageNumberError({ targetPage, maxPages: book.pages.length }))
    }

    // ページめくりアニメーション
    yield* animationService.playPageTurnAnimation(bookId, {
      duration: 300,
      direction: targetPage > book.metadata.currentPage ? "forward" : "backward",
      easing: "ease-in-out"
    })

    // ページ内容の更新
    yield* bookService.setCurrentPage(bookId, targetPage)

    // ページ効果音
    yield* SoundService.playSound("item.book.page_turn", {
      position: yield* PlayerService.getCurrentPlayerPosition(),
      volume: 0.5,
      pitch: 1.0
    })
  })
```

##### **インテリジェント文字制限システム**
```typescript
// 文字制限と自動改行の実装
const processTextInput = (text: string, constraints: TextConstraints) =>
  Effect.gen(function* () {
    const textProcessor = yield* TextProcessingService

    // 文字数カウント（Unicode対応）
    const characterCount = yield* textProcessor.countCharacters(text)
    const wordCount = yield* textProcessor.countWords(text)
    const lineCount = yield* textProcessor.countLines(text, constraints.maxCharactersPerLine)

    // 制限チェック
    if (characterCount > constraints.maxCharacters) {
      return yield* Effect.fail(new TextTooLongError({
        actual: characterCount,
        maximum: constraints.maxCharacters
      }))
    }

    if (lineCount > constraints.maxLines) {
      return yield* Effect.fail(new TooManyLinesError({
        actual: lineCount,
        maximum: constraints.maxLines
      }))
    }

    // 自動改行処理
    const formattedText = yield* textProcessor.wrapText(text, {
      maxLineLength: constraints.maxCharactersPerLine,
      preserveWords: true,
      hyphenation: false
    })

    return {
      originalText: text,
      processedText: formattedText,
      metrics: {
        characters: characterCount,
        words: wordCount,
        lines: lineCount
      }
    }
  })
```

##### **JSONベースリッチテキストフォーマット**
```typescript
// テキストフォーマットの解析と適用
const parseRichTextFormat = (rawText: string) =>
  Effect.gen(function* () {
    const formatter = yield* TextFormattingService

    // マークダウン形式のサポート
    const markdownPatterns = [
      { pattern: /\*\*(.*?)\*\*/g, format: { bold: true } },
      { pattern: /\*(.*?)\*/g, format: { italic: true } },
      { pattern: /__(.*?)__/g, format: { underlined: true } },
      { pattern: /~~(.*?)~~/g, format: { strikethrough: true } },
      { pattern: /\[url=(.*?)\](.*?)\[\/url\]/g, format: (match: string, url: string, text: string) => ({
        text,
        clickEvent: { action: "open_url" as const, value: url }
      })}
    ]

    // パターンマッチングによる変換
    const richTextComponents = yield* pipe(
      markdownPatterns,
      Effect.reduce(
        [{ text: rawText }] as RichTextComponent[],
        (components, pattern) => formatter.applyPattern(components, pattern)
      )
    )

    return richTextComponents
  })

// 色コード処理
const processColorCodes = (text: string) =>
  Effect.gen(function* () {
    const colorProcessor = yield* ColorProcessingService

    // §ベースの色コード（Minecraft標準）
    const colorCodePattern = /§([0-9a-fk-or])/g

    const processedComponents = yield* colorProcessor.parseColorCodes(text, {
      pattern: colorCodePattern,
      colorMap: {
        '0': 'black', '1': 'dark_blue', '2': 'dark_green', '3': 'dark_aqua',
        '4': 'dark_red', '5': 'dark_purple', '6': 'gold', '7': 'gray',
        '8': 'dark_gray', '9': 'blue', 'a': 'green', 'b': 'aqua',
        'c': 'red', 'd': 'light_purple', 'e': 'yellow', 'f': 'white',
        'k': { obfuscated: true }, 'l': { bold: true },
        'm': { strikethrough: true }, 'n': { underlined: true },
        'o': { italic: true }, 'r': 'reset'
      }
    })

    return processedComponents
  })
```

##### **アイテムデータ永続化システム**
```typescript
// 本のデータをNBT形式で保存
const serializeBookToNBT = (book: BookEntity) =>
  Effect.gen(function* () {
    const nbtService = yield* NBTService

    // ページデータの圧縮
    const compressedPages = yield* pipe(
      book.pages,
      Effect.forEach(page => compressPageData(page)),
      Effect.map(pages => ({
        pages: pages,
        pageCount: pages.length
      }))
    )

    // メタデータの構造化
    const nbtData = yield* nbtService.createCompound({
      // 基本情報
      id: nbtService.createString(book.id),
      type: nbtService.createString(book.type),

      // ページコンテンツ
      pages: nbtService.createList(
        compressedPages.pages.map(page =>
          nbtService.createString(JSON.stringify(page))
        )
      ),

      // メタデータ
      title: book.metadata.title ? nbtService.createString(book.metadata.title) : undefined,
      author: book.metadata.author ? nbtService.createString(book.metadata.author) : undefined,
      generation: nbtService.createInt(book.metadata.generation),

      // タイムスタンプ
      created: nbtService.createLong(book.metadata.created.getTime()),
      lastEdited: nbtService.createLong(book.metadata.lastEdited.getTime()),

      // 統計情報
      stats: nbtService.createCompound({
        totalWords: nbtService.createInt(book.metadata.totalWords),
        totalCharacters: nbtService.createInt(book.metadata.totalCharacters)
      }),

      // 権限設定
      permissions: nbtService.createCompound({
        canEdit: nbtService.createByte(book.permissions.canEdit ? 1 : 0),
        canCopy: nbtService.createByte(book.permissions.canCopy ? 1 : 0),
        canShare: nbtService.createByte(book.permissions.canShare ? 1 : 0),
        isPublic: nbtService.createByte(book.permissions.isPublic ? 1 : 0)
      })
    })

    return nbtData
  })

// 圧縮されたページデータの処理
const compressPageData = (page: BookPageData) =>
  Effect.gen(function* () {
    const compressionService = yield* CompressionService

    // テキストデータの圧縮（LZ4を使用）
    const compressedContent = yield* compressionService.compress(
      JSON.stringify(page.content),
      { algorithm: "lz4", level: 1 }
    )

    return {
      pageNumber: page.pageNumber,
      compressedContent: compressedContent,
      originalSize: JSON.stringify(page.content).length,
      compressedSize: compressedContent.length,
      wordCount: page.wordCount,
      characterCount: page.characterCount,
      lastModified: page.lastModified.toISOString()
    }
  })
```

## UI統合

- **看板**: 看板を右クリックするとテキスト入力UIが開く
- **本**: 本と羽ペンを手に持って右クリックすると執筆UIが開く

## テストケース

- [ ] 看板にテキストを入力し、正しく表示されること
- [ ] 本に複数ページのテキストを書き、保存できること
- [ ] 本に署名すると編集不可になり、タイトルと著者名が表示されること
- [ ] 署名済みの本が複製できること
