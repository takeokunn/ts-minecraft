# Combat System (戦闘システム)

## 概要

プレイヤーやMob間の戦闘を管理するシステムです。近接攻撃、遠距離攻撃、ダメージ計算、防具、エンチャント効果などを扱います。

## ドメインモデル (Domain Model with Schema)

```typescript
import { Schema } from "effect";

// (ここにSchema定義を追加)
```

## 主要ロジック (Core Logic with Services)

- ダメージ計算ロジック（武器、防具、エンチャント、ポーション効果を考慮）
- 攻撃クールダウンの管理
- ノックバック処理
- クリティカルヒット判定

## ECS統合 (ECS Integration)

- **Components**: `AttackComponent`, `ArmorComponent`, `TargetComponent`
- **Systems**: `CombatSystem`, `ProjectileSystem`

## UI連携 (UI Integration)

- 攻撃インジケーターの表示
- ダメージインジケーター（赤い点滅）
- モブの体力バー表示

## パフォーマンス考慮事項

- 大規模な戦闘における当たり判定の最適化。
- ダメージ計算のバッチ処理。
