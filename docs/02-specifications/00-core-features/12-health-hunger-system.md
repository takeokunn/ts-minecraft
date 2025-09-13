# Health & Hunger System (体力・飢餓システム)

## 概要

プレイヤーの生存を管理するMinecraftの中核システムです。体力（Health）と飢餓（Hunger）の2つの主要指標を通じて、プレイヤーのサバイバル体験を提供します。

## ドメインモデル (Domain Model with Schema)

```typescript
import { Schema } from "effect";

// (ここにSchema定義を追加)
```

## 主要ロジック (Core Logic with Services)

- 体力減少・回復ロジック
- 飢餓度・飽和度の増減ロジック
- 自然回復の条件判定
- 飢餓ダメージの処理

## ECS統合 (ECS Integration)

- **Components**: `HealthComponent`, `HungerComponent`
- **Systems**: `HealthSystem`, `HungerSystem`

## UI連携 (UI Integration)

- 体力バー（ハート）の表示
- 飢餓バー（肉）の表示
- ダメージ時の画面エフェクト

## パフォーマンス考慮事項

- 状態更新は必要な時のみ行う。
- 複数プレイヤーの状態をバッチで更新する。