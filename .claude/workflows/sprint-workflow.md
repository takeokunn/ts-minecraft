# Sprint Workflow

## 2週間Sprint
- Week 1: 実装
- Week 2: 品質

## タスク優先度
- P0: Critical（基盤）
- P1: High（コア機能）
- P2: Medium（拡張）

## Sprint開始
```bash
# Issue生成
gh issue create --title "Task" --label "sprint-$N"

# Branch作成
git checkout -b feature/issue-$N
```

## Daily
```bash
# テスト実行
pnpm test:unit
pnpm typecheck
pnpm lint

# 進捗確認
gh issue list --milestone "Sprint $N"
```

## PR作成
```bash
# コミット
git add -A
git commit -m "feat: implement #$N"

# PR作成
gh pr create --title "feat: #$N" --body "Closes #$N"
```

## 完了条件
- P0: 100%
- P1: 80%+
- カバレッジ: 80%+
- ドキュメント: 更新済み