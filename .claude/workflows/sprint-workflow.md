# Sprint Workflow - スプリント実行ワークフロー

## 概要
2週間スプリントでの効率的な開発フロー

## スプリント構成
```
Week 1: 実装フェーズ
- Day 1-2: Issue作成・準備
- Day 3-5: コア実装
- Day 6-7: テスト作成

Week 2: 品質フェーズ
- Day 8-9: 統合・デバッグ
- Day 10-11: レビュー対応
- Day 12-13: ドキュメント
- Day 14: リリース準備
```

## 自動化スクリプト

### Sprint開始
```bash
#!/bin/bash
# sprint-start.sh

SPRINT_NUMBER=$1
PHASE=$2

# Issue自動生成
generate_sprint_issues() {
  echo "Generating issues for Sprint $SPRINT_NUMBER, Phase $PHASE"

  # ROADMAPから該当タスク抽出
  pnpm run extract:tasks --sprint=$SPRINT_NUMBER --phase=$PHASE

  # Issue作成
  pnpm run create:issues --template=.claude/templates/github-issue.md

  # Milestoneセット
  gh api repos/:owner/:repo/milestones \
    --method POST \
    --field title="Sprint $SPRINT_NUMBER" \
    --field due_on="$(date -d '+14 days' --iso-8601)"
}

# Sprint board作成
create_sprint_board() {
  gh project create "Sprint $SPRINT_NUMBER" \
    --owner @me \
    --title "Sprint $SPRINT_NUMBER: Phase $PHASE"
}

# 実行
generate_sprint_issues
create_sprint_board
```

### Daily実行
```bash
#!/bin/bash
# daily-check.sh

# 進捗確認
check_progress() {
  echo "=== Sprint Progress ==="
  gh issue list --milestone "Sprint $SPRINT_NUMBER" \
    --json state,title,assignees \
    --jq '.[] | "\(.state)\t\(.title)"'
}

# テスト実行
run_daily_tests() {
  echo "=== Running Tests ==="
  pnpm test:unit
  pnpm test:integration
  pnpm bench:performance
}

# メトリクス収集
collect_metrics() {
  echo "=== Metrics ==="
  # カバレッジ
  pnpm test:coverage

  # パフォーマンス
  pnpm bench:all

  # コード品質
  pnpm lint:stats
}

# 実行
check_progress
run_daily_tests
collect_metrics
```

### PR作成支援
```bash
#!/bin/bash
# create-pr.sh

ISSUE_NUMBER=$1

# ブランチ作成
git checkout -b "feature/issue-$ISSUE_NUMBER"

# 実装
echo "Implement feature for issue #$ISSUE_NUMBER"

# コミット
git add -A
git commit -m "feat: implement #$ISSUE_NUMBER

- Effect-TS Context.GenericTag pattern
- Schema.Struct for type safety
- Property-Based Testing
- 80%+ test coverage"

# PR作成
gh pr create \
  --title "feat: implement #$ISSUE_NUMBER" \
  --body "$(cat .claude/templates/pr-template.md)" \
  --assignee @me \
  --label "sprint-$SPRINT_NUMBER" \
  --milestone "Sprint $SPRINT_NUMBER"
```

## タスク優先順位

### P0: Critical（即実装）
```yaml
criteria:
  - ブロッカー解消
  - 基盤システム
  - セキュリティ修正

examples:
  - Game Loop System
  - ECS Infrastructure
  - Error Handling
```

### P1: High（Sprint内必須）
```yaml
criteria:
  - コア機能
  - 依存関係あり
  - ユーザー影響大

examples:
  - Rendering System
  - World Generation
  - Player Movement
```

### P2: Medium（可能なら実装）
```yaml
criteria:
  - 拡張機能
  - 最適化
  - UX改善

examples:
  - Sound System
  - Particle Effects
  - Advanced AI
```

## 品質ゲート

### PR前チェック
```yaml
automated:
  - [ ] pnpm typecheck 成功
  - [ ] pnpm test:unit 成功
  - [ ] pnpm lint エラーなし
  - [ ] カバレッジ 80%以上

manual:
  - [ ] 機能動作確認
  - [ ] パフォーマンス確認
  - [ ] メモリリーク確認
```

### Sprint終了条件
```yaml
must_have:
  - P0タスク: 100%完了
  - P1タスク: 80%以上完了
  - テストカバレッジ: 80%以上
  - ドキュメント: 更新済み

nice_to_have:
  - P2タスク: 50%以上完了
  - パフォーマンス改善
  - リファクタリング
```

## レトロスペクティブ

### 振り返り項目
1. **達成内容**
   - 完了Issue数
   - 追加機能
   - 修正バグ数

2. **メトリクス**
   - ベロシティ
   - カバレッジ推移
   - パフォーマンス指標

3. **改善点**
   - プロセス改善
   - ツール改善
   - コミュニケーション

### アクションアイテム
```markdown
## Sprint {{NUMBER}} Retrospective

### Keep（継続）
- {{KEEP_ITEM_1}}
- {{KEEP_ITEM_2}}

### Problem（問題）
- {{PROBLEM_1}}
- {{PROBLEM_2}}

### Try（改善）
- {{TRY_1}}
- {{TRY_2}}
```