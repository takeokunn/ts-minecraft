#!/bin/bash

# TypeScript Minecraft プロジェクト統合エラー修正スクリプト

echo "=== 統合エラー修正を開始 ==="

# 1. Effect Schema インポート修正
echo "1. Effect Schema インポートパス修正中..."
find src -name "*.ts" -type f -exec sed -i '' "s|import \* as S from '@effect/schema/Schema'|import { Schema as S } from '@effect/schema'|g" {} \;

# 2. withDefault → withDefaults 修正
echo "2. Schema API変更修正中..."
find src -name "*.ts" -type f -exec sed -i '' "s|\.withDefault(|.withDefaults(|g" {} \;

# 3. BlockType enum 問題の調査
echo "3. BlockType enum 問題を調査中..."
grep -r "BlockType\." src --include="*.ts" | head -20

echo "=== 修正完了 ==="
echo "次のコマンドでビルドを確認してください："
echo "npm run build"