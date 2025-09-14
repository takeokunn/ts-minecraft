---
name: issue-implement
description: GitHub Issueの自動実装
arguments:
  required:
    - name: issue_number
      description: Issue番号
  optional:
    - name: auto_pr
      description: PR自動作成フラグ（true/false）
---

# Issue実装コマンド

GitHub Issueの内容に基づいて自動実装を行います。

## 使用方法

```bash
# 基本使用
claude "/issue/implement 123"

# PR自動作成付き
claude "/issue/implement 123 --auto-pr"

# 短縮形
claude "Issue #123 を実装して"
claude "Issue #123 を実装してPRまで作成して"
```

## 実行フロー

```bash
#!/bin/bash
set -euo pipefail

ISSUE_NUMBER="$1"
AUTO_PR="${2:-false}"

echo "📋 Issue #$ISSUE_NUMBER の実装を開始します"

# 1. Issue情報取得
echo "1️⃣ Issue情報を取得中..."
gh issue view "$ISSUE_NUMBER" --json title,body,labels

# 2. タスク分解（TodoWrite使用）
echo "2️⃣ タスクを分解中..."
# TodoWriteツールでタスク管理

# 3. 実装
echo "3️⃣ 実装中..."
# 実装ステップに従って自動実装

# 4. 品質チェック（並列実行）
echo "4️⃣ 品質チェック中..."
pnpm typecheck & PID1=$!
pnpm lint & PID2=$!
pnpm build & PID3=$!
wait $PID1 $PID2 $PID3

# 5. PR作成（オプション）
if [ "$AUTO_PR" = "true" ]; then
    echo "5️⃣ PR作成中..."
    ./scripts/create-pr.sh "$ISSUE_NUMBER"
fi

echo "✅ 実装完了！"
```

## 実装プロセス

1. **Issue解析**
   - Task ID抽出
   - 実装要件確認
   - 関連ドキュメント参照

2. **タスク管理**
   - TodoWriteで進捗追跡
   - 並列実行可能なタスクの特定

3. **実装**
   - Effect-TSパターン準拠
   - 既存コードとの統合

4. **検証**
   - TypeCheck
   - Lint
   - Build
   - Test（存在する場合）

## 関連コマンド

- [`/issue/create`](create.md) - Issue作成
- [`/pr/create`](../pr/create.md) - PR作成
- [`/test/run`](../test/run.md) - テスト実行