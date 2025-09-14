# 開発ワークフロー

## 🚀 基本フロー

### 1. Sprint開始
```bash
./scripts/sprint-start.sh 1        # Sprintタスク確認
./scripts/create-sprint-issues.sh 1 # GitHub Issues作成
```

### 2. タスク実装
```bash
# AI Agent指示例
"Issue #1 (P0-001)を実装してください。docs/を参照し、Effect-TSパターンに従ってください"

# 手動の場合
git checkout -b feat/P0-001
# 実装 → コミット
git commit -m "feat(core): implement project initialization [P0-001]"
```

### 3. 品質チェック
```bash
./scripts/pre-pr-check.sh      # 全品質チェック実行
# または個別実行
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## 🛠 コマンド

### 開発
```bash
pnpm dev          # 開発サーバー
pnpm build        # ビルド
pnpm typecheck    # 型チェック
pnpm lint         # Lintチェック
pnpm test         # テスト
pnpm test:coverage # カバレッジ
```

### Script
```bash
./scripts/sprint-start.sh 1        # Sprint開始
./scripts/create-sprint-issues.sh 1 # Issues作成
./scripts/create-issue.sh P0-001   # 単一Issue作成
./scripts/pre-pr-check.sh          # PR前品質チェック
./scripts/validate-docs.sh         # ドキュメント検証
```

## 📊 品質基準

**必須要件**
- TypeScript strictモード通過
- テストカバレッジ80%以上
- 60FPS維持、メモリ2GB以下

**コミットメッセージ**
```bash
feat(core): implement game loop [P1-001]
fix(render): texture loading [#123]
```

## 🤖 AI Agent指示例

```bash
"Issue #1 (P0-001)を実装してください。docs/を参照し、Effect-TSパターンに従ってください"
"GameServiceのProperty-based testingを実装してください"
```

**参照優先順位**: docs/ → ROADMAP.md → .claude/ → 既存コード

---

*開発フロー完全ガイド - 困ったときは`docs/`を確認*