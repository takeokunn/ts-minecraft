# .claude/ - Issue実装中心設定

## 構成
```
.claude/
├── CLAUDE.md         # プロジェクト情報・Effect-TSパターン
├── automation.md     # Issue実装自動化・品質ゲート
└── README.md         # このファイル
```

## 使用方法

### Issue実装（基本）
```bash
claude "Issue #123 を実装して"
```

**自動実行:**
1. GitHub Issue実行計画解析（Step 1, 2, 3...）
2. 各ステップを順次実行（指定参照ドキュメント使用）
3. Acceptance Criteria全項目検証
4. 実行計画完了報告（GitHub Actions連携）

## ファイル役割

### CLAUDE.md
- プロジェクト基本情報（Effect-TS, DDD, ECS）
- 実装パターン・制約
- ディレクトリ構造・参照優先順位

### automation.md
- Issue実装自動化フロー
- GitHub Actions品質ゲート連携
- 実行計画ベースワークフロー

## 設計原則

- **実行計画ベース**: GitHub Issue内のStep-by-Step実行計画に従った実装
- **完全自動**: 実行計画解析から品質確保まで自動化
- **最小設定**: 3ファイルのみの簡潔構成
- **品質確保**: Acceptance Criteria + GitHub Actions品質ゲートによる確実な完了