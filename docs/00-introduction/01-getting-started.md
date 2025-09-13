# はじめに (Getting Started)

このガイドでは、ts-minecraftプロジェクトの環境セットアップから基本的な開発ワークフロー、そしてプロジェクトで採用されている開発規約までを説明します。

## 1. 環境セットアップ (Environment Setup)

### 1.1. 前提条件 (Prerequisites)

以下のツールがインストールされていることを確認してください：

- **Node.js**: v18.0.0以上（推奨：v20以上）
- **pnpm**: v8.0.0以上（パッケージマネージャー）
- **Git**: バージョン管理用

### 1.2. インストール (Installation)

```bash
# 1. プロジェクトのクローン
git clone https://github.com/takeokunn/ts-minecraft.git
cd ts-minecraft

# 2. 依存関係のインストール
pnpm install
```

## 2. 開発サーバーとコマンド (Development Server & Commands)

### 2.1. 開発サーバーの起動

```bash
# 開発サーバーを起動（ホットリロード有効）
pnpm dev
```
ブラウザで `http://localhost:5173` を開くと、アプリケーションが表示されます。

### 2.2. 主要な開発コマンド

```bash
# 型チェック
pnpm type-check

# テスト実行
pnpm test

# リンティングとフォーマット
pnpm lint
pnpm format

# 本番用ビルド
pnpm build
```

## 3. 開発規約 (Development Conventions)

このセクションでは、最新のEffect-TSパターン（2024年版）を活用したts-minecraftプロジェクトで使用する開発規約とアーキテクチャパターンについて説明します。

### 3.1. 基本設計思想 (Core Design Philosophy)

#### Schema-first開発アプローチ
すべてのデータ構造は`Schema.Struct`から始まり、型安全なバリデーションと変換を行います。

```typescript
import { Schema } from "@effect/schema"

// ✅ Schema-first開発パターン
const PlayerSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("PlayerId")),
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50)),
  // ...
})
type Player = Schema.Schema.Type<typeof PlayerSchema>

// ❌ 避けるべきData.struct使用
// const OldPlayer = Data.struct<Player>({ ... })
```

#### 早期リターンパターン
バリデーション段階での即座な失敗処理を必須とします。

```typescript
// ✅ 早期リターンによる効率的な処理
const validateAndProcessPlayer = (input: unknown): Effect.Effect<ProcessedPlayer, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: 基本バリデーション
    if (!input || typeof input !== "object") {
      return yield* Effect.fail({ /* ... */ })
    }
    // ...
  })
```

#### 不変性の維持
すべてのデータ構造をimmutableとして扱います。

```typescript
// ✅ 不変なアップデート
const updatePlayerPosition = (player: Player, newX: number): Player => ({
  ...player,
  position: { ...player.position, x: newX }
})
```

#### クラス不使用ポリシー
`class` 構文と `this` キーワードは使用禁止です。関数型アプローチを採用します。

```typescript
// ✅ 関数型アプローチ
interface EntityManager {
  readonly entities: ReadonlyArray<Entity>
}

const addEntity = (manager: EntityManager, entity: Entity): EntityManager => ({
  ...manager,
  entities: [...manager.entities, entity]
})
```

### 3.2. TypeScript厳格ルール
`tsconfig.json`で`"strict": true`を有効にし、型安全性を最大限に高めます。`any`や`as`の不適切な使用は避けてください。

### 3.3. 命名規則 (Naming Conventions)
- **ファイルとディレクトリ**: `kebab-case` (e.g., `player-movement-system.ts`)
- **変数と関数**: `camelCase` (e.g., `playerPosition`)
- **型とSchema**: `PascalCase` (e.g., `Player`, `PlayerSchema`)
- **定数**: `UPPER_SNAKE_CASE` (e.g., `MAX_CHUNK_HEIGHT`)
- **Effect Layer**: `PascalCase` + `Live` 接尾辞 (e.g., `RendererLive`)

### 3.4. インポートパス規則 (Import Path Rules)
- プロジェクト内モジュールは`@/`エイリアスを使った絶対パスを推奨します。
- インポート順序: 1. Node.jsビルトイン, 2. サードパーティ, 3. プロジェクト内絶対パス, 4. 相対パス。

### 3.5. Effect-TSパターン
`Effect.gen`や`pipe`を積極的に使用し、エラーハンドリングは`catchTag`などで行います。サービス定義には`Context.GenericTag`を使用します。

```typescript
import { Context, Effect, Layer } from "effect"

// サービスの定義
class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  {
    readonly find: (id: string) => Effect.Effect<Entity | null, DatabaseError>
    readonly save: (entity: Entity) => Effect.Effect<void, DatabaseError>
  }
>() {}

// Layer の作成
const DatabaseServiceLive = Layer.succeed(DatabaseService, {
  find: (id) => /* 実装 */,
  save: (entity) => /* 実装 */,
})
```

## 4. 次のステップ (Next Steps)

環境が正常にセットアップできたら、以下のガイドも参照してください：

- [**アーキテクチャ概要**](../01-architecture/00-overview.md) - システム全体設計と設計原則
- [**開発ワークフロー**](../02-guides/01-development-workflow.md) - アプリケーションの起動フローの理解
- [**テスティングガイド**](../02-guides/02-testing.md) - Effect-TSを使ったテスト作成方法
- [**パフォーマンス最適化**](../02-guides/03-performance-optimization.md) - 最適化とプロファイリング
