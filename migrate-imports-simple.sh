#!/bin/bash

# TypeScript Minecraft プロジェクト：シンプルなインポートパス移行スクリプト

echo "🔄 Starting import path migration from @/domain to @/core..."
echo ""

total_files=0
updated_files=0
total_updates=0

# 単純な置換関数
replace_in_file() {
    local file="$1"
    local from="$2"
    local to="$3"
    local temp_file="${file}.tmp"
    
    # 置換を実行
    sed "s|from '$from'|from '$to'|g; s|from \"$from\"|from \"$to\"|g" "$file" > "$temp_file"
    
    # 変更があったかチェック
    if ! cmp -s "$file" "$temp_file"; then
        mv "$temp_file" "$file"
        echo "    ✓ $from → $to"
        return 0
    else
        rm "$temp_file"
        return 1
    fi
}

# メインの移行処理
echo "📁 Processing TypeScript files..."
while IFS= read -r -d '' file; do
    ((total_files++))
    
    # ファイルに@/domainのインポートが含まれているかチェック
    if grep -q "@/domain/" "$file" 2>/dev/null; then
        echo ""
        echo "📝 Processing: $(basename "$file")"
        file_updated=false
        
        # 各移行パターンを適用
        if replace_in_file "$file" "@/domain/entity" "@/core/entities/entity"; then
            file_updated=true
            ((total_updates++))
        fi
        
        if replace_in_file "$file" "@/domain/block" "@/core/entities/block"; then
            file_updated=true
            ((total_updates++))
        fi
        
        if replace_in_file "$file" "@/domain/block-definitions" "@/core/entities/block-definitions"; then
            file_updated=true
            ((total_updates++))
        fi
        
        if replace_in_file "$file" "@/domain/block-types" "@/core/values/block-type"; then
            file_updated=true
            ((total_updates++))
        fi
        
        if replace_in_file "$file" "@/domain/values/block-type" "@/core/values/block-type"; then
            file_updated=true
            ((total_updates++))
        fi
        
        if replace_in_file "$file" "@/domain/values/coordinates" "@/core/values/coordinates"; then
            file_updated=true
            ((total_updates++))
        fi
        
        if replace_in_file "$file" "@/domain/values/entity-id" "@/core/values/entity-id"; then
            file_updated=true
            ((total_updates++))
        fi
        
        if replace_in_file "$file" "@/domain/common" "@/core/common"; then
            file_updated=true
            ((total_updates++))
        fi
        
        if replace_in_file "$file" "@/domain/types" "@/core/types"; then
            file_updated=true
            ((total_updates++))
        fi
        
        if [ "$file_updated" = true ]; then
            ((updated_files++))
        fi
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

# 検証
echo "🔍 Verifying migration..."
remaining_lines=$(grep -r "@/domain/" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')

if [ "$remaining_lines" -eq 0 ]; then
    echo "✅ All @/domain imports successfully migrated!"
else
    echo "⚠️  Found $remaining_lines remaining old imports. Checking specific patterns..."
    
    # 残っているパターンを詳細確認
    echo ""
    echo "📋 Remaining @/domain imports by pattern:"
    grep -r "@/domain/" src --include="*.ts" --include="*.tsx" 2>/dev/null | head -10 | while read -r line; do
        echo "    $line"
    done
    
    if [ "$remaining_lines" -gt 10 ]; then
        echo "    ... and $((remaining_lines - 10)) more"
    fi
fi

echo ""
echo "🎉 Migration process completed!"