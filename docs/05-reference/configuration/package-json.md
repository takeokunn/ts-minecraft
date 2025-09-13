# package.json リファレンス

TypeScript Minecraftプロジェクトの`package.json`設定完全リファレンスです。

## 📋 基本情報

```json
{
  "name": "ts-minecraft",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false
}
```

| フィールド | 値 | 説明 |
|-----------|---|------|
| `name` | `ts-minecraft` | プロジェクト名 |
| `private` | `true` | npm公開を禁止（プライベートプロジェクト） |
| `version` | `0.0.0` | セマンティックバージョニング |
| `type` | `module` | ES Modules使用を宣言 |
| `sideEffects` | `false` | Tree-shakingの最適化を有効化 |

## 🚀 スクリプト定義

### 開発・ビルドスクリプト

| スクリプト | コマンド | 説明 |
|-----------|---------|------|
| `dev` | `vite` | 開発サーバー起動 |
| `build` | `tsc && vite build` | TypeScript型チェック後にビルド |
| `type-check` | `tsc --pretty` | TypeScript型チェック |
| `typecheck` | `tsc --pretty` | 型チェック（エイリアス） |

**使用例**:
```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# 型チェックのみ実行
npm run type-check
```

### テストスクリプト

| スクリプト | コマンド | 説明 |
|-----------|---------|------|
| `test` | `vitest` | Vitestによるテスト実行 |

**使用例**:
```bash
# テスト実行
npm test

# ウォッチモード
npm test -- --watch

# カバレッジ付きテスト
npm test -- --coverage
```

### 品質管理スクリプト

| スクリプト | コマンド | 説明 |
|-----------|---------|------|
| `lint` | `oxlint --deny-warnings --allow no-restricted-globals` | OXLint による高速リント |
| `lint:fix` | `oxlint --fix` | 自動修正可能なリントエラーを修正 |
| `format` | `prettier --write . --ignore-path .gitignore && oxlint --fix` | コード整形 + リント修正 |
| `format:check` | `prettier --check . --ignore-path .gitignore` | 整形チェック（修正なし） |

**使用例**:
```bash
# リントチェック
npm run lint

# フォーマット実行
npm run format

# CI用フォーマットチェック
npm run format:check
```

## 📦 依存関係

### 本番依存関係 (dependencies)

#### Effect-TS エコシステム
```json
{
  "@effect/platform": "^0.90.9",
  "@effect/schema": "^0.75.5",
  "effect": "^3.17.13"
}
```

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| `effect` | `^3.17.13` | Effect-TSコア機能 |
| `@effect/schema` | `^0.75.5` | スキーマ定義・バリデーション |
| `@effect/platform` | `^0.90.9` | プラットフォーム固有機能 |

#### 3Dグラフィックス
```json
{
  "three": "^0.179.1",
  "gl-matrix": "^3.4.4",
  "stats.js": "^0.17.0"
}
```

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| `three` | `^0.179.1` | 3Dレンダリングライブラリ |
| `gl-matrix` | `^3.4.4` | WebGL行列演算 |
| `stats.js` | `^0.17.0` | パフォーマンス監視 |

#### ユーティリティ
```json
{
  "alea": "^1.0.1",
  "simplex-noise": "^4.0.3",
  "uuid": "^11.1.0"
}
```

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| `alea` | `^1.0.1` | シード可能な疑似乱数生成器 |
| `simplex-noise` | `^4.0.3` | Minecraft地形生成用ノイズ |
| `uuid` | `^11.1.0` | ユニークID生成 |

### 開発依存関係 (devDependencies)

#### TypeScript・ビルドツール
```json
{
  "typescript": "^5.9.2",
  "vite": "^7.1.5",
  "vite-tsconfig-paths": "^5.1.4",
  "tsx": "^4.20.5"
}
```

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| `typescript` | `^5.9.2` | TypeScriptコンパイラ |
| `vite` | `^7.1.5` | 高速ビルドツール |
| `vite-tsconfig-paths` | `^5.1.4` | TypeScriptパスマッピング |
| `tsx` | `^4.20.5` | TypeScript実行環境 |

#### テスト関連
```json
{
  "vitest": "^3.2.4",
  "@vitest/coverage-v8": "^3.2.4",
  "@vitest/ui": "^3.2.4",
  "@effect/vitest": "^0.25.1",
  "@effect/test": "^0.1.0",
  "canvas": "^3.2.0"
}
```

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| `vitest` | `^3.2.4` | 高速テストランナー |
| `@vitest/coverage-v8` | `^3.2.4` | コードカバレッジ |
| `@vitest/ui` | `^3.2.4` | テストUI |
| `@effect/vitest` | `^0.25.1` | Effect-TS用Vitestプラグイン |
| `@effect/test` | `^0.1.0` | Effect-TS用テストユーティリティ |
| `canvas` | `^3.2.0` | Node.js Canvas API (テスト用) |

#### 品質管理ツール
```json
{
  "oxlint": "^1.15.0",
  "prettier": "^3.6.2",
  "madge": "^8.0.0"
}
```

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| `oxlint` | `^1.15.0` | Rust製高速リンター |
| `prettier` | `^3.6.2` | コードフォーマッター |
| `madge` | `^8.0.0` | 依存関係分析ツール |

#### 型定義
```json
{
  "@types/three": "^0.179.0",
  "@types/uuid": "^10.0.0",
  "@types/file-saver": "^2.0.7",
  "@types/stats.js": "^0.17.4",
  "@webgpu/types": "^0.1.64"
}
```

#### イメージ処理
```json
{
  "sharp": "^0.34.3"
}
```

## 🔧 依存関係管理

### バージョン戦略

| 記号 | 意味 | 例 | 説明 |
|------|------|---|------|
| `^` | メジャーバージョン固定 | `^3.17.13` | 3.x.x の最新 |
| `~` | マイナーバージョン固定 | `~3.17.13` | 3.17.x の最新 |
| 固定 | 完全固定 | `3.17.13` | 完全に固定 |

### 依存関係の更新

```bash
# 依存関係の確認
npm outdated

# 依存関係の更新
npm update

# セキュリティ脆弱性の確認
npm audit

# 脆弱性の自動修正
npm audit fix
```

### 依存関係の追加・削除

```bash
# 本番依存関係の追加
npm install <package-name>

# 開発依存関係の追加
npm install -D <package-name>

# 依存関係の削除
npm uninstall <package-name>

# 特定バージョンの指定
npm install effect@^3.17.13
```

## 🎯 カスタマイゼーション

### 新しいスクリプトの追加

```json
{
  "scripts": {
    "dev:debug": "DEBUG=true npm run dev",
    "build:analyze": "npm run build && npx vite-bundle-analyzer",
    "test:debug": "npm test -- --inspect-brk",
    "deps:check": "madge --circular src/",
    "deps:graph": "madge --image deps.svg src/"
  }
}
```

### 環境変数の設定

```json
{
  "scripts": {
    "dev": "NODE_ENV=development vite",
    "build": "NODE_ENV=production tsc && vite build",
    "test": "NODE_ENV=test vitest"
  }
}
```

## 📊 パッケージ情報

### 総計
- **本番依存関係**: 8パッケージ
- **開発依存関係**: 19パッケージ
- **総スクリプト数**: 8個

### サイズ分析
```bash
# パッケージサイズ分析
npx cost-of-modules

# バンドルサイズ分析
npm run build && npx vite-bundle-analyzer
```

## 🚨 注意事項

### セキュリティ

1. **private: true**
   - npm公開を防ぐ重要な設定
   - 誤って公開されることを防止

2. **依存関係の脆弱性**
   ```bash
   # 定期的な脆弱性チェック
   npm audit

   # 高・重要度の脆弱性のみ表示
   npm audit --audit-level high
   ```

### パフォーマンス

1. **sideEffects: false**
   - Tree-shakingの最適化
   - バンドルサイズの削減

2. **type: module**
   - ES Modulesの使用
   - モダンなモジュールシステム

## 🔍 トラブルシューティング

### よくある問題

#### 依存関係の競合
```bash
# package-lock.jsonを削除して再インストール
rm package-lock.json
npm install
```

#### TypeScriptバージョン競合
```bash
# ローカルTypeScriptバージョン確認
npx tsc --version

# グローバルTypeScriptバージョン確認
tsc --version
```

#### スクリプト実行エラー
```bash
# 権限問題の解決
chmod +x node_modules/.bin/*

# パスの確認
echo $PATH
```

## 🔗 関連リソース

- [TypeScript Config](./typescript-config.md) - TypeScript設定の詳細
- [Vite Config](./vite-config.md) - Vite設定の詳細
- [CLI Commands](../cli-commands/README.md) - package.jsonスクリプトの実行方法
- [Troubleshooting](../troubleshooting/dependency-issues.md) - 依存関係問題の解決方法