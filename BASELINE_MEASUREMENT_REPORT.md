# TypeScript Minecraft - Baseline Measurement Report

**測定日時**: 2025-10-07

## 📊 Executive Summary

### Comparison with EFFECT_TS_PHASED_REFACTORING_PLAN.md

| Metric                            | Plan Expectation | Actual Measurement | Delta         | Status    |
| --------------------------------- | ---------------- | ------------------ | ------------- | --------- |
| **as型アサーション (total)**      | 2,976            | 1,602              | -1,374 (-46%) | ✅ Better |
| **any使用**                       | 388              | 199                | -189 (-48%)   | ✅ Better |
| **unknown使用**                   | N/A              | 380                | N/A           | ℹ️ New    |
| **application_service in domain** | 9                | 9                  | 0             | ✅ Match  |
| **new Date()使用**                | 7-8              | 0                  | -7 (-100%)    | ✅ Better |

### Key Findings

1. **型アサーション**: 計画時想定より **46%少ない** (2,976 → 1,602)
   - 既にリファクタリング作業が進行している可能性
   - または計画時の測定方法が異なる（`as const`の扱い等）

2. **any使用**: 計画時想定より **48%少ない** (388 → 199)
   - 型安全性が想定より良好
   - ただし、`unknown`使用が380箇所存在（型安全性の観点では`any`より優れている）

3. **new Date()**: **既に完全移行済み** (0箇所)
   - 計画書の「95%移行済み」から100%完了
   - `Clock.currentTimeMillis`への統一が完了している

4. **application_service違反**: **計画通り9箇所**
   - Phase 1で優先修正対象
   - DDDレイヤリングの是正が必要

## 📈 Detailed Breakdown

### 1. Type Assertion Distribution by Domain

| Domain               | 'as' Assertions | % of Total | Priority | 説明                                                      |
| -------------------- | --------------- | ---------- | -------- | --------------------------------------------------------- |
| **domain/world**     | 520             | 32%        | P0       | 最大の問題箇所。procedural_generation, value_objectに集中 |
| **domain/inventory** | 363             | 22%        | P1       | factory, value_objectに集中                               |
| **domain/camera**    | 353             | 22%        | P2       | application_service, repositoryに集中                     |
| **infrastructure/**  | 97              | 6%         | P1       | ECS, storage統合部分                                      |
| domain/chunk         | 54              | 3%         | P2       | 比較的少ない                                              |
| domain/physics       | 29              | 1%         | P2       | 比較的少ない                                              |
| domain/shared        | 22              | 1%         | P0       | Brand型基盤。既にほぼ完了                                 |
| application/         | 14              | 0%         | P3       | 非常に少ない                                              |
| Other domains        | 150             | 9%         | P3       | その他のドメイン合計                                      |
| **Total**            | **1,602**       | **100%**   | -        | -                                                         |

### 2. Type Safety Hotspots (Top 10 Files)

#### Files with most 'as' assertions:

1. `src/domain/world/value_object/noise_configuration/index.ts` (47 assertions)
2. `src/domain/world/value_object/biome_properties/index.ts` (44 assertions)
3. `src/domain/camera/repository/index.ts` (36 assertions)
4. `src/domain/inventory/factory/item_factory/builders.ts` (32 assertions)
5. `src/domain/camera/application_service/scene_camera/live.ts` (32 assertions)
6. `src/domain/world/aggregate/index.ts` (26 assertions)
7. `src/domain/inventory/value_object/stack_size/constraints.ts` (26 assertions)
8. `src/domain/inventory/value_object/stack_size/operations.ts` (23 assertions)
9. `src/domain/camera/application_service/player_camera/live.ts` (23 assertions)
10. `src/domain/world/domain_service/biome_classification/biome_mapper.ts` (21 assertions)

#### Files with most ': any' usage:

1. `src/domain/world/domain_service/procedural_generation/structure_spawner.ts` (37 usages)
2. `src/domain/world/domain_service/procedural_generation/cave_carver.ts` (26 usages)
3. `src/domain/world/domain_service/procedural_generation/ore_placer.ts` (20 usages)
4. `src/domain/inventory/application_service/transaction_manager/workflows.ts` (19 usages)
5. `src/domain/world/factory/helpers.ts` (9 usages)
6. `src/domain/world/value_object/index.ts` (8 usages)
7. `src/domain/inventory/application_service/transaction_manager/live.ts` (8 usages)
8. `src/domain/world/domain_service/biome_classification/biome_mapper.ts` (7 usages)
9. `src/domain/world/value_object/biome_properties/index.ts` (4 usages)
10. `src/domain/world/repository/biome_system_repository/memory_implementation.ts` (3 usages)

#### Files with most ': unknown' usage:

1. `src/domain/inventory/types/errors.ts` (18 usages)
2. `src/domain/physics/types/core.ts` (14 usages)
3. `src/domain/inventory/repository/types/repository_error.ts` (14 usages)
4. `src/domain/camera/helper.ts` (14 usages)
5. `src/domain/world/repository/types/repository_error.ts` (12 usages)
6. `src/domain/camera/third_person.ts` (11 usages)
7. `src/domain/camera/first_person.ts` (11 usages)
8. `src/domain/world/application_service/cache_optimization/cache_manager.ts` (9 usages)
9. `src/domain/camera/service.ts` (9 usages)
10. `src/infrastructure/inventory/storage-service.ts` (7 usages)

### 3. DDD Layer Violations

**application_service directories in domain layer** (should be 0):

1. `/src/domain/chunk/application_service`
2. `/src/domain/camera/application_service`
3. `/src/domain/chunk_manager/application_service`
4. `/src/domain/world/application_service`
5. `/src/domain/inventory/application_service`
6. `/src/domain/physics/application_service`
7. `/src/domain/crafting/application_service`
8. `/src/domain/equipment/application_service`
9. `/src/domain/interaction/application_service`

**理由**: DDDアーキテクチャでは、`application_service`はドメイン層ではなくアプリケーション層に配置すべき。

## 🎯 Phase 1 Refactoring Targets (Recommendations)

Based on current measurements, Phase 1 should prioritize:

### Priority 0 (Immediate - Week 1)

1. **domain/world型安全化** - 520 'as' assertions (32% of total)
   - **Focus**: `procedural_generation/*` (structure_spawner: 37 any, cave_carver: 26 any)
   - **Focus**: `value_object/noise_configuration` (47 'as' assertions)
   - **Focus**: `value_object/biome_properties` (44 'as' assertions)
   - **Expected reduction**: 520 → ~312 (-40%)

2. **domain/shared Brand型基盤整備** - 22 'as' assertions
   - **Status**: 既にほぼ完了（想定76箇所 → 実測22箇所）
   - **Focus**: 残り22箇所の完全除去
   - **Expected reduction**: 22 → 0 (-100%)

3. **DDD Layer Violations修正** - 9 application_service directories
   - **Action**: `src/domain/*/application_service` → `src/application/use_cases/*`へ移動
   - **Expected**: 9 → 0 (-100%)

### Priority 1 (Week 2-3)

4. **domain/inventory型安全化** - 363 'as' assertions (22% of total)
   - **Focus**: `factory/item_factory/builders.ts` (32 'as' assertions)
   - **Focus**: `value_object/stack_size/*` (49 'as' assertions)
   - **Focus**: `application_service/transaction_manager/*` (27 any usages)
   - **Expected reduction**: 363 → ~218 (-40%)

5. **infrastructure/型安全化** - 97 'as' assertions
   - **Focus**: ECS system, storage integration
   - **Expected reduction**: 97 → ~58 (-40%)

### Priority 2 (Week 3-4)

6. **domain/camera型安全化** - 353 'as' assertions (22% of total)
   - **Focus**: `application_service/*` (55 'as' assertions)
   - **Focus**: `repository/index.ts` (36 'as' assertions)
   - **Expected reduction**: 353 → ~212 (-40%)

## 📝 Notes

### Measurement Methodology

- **Type assertions**: `grep -r " as " src/ --include="*.ts" | grep -v "as const"`
  - Excludes `as const` (type-safe literal types)
  - Includes only TypeScript files in `src/`

- **any usage**: `grep -r ": any" src/ --include="*.ts"`
  - Function parameters, return types, variable declarations

- **unknown usage**: `grep -r ": unknown" src/ --include="*.ts"`
  - Safer alternative to `any`

- **application_service violations**: `find src/domain -type d -name "application_service"`

- **new Date() usage**: `grep -r "new Date()" src/`

### Limitations

- **Circular dependency check**: madge not installed
  - **Action**: Install with `pnpm add -D madge`
  - **Command**: `pnpm madge --circular src/`

- **Non-null assertions (!)**: Not measured in this baseline
  - **Future**: Add to measurement methodology

### Discrepancies from Plan

計画書との差分の考えられる原因：

1. **測定方法の違い**: `as const`の扱い、検索パターンの違い
2. **リファクタリング進行**: 計画策定後に既に改善が進んでいる
3. **git状態**: 未コミットの変更が含まれている可能性

```bash
# 未コミット変更の確認
git status | grep "^M" | wc -l
# → 35 modified files
```

## ✅ Next Steps

### Immediate Actions

1. ✅ **Review this baseline** with EFFECT_TS_PHASED_REFACTORING_PLAN.md
2. ✅ **Adjust Phase 1 targets** based on actual measurements
3. ⬜ **Install madge**: `pnpm add -D madge`
4. ⬜ **Run circular dependency check**: `pnpm madge --circular src/`

### Phase 1 Preparation

1. ⬜ **Create FR-1 tracking issue**: domain/world refactoring (520 'as' → ~312)
2. ⬜ **Create FR-2 tracking issue**: DDD layer violations (9 → 0)
3. ⬜ **Document refactoring patterns**: `docs/tutorials/type-safe-refactoring.md`
4. ⬜ **Setup Performance baseline**: 60FPS measurement before refactoring

### Long-term Planning

1. ⬜ **Adjust Phase 2-4 estimates** based on Phase 1 actual vs. planned delta
2. ⬜ **Review unknown usage strategy**: 380 usages - acceptable or needs reduction?
3. ⬜ **Plan infrastructure refactoring**: 97 'as' assertions in critical path

## 🔍 Analysis of Current State vs. Plan

### Why are measurements better than expected?

| Metric           | Plan  | Actual | Possible Reasons                                                                                   |
| ---------------- | ----- | ------ | -------------------------------------------------------------------------------------------------- |
| as型アサーション | 2,976 | 1,602  | • 既に一部リファクタリング済み<br>• 測定方法の違い（`as const`除外等）<br>• 計画時のgrep精度の問題 |
| any使用          | 388   | 199    | • `unknown`への移行が進んでいる<br>• 型安全化が既に進行中<br>• Effect-TS導入による副次効果         |
| new Date()       | 7-8   | 0      | • `Clock.currentTimeMillis`への統一完了<br>• 計画書作成後に修正完了                                |

### Recommendations for Plan Update

1. **Phase 1目標値の調整**:
   - `as`型アサーション: 2,976 → 1,773 (-40%) を **1,602 → 961 (-40%)** に更新
   - `any`使用: 388 → 142 (-63%) を **199 → 74 (-63%)** に更新

2. **new Date()タスクの除外**:
   - 既に100%完了のため、Phase 1タスクから削除

3. **unknown戦略の明確化**:
   - 380箇所の`unknown`使用を許容するか、段階的削減するか決定

4. **Phase 1期間の再見積**:
   - 想定より46%問題が少ない → 期間短縮または範囲拡大を検討
