# 🤖 Claude Code 設定ディレクトリ

TypeScript Minecraft CloneプロジェクトのAI Agent開発を支援する設定・テンプレート集

## 📁 ディレクトリ構造

```
.claude/
├── CLAUDE.md           # メインコンテキストファイル（自動読み込み）
├── README.md           # このファイル
├── agents/             # 専門エージェント定義
│   ├── implementation-agent.md  # 実装担当
│   ├── test-agent.md           # テスト担当
│   └── review-agent.md         # レビュー担当
├── templates/          # 再利用可能テンプレート
│   └── github-issue.md         # Issue作成テンプレート
├── workflows/          # 開発ワークフロー
│   └── sprint-workflow.md      # Sprint実行手順
└── context/           # プロジェクト固有知識
    └── effect-patterns.md      # Effect-TSパターン集
```

## 🎯 使用方法

### 1. 基本的な使い方

```bash
# Claude Codeを起動
claude

# プロジェクトディレクトリで作業開始
# CLAUDE.mdが自動的に読み込まれます
```

### 2. 専門エージェントの活用

```bash
# 実装タスク
claude --agent implementation "Issue #123を実装して"

# テスト作成
claude --agent test "GameLoopServiceのテストを作成"

# コードレビュー
claude --agent review "PR #456をレビュー"
```

### 3. テンプレート使用

```bash
# Issue作成
claude "Phase 1のタスクからGitHub Issueを作成して"

# Sprint計画
claude "次のSprintの計画を立てて"
```

## 🚀 クイックスタート

### 新規開発者向け

1. **環境セットアップ**
   ```bash
   pnpm install
   pnpm dev
   ```

2. **CLAUDE.md確認**
   - プロジェクト制約を理解
   - Effect-TSパターンを確認

3. **最初のタスク**
   ```bash
   claude "ROADMAPからPhase 0のタスクを開始"
   ```

### AI Agent向け設定

1. **コンテキスト優先順位**
   - CLAUDE.md（必須制約）
   - effect-patterns.md（実装パターン）
   - 関連するagent定義

2. **作業フロー**
   - Issue確認 → 実装 → テスト → PR作成

## 📋 チェックリスト

### 実装前確認
- [ ] CLAUDE.mdの制約を理解
- [ ] Effect-TSパターンを確認
- [ ] 既存コードのパターンを調査

### PR前確認
- [ ] テストカバレッジ80%以上
- [ ] Effect-TS採用率95%以上
- [ ] ドキュメント更新

## 🔧 カスタマイズ

### プロジェクト固有設定

`CLAUDE.md`を編集してプロジェクト固有の制約を追加：

```markdown
## プロジェクト固有ルール
- カスタムルール1
- カスタムルール2
```

### 新規エージェント追加

`agents/`ディレクトリに新しいエージェント定義を追加：

```markdown
# CustomAgent - カスタムエージェント

## 役割
特定タスク専門のエージェント

## 専門領域
- 領域1
- 領域2
```

## 📊 メトリクス

### 品質指標
- **Effect-TS採用率**: 95%以上
- **テストカバレッジ**: 80%以上
- **型カバレッジ**: 100%
- **パフォーマンス**: 60FPS維持

### 生産性指標
- **Issue完了率**: 80%以上/Sprint
- **PR承認率**: 初回90%以上
- **バグ発生率**: 5%以下

## 🔗 関連リソース

- [ROADMAP.md](../ROADMAP.md) - 実装計画
- [docs/](../docs/) - プロジェクトドキュメント
- [Effect-TS Docs](https://effect.website/) - 公式ドキュメント
- [Claude Code Docs](https://docs.anthropic.com/claude-code/) - Claude Code公式

## 💡 Tips

### 効率的な作業のコツ

1. **コンテキスト管理**
   - `/clear`で定期的にリセット
   - 関連ファイルを先に読み込み

2. **並行処理**
   - 複数エージェントを並行実行
   - 独立したタスクは同時処理

3. **検証自動化**
   - CIでの自動チェック活用
   - pre-commit hookの設定

## 🆘 トラブルシューティング

### よくある問題

**Q: Effect-TSパターンがわからない**
- A: `context/effect-patterns.md`を参照

**Q: テストが失敗する**
- A: test-agentを使用して修正

**Q: パフォーマンスが悪い**
- A: review-agentでボトルネック特定

## 📝 更新履歴

- 2024-01: 初期設定作成
- 2024-01: Effect-TSパターン追加
- 2024-01: Sprint workflow追加