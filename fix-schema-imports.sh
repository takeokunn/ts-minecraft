#!/bin/bash

echo "=== Effect Schema インポート修正 ==="

# Effect 3.x では @effect/schema は effect/Schema になります
find src -name "*.ts" -type f | while read file; do
    if grep -q "@effect/schema" "$file"; then
        echo "修正中: $file"
        # @effect/schema/Schema -> effect/Schema
        sed -i '' "s|import.*from.*'@effect/schema/Schema'|import { Schema as S } from 'effect/Schema'|g" "$file"
        # @effect/schema -> effect/Schema
        sed -i '' "s|import.*from.*'@effect/schema'|import { Schema as S } from 'effect/Schema'|g" "$file"
    fi
done

echo "=== withDefault -> withDefaults 修正 ==="
find src -name "*.ts" -type f | while read file; do
    if grep -q "withDefault(" "$file"; then
        echo "修正中: $file"
        sed -i '' "s|\.withDefault(|.withDefaults(|g" "$file"
    fi
done

echo "=== 修正完了 ==="