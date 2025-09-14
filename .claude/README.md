# .claude - AI Agent駆動開発設定

TypeScript Minecraft Clone の完全自動化開発環境

## 🎯 開発フロー

```mermaid
graph LR
    A[ROADMAP] --> B[Sprint計画]
    B --> C[Issue自動生成]
    C --> D[AI実装]
    D --> E[自動テスト]
    E --> F[PR作成]
    F --> G[自動レビュー]
    G --> H[人間確認]
```

## 📁 ディレクトリ構造

```
.claude/
├── CLAUDE.md              # メインコンテキスト
├── agents/                # 専門エージェント
│   ├── orchestrator-agent.md  # 統括
│   ├── implementation-agent.md # 実装
│   ├── test-agent.md          # テスト
│   └── review-agent.md        # レビュー
├── automation/            # 自動化設定
│   ├── task-decomposer.md    # タスク分解
│   ├── issue-generator.md    # Issue生成
│   ├── pr-automator.md       # PR自動化
│   └── quality-gates.md      # 品質ゲート
├── templates/             # テンプレート
├── workflows/             # ワークフロー
└── context/              # パターン集
```

## 🚀 クイックスタート

### 1. Sprint開始
```bash
# Sprint 1を開始（自動でIssue生成）
./scripts/sprint-start.sh 1
```

### 2. Issue実装
```bash
# Issue #123を実装
claude "Issue #123を実装して"
```

### 3. PR作成・検証
```bash
# 自動検証してPR作成
./scripts/pr-validate.sh 123
```

## 🤖 AI Agent コマンド

### Orchestrator（統括）
```bash
# Sprint計画
claude orchestrate sprint-plan 1

# タスク分解
claude orchestrate decompose "Phase 0"

# 進捗確認
claude orchestrate status
```

### Implementation（実装）
```bash
# サービス実装
claude implement service GameLoopService

# 機能実装
claude implement feature "Player Movement"

# バグ修正
claude implement fix "Issue #456"
```

### Test（テスト）
```bash
# テスト生成
claude test generate GameLoopService

# カバレッジ改善
claude test improve-coverage src/domain/

# PBT追加
claude test add-pbt PlayerService
```

### Review（レビュー）
```bash
# PRレビュー
claude review pr 789

# 修正提案
claude review suggest-fixes 789

# 承認判定
claude review approve 789
```

## 📊 品質ゲート

### Level 1: 構文（1秒以内）
- TypeScript strict
- 循環参照チェック

### Level 2: 静的解析（10秒以内）
- Effect-TS 95%+
- クラス使用 0
- async/await 0

### Level 3: テスト（30秒以内）
- カバレッジ 80%+
- 全テスト成功

### Level 4: パフォーマンス（60秒以内）
- 60FPS維持
- メモリ 2GB以下

## 🔧 自動化スクリプト

```bash
scripts/
├── sprint-start.sh      # Sprint開始
├── create-issues.sh     # Issue生成
└── pr-validate.sh       # PR検証
```

## 📈 メトリクス

### コード品質
- Effect-TS採用率: 95%+
- テストカバレッジ: 80%+
- 複雑度: 10以下

### パフォーマンス
- FPS: 60維持
- メモリ: 2GB以下
- チャンクロード: 100ms以内

### 生産性
- Issue完了率: 80%+/Sprint
- PR承認率: 初回90%+
- バグ率: 5%以下

## 🎮 GitHub Actions

```yaml
# 手動実行
gh workflow run ai-automation.yml -f action=sprint-start -f sprint=1

# PR自動検証
# PR作成時に自動実行

# 定期実行
# 毎週月曜日に新Sprint開始
```

## 💡 ベストプラクティス

### タスク分解
- 1 Issue = 1 PR
- 2-4時間で完了
- 明確な成功基準

### 実装
- Effect-TSパターン厳守
- テストファースト
- ドキュメント同時更新

### レビュー
- 自動チェック通過必須
- パフォーマンス確認
- 人間の最終確認

## 🔗 参考

- [ROADMAP.md](../ROADMAP.md) - 実装計画
- [docs/](../docs/) - 仕様書（100%完備）
- [Effect-TS](https://effect.website/) - 公式ドキュメント