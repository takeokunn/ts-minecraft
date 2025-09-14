#!/bin/bash
set -euo pipefail

# ドキュメント品質検証スクリプト
# Usage: ./scripts/validate-docs.sh

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly DOCS_DIR="$PROJECT_ROOT/docs"

# 色付きメッセージ関数
print_success() { echo -e "\033[32m✅ $1\033[0m"; }
print_error() { echo -e "\033[31m❌ $1\033[0m"; }
print_info() { echo -e "\033[34mℹ️ $1\033[0m"; }
print_warning() { echo -e "\033[33m⚠️ $1\033[0m"; }

# yq コマンド確認
check_dependencies() {
    if ! command -v yq >/dev/null 2>&1; then
        print_error "yq command not found. Please install yq:"
        echo "  brew install yq"
        exit 1
    fi
}

# YAML frontmatter 抽出
extract_frontmatter() {
    local file="$1"
    if [[ -f "$file" ]] && grep -q "^---$" "$file"; then
        sed -n '1,/^---$/p' "$file" | sed '1d;$d'
    fi
}

# 必須フィールドチェック
validate_required_fields() {
    local file="$1"
    local frontmatter
    local errors=0

    frontmatter=$(extract_frontmatter "$file")

    if [[ -z "$frontmatter" ]]; then
        print_warning "$file: YAML frontmatter not found"
        return 1
    fi

    # 必須フィールドリスト
    local required_fields=(
        "title"
        "description"
        "category"
        "tags"
    )

    for field in "${required_fields[@]}"; do
        if ! echo "$frontmatter" | yq -e ".$field" >/dev/null 2>&1; then
            print_error "$file: Missing required field '$field'"
            ((errors++))
        fi
    done

    return $errors
}

# リンク検証
validate_links() {
    local file="$1"
    local broken_links=0

    # Markdown リンク抽出: [text](path)
    while IFS= read -r link; do
        if [[ "$link" =~ ^\./|^\.\./ ]]; then
            # 相対パス解決
            local resolved_path
            resolved_path=$(realpath -m "$(dirname "$file")/$link" 2>/dev/null || echo "$link")

            if [[ ! -f "$resolved_path" ]]; then
                print_error "$file: Broken link -> $link"
                ((broken_links++))
            fi
        fi
    done < <(grep -oE '\[([^\]]*)\]\(([^)]*)\)' "$file" | sed -E 's/.*\(([^)]*)\).*/\1/' | grep -E '^\./|^\.\./')

    return $broken_links
}

# 単一ファイル検証
validate_file() {
    local file="$1"
    local total_errors=0

    print_info "Validating: $file"

    # 必須フィールドチェック
    validate_required_fields "$file" || ((total_errors += $?))

    # リンク検証
    validate_links "$file" || ((total_errors += $?))

    if [[ $total_errors -eq 0 ]]; then
        print_success "$file: Valid"
    else
        print_error "$file: $total_errors errors found"
    fi

    return $total_errors
}

# 全ファイル検証
validate_all_docs() {
    local total_files=0
    local valid_files=0
    local total_errors=0

    print_info "Starting documentation validation..."
    echo ""

    while IFS= read -r -d '' file; do
        ((total_files++))

        if validate_file "$file"; then
            ((valid_files++))
        else
            ((total_errors += $?))
        fi

        echo ""
    done < <(find "$DOCS_DIR" -name "*.md" -print0)

    # サマリー出力
    echo "📊 Validation Summary"
    echo "===================="
    echo "Total files: $total_files"
    echo "Valid files: $valid_files"
    echo "Invalid files: $((total_files - valid_files))"
    echo "Total errors: $total_errors"

    if [[ $total_errors -eq 0 ]]; then
        print_success "All documentation is valid!"
        return 0
    else
        print_error "Documentation validation failed with $total_errors errors"
        return 1
    fi
}

# メイン実行
main() {
    print_info "TypeScript Minecraft Clone - Documentation Validator"
    echo ""

    check_dependencies

    if [[ ! -d "$DOCS_DIR" ]]; then
        print_error "Documentation directory not found: $DOCS_DIR"
        exit 1
    fi

    validate_all_docs
}

main "$@"