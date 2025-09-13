# 開発環境セットアップガイド

## 前提条件

### 必須環境
- **Node.js**: 18.0.0 以上
- **pnpm**: 8.0.0 以上
- **Git**: 2.30.0 以上
- **VS Code** または **WebStorm**（推奨）

### 推奨環境
- **OS**: macOS, Linux, WSL2
- **メモリ**: 8GB 以上
- **ストレージ**: 10GB 以上の空き容量

## 1. プロジェクトのセットアップ

### 1.1 リポジトリのクローン

```bash
# HTTPS
git clone https://github.com/takeokunn/ts-minecraft.git

# SSH（推奨）
git clone git@github.com:takeokunn/ts-minecraft.git

cd ts-minecraft
```

### 1.2 依存関係のインストール

```bash
# pnpm のインストール（未インストールの場合）
npm install -g pnpm

# 依存関係のインストール
pnpm install

# Git hooks のセットアップ
pnpm prepare
```

### 1.3 環境変数の設定

```bash
# .env.local ファイルの作成
cp .env.example .env.local

# 必要に応じて編集
vim .env.local
```

```env
# .env.local の例
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
VITE_RENDER_DISTANCE=8
VITE_ENABLE_WEBGPU=false
```

## 2. VS Code の設定

### 2.1 推奨拡張機能

`.vscode/extensions.json` に定義された拡張機能をインストール：

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "streetsidesoftware.code-spell-checker",
    "usernamehw.errorlens",
    "orta.vscode-jest",
    "yoavbls.pretty-ts-errors",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### 2.2 ワークスペース設定

`.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.turbo": true
  }
}
```

## 3. Effect-TS 開発環境

### 3.1 最新Effect-TSパターンの確認

**重要**: 以下の最新パターンを必ず使用してください。

```typescript
// tools/effect-patterns-check.ts
import { Schema, Effect, Context, Match } from "effect"

// ✅ 正しいパターン (2024年最新)
const User = Schema.Struct({
  _tag: Schema.Literal("User"),
  id: Schema.String.pipe(Schema.brand("UserId")),
  name: Schema.String,
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
})
type User = Schema.Schema.Type<typeof User>

// ✅ Context.GenericTag 使用
const UserService = Context.GenericTag<UserService>("@app/UserService")

// ✅ Match.value でパターンマッチング
const handleUserAction = (action: UserAction) =>
  Match.value(action).pipe(
    Match.tag("Create", ({ userData }) => createUser(userData)),
    Match.tag("Update", ({ id, userData }) => updateUser(id, userData)),
    Match.tag("Delete", ({ id }) => deleteUser(id)),
    Match.exhaustive
  )

// ❌ 古いパターン (使用禁止)
// Data.Class, Data.TaggedError, if/else, switch, Context.Tag
```

### 3.2 Effect-TS開発ルール

**必須遵守事項**:

1. **class 使用禁止**: 全て Schema.Struct で定義
2. **Data.TaggedError 禁止**: Schema でエラー定義
3. **Context.GenericTag 使用**: "@app/ServiceName" 形式
4. **Match.value 使用**: if/else/switch の代わり
5. **早期リターン**: ガード句で最適化
6. **純粋関数**: 副作用のない計算ロジック

### 3.3 型チェックの設定

```bash
# TypeScript の厳格な設定
pnpm type-check

# watch モード
pnpm type-check:watch
```

## 4. 開発サーバーの起動

### 4.1 基本的な起動

```bash
# 開発サーバー起動（ホットリロード有効）
pnpm dev

# ブラウザで以下にアクセス
# http://localhost:5173
```

### 4.2 デバッグモード

```bash
# デバッグモードで起動
VITE_DEBUG_MODE=true pnpm dev

# パフォーマンスプロファイリング有効
VITE_ENABLE_PROFILING=true pnpm dev
```

### 4.3 各種開発コマンド

```bash
# リント実行
pnpm lint

# フォーマット
pnpm format

# テスト実行
pnpm test

# テスト（watch モード）
pnpm test:watch

# カバレッジ
pnpm test:coverage

# ビルド
pnpm build

# ビルド結果のプレビュー
pnpm preview
```

## 5. 開発フロー

### 5.1 Effect-TS新機能実装フロー

```typescript
// 1. Schema定義
const FeatureRequest = Schema.Struct({
  _tag: Schema.Literal("FeatureRequest"),
  id: Schema.String.pipe(Schema.brand("FeatureId")),
  name: Schema.String,
  description: Schema.String
})
type FeatureRequest = Schema.Schema.Type<typeof FeatureRequest>

// 2. サービスインターフェース
interface FeatureService {
  readonly implement: (request: FeatureRequest) => Effect.Effect<Feature, FeatureError>
}

// 3. Context定義
const FeatureService = Context.GenericTag<FeatureService>("@app/FeatureService")

// 4. 実装
const FeatureServiceLive = Layer.effect(
  FeatureService,
  Effect.gen(function* () => ({
    implement: (request) => Effect.gen(function* () => {
      // 早期リターンでバリデーション
      if (!request.name.trim()) {
        return yield* Effect.fail(new FeatureError({ message: "Name is required" }))
      }

      // 実装ロジック...
    })
  }))
)
```

1. **Context7 で仕様確認**
   ```bash
   # Effect-TS の最新パターンを確認
   pnpm check:patterns
   ```

2. **ブランチ作成**
   ```bash
   git checkout -b feature/new-feature
   ```

3. **テストファースト**
   ```typescript
   // __tests__/new-feature.test.ts
   import { Effect, TestContext } from "effect"

   describe("NewFeature", () => {
     it("should work correctly", () =>
       Effect.gen(function* () {
         // テスト実装
       }).pipe(
         Effect.provide(TestContext.TestContext),
         Effect.runPromise
       ))
   })
   ```

4. **実装**
   ```typescript
   // src/domain/services/new-feature.service.ts
   import { Effect, Layer, Context } from "effect"

   export class NewFeatureService extends Context.Tag("NewFeatureService")<
     NewFeatureService,
     {
       readonly operation: () => Effect.Effect<Result, Error>
     }
   >() {}
   ```

5. **型チェック**
   ```bash
   pnpm type-check
   ```

6. **テスト実行**
   ```bash
   pnpm test
   ```

7. **コミット**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

## 6. トラブルシューティング

### 6.1 よくある問題

#### pnpm install でエラー

```bash
# キャッシュクリア
pnpm store prune

# node_modules 削除
rm -rf node_modules

# 再インストール
pnpm install
```

#### TypeScript エラー

```bash
# TypeScript サーバーリスタート（VS Code）
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# tsconfig のチェック
pnpm type-check --listFiles
```

#### Effect-TS パターンエラー

```typescript
// ❌ 古いパターン
const old = Effect.sync(() => value)

// ✅ 新しいパターン（Context7 で確認）
const new = Effect.gen(function* () {
  return value
})
```

### 6.2 パフォーマンス問題

```bash
# Chrome DevTools でプロファイリング
1. F12 でDevTools を開く
2. Performance タブ
3. Record ボタンで記録開始
4. 問題の操作を実行
5. Stop で記録停止

# Lighthouse でパフォーマンス測定
pnpm build
pnpm preview
# Lighthouse を実行
```

## 7. 推奨される開発環境

### 7.1 ハードウェア要件

| コンポーネント | 最小要件 | 推奨要件 |
|---------------|---------|---------|
| CPU | 4コア | 8コア以上 |
| メモリ | 8GB | 16GB以上 |
| ストレージ | 10GB | SSD 20GB以上 |
| GPU | 統合GPU | 専用GPU |

### 7.2 ブラウザ要件

- **Chrome**: 90以上（推奨）
- **Firefox**: 88以上
- **Safari**: 14以上
- **Edge**: 90以上

### 7.3 追加ツール

```bash
# Chrome 拡張機能
- React Developer Tools
- Redux DevTools

# デバッグツール
- VS Code Debugger for Chrome
- Node.js Inspector

# パフォーマンス分析
- Chrome DevTools
- Lighthouse
```

## 8. CI/CD 環境

### 8.1 GitHub Actions

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm type-check
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

### 8.2 pre-commit hooks

`.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm type-check
pnpm lint-staged
```

## 9. アセット・リソース管理

### 9.1 フリーテクスチャリソース

Minecraft クローン開発で使用できるフリーテクスチャの主要な入手先：

#### OpenGameArt
- **URL**: [OpenGameArt.org](https://opengameart.org/)
- **特徴**: CC0ライセンスのMinecraftインスパイア系テクスチャが豊富
- **おすすめ**: [CC0 Minecraft Inspired Textures](https://opengameart.org/content/cc0-minecraft-inspired-textures)

#### Modrinth
- **URL**: [modrinth.com/resourcepacks](https://modrinth.com/resourcepacks)
- **特徴**: 数千のMinecraftリソースパックが検索可能
- **フィルター**: カテゴリ、解像度、バージョン別の絞り込み可能

#### Pixabay
- **URL**: [pixabay.com](https://pixabay.com/)
- **特徴**: 商用利用可能、帰属表示不要のテクスチャ
- **検索**: "minecraft texture" "game texture" でヒット

#### ResourcePack.net & Texture-Packs.com
- **特徴**: デフォルト、リアル、現代風、中世風、PvP、漫画風など多様なスタイル
- **利用**: 多くは無料、一部は有料プレミアム

### 9.2 フリー音楽・効果音リソース

#### Freesound.org
- **URL**: [freesound.org](https://freesound.org/)
- **特徴**: Creative Commonsライセンスの音響データベース
- **内容**: サンプル、録音、ビープ音、環境音など

#### Pixabay Audio
- **URL**: [pixabay.com/music/](https://pixabay.com/music/)
- **特徴**: ロイヤリティフリー、帰属表示不要
- **カテゴリ**: ゲーム開発向け音楽・効果音

#### Art Game Sound
- **URL**: [artgamesound.com](https://artgamesound.com/)
- **特徴**: 35万以上のCC0アセット検索アプリ
- **内容**:
  - 340,222 音響効果・音楽ファイル
  - 11,064 3Dモデル
  - 7,918 2Dアート
  - 6,429 テクスチャ

#### itch.io CC0 Assets
- **URL**: [itch.io/game-assets/assets-cc0](https://itch.io/game-assets/assets-cc0)
- **特徴**: CC0ライセンスのゲームアセット
- **例**: Audio Super Kit、Interface SFX Pack、Horror Audio Bundle

### 9.3 開発ツール

#### Minecraft Texture Studio
- **URL**: [SourceForge](https://sourceforge.net/projects/minecrafttexturestudio/)
- **特徴**: リソースパック作成用の無料ツール
- **機能**: Minecraftインストールの自動検出、テクスチャ編集

#### 推奨画像編集ツール
- **Aseprite**: ピクセルアート特化（有料）
- **Photopea**: オンライン無料画像編集（Photoshop互換）
- **GIMP**: 無料の高機能画像編集
- **MS Paint**: シンプルなピクセル編集

### 9.4 ライセンス管理

#### CC0 (Creative Commons Zero)
```typescript
// ライセンス不要、商用利用可、帰属表示不要
const cc0Asset = {
  license: "CC0",
  attribution: false,
  commercial: true,
  modifications: true
}
```

#### Creative Commons ライセンス
```typescript
// 各ライセンスの確認が必要
const ccLicenses = {
  "CC BY": "帰属表示必須",
  "CC BY-SA": "帰属表示 + 継承",
  "CC BY-NC": "帰属表示 + 非商用のみ",
  "CC BY-NC-SA": "帰属表示 + 非商用 + 継承"
}
```

### 9.5 アセット管理のベストプラクティス

#### ディレクトリ構造
```
public/
├── assets/
│   ├── textures/
│   │   ├── blocks/
│   │   ├── items/
│   │   └── ui/
│   ├── sounds/
│   │   ├── ambient/
│   │   ├── effects/
│   │   └── music/
│   └── models/
│       ├── blocks/
│       └── entities/
```

#### ライセンス記録
```typescript
// src/assets/license-registry.ts
export const assetLicenses = {
  "grass-texture.png": {
    source: "OpenGameArt",
    license: "CC0",
    author: "Artist Name",
    url: "https://opengameart.org/content/..."
  }
} as const
```

#### アセット読み込み
```typescript
// src/shared/asset-loader.ts
import { Effect } from "effect"

export const loadTexture = (path: string) =>
  Effect.gen(function* () {
    const texture = yield* Effect.tryPromise(() =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = `/assets/textures/${path}`
      })
    )
    return texture
  })
```

### 9.6 品質チェック

#### テクスチャ要件
- **解像度**: 16x16, 32x32, 64x64, 128x128 (2の累乗)
- **フォーマット**: PNG（透明度対応）
- **圧縮**: 可逆圧縮推奨
- **命名**: kebab-case（例：`grass-block.png`）

#### 音響要件
- **フォーマット**: OGG Vorbis または MP3
- **サンプリング**: 44.1kHz / 22.05kHz
- **ビットレート**: 128-192 kbps
- **長さ**: 効果音は1-3秒、BGMは1-5分

#### パフォーマンス考慮
```typescript
// アセット遅延読み込み
const LazyAssetLoader = Effect.gen(function* () {
  const cache = new Map<string, any>()

  return {
    loadTexture: (path: string) =>
      cache.has(path)
        ? Effect.succeed(cache.get(path))
        : Effect.gen(function* () {
            const texture = yield* loadTexture(path)
            cache.set(path, texture)
            return texture
          })
  }
})
```

## 次のステップ

環境構築が完了したら、以下のドキュメントに進んでください：

1. [**コーディング規約**](./01-coding-standards.md) - コードスタイルガイド
2. [**Getting Started**](../guides/getting-started.md) - 最初の実装
3. [**Core Features**](../05-core-features/00-overview.md) - 基本機能の実装