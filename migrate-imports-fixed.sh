#!/bin/bash

# Team A: Domain → Core 移行のインポートパス置換スクリプト（修正版）

echo "🔄 Starting import path migration from @/domain to @/core/entities..."

# 置換を実行する関数
replace_imports() {
    local file="$1"
    
    # 一時ファイルを作成
    local temp_file="${file}.tmp"
    
    # 置換処理
    cat "$file" | \
        sed "s|from '@/domain/entity'|from '@/core/entities/entity'|g" | \
        sed "s|from \"@/domain/entity\"|from \"@/core/entities/entity\"|g" | \
        sed "s|from '@/domain/block'|from '@/core/entities/block'|g" | \
        sed "s|from \"@/domain/block\"|from \"@/core/entities/block\"|g" | \
        sed "s|from '@/domain/block-definitions'|from '@/core/entities/block-definitions'|g" | \
        sed "s|from \"@/domain/block-definitions\"|from \"@/core/entities/block-definitions\"|g" > "$temp_file"
    
    # 元のファイルを置き換え
    mv "$temp_file" "$file"
}

# 対象ファイルを処理
count=0
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
    if grep -q "@/domain/\(entity\|block\|block-definitions\)" "$file" 2>/dev/null; then
        echo "  Updating: $file"
        replace_imports "$file"
        ((count++))
    fi
done

echo ""
echo "✅ Import path migration completed!"

# 検証：まだ古いインポートが残っていないか確認
echo ""
echo "🔍 Verifying migration..."
remaining=$(grep -r "@/domain/\(entity\|block\|block-definitions\)" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')

if [ "$remaining" -eq 0 ]; then
    echo "✅ All imports successfully migrated!"
else
    echo "⚠️  Found $remaining remaining old imports. Running detailed check..."
    grep -r "@/domain/\(entity\|block\|block-definitions\)" src --include="*.ts" --include="*.tsx" | head -5
fi