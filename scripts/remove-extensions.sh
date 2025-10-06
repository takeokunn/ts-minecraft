#!/bin/bash

echo "Removing .js/.ts extensions from imports..."

# .ts/.tsx拡張子を削除（.jsonは除外）
# macOS対応のため sed -i '' を使用
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s/from '\(.*\)\.js'/from '\1'/g" \
  -e "s/from \"\(.*\)\.js\"/from \"\1\"/g" \
  -e "s/from '\(.*\)\.ts'/from '\1'/g" \
  -e "s/from \"\(.*\)\.ts\"/from \"\1\"/g" \
  {} +

echo "✅ Done"
