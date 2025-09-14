# TypeScript Minecraft Clone

## プロジェクト概要
Effect-TS + DDD + ECS による完全関数型Minecraftクローン

**目標**: 60FPS / <2GB メモリ / 80%+ カバレッジ
**制約**: クラス禁止 / var,let,any,async禁止 / Effect.gen/Schema.Struct必須

## Issue実装フロー

### 基本コマンド
```
claude "Issue #123 を実装して"  → GitHub Issue実行計画に従って自動実装
```

### Issue実行計画の参照
**AI Task Issueテンプレート**（`.github/ISSUE_TEMPLATE/ai-task.yml`）使用

Claude AgentはGitHub Issueから以下を自動実行：
- **8段階実行ステップ**: 80分で完全実装（Step 1-8）
- **詳細な実装コード**: Effect-TS Service/Layer/Schemaパターン
- **自動検証**: pnpm typecheck/lint/test/build
- **トラブルシューティング**: エラー時の自動修正手順

### 実装パターン
```typescript
// Service定義
export const GameService = Context.GenericTag<GameService>("@minecraft/GameService")

// Data構造
export const Player = Schema.Struct({
  id: Schema.String,
  position: Schema.Struct({
    x: Schema.Number, y: Schema.Number, z: Schema.Number
  })
})

// Error定義
export const GameError = Schema.TaggedError("GameError")({
  type: Schema.String,
  details: Schema.String
})

// Layer実装
export const GameServiceLive = Layer.effect(
  GameService,
  Effect.succeed({
    // 実装
  })
)
```

## 品質基準（GitHub Actions自動実行）
- TypeScript strict mode
- Lint・コード品質
- テストカバレッジ 80%+
- パフォーマンス 60FPS + <2GB

## 開発コマンド
```bash
pnpm dev              # 開発サーバー
pnpm typecheck        # 型チェック
pnpm lint             # コード品質
pnpm test             # テスト実行
pnpm build            # ビルド
```

## ディレクトリ構造
```
src/domain/           # ドメインロジック (DDD)
src/systems/          # ECSシステム
src/shared/           # 共通パターン
docs/                 # 完全仕様書
```

## 参照優先順位
1. **GitHub Issue実行計画**（ai-task.ymlテンプレート）- 具体的実装手順・完了条件
2. **docs/** - Issue内で指定された詳細仕様
3. **src/shared/** - Issue内で指定された実装パターン例
4. **ROADMAP.md** - 全体コンテキスト