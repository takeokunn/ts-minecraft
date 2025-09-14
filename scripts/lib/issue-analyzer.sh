#!/bin/bash

# =============================================================================
# Issue分析ライブラリ - 自然言語解析とIssue構造化
# =============================================================================

# 共通ライブラリをソース（SCRIPT_DIRが未定義の場合のみ設定）
if [ -z "${SCRIPT_DIR:-}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
if [ -f "${SCRIPT_DIR}/common.sh" ]; then
    source "${SCRIPT_DIR}/common.sh"
fi

# -----------------------------------------------------------------------------
# 複雑度定義
# -----------------------------------------------------------------------------
readonly COMPLEXITY_LEVELS=(
    "1 - Very Simple (設定変更レベル)"
    "2 - Simple (単純な関数実装)"
    "3 - Easy (基本的な機能実装)"
    "4 - Medium-Easy (複数ファイル実装)"
    "5 - Medium (標準的な機能実装)"
    "6 - Medium-Hard (複雑なロジック)"
    "7 - Hard (アーキテクチャ変更)"
    "8 - Very Hard (大規模リファクタリング)"
    "9 - Expert (新技術・パターン導入)"
    "10 - Extreme (フルスタック実装)"
)

# AIガイダンスレベル定義
readonly AI_GUIDANCE_LEVELS=(
    "Minimal - 基本要件のみ"
    "Standard - 通常レベルの指示"
    "Detailed - 詳細な実装指示"
    "Expert - 高度な技術指示と制約"
)

# -----------------------------------------------------------------------------
# 複雑度推定
# -----------------------------------------------------------------------------
estimate_complexity() {
    local request=$1
    local request_lower=$(echo "$request" | tr '[:upper:]' '[:lower:]')

    # キーワードベースの複雑度マッピング
    declare -A complexity_keywords=(
        # Very Simple (1)
        ["設定|config|configuration|環境変数"]="1"

        # Simple (2)
        ["追加.*関数|単純な|シンプル|helper|utility"]="2"

        # Easy (3)
        ["導入|追加|新規|作成|setup|install|add|create|implement.*simple"]="3"

        # Medium-Easy (4)
        ["複数.*ファイル|モジュール間|連携"]="4"

        # Medium (5)
        ["改善|リファクタリング|修正|fix|improve|refactor|update|enhance"]="5"

        # Medium-Hard (6)
        ["複雑|ロジック|アルゴリズム|最適化|optimize|performance"]="6"

        # Hard (7)
        ["設計|アーキテクチャ|システム|統合|integrate|design|architecture"]="7"

        # Very Hard (8)
        ["大規模|全面|マイグレーション|移行|migration|overhaul"]="8"

        # Expert (9)
        ["新技術|新.*パターン|革新|innovative|cutting-edge"]="9"

        # Extreme (10)
        ["フルスタック|全体|complete.*rewrite|entire.*system"]="10"
    )

    # キーワードマッチング
    for pattern in "${!complexity_keywords[@]}"; do
        if echo "$request_lower" | grep -qE "$pattern"; then
            local level="${complexity_keywords[$pattern]}"
            echo "${COMPLEXITY_LEVELS[$((level - 1))]}"
            return
        fi
    done

    # デフォルト
    echo "${COMPLEXITY_LEVELS[4]}"  # Medium
}

# -----------------------------------------------------------------------------
# AIガイダンスレベル推定
# -----------------------------------------------------------------------------
estimate_ai_guidance() {
    local request=$1
    local request_lower=$(echo "$request" | tr '[:upper:]' '[:lower:]')

    # キーワードベースのガイダンスマッピング
    if echo "$request_lower" | grep -qE "lint|format|style|config|設定"; then
        echo "${AI_GUIDANCE_LEVELS[0]}"  # Minimal
    elif echo "$request_lower" | grep -qE "標準|通常|normal|standard"; then
        echo "${AI_GUIDANCE_LEVELS[1]}"  # Standard
    elif echo "$request_lower" | grep -qE "effect-ts|effect|functional|fp|詳細"; then
        echo "${AI_GUIDANCE_LEVELS[2]}"  # Detailed
    elif echo "$request_lower" | grep -qE "高度|expert|advanced|complex"; then
        echo "${AI_GUIDANCE_LEVELS[3]}"  # Expert
    else
        echo "${AI_GUIDANCE_LEVELS[1]}"  # Standard (default)
    fi
}

# -----------------------------------------------------------------------------
# ドキュメント参照推定
# -----------------------------------------------------------------------------
suggest_documentation() {
    local request=$1
    local request_lower=$(echo "$request" | tr '[:upper:]' '[:lower:]')
    local docs=()

    # キーワードベースのドキュメントマッピング
    if echo "$request_lower" | grep -qE "lint|format|style|規約|convention"; then
        docs+=("docs/how-to/development/development-conventions.md")
        docs+=("docs/reference/configuration/development-tools.md")
    fi

    if echo "$request_lower" | grep -qE "test|テスト|spec"; then
        docs+=("docs/how-to/testing/unit-testing.md")
        docs+=("docs/how-to/testing/integration-testing.md")
        docs+=("docs/reference/testing/test-patterns.md")
    fi

    if echo "$request_lower" | grep -qE "effect|fp|functional|関数型"; then
        docs+=("docs/tutorials/effect-ts-fundamentals/effect-ts-patterns.md")
        docs+=("docs/explanations/design-patterns/effect-ts-architecture.md")
    fi

    if echo "$request_lower" | grep -qE "ブロック|block"; then
        docs+=("docs/reference/api/core/block-api.md")
        docs+=("docs/explanations/game-mechanics/block-system.md")
    fi

    if echo "$request_lower" | grep -qE "world|ワールド|chunk|チャンク"; then
        docs+=("docs/reference/api/core/world-api.md")
        docs+=("docs/explanations/game-mechanics/world-generation.md")
    fi

    if echo "$request_lower" | grep -qE "render|レンダリング|描画|graphics"; then
        docs+=("docs/reference/api/rendering/render-api.md")
        docs+=("docs/explanations/technical/rendering-pipeline.md")
    fi

    if echo "$request_lower" | grep -qE "エンティティ|entity|mob|player"; then
        docs+=("docs/reference/api/entities/entity-api.md")
        docs+=("docs/explanations/game-mechanics/entity-system.md")
    fi

    # デフォルトドキュメント
    if [ ${#docs[@]} -eq 0 ]; then
        docs+=("docs/INDEX.md")
        docs+=("docs/how-to/development/README.md")
    fi

    # 配列を改行区切りの文字列に変換
    printf "参照: %s\n" "${docs[@]}"
}

# -----------------------------------------------------------------------------
# 実行ステップ生成
# -----------------------------------------------------------------------------
generate_execution_steps() {
    local request=$1
    local request_lower=$(echo "$request" | tr '[:upper:]' '[:lower:]')

    cat << EOF
## Phase 1: 調査・分析
1. 既存実装の確認
   - 参照: docs/reference/architecture/project-structure.md
   - 関連コードの特定と分析
2. 関連パターンの調査
   - 参照: docs/explanations/design-patterns/README.md
   - Effect-TSパターンの確認

## Phase 2: 実装
EOF

    # タスクタイプ別の実装ステップ
    if echo "$request_lower" | grep -qE "lint|format|editorconfig|prettier|eslint"; then
        cat << EOF
1. 設定ファイルの作成・更新
   - .editorconfig, .prettierrc, .eslintrc等の設定
2. package.jsonへのスクリプト追加
   - lint, format等のコマンド定義
3. CI/CDパイプラインへの統合
   - GitHub Actionsへの組み込み
EOF
    elif echo "$request_lower" | grep -qE "test|テスト|spec|jest|vitest"; then
        cat << EOF
1. テストファイルの作成
   - ユニットテスト・統合テストの配置
2. テストケースの実装
   - 正常系・異常系・境界値テスト
3. カバレッジ確認
   - 閾値設定と確認
EOF
    elif echo "$request_lower" | grep -qE "api|endpoint|route|controller"; then
        cat << EOF
1. APIエンドポイントの設計
   - RESTful設計またはGraphQL実装
2. コントローラー・ハンドラーの実装
   - Effect-TSパターンでのエラーハンドリング
3. バリデーション・認証の実装
   - 入力検証とセキュリティ
EOF
    elif echo "$request_lower" | grep -qE "ui|component|画面|フロントエンド"; then
        cat << EOF
1. コンポーネント設計
   - React/Vue/Angular等での実装
2. スタイリング実装
   - CSS/Tailwind等での装飾
3. 状態管理の統合
   - Redux/MobX等との連携
EOF
    else
        cat << EOF
1. 必要なモジュールの作成
   - Effect-TSパターンでの実装
2. ビジネスロジックの実装
   - 要件に応じた機能実装
3. 既存コードとの統合
   - 依存関係の解決と連携
EOF
    fi

    cat << EOF

## Phase 3: 検証
1. 静的解析の実行
   - \`pnpm typecheck\`: TypeScript型チェック
   - \`pnpm lint\`: Lintチェック
2. ビルド確認
   - \`pnpm build\`: 本番ビルド
3. テスト実行
   - 自動テストの実行（存在する場合）
4. 手動テスト
   - 開発サーバーでの動作確認
EOF
}

# -----------------------------------------------------------------------------
# 成功条件生成
# -----------------------------------------------------------------------------
generate_success_criteria() {
    local request=$1
    local request_lower=$(echo "$request" | tr '[:upper:]' '[:lower:]')

    cat << EOF
## 必須条件
- [ ] すべての型チェックがパス（\`pnpm typecheck\`）
- [ ] Lintエラーなし（\`pnpm lint\`）
- [ ] ビルド成功（\`pnpm build\`）
- [ ] 既存テストが全てパス

## 機能要件
EOF

    # タスクタイプ別の成功条件
    if echo "$request_lower" | grep -qE "lint|format|editorconfig"; then
        cat << EOF
- [ ] 設定ファイルが適切に配置されている
- [ ] フォーマット/Lintルールが動作する
- [ ] CI/CDで自動実行される
- [ ] 既存コードがルールに準拠している
EOF
    elif echo "$request_lower" | grep -qE "test|テスト"; then
        cat << EOF
- [ ] テストが正常に実行される
- [ ] カバレッジ基準を満たす（80%以上推奨）
- [ ] エッジケースがカバーされている
- [ ] テストが高速で安定している
EOF
    elif echo "$request_lower" | grep -qE "パフォーマンス|performance|最適化"; then
        cat << EOF
- [ ] パフォーマンスが改善されている
- [ ] ベンチマーク結果が基準を満たす
- [ ] メモリリークがない
- [ ] 負荷テストをパスする
EOF
    elif echo "$request_lower" | grep -qE "セキュリティ|security|認証|authorization"; then
        cat << EOF
- [ ] セキュリティ脆弱性がない
- [ ] 認証・認可が正しく機能する
- [ ] 入力検証が適切に行われる
- [ ] セキュリティテストをパスする
EOF
    else
        cat << EOF
- [ ] 要求された機能が実装されている
- [ ] Effect-TSパターンに準拠している
- [ ] 既存機能への影響がない
- [ ] エラーハンドリングが適切
EOF
    fi

    cat << EOF

## 品質基準
- [ ] コードが読みやすく保守しやすい
- [ ] 適切なエラーメッセージが表示される
- [ ] ログが適切に出力される
- [ ] ドキュメントが更新されている（必要に応じて）
EOF
}

# -----------------------------------------------------------------------------
# 検証コマンド生成
# -----------------------------------------------------------------------------
generate_verification_commands() {
    local project_type=$(detect_project_type)

    cat << 'EOF'
#!/bin/bash
set -e

echo "🔍 検証開始..."

# TypeScript/JavaScript プロジェクト
if [ -f "package.json" ]; then
    # TypeCheck
    if npm run typecheck --if-present 2>/dev/null || pnpm typecheck 2>/dev/null; then
        echo "✅ TypeCheck: Pass"
    else
        echo "❌ TypeCheck: Failed"
        exit 1
    fi

    # Lint
    if npm run lint --if-present 2>/dev/null || pnpm lint 2>/dev/null; then
        echo "✅ Lint: Pass"
    else
        echo "❌ Lint: Failed"
        exit 1
    fi

    # Build
    if npm run build --if-present 2>/dev/null || pnpm build 2>/dev/null; then
        echo "✅ Build: Pass"
    else
        echo "❌ Build: Failed"
        exit 1
    fi

    # Test
    if npm test --if-present 2>/dev/null || pnpm test 2>/dev/null; then
        echo "✅ Test: Pass"
    else
        echo "⚠️  Test: Skipped or Failed"
    fi
fi

# 開発サーバー起動確認（短時間）
if [ -f "package.json" ] && grep -q '"dev"' package.json; then
    echo "🚀 開発サーバー起動確認..."
    timeout 10 npm run dev 2>/dev/null || timeout 10 pnpm dev 2>/dev/null || true
fi

echo "✅ 検証完了！"
EOF
}