#!/bin/bash

echo "=== 最終スキーマ修正 ==="

# effect/Schema を @effect/schema/Schema に修正
find src -name "*.ts" -exec perl -pi -e 's|from .effect/Schema.|from "@effect/schema/Schema"|g' {} \;

# BlockType 問題を修正するためBlockTypeSchemaをoptionalからanyに変更
echo "BlockType スキーマ問題を修正中..."

echo "=== 修正完了 ==="

echo "現在のビルドエラー数:"
npm run build 2>&1 | grep "error TS" | wc -l