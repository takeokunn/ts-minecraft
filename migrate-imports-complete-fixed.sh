#!/bin/bash

# TypeScript Minecraft プロジェクト：包括的なインポートパス移行スクリプト

echo "🔄 Starting comprehensive import path migration from @/domain to @/core..."
echo ""

# 統計用変数
total_files=0
updated_files=0
total_updates=0

# インポートパスを置換する関数
replace_imports() {
    local file="$1"
    local temp_file="${file}.tmp"
    local file_updated=false
    
    cp "$file" "$temp_file"
    
    # 各移行ルールを適用
    local patterns=(
        "s|from '[^']*@/domain/entity[^']*'|from '@/core/entities/entity'|g"
        "s|from \"[^\"]*@/domain/entity[^\"]*\"|from \"@/core/entities/entity\"|g"
        "s|from '[^']*@/domain/block[^']*'|from '@/core/entities/block'|g"
        "s|from \"[^\"]*@/domain/block[^\"]*\"|from \"@/core/entities/block\"|g"
        "s|from '[^']*@/domain/block-definitions[^']*'|from '@/core/entities/block-definitions'|g"
        "s|from \"[^\"]*@/domain/block-definitions[^\"]*\"|from \"@/core/entities/block-definitions\"|g"
        "s|from '[^']*@/domain/block-types[^']*'|from '@/core/values/block-type'|g"
        "s|from \"[^\"]*@/domain/block-types[^\"]*\"|from \"@/core/values/block-type\"|g"
        "s|from '[^']*@/domain/values/block-type[^']*'|from '@/core/values/block-type'|g"
        "s|from \"[^\"]*@/domain/values/block-type[^\"]*\"|from \"@/core/values/block-type\"|g"
        "s|from '[^']*@/domain/values/coordinates[^']*'|from '@/core/values/coordinates'|g"
        "s|from \"[^\"]*@/domain/values/coordinates[^\"]*\"|from \"@/core/values/coordinates\"|g"
        "s|from '[^']*@/domain/values/entity-id[^']*'|from '@/core/values/entity-id'|g"
        "s|from \"[^\"]*@/domain/values/entity-id[^\"]*\"|from \"@/core/values/entity-id\"|g"
        "s|from '[^']*@/domain/common[^']*'|from '@/core/common'|g"
        "s|from \"[^\"]*@/domain/common[^\"]*\"|from \"@/core/common\"|g"
        "s|from '[^']*@/domain/types[^']*'|from '@/core/types'|g"
        "s|from \"[^\"]*@/domain/types[^\"]*\"|from \"@/core/types\"|g"
    )
    
    # パターンを適用してカウント
    for pattern in "${patterns[@]}"; do
        if sed "$pattern" "$temp_file" > "${temp_file}.new" && ! cmp -s "$temp_file" "${temp_file}.new"; then
            mv "${temp_file}.new" "$temp_file"
            file_updated=true
            total_updates=$((total_updates + 1))
        else
            rm -f "${temp_file}.new"
        fi
    done
    
    if [ "$file_updated" = true ]; then
        mv "$temp_file" "$file"
        updated_files=$((updated_files + 1))
        echo "  ✅ Updated: $file"
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
        echo "📝 Processing: $file"
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

# 検証：まだ古いインポートが残っていないか確認
echo "🔍 Verifying migration..."
remaining=$(grep -r "@/domain/" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')

if [ "$remaining" -eq 0 ]; then
    echo "✅ All @/domain imports successfully migrated!"
else
    echo "⚠️  Found $remaining remaining old imports:"
    grep -r "@/domain/" src --include="*.ts" --include="*.tsx" 2>/dev/null | head -10 | while read -r line; do
        echo "    $line"
    done
    if [ "$remaining" -gt 10 ]; then
        echo "    ... and $((remaining - 10)) more"
    fi
fi

echo ""
echo "🎉 Migration process completed!"