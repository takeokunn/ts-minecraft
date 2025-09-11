#!/bin/bash

# Team A: Domain → Core 移行のインポートパス置換スクリプト

echo "🔄 Starting import path migration from @/domain to @/core/entities..."

# 置換対象ファイルのリスト作成
FILES=$(find src -type f -name "*.ts" -o -name "*.tsx" | xargs grep -l "@/domain/\(entity\|block\|block-definitions\)")

if [ -z "$FILES" ]; then
    echo "✅ No files need updating"
    exit 0
fi

echo "📝 Found $(echo "$FILES" | wc -l | tr -d ' ') files to update"

# 各ファイルで置換を実行
for file in $FILES; do
    echo "  Updating: $file"
    
    # macOS用のsedコマンド（-i ''でインプレース編集）
    # entity.ts の置換
    sed -i '' "s|from '@/domain/entity'|from '@/core/entities/entity'|g" "$file"
    sed -i '' "s|from \"@/domain/entity\"|from \"@/core/entities/entity\"|g" "$file"
    
    # block.ts の置換
    sed -i '' "s|from '@/domain/block'|from '@/core/entities/block'|g" "$file"
    sed -i '' "s|from \"@/domain/block\"|from \"@/core/entities/block\"|g" "$file"
    
    # block-definitions.ts の置換
    sed -i '' "s|from '@/domain/block-definitions'|from '@/core/entities/block-definitions'|g" "$file"
    sed -i '' "s|from \"@/domain/block-definitions\"|from \"@/core/entities/block-definitions\"|g" "$file"
done

echo ""
echo "✅ Import path migration completed!"
echo ""
echo "📊 Summary:"
echo "  - Files updated: $(echo "$FILES" | wc -l | tr -d ' ')"
echo "  - entity imports: @/domain/entity → @/core/entities/entity"
echo "  - block imports: @/domain/block → @/core/entities/block"
echo "  - block-definitions imports: @/domain/block-definitions → @/core/entities/block-definitions"