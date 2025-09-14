# 開発ワークフロー - Issue実装中心
## 基本フロー

```mermaid
flowchart LR
    A[要望/Issue作成] --> B[claude "Issue #123 を実装して"]
    B --> C[Pre-Step: 事前確認]
    C --> D[Step 1-8: 段階的実装]
    D --> E[Post-Step: 文書化・PR作成]
    E --> F[GitHub Actions: 品質確認]
    F --> G[レビュー・マージ]
```

## Issue作成
### 方法1: 自然言語からの自動作成【NEW】

```bash
# Claude経由（推奨）
claude "editorconfig lintを導入したい Issue を作って"
claude "/issue/create ブロック破壊アニメーションを追加"

# 直接実行
./scripts/create-issue.sh "editorconfig lintを導入したい"
./scripts/create-issue.sh "タスク" --guidance Detailed --dry-run
```

### 方法2: ROADMAP連携での自動作成

```bash
# Claude Agent経由
claude "ROADMAP Phase 0 のIssueを作成して"

# 直接実行
./scripts/create-phase-issues.sh 0

# Dry-runテスト
DRY_RUN=true ./scripts/create-phase-issues.sh 0
```

### 方法3: 手動作成（AI Task Issueテンプレート）

GitHub Issues > New issue > **AI Agent Task** を選択

**テンプレート構成:**
1. **段階的実行ステップ（8段階）**
   - Step 1: 事前調査・分析
   - Step 2: ディレクトリ構造作成
   - Step 3: 型定義・データ構造
   - Step 4: Service実装
   - Step 5: ECSシステム統合
   - Step 6: テスト実装
   - Step 7: 統合・エクスポート
   - Step 8: 品質確認・最適化

2. **Acceptance Criteria（自動検証項目）**
   - TypeScript: 0エラー
   - ESLint: 0警告
   - Coverage: 80%+
   - パフォーマンステスト

**特徴:**
- 段階的な完全機能実装が可能
- Effect-TSベストプラクティス準拠
- 自動検証・自動修正機能

## Issue実装コマンド
### 基本

```bash
# Claude経由（推奨）
claude "Issue #123 を実装して"
claude "/issue/implement 123"

# ワンライナー実行（Issue作成→実装→PR作成）
claude "editorconfig lintを導入したい Issue を作って実装してPRまで作成して"
```

**自動実行内容:**
1. **Pre-Step実装前確認**: `list_memories`・`@docs/`設計方針・実装方針確認・Context7ライブラリ仕様確認
2. **GitHub Issue実行計画解析**: Step 1-8の段階的実行
3. **各ステップ順次実行**: 指定された参照ドキュメント使用
4. **Post-Step実装後処理**: `@docs/`更新・`write_memory`保存・品質確認
5. **Acceptance Criteria全項目検証**
6. **PR自動作成**: Issue完了後、Pull Request自動生成
7. **実行計画完了報告**（GitHub Actions連携）

### 品質チェック（GitHub Actions自動実行）

- TypeScript型チェック
- Lint・コード品質
- テストカバレッジ 80%+
- ビルド・パフォーマンステスト

## 完了フロー
### 実装完了後
```
✅ Issue #123: 実行計画完了
📋 実行済み: Step 1✅ Step 2✅ Step 3✅ Step 4✅
📊 品質: TypeScript✅ Lint✅ Coverage:87% Performance✅
🎯 Acceptance Criteria: 全項目達成
📄 @docs/ 更新完了、Memory保存済み
🔄 PR作成: 自動生成完了 (#PR番号)
```

### PR作成

```bash
# Claude経由
claude "Issue #123 のPRを作成して"
claude "/pr/create 123"

# 直接実行
./scripts/create-pr.sh 123
./scripts/create-pr.sh 123 --draft --no-checks
```

**自動実行内容:**
- 品質チェック（TypeCheck/Lint/Build）並列実行
- ブランチ作成・コミット・プッシュ
- PRテンプレート自動生成
- Issue自動クローズ設定（Closes #xxx）

## 参照優先順位

1. **GitHub Issue実行計画** - ステップバイステップ実装手順
2. **docs/INDEX.md** - プロジェクト全体のSingle Source of Truth
3. **docs/内の関連ファイル** - 実行計画で指定された詳細仕様
4. **src/shared/** - 実装済みパターン例
5. **Acceptance Criteria** - Issue記載の完了条件・テスト要件

## プロジェクト構成（Single Source of Truth）

```
.claude/
├── CLAUDE.md         # エントリーポイント
├── commands/         # カスタムコマンド定義【NEW】
│   ├── index.md     # コマンドインデックス
│   ├── issue/       # Issue管理コマンド
│   ├── pr/          # PR管理コマンド
│   ├── test/        # テストコマンド
│   └── build/       # ビルドコマンド
└── README.md         # 使用方法

scripts/
├── lib/              # 共通ライブラリ
│   ├── common.sh    # 共通関数
│   ├── issue-analyzer.sh # Issue分析
│   ├── claude-helpers.sh # Claude連携
│   └── pr-helpers.sh # PR作成支援
├── create-issue.sh   # Issue自動生成（リファクタリング済）
├── create-pr.sh      # PR自動作成（リファクタリング済）
├── create-phase-issues.sh # ROADMAP Issue作成
├── claude-issue.sh   # Claude専用エントリーポイント
├── test-all.sh      # テストスイート
└── README.md         # スクリプト概要

docs/                 # プロジェクト仕様
├── INDEX.md         # ドキュメントエントリーポイント
├── how-to/          # 実装方法
├── tutorials/       # チュートリアル
├── explanations/    # 設計説明
└── reference/       # API仕様
```

---

**哲学**: GitHub Issue実行計画をベースに、Claude AgentがStep-by-Stepで確実に実装完了まで自動実行