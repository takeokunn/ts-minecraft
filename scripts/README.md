# Scripts - Claude Code 自動化

## 構成
```
scripts/
├── create-phase-issues.sh  # ROADMAP Phase Issue自動作成
└── README.md              # このファイル
```

## 使用方法

### Issue作成
```bash
# ROADMAP Phase 0のIssue作成（dry-run）
DRY_RUN=true ./scripts/create-phase-issues.sh 0

# 実際にIssue作成
./scripts/create-phase-issues.sh 0

# Claude Agent経由
claude "ROADMAP Phase 0 のIssueを作成して"
```

### Issue実装
```bash
# Claude Agent経由
claude "Issue #123 を実装して"    # → GitHub Issue実行計画に従って自動実装
```

## create-phase-issues.sh

### 機能
- ROADMAP.mdからPhaseタスクを自動抽出
- ai-task.yml形式でIssue本文を生成
- gh CLIでGitHub Issue作成
- DRY_RUNモードでテスト実行可能

### Issue自動生成内容
- Task ID（P0-001形式）
- 実装複雑度（サイズベースで自動判定）
- AI実装コンテキスト（Effect-TS制約）
- 実行フェーズ設計（3段階）
- 成功基準（自動検証項目）
- 検証コマンド一覧

## 設計原則

- **Issue中心**: GitHub Issue実行計画に従った実装
- **完全自動**: ROADMAPからIssue作成まで自動化
- **最小構成**: 必要最小限のスクリプト
- **品質確保**: GitHub Actionsでの品質ゲート