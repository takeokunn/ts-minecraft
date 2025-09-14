#!/bin/bash
set -euo pipefail

# Configuration
readonly ROADMAP_FILE="ROADMAP.md"

# Logging
log_info() { echo "ℹ️  $1" >&2; }
log_error() { echo "❌ $1" >&2; }
log_success() { echo "✅ $1" >&2; }

# Prerequisites check
check_prerequisites() {
    [[ -f "$ROADMAP_FILE" ]] || { log_error "ROADMAP.md not found"; return 1; }
    command -v gh >/dev/null || { log_error "GitHub CLI required"; return 1; }
}

# Extract task section from ROADMAP
get_task_section() {
    local task_id="$1"
    grep -A 50 "^#### $task_id:" "$ROADMAP_FILE" | sed '/^#### [^#]/q' | sed '$d'
}

# Parse task metadata
parse_task() {
    local task_id="$1"
    local section

    section=$(get_task_section "$task_id") || { log_error "Task $task_id not found"; return 1; }

    # Extract metadata
    TASK_ID="$task_id"
    TASK_NAME=$(echo "$section" | head -1 | sed "s/^#### $task_id: //" | sed 's/ ⭐️//')
    TASK_SIZE=$(echo "$section" | grep -E "^\*\*サイズ\*\*:" | cut -d' ' -f2 || echo "M")
    TASK_TYPE=$(echo "$section" | grep -E "^\*\*タイプ\*\*:" | cut -d' ' -f2 || echo "feature")
    TASK_PRIORITY=$(echo "$section" | grep -E "^\*\*優先度\*\*:" | cut -d' ' -f2 || echo "Medium")
    TASK_PHASE="${task_id%%-*}"

    # Calculate hours and complexity
    case "$TASK_SIZE" in
        XS) TASK_HOURS=1 ;;
        S) TASK_HOURS=2 ;;
        M) TASK_HOURS=4 ;;
        L) TASK_HOURS=6 ;;
        XL) TASK_HOURS=8 ;;
        *) TASK_HOURS=4 ;;
    esac

    TASK_COMPLEXITY=5
    echo "$section" | grep -qi "effect-ts" && ((TASK_COMPLEXITY++))
    echo "$section" | grep -qi "integration" && ((TASK_COMPLEXITY+=2))
    [[ $TASK_COMPLEXITY -gt 10 ]] && TASK_COMPLEXITY=10
}

# Extract specific sections
get_success_criteria() {
    local section="$1"
    echo "$section" | sed -n '/# 成功基準/,/^#[^#]/p' | grep -E "^- \[" | sed 's/^- \[ \] *//' || echo ""
}

get_implementation_files() {
    local section="$1"
    echo "$section" | sed -n '/# 実装ファイル/,/^#[^#]/p' | grep -E "^-" | sed 's/^- *//' || echo ""
}

get_ai_instructions() {
    local section="$1"
    echo "$section" | sed -n '/# AI.*指示/,/^```/p' | sed '1d;$d' || echo "ROADMAPを参照して実装してください"
}

get_verification_commands() {
    local section="$1"
    echo "$section" | sed -n '/# 検証/,/^#[^#]/p' | grep -E "^(pnpm|npm)" | sed 's/^- *//' || echo -e "pnpm test\npnpm typecheck\npnpm lint"
}

# Generate labels
generate_labels() {
    local labels="task,size/$TASK_SIZE"

    case "$TASK_TYPE" in
        setup) labels="$labels,type:setup" ;;
        config) labels="$labels,type:config" ;;
        service|interface|feature) labels="$labels,type:feature" ;;
        test) labels="$labels,type:test" ;;
        docs) labels="$labels,type:docs" ;;
        infrastructure) labels="$labels,type:infrastructure" ;;
    esac

    case "$TASK_PRIORITY" in
        Critical) labels="$labels,priority:critical" ;;
        High) labels="$labels,priority:high" ;;
        Medium) labels="$labels,priority:medium" ;;
        Low) labels="$labels,priority:low" ;;
    esac

    labels="$labels,phase:${TASK_PHASE#P}"
    [[ $TASK_COMPLEXITY -ge 8 ]] && labels="$labels,complexity:high"
    [[ $TASK_HOURS -ge 6 ]] && labels="$labels,effort:large"

    echo "$labels"
}