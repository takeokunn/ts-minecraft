#!/bin/bash

echo "=== 全スキーマインポート修正開始 ==="

# 正しいEffect Schemaインポートパスに一括修正
find src -name "*.ts" -exec perl -pi -e 's|import { Schema as S } from "effect/Schema"|import * as S from "@effect/schema/Schema"|g' {} \;
find src -name "*.ts" -exec perl -pi -e 's|import \* as S from .@effect/schema.|import * as S from "@effect/schema/Schema"|g' {} \;
find src -name "*.ts" -exec perl -pi -e 's|import.*from.*"@effect/schema"|import * as S from "@effect/schema/Schema"|g' {} \;

echo "=== withDefault API修正 ==="
find src -name "*.ts" -exec perl -pi -e 's|\.withDefault\(|.withDefaults(|g' {} \;

echo "=== 修正完了 ==="

echo "修正されたファイル一覧："
grep -l "@effect/schema" src/**/*.ts | head -10