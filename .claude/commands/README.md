# Claude Code Commands

開発効率を最大化するためのカスタムコマンド群です。すべて汎用的に設計されており、あらゆるプロジェクトで再利用可能です。

## 📋 コマンド一覧

| コマンド | 概要 | 対応言語 | 実行時間 |
|----------|------|----------|----------|
| [`project-analyze`](#project-analyze) | プロジェクト包括分析 | JS/TS, Python, Rust, Go | 5-10秒 |
| [`quality-setup`](#quality-setup) | 品質ツール一括設定 | JS/TS, Python, Rust, Go | 30-60秒 |
| [`deps-update`](#deps-update) | 依存関係安全更新 | JS/TS, Python, Rust, Go | 1-5分 |
| [`github-setup`](#github-setup) | CI/CD自動設定 | 全言語対応 | 10-20秒 |
| [`project-clean`](#project-clean) | プロジェクトクリーンアップ | 全言語対応 | 5-30秒 |

## 🔍 project-analyze

**概要**: プロジェクトの技術スタック、構造、設定を包括的に分析し、改善提案を生成

### 検出項目
- **言語**: JavaScript, TypeScript, Python, Rust, Go
- **フレームワーク**: React, Vue, Angular, Next.js, Three.js, Effect-TS
- **パッケージマネージャー**: npm, yarn, pnpm, bun, pip, cargo, go mod
- **ビルドツール**: Vite, Webpack, Rollup, esbuild
- **品質ツール**: ESLint, Prettier, oxlint, flake8, rustfmt
- **テストフレームワーク**: Jest, Vitest, Mocha, pytest

### 分析結果例
```
📊 プロジェクト分析結果
==================================================

🔧 技術スタック:
  言語: TypeScript
  フレームワーク: Effect-TS + Three.js
  パッケージマネージャー: pnpm
  ビルドツール: Vite
  テストフレームワーク: Vitest
  Linter: oxlint
  Formatter: Prettier

📍 Git情報:
  ブランチ: feature/ddd-architecture-migration-v3
  変更: あり
  リモート: https://github.com/takeokunn/ts-minecraft.git

📁 プロジェクト構造:
  src/
    ├── domain
    ├── application
    ├── infrastructure
    └── presentation
  docs/
    ├── 01-architecture
    ├── 02-specifications
    └── 03-guides

💡 推奨改善点:
  🚀 GitHub Actionsの設定を推奨（CI/CD自動化）
  📦 @effect/platform の追加を推奨（Effect-TS エコシステム）
```

### 使用例
```bash
# 基本分析
/project-analyze

# 結果を活用した次のステップ
/quality-setup    # 品質ツール設定
/github-setup     # CI/CD設定
```

## ⚙️ quality-setup

**概要**: 言語別に最適化された品質ツール（リンター、フォーマッター、テスト）を自動設定

### JavaScript/TypeScript設定内容
- **ESLint**: TypeScript対応、厳密ルール設定
- **Prettier**: 一貫したフォーマット設定
- **Vitest**: 高速テストフレームワーク + カバレッジ
- **package.json**: 品質チェックスクリプト自動追加

### 設定ファイル生成
```json
// .eslintrc.json
{
  "extends": ["eslint:recommended", "@typescript-eslint/recommended"],
  "rules": {
    "indent": ["error", 2],
    "quotes": ["error", "single"],
    "semi": ["error", "never"]
  }
}

// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Python設定内容
- **black**: コードフォーマッター
- **flake8**: リンター
- **isort**: インポート整理
- **pytest**: テストフレームワーク + カバレッジ
- **mypy**: 型チェック

### 使用例
```bash
# 自動検出で設定
/quality-setup

# 言語指定で設定
/quality-setup python
/quality-setup rust
```

### 設定後のワークフロー
```bash
npm run lint        # リント実行
npm run lint:fix    # リント自動修正
npm run format      # フォーマット実行
npm run test        # テスト実行
npm run test:coverage # カバレッジ付きテスト
```

## 🔄 deps-update

**概要**: プロジェクトの依存関係を安全かつ効率的に更新

### 更新プロセス
1. **現在の状態確認**: 古いパッケージの検出
2. **セキュリティ監査**: 脆弱性チェック
3. **依存関係更新**: 段階的アップデート
4. **検証テスト**: 型チェック、テスト実行
5. **結果レポート**: 更新内容と推奨事項

### JavaScript/TypeScript更新
```bash
# パッケージマネージャー別対応
npm update                    # npm
yarn upgrade                  # yarn
pnpm update                   # pnpm

# メジャーバージョン更新
npx npm-check-updates -u      # npm
yarn upgrade --latest         # yarn
pnpm update --latest          # pnpm
```

### セキュリティ監査
```bash
npm audit              # 脆弱性チェック
npm audit fix          # 自動修正
```

### 使用例
```bash
# 標準更新（マイナー・パッチのみ）
/deps-update

# 確認のみ（更新は実行しない）
/deps-update --check-only

# メジャーバージョン更新を含む
/deps-update --major
```

### 更新後の自動検証
- TypeScript型チェック実行
- テストスイート実行
- ビルド確認
- セキュリティ監査

## 🚀 github-setup

**概要**: プロジェクトタイプに応じたGitHub Actions CI/CDワークフローを自動生成

### 対応プロジェクトタイプ
- **web**: Webアプリケーション（React, Vue等）
- **lib**: ライブラリ・パッケージ
- **game**: ゲームプロジェクト（Three.js等）

### 生成されるワークフロー

#### CI ワークフロー (ci.yml)
```yaml
name: CI - Code Quality & Testing
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['18.x', '20.x']
    steps:
    - name: Checkout repository
    - name: Setup Node.js
    - name: Install dependencies
    - name: TypeScript type check
    - name: Lint check
    - name: Format check
    - name: Run tests
    - name: Build application
    - name: Upload coverage
```

#### CD ワークフロー (cd.yml)
```yaml
name: CD - Deploy to GitHub Pages
on:
  push:
    branches: [ "main" ]

jobs:
  build:
    # ビルド・品質チェック・デプロイ
  deploy:
    # GitHub Pages デプロイ
```

### 追加設定
- **セキュリティスキャン**: Trivy脆弱性スキャナー
- **Dependabot**: 自動依存関係更新
- **コードカバレッジ**: Codecov統合

### 使用例
```bash
# 自動検出で設定
/github-setup

# プロジェクトタイプ指定
/github-setup --type=game
/github-setup --type=lib
/github-setup --type=web
```

### 設定後の手順
1. GitHub リポジトリの Settings > Pages で "GitHub Actions" を選択
2. 必要なシークレット設定（NPM_TOKEN, CODECOV_TOKEN等）
3. コードをpushして動作確認

## 🧹 project-clean

**概要**: 不要ファイル削除、依存関係クリーンアップ、キャッシュクリアを実行

### 削除対象

#### 共通ファイル・ディレクトリ
- `dist`, `build`, `out` - ビルド生成物
- `.vite`, `.next`, `.cache` - ツールキャッシュ
- `coverage`, `.nyc_output` - テストカバレッジ
- `.DS_Store`, `Thumbs.db` - OSファイル
- `*.log`, `*.tmp` - 一時ファイル

#### 言語固有
**JavaScript/TypeScript:**
- `node_modules/.vite`
- `node_modules/.cache`
- ディープクリーン: `node_modules` 全体

**Python:**
- `__pycache__`, `*.pyc`
- `.pytest_cache`, `.mypy_cache`
- `*.egg-info`

**Rust:**
- `target` ディレクトリ
- ディープクリーン: `cargo clean`

### 使用例
```bash
# 標準クリーニング
/project-clean

# ディープクリーニング（node_modules等も削除）
/project-clean --deep

# 確認なしで実行
/project-clean --confirm
```

### クリーニング結果例
```
📋 クリーンアップ計画:

📁 削除対象ディレクトリ:
  - dist (150 MB)
  - node_modules/.vite (45 MB)
  - coverage (12 MB)

📄 削除対象ファイル:
  - *.log
  - .DS_Store

💾 推定削除サイズ: 207 MB

📊 削除完了: 156 項目, 207 MB
```

## 🔧 拡張・カスタマイズ

### 新しいコマンド作成テンプレート
```javascript
#!/usr/bin/env node

/**
 * カスタムコマンド
 * 使用法: /my-command [options]
 */

class MyCommand {
  constructor() {
    this.language = this.detectLanguage();
  }

  detectLanguage() {
    // 言語検出ロジック
  }

  async execute() {
    console.log('🚀 コマンド実行開始...');

    try {
      // メインロジック

      console.log('✅ 完了！');
    } catch (error) {
      console.error('❌ エラー:', error.message);
    }
  }
}

if (require.main === module) {
  new MyCommand().execute();
}

module.exports = { MyCommand };
```

### コマンド共通機能
- 言語自動検出
- パッケージマネージャー識別
- 進捗表示
- エラーハンドリング
- 結果レポート

---

**🎯 Ready for Streamlined Development! Execute Commands for Maximum Efficiency!**