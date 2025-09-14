# 開発ワークフロー完全ガイド

## 🚀 クイックスタート

```bash
# 1. プロジェクトセットアップ
git clone https://github.com/yourusername/ts-minecraft.git
cd ts-minecraft
pnpm install

# 2. 開発サーバー起動
pnpm dev

# 3. テスト実行
pnpm test

# 4. ビルド
pnpm build
```

## 📋 開発フロー

### 1️⃣ Sprint開始

```bash
# Sprint 1を開始
./scripts/sprint-start.sh 1

# 出力例:
# ✅ Sprint 1 started
# 📋 Tasks: P0-001 to P0-007
# 📊 Total: 7 tasks
# 🔗 Board: https://github.com/user/project/projects/1
```

### 2️⃣ タスク選択 & Issue作成

```bash
# ROADMAPからタスクを確認
./scripts/list-tasks.sh --sprint 1

# 単一Issue作成
./scripts/create-issue.sh P0-001

# Sprint全体のIssue一括作成
./scripts/create-sprint-issues.sh 1
```

### 3️⃣ 実装

#### AI Agentを使用した実装

```bash
# Claudeで実装
claude "Issue #1 (P0-001: プロジェクト初期化)を実装してください"

# またはCursorで実装
cursor "P0-001のタスクを実装"
```

#### 手動実装の場合

```bash
# ブランチ作成
git checkout -b feat/P0-001-project-init

# 実装...

# コミット
git add .
git commit -m "feat(core): implement project initialization [P0-001]"
```

### 4️⃣ PR作成

```bash
# 自動PR作成
./scripts/create-pr.sh 1  # Issue番号

# PRテンプレートに従って記入
# - タスクID
# - 実装内容
# - テスト結果
# - チェックリスト
```

### 5️⃣ 品質チェック

```bash
# ローカルで全チェック実行
./scripts/pre-pr-check.sh

# 個別チェック
pnpm typecheck      # 型チェック
pnpm lint          # Lintチェック
pnpm test          # テスト
pnpm test:coverage # カバレッジ
pnpm build         # ビルド確認
```

### 6️⃣ レビュー & マージ

- GitHub ActionsのCI全てがグリーン
- カバレッジ80%以上
- ドキュメント更新済み
- PRチェックリスト完了

## 🛠 コマンドリファレンス

### 開発コマンド

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動 |
| `pnpm build` | プロダクションビルド |
| `pnpm preview` | ビルドプレビュー |
| `pnpm typecheck` | TypeScript型チェック |
| `pnpm lint` | ESLint実行 |
| `pnpm lint:fix` | ESLint自動修正 |
| `pnpm format` | Prettier実行 |
| `pnpm format:check` | フォーマットチェック |

### テストコマンド

| コマンド | 説明 |
|---------|------|
| `pnpm test` | 全テスト実行 |
| `pnpm test:unit` | ユニットテスト |
| `pnpm test:watch` | テスト監視モード |
| `pnpm test:coverage` | カバレッジ計測 |
| `pnpm test:pbt` | Property-based testing |

### Sprint管理スクリプト

| スクリプト | 説明 | 使用例 |
|-----------|------|--------|
| `sprint-start.sh` | Sprint開始 | `./scripts/sprint-start.sh 1` |
| `sprint-status.sh` | 進捗確認 | `./scripts/sprint-status.sh` |
| `list-tasks.sh` | タスク一覧 | `./scripts/list-tasks.sh --sprint 1` |

### Issue/PR管理スクリプト

| スクリプト | 説明 | 使用例 |
|-----------|------|--------|
| `create-issue.sh` | Issue作成 | `./scripts/create-issue.sh P0-001` |
| `create-sprint-issues.sh` | Sprint Issues一括作成 | `./scripts/create-sprint-issues.sh 1` |
| `create-pr.sh` | PR作成 | `./scripts/create-pr.sh 1` |
| `pr-validate.sh` | PR検証 | `./scripts/pr-validate.sh 123` |

## 📊 品質基準

### 必須要件

- ✅ TypeScript strictモード通過
- ✅ テストカバレッジ80%以上
- ✅ Lintエラー0
- ✅ ビルド成功
- ✅ ドキュメント更新

### パフォーマンス基準

- 🎯 FPS: 60以上
- 🎯 メモリ使用量: 2GB以下
- 🎯 チャンクロード: 100ms以下
- 🎯 初期ロード: 3秒以下

### コード品質

- 📏 関数の行数: 50行以下
- 📏 ファイルの行数: 300行以下
- 📏 循環的複雑度: 10以下
- 📏 重複コード: 3%以下

## 🔄 Git ワークフロー

### ブランチ戦略

```
main
  ├── develop
  │   ├── feat/P0-001-project-init
  │   ├── feat/P1-001-game-loop
  │   └── fix/issue-123
  └── release/v1.0.0
```

### コミットメッセージ

```bash
# フォーマット
<type>(<scope>): <subject> [<task-id>]

# 例
feat(core): implement game loop service [P1-001]
fix(rendering): resolve texture loading issue [#123]
docs(api): update service documentation [P0-007]
test(ecs): add component system tests [P1-008]
```

### タイプ一覧

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: フォーマット
- `refactor`: リファクタリング
- `perf`: パフォーマンス改善
- `test`: テスト
- `build`: ビルド
- `ci`: CI/CD
- `chore`: その他

## 🤖 AI Agent活用

### Claude/Cursor への指示例

```bash
# 実装タスク
"Issue #1 (P0-001)を実装してください。docs/を参照し、Effect-TSパターンに従ってください"

# テスト作成
"GameServiceのProperty-based testingを実装してください"

# ドキュメント更新
"GameServiceのAPI仕様書をdocs/reference/api/に作成してください"

# リファクタリング
"ChunkManagerをEffect-TSのLayerパターンにリファクタリングしてください"
```

### 実装時の参照優先順位

1. `docs/` - 仕様書（100%信頼）
2. `ROADMAP.md` - タスク詳細
3. `.claude/` - AI Agent設定
4. 既存コード - パターン参考

## 📈 進捗管理

### デイリーチェック

```bash
# 今日のタスク確認
./scripts/daily-standup.sh

# 出力:
# 📅 2024-01-15
# ✅ Completed: P0-001, P0-002
# 🔄 In Progress: P0-003
# ⏳ Pending: P0-004, P0-005
# 📊 Sprint Progress: 28% (2/7)
```

### 週次レポート

```bash
# 週次進捗レポート生成
./scripts/weekly-report.sh

# Markdownレポートが生成される
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

| 問題 | 解決方法 |
|------|---------|
| TypeScriptエラー | `pnpm typecheck --listFiles` でエラーファイル特定 |
| テスト失敗 | `pnpm test --bail` で最初のエラーで停止 |
| ビルドエラー | `pnpm build --debug` で詳細ログ表示 |
| Lintエラー | `pnpm lint:fix` で自動修正 |
| メモリ不足 | `NODE_OPTIONS="--max-old-space-size=4096" pnpm build` |

### デバッグモード

```bash
# 環境変数設定
export DEBUG=true
export LOG_LEVEL=debug

# デバッグ実行
pnpm dev:debug
```

## 📚 参考資料

- [Effect-TS公式ドキュメント](https://effect.website)
- [Three.js公式ドキュメント](https://threejs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook)
- [プロジェクト仕様書](./docs/)

## 💡 Tips

1. **毎日の開始時**: `git pull` と `pnpm install` を実行
2. **PR作成前**: 必ず `./scripts/pre-pr-check.sh` を実行
3. **困ったとき**: `docs/` の仕様書を確認
4. **パフォーマンス問題**: Chrome DevToolsのPerformanceタブを活用
5. **メモリリーク**: Chrome DevToolsのMemoryタブでヒープスナップショット

---

*このドキュメントは開発フローの完全ガイドです。更新が必要な場合はPRを作成してください。*