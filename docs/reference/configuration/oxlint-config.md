---
title: 'Oxlint設定 - Rust製高速リンター設定ガイド'
description: '超高速Rust製リンターOxlintの設定・ルール・パフォーマンス最適化。ESLintの50-100倍高速なコード品質管理。'
category: 'reference'
difficulty: 'intermediate'
tags: ['oxlint', 'linter', 'rust', 'configuration', 'performance', 'code-quality']
prerequisites: ['basic-typescript']
estimated_reading_time: '10分'
dependencies: []
status: 'complete'
---

# oxlint Configuration

> **oxlint設定**: Rust製の超高速リンターによるコード品質管理

## 概要

TypeScript Minecraftプロジェクトのoxlint設定について解説します。oxlintはRust製の高速リンターで、ESLintの**50-100倍以上高速**に動作します。

## 基本設定

### oxlintrc.json

```json
{
  "rules": {
    // TypeScript固有のルール
    "no-unused-vars": "error",
    "no-explicit-any": "error",
    "prefer-const": "error",
    "no-console": "warn",
    "no-debugger": "error",

    // Import関連
    "import/no-cycle": "error",
    "import/no-self-import": "error",

    // 型安全性
    "no-undef": "error",
    "no-redeclare": "error",

    // パフォーマンス最適化
    "no-sparse-arrays": "error",
    "no-constant-binary-expression": "error"
  },
  "ignore": ["node_modules", "dist", "coverage", "*.config.js", "*.config.ts"],
  "env": {
    "browser": true,
    "node": true
  }
}
```

## ESLintからの移行ガイド

### パフォーマンス比較

| メトリクス               | ESLint | oxlint | 改善率 |
| ------------------------ | ------ | ------ | ------ |
| 実行時間（1000ファイル） | 30秒   | 0.3秒  | 100倍  |
| メモリ使用量             | 500MB  | 50MB   | 10倍   |
| CI/CDパイプライン時間    | 5分    | 30秒   | 10倍   |

### 移行手順

1. **oxlintのインストール**

```bash
npm install --save-dev oxlint
# または
pnpm add -D oxlint
```

2. **設定ファイルの作成**

```bash
# ESLint設定から自動変換
npx oxlint init --from-eslint .eslintrc.json
```

3. **package.jsonのスクリプト更新**

```json
{
  "scripts": {
    "lint": "oxlint .",
    "lint:fix": "oxlint . --fix"
  }
}
```

## Effect-TS用最適化設定

### 関数型プログラミング向け設定

```json
{
  "rules": {
    // 純粋性の保証
    "no-param-reassign": "error",
    "no-mutating-methods": "warn",

    // Effect-TSパターン
    "prefer-arrow-callback": "error",
    "arrow-body-style": ["error", "as-needed"],

    // 副作用の検出
    "no-floating-promises": "error",
    "require-await": "error",

    // 型の厳密性
    "strict-boolean-expressions": "error",
    "no-implicit-coercion": "error"
  }
}
```

## カスタムルール設定

### 開発環境用設定

```json
{
  "extends": "oxlint:recommended",
  "rules": {
    "no-console": "off",
    "no-debugger": "warn"
  }
}
```

### 本番環境用設定

```json
{
  "extends": "oxlint:strict",
  "rules": {
    "no-console": "error",
    "no-debugger": "error",
    "no-alert": "error"
  }
}
```

### テスト環境用設定

```json
{
  "overrides": [
    {
      "files": ["**/*.test.ts", "**/*.spec.ts"],
      "rules": {
        "no-console": "off",
        "max-lines": "off"
      }
    }
  ]
}
```

## エディタ統合

### エディタ設定の例

多くのエディタでOxlintを統合できます。以下は設定例です：

```json
{
  "oxlint.enable": true,
  "oxlint.run": "onSave",
  "oxlint.autoFixOnSave": true,
  "oxlint.packageManager": "pnpm",

  // ESLintを無効化
  "eslint.enable": false
}
```

お使いのエディタのOxlint拡張機能のドキュメントをご確認ください。

## CI/CD統合

### GitHub Actions

```yaml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx oxlint .
```

## トラブルシューティング

### よくある問題と解決策

#### 1. TypeScriptパス解決エラー

```json
{
  "settings": {
    "resolver": {
      "typescript": {
        "project": "./tsconfig.json"
      }
    }
  }
}
```

#### 2. モノレポでの設定

```json
{
  "workspaces": ["packages/*"],
  "rules": {
    // 共通ルール
  }
}
```

#### 3. パフォーマンスチューニング

```json
{
  "parallel": true,
  "cache": true,
  "cacheLocation": ".oxlint-cache"
}
```

## ベストプラクティス

### 1. 段階的な厳密化

```json
{
  "severity": {
    "default": "warning",
    "production": "error"
  }
}
```

### 2. カスタムプラグインの活用

```javascript
// .oxlint/plugins/ddd-rules.js
module.exports = {
  rules: {
    'ddd/aggregate-immutability': 'error',
    'ddd/value-object-equality': 'error',
  },
}
```

### 3. pre-commitフックの設定

```json
// .husky/pre-commit
{
  "hooks": {
    "pre-commit": "oxlint --fix --staged"
  }
}
```

## 他ツールとの連携

### Prettierとの併用

```json
{
  "extends": ["oxlint:recommended", "prettier"],
  "rules": {
    // Prettierと競合しないルールのみ
  }
}
```

### TypeScript compilerとの連携

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "oxlint-typescript-plugin"
      }
    ]
  }
}
```

## パフォーマンス最適化

### キャッシュの活用

```bash
# キャッシュを有効にして実行
oxlint . --cache --cache-location node_modules/.cache/oxlint
```

### 並列実行の設定

```json
{
  "parallel": true,
  "maxWorkers": 4
}
```

## ⚡ パフォーマンス影響

### ビルドへの影響

- **開発時**: リント時間 0.3秒（1000ファイル）
- **CI/CD**: パイプライン時間30秒短縮
- **メモリ使用量**: ESLintの1/10（50MB程度）

### 開発効率への影響

- **即座のフィードバック**: ファイル保存時にリアルタイム検証
- **低CPU使用率**: バックグラウンド実行でも開発環境に影響なし
- **高速修正**: `--fix`オプションで瞬時にコード修正

## 関連項目

- [TypeScript設定](./typescript-config.md)
- [Vite設定](./vite-config.md)
- [開発環境設定](./development-config.md)
- [CI/CD設定](../../04-development/ci-cd-setup.md)
