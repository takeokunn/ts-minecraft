#!/bin/bash

# TypeScript Minecraft プロジェクト：包括的なインポートパス移行スクリプト

echo "🔄 Starting comprehensive import path migration from @/domain to @/core..."
echo ""

# 移行ルール定義（from:to形式）
declare -A MIGRATION_RULES=(
    ["@/domain/entity"]="@/core/entities/entity"
    ["@/domain/block"]="@/core/entities/block"
    ["@/domain/block-definitions"]="@/core/entities/block-definitions"
    ["@/domain/block-types"]="@/core/values/block-type"
    ["@/domain/values/block-type"]="@/core/values/block-type"
    ["@/domain/values/coordinates"]="@/core/values/coordinates"
    ["@/domain/values/entity-id"]="@/core/values/entity-id"
    ["@/domain/common"]="@/core/common"
    ["@/domain/types"]="@/core/types"
)

# 統計用変数
total_files=0
updated_files=0
total_updates=0
declare -A update_stats

# インポートパスを置換する関数
replace_imports() {
    local file="$1"
    local temp_file="${file}.tmp"
    local file_updated=false
    
    cp "$file" "$temp_file"
    
    # 各移行ルールを適用
    for from_path in "${!MIGRATION_RULES[@]}"; do
        local to_path="${MIGRATION_RULES[$from_path]}"
        
        # シングルクォートとダブルクォート両方に対応
        local count1=$(sed -n "s|from '[^']*${from_path}[^']*'|from '${to_path}'|gp" "$temp_file" | wc -l | tr -d ' ')
        local count2=$(sed -n "s|from \"[^\"]*${from_path}[^\"]*\"|from \"${to_path}\"|gp" "$temp_file" | wc -l | tr -d ' ')
        
        if [ "$count1" -gt 0 ] || [ "$count2" -gt 0 ]; then
            sed -i '' "s|from '[^']*${from_path}[^']*'|from '${to_path}'|g" "$temp_file"
            sed -i '' "s|from \"[^\"]*${from_path}[^\"]*\"|from \"${to_path}\"|g" "$temp_file"
            
            local total_count=$((count1 + count2))
            echo "    ${from_path} → ${to_path}: ${total_count} replacements"
            
            update_stats["$from_path"]=$((${update_stats["$from_path"]} + total_count))
            total_updates=$((total_updates + total_count))
            file_updated=true
        fi
    done
    
    if [ "$file_updated" = true ]; then
        mv "$temp_file" "$file"
        updated_files=$((updated_files + 1))
        echo "  ✅ Updated: $(basename "$file")"
    else
        rm "$temp_file"
    fi
}

# メインの移行処理
echo "📁 Scanning TypeScript files in src directory..."
while IFS= read -r -d '' file; do
    ((total_files++))
    
    # ファイルに@/domainのインポートが含まれているかチェック
    if grep -q "@/domain/" "$file" 2>/dev/null; then
        echo ""
        echo "📝 Processing: $(basename "$file")"
        replace_imports "$file"
    fi
done < <(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0)

echo ""
echo "✅ Migration completed!"
echo ""
echo "📊 Migration Summary:"
echo "  - Total files scanned: $total_files"
echo "  - Files updated: $updated_files"
echo "  - Total import statements updated: $total_updates"
echo ""

if [ ${#update_stats[@]} -gt 0 ]; then
    echo "📋 Detailed migration breakdown:"
    for from_path in "${!update_stats[@]}"; do
        local to_path="${MIGRATION_RULES[$from_path]}"
        local count="${update_stats[$from_path]}"
        echo "  - $from_path → $to_path: $count occurrences"
    done
    echo ""
fi

# 検証：まだ古いインポートが残っていないか確認
echo "🔍 Verifying migration..."
remaining=$(grep -r "@/domain/" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')

if [ "$remaining" -eq 0 ]; then
    echo "✅ All @/domain imports successfully migrated!"
else
    echo "⚠️  Found $remaining remaining old imports:"
    grep -r "@/domain/" src --include="*.ts" --include="*.tsx" 2>/dev/null | head -5 | while read -r line; do
        echo "    $line"
    done
    if [ "$remaining" -gt 5 ]; then
        echo "    ... and $((remaining - 5)) more"
    fi
fi

echo ""
echo "🎉 Migration process completed!"