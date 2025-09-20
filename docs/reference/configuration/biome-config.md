# Biome 設定ファイル

## 概要

`biome.json`は、コードの品質管理とフォーマットを統合的に制御する設定ファイルです。
Biomeは、ESLintとPrettierの機能を統合した高速なRustベースのツールです。

## 設定ファイル構造

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignore": ["node_modules", "dist", "coverage", "*.min.js", "*.lock", "pnpm-lock.yaml"]
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineEnding": "lf",
    "lineWidth": 120,
    "attributePosition": "auto"
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": { /* ... */ },
      "correctness": { /* ... */ },
      "security": { /* ... */ },
      "style": { /* ... */ },
      "suspicious": { /* ... */ }
    }
  },
  "javascript": {
    "formatter": {
      "jsxQuoteStyle": "double",
      "quoteProperties": "asNeeded",
      "trailingCommas": "es5",
      "semicolons": "asNeeded",
      "arrowParentheses": "always",
      "bracketSpacing": true,
      "bracketSameLine": false,
      "quoteStyle": "single",
      "attributePosition": "auto"
    }
  },
  "json": {
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "lineEnding": "lf",
      "lineWidth": 120,
      "trailingCommas": "none"
    }
  }
}
```

## 主要設定項目

### VCS 統合

```json
"vcs": {
  "enabled": true,
  "clientKind": "git",
  "useIgnoreFile": true
}
```

- **enabled**: バージョン管理システムとの統合を有効化
- **clientKind**: 使用するVCSの種類（git）
- **useIgnoreFile**: .gitignoreファイルを考慮

### ファイル管理

```json
"files": {
  "ignore": ["node_modules", "dist", "coverage", "*.min.js", "*.lock", "pnpm-lock.yaml"]
}
```

チェック対象から除外するファイル・ディレクトリを指定します。

### フォーマッター設定

```json
"formatter": {
  "enabled": true,
  "formatWithErrors": false,
  "indentStyle": "space",
  "indentWidth": 2,
  "lineEnding": "lf",
  "lineWidth": 120
}
```

#### 主要設定

| 設定項目 | 値 | 説明 |
|---------|-----|------|
| `indentStyle` | `"space"` | インデントにスペースを使用 |
| `indentWidth` | `2` | インデント幅は2文字 |
| `lineEnding` | `"lf"` | 改行コードはLF（Unix形式） |
| `lineWidth` | `120` | 1行の最大文字数 |

### JavaScript/TypeScript 固有設定

```json
"javascript": {
  "formatter": {
    "quoteStyle": "single",
    "semicolons": "asNeeded",
    "trailingCommas": "es5",
    "arrowParentheses": "always"
  }
}
```

| 設定項目 | 値 | 説明 |
|---------|-----|------|
| `quoteStyle` | `"single"` | シングルクォートを使用 |
| `semicolons` | `"asNeeded"` | 必要な場合のみセミコロン |
| `trailingCommas` | `"es5"` | ES5準拠の末尾カンマ |
| `arrowParentheses` | `"always"` | アロー関数の引数は常に括弧で囲む |

### リンタールール

#### 主要カテゴリ

1. **complexity**: コードの複雑性に関するルール
2. **correctness**: 正確性に関するルール
3. **security**: セキュリティに関するルール
4. **style**: コードスタイルに関するルール
5. **suspicious**: 疑わしいコードパターンの検出

#### 重要なルール

```json
{
  "style": {
    "noVar": "error",
    "useConst": "error",
    "useNodejsImportProtocol": "error"
  },
  "correctness": {
    "noUnusedVariables": "error"
  },
  "suspicious": {
    "noConsoleLog": "off"
  }
}
```

## コマンドリファレンス

### 基本コマンド

```bash
# チェック（リントとフォーマット）
pnpm lint

# 自動修正
pnpm lint:fix

# フォーマットのみ
pnpm format

# フォーマットチェック（修正なし）
pnpm format:check
```

### 詳細なコマンドオプション

```bash
# 特定ファイルのチェック
pnpm biome check src/index.ts

# ワンライナーで全修正
pnpm biome check --write .

# CI/CD用（エラー時に非ゼロ終了）
pnpm biome check --error-on-warnings .

# フォーマットのみ実行
pnpm biome format --write .

# import文の整理のみ
pnpm biome check --organize-imports-only .
```

## 移行ガイド

### ESLint/Prettierからの移行

#### 以前の設定（削除済み）
- `.eslintrc.json` - ESLint設定
- `.prettierrc` - Prettier設定
- `oxlintrc.json` - oxlint設定

#### 設定の対応表

| Prettier設定 | Biome設定 |
|-------------|-----------|
| `semi: false` | `semicolons: "asNeeded"` |
| `singleQuote: true` | `quoteStyle: "single"` |
| `tabWidth: 2` | `indentWidth: 2` |
| `trailingComma: "es5"` | `trailingCommas: "es5"` |
| `printWidth: 120` | `lineWidth: 120` |
| `arrowParens: "always"` | `arrowParentheses: "always"` |

| oxlint設定 | Biome設定 |
|-----------|-----------|
| `no-var: error` | `noVar: "error"` |
| `prefer-const: error` | `useConst: "error"` |
| `no-unused-vars: error` | `noUnusedVariables: "error"` |
| `no-console: off` | `noConsoleLog: "off"` |

## トラブルシューティング

### よくある問題

#### 1. Node.jsプロトコルエラー

```javascript
// ❌ エラー
import { readFile } from 'fs'

// ✅ 修正後
import { readFile } from 'node:fs'
```

**解決方法**:
```bash
pnpm lint:fix
```

#### 2. フォーマット競合

既存のコードスタイルとBiomeのデフォルト設定が競合する場合：

```bash
# 全ファイルを一括フォーマット
pnpm biome check --write .

# 段階的に適用
pnpm biome check --write src/
```

#### 3. CI/CDでのエラー

```yaml
# GitHub Actions での使用例
- name: Biome check
  run: pnpm lint
```

エラーが発生した場合、ローカルで以下を実行：

```bash
# CIと同じ条件でチェック
pnpm biome check --error-on-warnings .
```

## ベストプラクティス

### 1. コミット前のチェック

```bash
# git hooks との統合
pnpm biome check --write . && git add -A
```

### 2. VS Code設定

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "quickfix.biome": true,
    "source.organizeImports.biome": true
  }
}
```

### 3. パフォーマンス最適化

```bash
# 並列処理の有効化
BIOME_MAX_DIAGNOSTICS=50 pnpm lint

# キャッシュの活用
pnpm biome check --use-cache .
```

## 関連リンク

- [Biome公式ドキュメント](https://biomejs.dev/)
- [プロジェクト設定概要](./README.md)
- [開発コマンドリファレンス](../cli/development-commands.md)