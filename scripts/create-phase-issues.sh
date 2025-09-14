#!/bin/bash

#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Phase Issue自動作成スクリプト
# ROADMAP.mdからタスクを抽出してGitHub Issueを作成
#━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

#──────────────────────────────────────────────────────────────────────────────
# 設定値
#──────────────────────────────────────────────────────────────────────────────

readonly SCRIPT_NAME=$(basename "$0")
readonly PHASE=${1:-0}
readonly ROADMAP_FILE="ROADMAP.md"
readonly DRY_RUN=${DRY_RUN:-false}

# ラベル設定
readonly LABELS="ai-agent,task,execution-plan,auto-executable,phase-${PHASE}"

#──────────────────────────────────────────────────────────────────────────────
# カラー出力関数
#──────────────────────────────────────────────────────────────────────────────

print_info() {
    echo -e "\033[0;34m📋\033[0m $1"
}

print_success() {
    echo -e "\033[0;32m✅\033[0m $1"
}

print_warning() {
    echo -e "\033[0;33m⚠️\033[0m $1"
}

print_error() {
    echo -e "\033[0;31m❌\033[0m $1" >&2
}

print_processing() {
    echo -e "\033[0;36m🔄\033[0m $1"
}

#──────────────────────────────────────────────────────────────────────────────
# 複雑度判定関数
#──────────────────────────────────────────────────────────────────────────────

get_complexity() {
    local size="$1"

    case "$size" in
        "XS"*) echo "1 - Very Simple (設定変更レベル)" ;;
        "S"*)  echo "2 - Simple (単純な関数実装)" ;;
        "M"*)  echo "5 - Medium (標準的な機能実装)" ;;
        "L"*)  echo "7 - Hard (アーキテクチャ変更)" ;;
        "XL"*) echo "9 - Expert (新技術・パターン導入)" ;;
        *)     echo "3 - Easy (基本的な機能実装)" ;;
    esac
}

#──────────────────────────────────────────────────────────────────────────────
# 機能名抽出関数
#──────────────────────────────────────────────────────────────────────────────

extract_feature_name() {
    local task_name="$1"

    # タスク名から英単語を抽出して小文字化
    echo "$task_name" | \
        grep -oE '[A-Za-z]+' | \
        head -1 | \
        tr '[:upper:]' '[:lower:]'
}

#──────────────────────────────────────────────────────────────────────────────
# Issue本文生成関数
#──────────────────────────────────────────────────────────────────────────────

generate_issue_body() {
    local task_id="$1"
    local complexity="$2"
    local feature_name="$3"
    local size="$4"
    local type="$5"
    local priority="$6"

    cat <<EOF
## 🤖 自動生成Issue

**実行コマンド**: \`claude "Issue #[番号] を実装して"\`

## Task ID
$task_id

## 実装複雑度
$complexity

## AI実装コンテキスト

### 参照実装
- \`src/shared/\` の既存パターン
- \`docs/reference/\` の仕様書
- 既存Service: \`grep -r "Service" src/domain/\`

### 技術制約
- **必須**: Effect-TS 3.17+
- **型定義**: Schema.Struct による厳密な型
- **パフォーマンス**: 60FPS維持、メモリ2GB以下

### 禁止事項
- ❌ class（Data.Class除く）
- ❌ var/let/any
- ❌ async/await
- ❌ 副作用のある純関数外処理

## 実行ステップ（AI Agent自動実行用）

### Step 1: 事前調査・分析（10分）
\`\`\`bash
# プロジェクト構造確認
find src/domain -type d -maxdepth 2 | head -20
find src/systems -type f -name "*.ts" | head -10
find src/shared -type f -name "*.ts" | head -10

# 依存関係確認
jq '.dependencies | keys[]' package.json | grep -E "(effect|three)"

# 既存実装パターン検索
rg "Context.GenericTag" src/ --type ts | head -5
rg "Schema.Struct" src/ --type ts | head -5
rg "Layer.effect" src/ --type ts | head -5
\`\`\`

### Step 2: ディレクトリ・ファイル構造作成（5分）
\`\`\`bash
# 機能ディレクトリ作成
FEATURE="${feature_name}"
mkdir -p "src/domain/\${FEATURE}"/{types,services,errors,tests}

# ファイル作成
cat > "src/domain/\${FEATURE}/index.ts" << 'END'
export * from "./types"
export * from "./services"
export * from "./errors"
END

# 各ファイルのテンプレート作成
touch "src/domain/\${FEATURE}/types/\${FEATURE^}.ts"
touch "src/domain/\${FEATURE}/services/\${FEATURE^}Service.ts"
touch "src/domain/\${FEATURE}/errors/\${FEATURE^}Error.ts"
touch "src/domain/\${FEATURE}/tests/\${FEATURE^}.test.ts"
\`\`\`

### Step 3: 型定義・データ構造実装（15分）

#### types/\${FEATURE^}.ts
\`\`\`typescript
import { Schema } from "@effect/schema"

// メインデータ構造
export const \${FEATURE^}Data = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf
})

export type \${FEATURE^}Data = Schema.Schema.Type<typeof \${FEATURE^}Data>

// 作成用データ構造
export const Create\${FEATURE^}Input = Schema.Struct({
  name: Schema.String,
  position: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }))
})

export type Create\${FEATURE^}Input = Schema.Schema.Type<typeof Create\${FEATURE^}Input>
\`\`\`

#### errors/\${FEATURE^}Error.ts
\`\`\`typescript
import { Schema } from "@effect/schema"

export class \${FEATURE^}NotFoundError extends Schema.TaggedError<\${FEATURE^}NotFoundError>(
  "\${FEATURE^}NotFoundError"
)({
  id: Schema.String,
  message: Schema.String
}) {}

export class \${FEATURE^}ValidationError extends Schema.TaggedError<\${FEATURE^}ValidationError>(
  "\${FEATURE^}ValidationError"
)({
  field: Schema.String,
  message: Schema.String
}) {}

export type \${FEATURE^}Error = \${FEATURE^}NotFoundError | \${FEATURE^}ValidationError
\`\`\`

### Step 4: Service実装（20分）

#### services/\${FEATURE^}Service.ts
\`\`\`typescript
import { Context, Effect, Layer, Option } from "effect"
import * as Schema from "@effect/schema/Schema"
import { \${FEATURE^}Data, Create\${FEATURE^}Input } from "../types"
import { \${FEATURE^}NotFoundError, \${FEATURE^}ValidationError } from "../errors"

// Service Interface
export interface \${FEATURE^}Service {
  readonly create: (input: Create\${FEATURE^}Input) => Effect.Effect<\${FEATURE^}Data, \${FEATURE^}ValidationError>
  readonly get: (id: string) => Effect.Effect<\${FEATURE^}Data, \${FEATURE^}NotFoundError>
  readonly update: (id: string, data: Partial<\${FEATURE^}Data>) => Effect.Effect<\${FEATURE^}Data, \${FEATURE^}NotFoundError | \${FEATURE^}ValidationError>
  readonly delete: (id: string) => Effect.Effect<void, \${FEATURE^}NotFoundError>
  readonly list: () => Effect.Effect<ReadonlyArray<\${FEATURE^}Data>, never>
}

// Context Tag
export const \${FEATURE^}Service = Context.GenericTag<\${FEATURE^}Service>(
  "@minecraft/\${FEATURE^}Service"
)

// Implementation
const make = Effect.gen(function* () {
  // In-memory storage（実際はDBやRedis等を使用）
  const storage = new Map<string, \${FEATURE^}Data>()

  return {
    create: (input) => Effect.gen(function* () {
      // バリデーション
      const validated = yield* Schema.decodeUnknown(Create\${FEATURE^}Input)(input)

      // データ作成
      const id = \`\${feature_name}-\${Date.now()}\`
      const now = new Date()
      const data: \${FEATURE^}Data = {
        id,
        name: validated.name,
        position: validated.position ?? { x: 0, y: 0, z: 0 },
        createdAt: now,
        updatedAt: now
      }

      storage.set(id, data)
      yield* Effect.log(\`Created \${feature_name}: \${id}\`)

      return data
    }),

    get: (id) => Effect.gen(function* () {
      const data = storage.get(id)

      if (!data) {
        return yield* Effect.fail(new \${FEATURE^}NotFoundError({
          id,
          message: \`\${FEATURE^} with id \${id} not found\`
        }))
      }

      return data
    }),

    update: (id, updates) => Effect.gen(function* () {
      const existing = storage.get(id)

      if (!existing) {
        return yield* Effect.fail(new \${FEATURE^}NotFoundError({
          id,
          message: \`\${FEATURE^} with id \${id} not found\`
        }))
      }

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      }

      storage.set(id, updated)
      yield* Effect.log(\`Updated \${feature_name}: \${id}\`)

      return updated
    }),

    delete: (id) => Effect.gen(function* () {
      if (!storage.has(id)) {
        return yield* Effect.fail(new \${FEATURE^}NotFoundError({
          id,
          message: \`\${FEATURE^} with id \${id} not found\`
        }))
      }

      storage.delete(id)
      yield* Effect.log(\`Deleted \${feature_name}: \${id}\`)
    }),

    list: () => Effect.succeed(Array.from(storage.values()))
  }
})

// Layer
export const \${FEATURE^}ServiceLive = Layer.effect(\${FEATURE^}Service, make)
\`\`\`

### Step 5: テスト実装（20分）

#### tests/\${FEATURE^}.test.ts
\`\`\`typescript
import { describe, it, expect, beforeEach } from "vitest"
import { Effect, Exit, TestContext } from "effect"
import { \${FEATURE^}Service, \${FEATURE^}ServiceLive } from "../services"
import { Create\${FEATURE^}Input } from "../types"

describe("\${FEATURE^}Service", () => {
  const testLayer = \${FEATURE^}ServiceLive

  describe("create", () => {
    it("should create a new \${feature_name}", async () => {
      const program = Effect.gen(function* () {
        const service = yield* \${FEATURE^}Service
        const input: Create\${FEATURE^}Input = {
          name: "Test \${FEATURE^}"
        }

        const result = yield* service.create(input)

        expect(result.id).toBeDefined()
        expect(result.name).toBe("Test \${FEATURE^}")
        expect(result.position).toEqual({ x: 0, y: 0, z: 0 })

        return result
      })

      const result = await Effect.runPromise(
        Effect.provide(program, testLayer)
      )

      expect(result).toBeDefined()
    })
  })

  describe("get", () => {
    it("should retrieve an existing \${feature_name}", async () => {
      const program = Effect.gen(function* () {
        const service = yield* \${FEATURE^}Service

        // Create
        const created = yield* service.create({ name: "Test" })

        // Get
        const retrieved = yield* service.get(created.id)

        expect(retrieved.id).toBe(created.id)
        expect(retrieved.name).toBe(created.name)

        return retrieved
      })

      await Effect.runPromise(
        Effect.provide(program, testLayer)
      )
    })

    it("should fail when \${feature_name} not found", async () => {
      const program = Effect.gen(function* () {
        const service = yield* \${FEATURE^}Service
        return yield* service.get("non-existent")
      })

      const exit = await Effect.runPromiseExit(
        Effect.provide(program, testLayer)
      )

      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe("update", () => {
    it("should update an existing \${feature_name}", async () => {
      const program = Effect.gen(function* () {
        const service = yield* \${FEATURE^}Service

        // Create
        const created = yield* service.create({ name: "Original" })

        // Update
        const updated = yield* service.update(created.id, {
          name: "Updated"
        })

        expect(updated.name).toBe("Updated")
        expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime())

        return updated
      })

      await Effect.runPromise(
        Effect.provide(program, testLayer)
      )
    })
  })

  describe("delete", () => {
    it("should delete an existing \${feature_name}", async () => {
      const program = Effect.gen(function* () {
        const service = yield* \${FEATURE^}Service

        // Create
        const created = yield* service.create({ name: "ToDelete" })

        // Delete
        yield* service.delete(created.id)

        // Verify deleted
        const getResult = yield* Effect.either(service.get(created.id))

        expect(Exit.isLeft(getResult)).toBe(true)
      })

      await Effect.runPromise(
        Effect.provide(program, testLayer)
      )
    })
  })

  describe("list", () => {
    it("should list all \${feature_name}s", async () => {
      const program = Effect.gen(function* () {
        const service = yield* \${FEATURE^}Service

        // Create multiple
        yield* service.create({ name: "First" })
        yield* service.create({ name: "Second" })

        // List
        const list = yield* service.list()

        expect(list.length).toBeGreaterThanOrEqual(2)

        return list
      })

      await Effect.runPromise(
        Effect.provide(program, testLayer)
      )
    })
  })
})
\`\`\`

### Step 6: ECSシステム統合（必要に応じて）（15分）

\`\`\`typescript
// src/systems/\${FEATURE^}System.ts
import { Effect } from "effect"
import { \${FEATURE^}Service } from "../domain/\${feature_name}/services"
import { System } from "../ecs/System"

export const create\${FEATURE^}System = Effect.gen(function* () {
  const service = yield* \${FEATURE^}Service

  return {
    name: "\${FEATURE^}System",

    update: (entities, deltaTime) => Effect.gen(function* () {
      for (const entity of entities) {
        if (entity.hasComponent("\${FEATURE^}Component")) {
          // コンポーネント処理
          const component = entity.getComponent("\${FEATURE^}Component")

          // サービス経由で更新
          yield* service.update(component.id, {
            position: component.position
          })
        }
      }
    })
  }
})
\`\`\`

### Step 7: 統合・エクスポート（5分）

\`\`\`bash
# メインLayerに統合
cat >> src/layers/MainLayer.ts << 'END'

import { \${FEATURE^}ServiceLive } from "../domain/\${feature_name}"

export const MainLayer = Layer.mergeAll(
  ConfigServiceLive,
  LoggerServiceLive,
  \${FEATURE^}ServiceLive,  // 追加
  // 他のLayer...
)
END

# ドメインindex更新
echo "export * as \${feature_name} from \"./\${feature_name}\"" >> src/domain/index.ts
\`\`\`

### Step 8: 品質確認・最適化（10分）

\`\`\`bash
# 段階的品質チェック
echo "🔍 品質チェック開始..."

# TypeScript
if pnpm typecheck; then
  echo "✅ TypeScript: OK"
else
  echo "❌ TypeScriptエラーを修正してください"
  exit 1
fi

# Lint
if pnpm lint --fix; then
  echo "✅ Lint: OK"
else
  echo "⚠️ Lint警告があります"
fi

# Test
if pnpm test "src/domain/\${FEATURE}/"; then
  echo "✅ Test: OK"
else
  echo "❌ テストが失敗しました"
  exit 1
fi

# Coverage
if pnpm test:coverage | grep -E "Statements.*[8-9][0-9]%|100%"; then
  echo "✅ Coverage: 80%以上"
else
  echo "⚠️ カバレッジが80%未満です"
fi

# Build
if pnpm build; then
  echo "✅ Build: OK"
else
  echo "❌ ビルドエラー"
  exit 1
fi

echo "🎉 すべての品質チェックが完了しました！"
\`\`\`

## Acceptance Criteria（自動検証）

### 必須検証項目
- [ ] \`pnpm typecheck\` - TypeScriptエラー: 0
- [ ] \`pnpm lint\` - Lintエラー: 0
- [ ] \`pnpm test\` - テスト: 全パス
- [ ] \`pnpm test:coverage\` - カバレッジ: 80%以上
- [ ] \`pnpm build\` - ビルド: 成功

### コード品質基準
- [ ] Effect-TS \`Context.GenericTag\` でService定義
- [ ] \`Schema.Struct\` で全データ構造定義
- [ ] \`Schema.TaggedError\` でエラー型定義
- [ ] 純関数のみ（副作用はEffect内）
- [ ] class/var/let/any/async/await 未使用

### パフォーマンス基準
- [ ] レンダリング: 60FPS維持
- [ ] メモリ使用量: 2GB以下
- [ ] 初期ロード: 3秒以内

## トラブルシューティング

### よくあるエラーと対処法

#### TypeScriptエラー
\`\`\`bash
# Property does not exist
→ Schema.Struct に型定義追加
→ pnpm typecheck で再確認
\`\`\`

#### Effect-TSエラー
\`\`\`bash
# Cannot find namespace 'Effect'
→ import * as Effect from "effect"
→ Context7で最新API確認
\`\`\`

#### テストカバレッジ不足
\`\`\`bash
# Coverage below 80%
→ エラーケースのテスト追加
→ エッジケースのテスト追加
\`\`\`

## タスクメタデータ
- **サイズ**: $size
- **タイプ**: $type
- **優先度**: $priority
- **推定時間**: 80分
- **自動生成日時**: $(date +"%Y-%m-%d %H:%M:%S")
EOF
}

#──────────────────────────────────────────────────────────────────────────────
# Issue作成関数
#──────────────────────────────────────────────────────────────────────────────

create_issue() {
    local task_id="$1"
    local task_name="$2"
    local issue_body="$3"

    if [[ "$DRY_RUN" == "true" ]]; then
        echo ""
        print_info "[DRY-RUN] Issue作成コマンド:"
        echo "gh issue create \\"
        echo "  --title \"[$task_id] $task_name\" \\"
        echo "  --body \"\$ISSUE_BODY\" \\"
        echo "  --label \"$LABELS\" \\"
        echo "  --assignee \"@me\""
        echo ""
    else
        if gh issue create \
            --title "[$task_id] $task_name" \
            --body "$issue_body" \
            --label "$LABELS" \
            --assignee "@me" 2>/dev/null; then
            print_success "Issue作成完了: $task_id"
        else
            print_warning "Issue作成スキップ: $task_id (既存の可能性)"
        fi
    fi
}

#──────────────────────────────────────────────────────────────────────────────
# タスク処理関数
#──────────────────────────────────────────────────────────────────────────────

process_task() {
    local line="$1"

    # タスクIDとタスク名を抽出
    if [[ $line =~ ^####[[:space:]]+(P[0-9]+-[0-9]+):[[:space:]](.+) ]]; then
        local task_id="${BASH_REMATCH[1]}"
        local task_name="${BASH_REMATCH[2]}"

        # ⭐️マークを削除
        task_name="${task_name% ⭐️}"

        print_processing "処理中: $task_id - $task_name"

        # メタデータ行を読み込み
        read -r meta_line || true

        # メタデータ抽出
        local size=$(echo "$meta_line" | grep -oP 'サイズ\**: \K[^|]+' | xargs || echo "M")
        local type=$(echo "$meta_line" | grep -oP 'タイプ\**: \K[^|]+' | xargs || echo "feature")
        local priority=$(echo "$meta_line" | grep -oP '優先度\**: \K[^|]+' | xargs || echo "Medium")

        # 複雑度と機能名を取得
        local complexity=$(get_complexity "$size")
        local feature_name=$(extract_feature_name "$task_name")

        # Issue本文生成
        local issue_body=$(generate_issue_body \
            "$task_id" \
            "$complexity" \
            "$feature_name" \
            "$size" \
            "$type" \
            "$priority")

        # Issue作成
        create_issue "$task_id" "$task_name" "$issue_body"
    fi
}

#──────────────────────────────────────────────────────────────────────────────
# メイン処理
#──────────────────────────────────────────────────────────────────────────────

main() {
    print_info "Phase $PHASE のIssue作成を開始します..."

    # ROADMAPファイル確認
    if [[ ! -f "$ROADMAP_FILE" ]]; then
        print_error "$ROADMAP_FILE が見つかりません"
        exit 1
    fi

    # gh CLIの存在確認
    if ! command -v gh &> /dev/null; then
        print_error "gh CLI がインストールされていません"
        print_info "インストール: https://cli.github.com/"
        exit 1
    fi

    # DRY_RUNモードの通知
    if [[ "$DRY_RUN" == "true" ]]; then
        print_warning "DRY-RUNモード: 実際のIssue作成は行いません"
    fi

    # タスク処理
    local task_count=0
    while IFS= read -r line; do
        process_task "$line"
        ((task_count++)) || true
    done < <(grep -A 2 "^#### P${PHASE}-" "$ROADMAP_FILE")

    if [[ $task_count -eq 0 ]]; then
        print_warning "Phase $PHASE のタスクが見つかりませんでした"
    else
        print_success "Phase $PHASE のIssue作成が完了しました（${task_count}件処理）"
    fi
}

# スクリプト実行
main "$@"