---
title: "開発コマンド - 開発フロー完全リファレンス"
description: "開発・ビルド・品質管理に関するCLIコマンドの完全リファレンス。pnpm、Vite、TypeScript、リント関連コマンド。"
category: "reference"
difficulty: "beginner"
tags: ["development", "cli", "pnpm", "vite", "typescript", "linting"]
prerequisites: ["basic-cli"]
estimated_reading_time: "12分"
dependencies: []
status: "complete"
---

# 開発コマンド

開発・ビルド・品質管理に関するCLIコマンドの完全リファレンスです。

## 📋 コマンド一覧

| コマンド | 用途 | 実行時間 | 説明 |
|---------|------|---------|------|
| `pnpm dev` | 開発サーバー起動 | 2-5秒 | Vite開発サーバーの起動 |
| `pnpm build` | プロダクションビルド | 30-60秒 | 最適化されたビルドの生成 |
| `pnpm preview` | ビルド結果プレビュー | 1-3秒 | ビルドしたアプリのプレビュー |
| `pnpm clean` | キャッシュクリア | 1-2秒 | ビルドキャッシュの削除 |
| `pnpm lint` | ESLintチェック | 3-8秒 | コード品質のチェック |
| `pnpm lint:fix` | ESLint自動修正 | 5-12秒 | 修正可能なリントエラーの自動修正 |
| `pnpm format` | コード整形 | 2-5秒 | Prettierによるコード整形 |
| `pnpm typecheck` | 型チェック | 5-15秒 | TypeScriptの型チェック |
| `pnpm check` | 全品質チェック | 10-30秒 | lint + format + type-checkの一括実行 |

## 🚀 開発コマンド

### dev
開発サーバーを起動します。

```bash
pnpm dev
```

**詳細仕様**:
- **ポート**: デフォルト5173、環境変数`PORT`で変更可能
- **HMR**: Hot Module Replacementが有効
- **TypeScript**: リアルタイム型チェック
- **Three.js**: WebGL デバッグツールが利用可能

**オプション**:
```bash
# ポート指定
PORT=3000 pnpm dev

# デバッグモード
DEBUG=true pnpm dev

# ホスト指定（ネットワーク公開）
pnpm dev -- --host 0.0.0.0

# HTTPS有効化
pnpm dev -- --https
```

**パフォーマンス指標**:
- 初回起動: 2-5秒
- HMR更新: 50-200ms
- メモリ使用量: 200-400MB

### build
プロダクション用にアプリケーションをビルドします。

```bash
pnpm build
```

**詳細仕様**:
- **出力先**: `dist/` ディレクトリ
- **最適化**: Tree-shaking、Minification、Code Splitting
- **アセット**: ハッシュ付きファイル名での出力
- **Three.js**: プロダクション最適化

**ビルド成果物**:
```
dist/
├── index.html          # メインHTMLファイル
├── assets/
│   ├── index-[hash].js # メインJavaScriptバンドル
│   ├── index-[hash].css # スタイルシート
│   └── textures/        # ゲームテクスチャ
└── models/              # 3Dモデルファイル
```

**環境変数での制御**:
```bash
# ビルド最適化レベル
BUILD_OPTIMIZATION=aggressive pnpm build

# ソースマップ生成
GENERATE_SOURCEMAP=true pnpm build

# バンドル分析
ANALYZE_BUNDLE=true pnpm build
```

**パフォーマンス指標**:
- ビルド時間: 30-60秒
- 出力サイズ: 2-5MB（gzip圧縮前）
- メモリ使用量: 800MB-1.2GB

### preview
ビルドされたアプリケーションをプレビューします。

```bash
pnpm preview
```

**詳細仕様**:
- **前提条件**: `pnpm build` の実行が必要
- **ポート**: デフォルト4173
- **サーバー**: 静的ファイルサーバーとして動作

**オプション**:
```bash
# ポート指定
pnpm preview -- --port 8080

# ホスト指定
pnpm preview -- --host 0.0.0.0
```

### clean
ビルドキャッシュを削除します。

```bash
pnpm clean
```

**削除対象**:
- `dist/` ディレクトリ
- `node_modules/.vite/` キャッシュ
- TypeScriptビルド情報

## 🔍 品質管理コマンド

### lint
ESLintによるコード品質チェックを実行します。

```bash
pnpm lint
```

**チェック項目**:
- Effect-TSコーディング規約
- 関数型プログラミングパターン
- TypeScript型安全性
- パフォーマンス最適化

**設定ファイル**: `.eslintrc.json`

**オプション**:
```bash
# 特定ファイルのみチェック
pnpm lint src/core/

# 詳細モード
pnpm lint -- --verbose

# 警告も含めて表示
pnpm lint -- --max-warnings 0
```

### lint:fix
修正可能なESLintエラーを自動修正します。

```bash
pnpm lint:fix
```

**自動修正対象**:
- インデント、セミコロン等の形式的エラー
- import文の順序
- 未使用変数の削除（安全な場合のみ）

### format
Prettierによるコード整形を実行します。

```bash
pnpm format
```

**整形対象**:
- TypeScript (`.ts`, `.tsx`)
- JSON (`.json`)
- Markdown (`.md`)

**設定ファイル**: `.prettierrc`

**オプション**:
```bash
# 特定ディレクトリのみ
pnpm format src/

# チェックのみ（修正なし）
pnpm format -- --check
```

### type-check
TypeScriptの型チェックを実行します。

```bash
pnpm typecheck
```

**チェック内容**:
- 型安全性の検証
- Effect-TSパターンの適切性
- Schema定義の整合性

**設定ファイル**: `tsconfig.json`

**オプション**:
```bash
# 詳細エラー表示
pnpm typecheck -- --verbose

# 増分チェック無効化
pnpm typecheck -- --force
```

### check
全品質チェックを一括実行します。

```bash
pnpm check
```

**実行順序**:
1. `pnpm lint`
2. `pnpm format --check`
3. `pnpm typecheck`

**CI/CD推奨**: 継続的インテグレーションで使用

## 🛠️ カスタマイゼーション

### 開発サーバー設定

`vite.config.ts`での設定例:
```typescript
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    https: true,
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
})
```

### ESLint設定拡張

`.eslintrc.json`での設定例:
```json
{
  "extends": ["@effect/eslint-config"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "functional/no-classes": "error"
  }
}
```

### Prettier設定調整

`.prettierrc`での設定例:
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

## 🐛 トラブルシューティング

### よくある問題と解決策

#### ポートが既に使用中
```bash
# エラー: Port 5173 is already in use
PORT=3000 pnpm dev
```

#### メモリ不足エラー
```bash
# Node.jsメモリ制限を増加
NODE_OPTIONS="--max-old-space-size=4096" pnpm build
```

#### 型チェックが遅い
```bash
# 増分ビルド有効化
pnpm typecheck -- --incremental
```

#### ESLintキャッシュ問題
```bash
# ESLintキャッシュをクリア
pnpm lint -- --no-cache
```

## 📊 パフォーマンス最適化

### ビルド速度向上
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'effect': ['effect', '@effect/schema'],
          'three': ['three']
        }
      }
    }
  }
})
```

### 開発サーバー最適化
```typescript
export default defineConfig({
  optimizeDeps: {
    include: ['effect', '@effect/schema', 'three'],
    exclude: ['@effect/platform-node']
  }
})
```

## 🔗 関連リソース

- [Configuration Reference](../configuration/vite-config.md) - Vite設定の詳細
- [Testing Commands](./testing-commands.md) - テスト関連コマンド
- [Troubleshooting](../troubleshooting/build-errors.md) - ビルドエラーの対処法