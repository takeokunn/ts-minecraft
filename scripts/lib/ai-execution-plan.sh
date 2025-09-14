#!/bin/bash
set -euo pipefail

# AI Coding Agent向け実行計画生成
# 具体的で検証可能な実行ステップを生成

source "$(dirname "${BASH_SOURCE[0]}")/issue-core.sh"

# AI Agent向け実行ステップ生成
generate_ai_execution_steps() {
    case "$TASK_TYPE" in
        setup|config) generate_ai_setup_steps ;;
        service|interface) generate_ai_service_steps ;;
        feature) generate_ai_feature_steps ;;
        test) generate_ai_test_steps ;;
        docs) generate_ai_docs_steps ;;
        infrastructure) generate_ai_infra_steps ;;
        *) generate_ai_default_steps ;;
    esac
}

# Setup/Config用AI実行計画
generate_ai_setup_steps() {
    cat << EOF
## 🤖 AI Agent実行計画

### Phase 1: 分析・準備
**AI実行指示**:
\`\`\`bash
# 1. プロジェクト構造確認
find src -type f -name "*.ts" | grep -E "(config|setup)" | head -10

# 2. 既存パターン分析
grep -r "Schema.Struct" src --include="*.ts" | head -5
grep -r "Context.GenericTag" src --include="*.ts" | head -5

# 3. 依存関係確認
grep -r "import.*effect" src --include="*.ts" | head -5
\`\`\`

**成功基準**:
- [ ] 類似実装パターン3つ以上特定
- [ ] Effect-TSパターンの理解完了
- [ ] 実装対象ファイルパスの決定

**エラー時対応**:
- パターンが見つからない場合: docs/reference/api/ を確認
- Effect-TS不明時: 最新のContext7ドキュメントを参照

### Phase 2: Schema定義実装
**AI実行指示**:
\`\`\`typescript
// 1. Schema定義作成（例: ConfigSchema）
import { Schema } from '@effect/schema';

export const ${TASK_NAME}Schema = Schema.Struct({
  // ROADMAPの仕様に基づき具体的な型定義を追加
});

export type ${TASK_NAME} = Schema.Schema.Type<typeof ${TASK_NAME}Schema>;
\`\`\`

**検証コマンド**:
\`\`\`bash
# TypeScript型チェック
pnpm typecheck

# Schema検証テスト
pnpm test src/**/*${TASK_NAME}*.test.ts
\`\`\`

**成功基準**:
- [ ] Schema.Struct使用で型定義完了
- [ ] TypeScript strictモード通過
- [ ] バリデーション機能実装

### Phase 3: Context実装
**AI実行指示**:
\`\`\`typescript
// 2. Context定義
import { Context } from 'effect';

export interface ${TASK_NAME}Service {
  readonly load: () => Effect.Effect<${TASK_NAME}, ${TASK_NAME}Error>;
  readonly save: (config: ${TASK_NAME}) => Effect.Effect<void, ${TASK_NAME}Error>;
}

export const ${TASK_NAME}Service = Context.GenericTag<${TASK_NAME}Service>('${TASK_NAME}Service');
\`\`\`

**検証コマンド**:
\`\`\`bash
# Context動作確認
pnpm test:unit
pnpm build
\`\`\`

**成功基準**:
- [ ] Context.GenericTag使用
- [ ] Effect型でエラーハンドリング
- [ ] Layer実装完了

### Phase 4: 統合・テスト
**AI実行指示**:
\`\`\`bash
# 統合テスト実行
pnpm test
pnpm typecheck
pnpm lint

# パフォーマンステスト
pnpm dev &
sleep 5
curl http://localhost:3000/health
kill %1
\`\`\`

**成功基準**:
- [ ] 全テスト通過
- [ ] 60FPS維持確認
- [ ] メモリリークなし
- [ ] ドキュメント更新完了

**完了判定**:
\`\`\`bash
# 最終確認スクリプト
[[ \$(pnpm test 2>&1 | grep "PASS" | wc -l) -gt 0 ]] && echo "✅ Tests PASS"
[[ \$(pnpm typecheck 2>&1 | grep "Found 0 errors" | wc -l) -gt 0 ]] && echo "✅ TypeCheck PASS"
[[ \$(pnpm lint 2>&1 | grep -c "error") -eq 0 ]] && echo "✅ Lint PASS"
\`\`\`
EOF
}

# Service/Interface用AI実行計画
generate_ai_service_steps() {
    cat << EOF
## 🤖 AI Agent実行計画

### Phase 1: ドメインモデル設計
**AI実行指示**:
\`\`\`bash
# 1. 既存ドメインパターン確認
find src/domain -name "*.ts" | head -10
grep -r "export.*Service" src/domain --include="*.ts" | head -5

# 2. 類似サービス分析
grep -A 10 -B 5 "Context.GenericTag" src/domain/**/*.ts
\`\`\`

**具体的実装タスク**:
\`\`\`typescript
// 1. ドメインエラー定義
export const ${TASK_NAME}Error = Schema.TaggedError('${TASK_NAME}Error')({
  reason: Schema.String,
  details: Schema.String.pipe(Schema.optional())
});

// 2. ドメインモデル定義
export const ${TASK_NAME}Schema = Schema.Struct({
  // ROADMAPの仕様に従って具体的な定義を追加
});

// 3. サービスインターフェース定義
export interface ${TASK_NAME}Service {
  // ROADMAPの機能要件に基づく具体的なメソッド
}
\`\`\`

**成功基準**:
- [ ] ドメインエラー型定義完了
- [ ] Schema.Struct使用のモデル定義
- [ ] サービスインターフェース設計完了

### Phase 2: コアロジック実装
**AI実行指示**:
\`\`\`typescript
// サービス実装作成
import { Effect, Layer, Context } from 'effect';

const make${TASK_NAME}Service = (): Effect.Effect<${TASK_NAME}Service> =>
  Effect.succeed({
    // 具体的なビジネスロジック実装
    // Effect型を使用したエラーハンドリング必須
  });

export const ${TASK_NAME}ServiceLive = Layer.effect(
  ${TASK_NAME}Service,
  make${TASK_NAME}Service()
);
\`\`\`

**検証ポイント**:
\`\`\`bash
# 実装チェック
grep -r "Effect\.succeed\|Effect\.fail" src/**/*${TASK_NAME}*
grep -r "Layer\.effect" src/**/*${TASK_NAME}*
\`\`\`

**成功基準**:
- [ ] Effect.EffectでのError型管理
- [ ] Layer.effectでのDI実装
- [ ] 純関数での実装（副作用排除）

### Phase 3: パフォーマンス最適化
**AI実行指示**:
\`\`\`bash
# パフォーマンステスト
pnpm test:performance
pnpm dev &
DEV_PID=\$!

# 60FPS維持確認
sleep 3
ps -p \$DEV_PID -o %cpu,%mem,pid,command
kill \$DEV_PID
\`\`\`

**最適化チェック**:
\`\`\`typescript
// メモリ使用量確認
const memoryBefore = process.memoryUsage();
// サービス実行
const memoryAfter = process.memoryUsage();
const heapDiff = memoryAfter.heapUsed - memoryBefore.heapUsed;
console.log('Memory usage:', heapDiff / 1024 / 1024, 'MB');
\`\`\`

**成功基準**:
- [ ] 60FPS維持
- [ ] メモリ使用量2GB以下
- [ ] CPU使用率適正

### Phase 4: 統合テスト・ドキュメント
**AI実行指示**:
\`\`\`bash
# E2Eテスト実行
pnpm test:integration
pnpm test:e2e

# API仕様書生成
echo "# ${TASK_NAME}Service API" > docs/reference/api/${TASK_NAME,,}-service.md
echo "" >> docs/reference/api/${TASK_NAME,,}-service.md
echo "## Interface" >> docs/reference/api/${TASK_NAME,,}-service.md
\`\`\`

**成功基準**:
- [ ] 全統合テスト通過
- [ ] API仕様書作成完了
- [ ] 使用例ドキュメント完備
EOF
}

# Feature用AI実行計画
generate_ai_feature_steps() {
    cat << EOF
## 🤖 AI Agent実行計画

### Phase 1: UI/UX設計・コンポーネント分析
**AI実行指示**:
\`\`\`bash
# 1. 既存UIパターン確認
find src/ui -name "*.tsx" | head -10
grep -r "export.*Component" src/ui --include="*.tsx" | head -5

# 2. 状態管理パターン確認
grep -r "useState\|useEffect" src --include="*.tsx" | head -5
\`\`\`

**コンポーネント設計**:
\`\`\`typescript
// 1. Props型定義
export const ${TASK_NAME}PropsSchema = Schema.Struct({
  // 必要なpropsをSchema定義
});
export type ${TASK_NAME}Props = Schema.Schema.Type<typeof ${TASK_NAME}PropsSchema>;

// 2. 状態型定義
export const ${TASK_NAME}StateSchema = Schema.Struct({
  // コンポーネント状態をSchema定義
});
\`\`\`

**成功基準**:
- [ ] Props・State型定義完了
- [ ] Schema.Structによる型安全性確保
- [ ] 既存UIパターンとの整合性確認

### Phase 2: フロントエンド実装
**AI実行指示**:
\`\`\`typescript
import { Effect } from 'effect';
import { Schema } from '@effect/schema';

// React Componentの実装（Effect統合）
export const ${TASK_NAME}Component: React.FC<${TASK_NAME}Props> = (props) => {
  // Effect-TSとReactの統合パターン使用
  // パフォーマンス最適化（memo、useCallback等）必須
};
\`\`\`

**検証コマンド**:
\`\`\`bash
# コンポーネントテスト
pnpm test src/ui/**/*${TASK_NAME}*.test.tsx

# レンダリング確認
pnpm dev &
sleep 5
curl -s http://localhost:3000 | grep -q "${TASK_NAME}" && echo "✅ Component rendered"
kill %1
\`\`\`

**成功基準**:
- [ ] React Component実装完了
- [ ] Effect-TS統合パターン使用
- [ ] レンダリング動作確認

### Phase 3: バックエンド統合
**AI実行指示**:
\`\`\`typescript
// API統合実装
import { Effect, pipe } from 'effect';

export const use${TASK_NAME}Api = () => {
  return pipe(
    // Effect-TSでのAPI呼び出し実装
    Effect.tryPromise({
      try: () => fetch('/api/${TASK_NAME,,}').then(res => res.json()),
      catch: (error) => new ${TASK_NAME}Error({ reason: 'API Error', details: String(error) })
    }),
    Effect.flatMap(Schema.decodeUnknown(${TASK_NAME}ResponseSchema))
  );
};
\`\`\`

**統合テスト**:
\`\`\`bash
# API統合テスト
pnpm test:api
pnpm test:integration

# E2Eフロー確認
pnpm test:e2e -- --grep "${TASK_NAME}"
\`\`\`

**成功基準**:
- [ ] API統合完了
- [ ] エラーハンドリング実装
- [ ] E2Eテスト通過

### Phase 4: パフォーマンス最適化・最終検証
**AI実行指示**:
\`\`\`bash
# パフォーマンス測定
pnpm build
pnpm start &
SERVER_PID=\$!

# 60FPS測定（実際の測定ツールを使用）
echo "Performance test starting..."
sleep 5

# メモリ使用量確認
ps -p \$SERVER_PID -o %mem,rss,vsz
kill \$SERVER_PID
\`\`\`

**最終検証**:
\`\`\`bash
# 全体品質チェック
pnpm test:all
pnpm typecheck
pnpm lint
pnpm build

# 品質メトリクス確認
echo "Quality Gates:"
pnpm test:coverage | grep -E "Statements|Branches|Functions|Lines"
\`\`\`

**成功基準**:
- [ ] 60FPS維持確認
- [ ] テストカバレッジ80%以上
- [ ] メモリ使用量基準内
- [ ] 全品質ゲート通過
EOF
}

# その他タイプ用のデフォルト実行計画
generate_ai_test_steps() {
    cat << EOF
## 🤖 AI Agent実行計画（テスト実装）

### Phase 1: テスト戦略・設計
**AI実行指示**:
\`\`\`bash
# 既存テストパターン確認
find . -name "*.test.ts" -o -name "*.spec.ts" | head -10
grep -r "describe\|it\|test" --include="*.test.ts" | head -5
\`\`\`

### Phase 2: 単体テスト実装
**AI実行指示**:
\`\`\`typescript
import { Effect } from 'effect';
import { describe, it, expect } from 'vitest';

describe('${TASK_NAME}', () => {
  it('should work correctly', () => {
    // Effect-TSを使用したテスト実装
  });
});
\`\`\`

### Phase 3: 統合・E2Eテスト
**検証コマンド**: \`pnpm test:integration && pnpm test:e2e\`

### Phase 4: カバレッジ確認
**検証コマンド**: \`pnpm test:coverage\`
**成功基準**: 80%以上のカバレッジ達成
EOF
}

generate_ai_docs_steps() {
    cat << EOF
## 🤖 AI Agent実行計画（ドキュメント作成）

### Phase 1: 構造設計・情報収集
**AI実行指示**:
\`\`\`bash
# 既存ドキュメント分析
find docs -name "*.md" | head -20
grep -r "# " docs --include="*.md" | head -10
\`\`\`

### Phase 2: コンテンツ作成
**AI実行指示**:
\`\`\`markdown
# ${TASK_NAME}

## 概要
<!-- 具体的な説明を記載 -->

## 使用方法
\`\`\`typescript
// コード例
\`\`\`

## API Reference
<!-- 詳細なAPI仕様 -->
\`\`\`

### Phase 3: 品質確認
**検証コマンド**:
\`\`\`bash
# リンク確認
grep -r "http\|\.md" docs --include="*.md" | head -10
\`\`\`
EOF
}

generate_ai_infra_steps() {
    cat << EOF
## 🤖 AI Agent実行計画（インフラ）

### Phase 1: 設計・要件分析
**AI実行指示**: 既存インフラ設定確認、要件定義

### Phase 2: 環境構築
**AI実行指示**: インフラリソース作成、設定

### Phase 3: 自動化・CI/CD
**検証コマンド**: デプロイテスト、自動化確認

### Phase 4: 監視・運用準備
**成功基準**: 監視システム構築、運用ドキュメント完備
EOF
}

generate_ai_default_steps() {
    cat << EOF
## 🤖 AI Agent実行計画

### Phase 1: 要件分析・設計
**AI実行指示**:
\`\`\`bash
# ROADMAPから詳細要件抽出
grep -A 20 "#### $TASK_ID:" ROADMAP.md

# 既存実装パターン確認
find src -name "*.ts" | xargs grep -l "Similar patterns" | head -5
\`\`\`

### Phase 2: 実装
**AI実行指示**:
\`\`\`typescript
// Effect-TSパターンでの実装
import { Effect, Schema, Context, Layer } from 'effect';

// 具体的実装はROADMAPの仕様に従う
\`\`\`

### Phase 3: テスト・検証
**検証コマンド**:
\`\`\`bash
pnpm test
pnpm typecheck
pnpm lint
\`\`\`

### Phase 4: ドキュメント・完了
**成功基準**: 全品質ゲート通過、ドキュメント更新完了
EOF
}

# AI Agent向けコンテキスト情報生成
generate_ai_context() {
    cat << EOF

## 📋 AI Agent実行コンテキスト

### 🎯 プロジェクト制約
- **禁止事項**: class使用禁止、var/let/any/async/await禁止
- **必須パターン**: Effect-TS 3.17+、Schema.Struct、Context.GenericTag
- **パフォーマンス**: 60FPS維持、メモリ2GB以下
- **品質基準**: カバレッジ80%以上、TypeScript strict

### 🔧 必須パターン例
\`\`\`typescript
// Schema定義
const DataSchema = Schema.Struct({ field: Schema.String });

// Service定義
export const Service = Context.GenericTag<ServiceInterface>('ServiceName');

// Layer実装
export const ServiceLive = Layer.effect(Service, makeService());

// エラーハンドリング
export const ServiceError = Schema.TaggedError('ServiceError')({
  reason: Schema.String
});
\`\`\`

### 📁 参照ファイル
- プロジェクト規約: \`.claude/CLAUDE.md\`
- 開発パターン: \`src/shared/\` 以下の実装例
- ドキュメント: \`docs/reference/api/\`

### ⚠️ 重要な注意点
1. **Effect型必須**: 全ての非同期処理でEffect使用
2. **Schema検証**: 外部データは必ずSchema.decodeUnknown
3. **関数型**: 純関数のみ、副作用は分離
4. **テスト**: 実装と同時にテストコード作成

### 🚀 実行時ヒント
- Context7で最新Effect-TS情報を確認
- 既存コードパターンを優先的に踏襲
- エラー時は具体的なエラー情報を提供
- 段階的実装で品質を確保
EOF
}

# 全体のAI実行計画生成（メイン関数）
generate_ai_comprehensive_plan() {
    echo "$(generate_ai_execution_steps)"
    echo ""
    echo "$(generate_ai_context)"
}