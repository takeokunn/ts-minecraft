# Scripts - 実行スクリプト

## 📚 Single Source of Truth

スクリプトの詳細な使用方法とワークフローは、Claude Code コマンドとして定義されています：
→ [**`.claude/commands/`**](../.claude/commands/index.md) を参照してください。

## 🗂️ スクリプト構成

```
scripts/
├── lib/                   # 共通ライブラリ
│   ├── common.sh         # 共通関数
│   ├── issue-analyzer.sh # Issue分析ロジック
│   ├── claude-helpers.sh # Claude連携ヘルパー
│   └── pr-helpers.sh     # PR作成ヘルパー
├── create-issue.sh        # Issue自動生成
├── create-pr.sh          # PR自動作成
├── create-phase-issues.sh # ROADMAP Phase Issue作成
├── claude-issue.sh       # Claude専用エントリーポイント
├── test-all.sh           # テストスイート
└── README.md            # このファイル
```

## 🚀 クイックリファレンス

### Claude経由（推奨）

```bash
# コマンド体系を使用
claude "/issue/create 要望文"
claude "/issue/implement 123"
claude "/pr/create 123"
```

### 直接実行

```bash
./scripts/create-issue.sh "要望文"
./scripts/create-pr.sh 123
./scripts/create-phase-issues.sh 0
```

## 📖 詳細ドキュメント

各スクリプトの詳細な仕様と使用方法：

- [Issue作成コマンド](../.claude/commands/issue/create.md)
- [Issue実装コマンド](../.claude/commands/issue/implement.md)
- [PR作成コマンド](../.claude/commands/pr/create.md)

## 🛠️ 主要スクリプト

### create-issue.sh

自然言語の要望文から構造化されたGitHub Issueを自動生成します。

```bash
# 基本使用
./scripts/create-issue.sh "editorconfig lintを導入したい"

# オプション付き
./scripts/create-issue.sh "タスク" --guidance Detailed --verbose --dry-run
```

**機能:**

- Task ID自動採番（P0-001形式）
- 複雑度とAIガイダンスの自動推定
- 関連ドキュメント自動リンク
- DRY RUNモード対応

### create-pr.sh

GitHub IssueからPull Requestを自動作成します。

```bash
# 基本使用
./scripts/create-pr.sh 123

# オプション付き
./scripts/create-pr.sh 123 --draft --no-checks
```

**機能:**

- Issue情報の自動取得
- ブランチ自動作成・管理
- 品質チェック（TypeCheck/Lint/Build）
- PRテンプレート自動生成
- DRAFTモード対応

### create-phase-issues.sh

ROADMAP.mdからPhase単位でIssueを一括作成します。

```bash
# Phase 0のIssue作成
./scripts/create-phase-issues.sh 0

# DRY RUNモード
DRY_RUN=true ./scripts/create-phase-issues.sh 0
```

### test-all.sh

すべてのスクリプトの動作を検証します。

```bash
# フルテスト
./scripts/test-all.sh

# クイックテスト
./scripts/test-all.sh false false true
```

## 📚 ライブラリ構成

- **common.sh**: ロギング、バリデーション、ユーティリティ関数
- **issue-analyzer.sh**: Issue分析と要望文解析ロジック
- **claude-helpers.sh**: Claude Agent連携ヘルパー
- **pr-helpers.sh**: PR作成支援関数

## 🎯 設計原則

1. **モジュラー設計**: 共通処理をライブラリ化
2. **エラーハンドリング**: 明確なエラーメッセージと復旧手順
3. **DRY原則**: コードの重複を排除
4. **テスト可能**: 包括的なテストスイート
