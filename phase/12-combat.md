---
title: 'Phase 12 - Combat System'
description: '戦闘システムと武器'
phase: 12
estimated_duration: '4日間'
difficulty: 'intermediate'
---

# Phase 12 - Combat System

## 目標
戦闘システムを実装する。攻撃、ダメージ計算、武器耐久度、ノックバック、モブとの戦闘を追加する。

## ✅ 受け入れ条件（画面で確認）

### 攻撃
- [ ] 左クリックで攻撃ができる
- [ ] 攻撃アニメーションがある
- [ ] 攻撃範囲内のエンティティにダメージが入る

### ダメージ
- [ ] ダメージ計算が正しい
- [ ] ノックバックが動作している（後ろに弾かれる）
- [ ] クリティカルヒットがある

### 武器
- [ ] 剣などの武器で攻撃するとダメージが高い
- [ ] 攻撃するたびに耐久度が減る
- [ ] 耐久度ゼロで武器が壊れる

## 📝 タスク

### Day 1: 攻撃システム

#### 攻撃定義
- [ ] `src/combat/attack.ts` の作成
  - [ ] `AttackService = Context.GenericTag<AttackService>('@minecraft/AttackService')`

#### 攻撃判定
- [ ] `performAttack(attacker, target)` メソッド
  - [ ] 攻撃範囲の計算
  - [ ] レイキャスティングまたは距離判定
  - [ ] クールダウン（攻撃間隔）

#### 攻撃アニメーション
- [ ] 手の振りアニメーション
- [ ] 攻撃時の視覚的エフェクト

### Day 2: ダメージ計算

#### ダメージ定義
- [ ] `src/combat/damage.ts` の作成
  - [ ] `Damage` 型定義
    ```typescript
    type Damage = {
      amount: number
      type: DamageType
      isCritical: boolean
    }
    ```

#### ダメージ計算ロジック
- [ ] 基本ダメージ（武器ベース）
- [ ] クリティカルヒット（1.5倍）
- [ ] 防具による軽減
  ```typescript
  const calculateDamage = (attack: Attack, defense: Defense) => {
    const baseDamage = attack.weaponDamage
    const crit = Math.random() < attack.critChance
    const critMultiplier = crit ? 1.5 : 1
    const armorReduction = defense.armorValue * 0.04
    const finalDamage = baseDamage * critMultiplier * (1 - armorReduction)
    return { amount: finalDamage, isCritical: crit }
  }
  ```

#### ノックバック
- [ ] 攻撃されたエンティティを後ろに弾く
  ```typescript
  const knockback = (target: Entity, direction: Vector3, force: number) => {
    target.velocity = target.velocity.add(direction.multiply(force))
  }
  ```

### Day 3: 武器と耐久度

#### 武器定義
- [ ] 武器アイテムタイプの拡張
  - [ ] 剣、斧、弓など
  - [ ] 武器プロパティ
    ```typescript
    type WeaponProperties = {
      damage: number
      attackSpeed: number
      durability: number
      maxDurability: number
    }
    ```

#### 耐久度システム
- [ ] 攻撃ごとに耐久度減少
- [ ] 耐久度ゼロでアイテム消失
- [ ] 耐久度のHUD表示（オプション）

#### 武器切り替え
- [ ] メインハンドスロット
- [ ] 現在の武器の追跡
- [ ] 1-9キーまたはスクロールで切り替え

### Day 4: モブ戦闘統合

#### モブの被ダメージ
- [ ] モブの体力システム統合（Phase 13で実装）
- [ ] 攻撃時のドロップアイテム（XPオブ、アイテム）
- [ ] 死亡時のアニメーション

#### 戦闘エフェクト
- [ ] ダメージ数字の表示
- [ ] ダメージ時のパーティクル
- [ ] クリティカル時の特別エフェクト

#### テスト
- [ ] `src/combat/attack.test.ts` の作成
  - [ ] 攻撃判定
  - [ ] クールダウン
- [ ] `src/combat/damage.test.ts` の作成
  - [ ] ダメージ計算
  - [ ] クリティカルヒット
  - [ ] 防具軽減
- [ ] `src/combat/weapon.test.ts` の作成
  - [ ] 耐久度減少

#### 最終検証
- [ ] 左クリックで攻撃できる
- [ ] モブにダメージが入る
- [ ] ノックバックが動作している
- [ ] クリティカルヒットがある
- [ ] 武器の耐久度が減る
- [ ] すべてのテストが成功

## 🎯 成功基準
- 戦闘システムが実装されている
- ダメージ計算が正確である
- 武器の耐久度が機能している
- ノックバックが動作している

## 📊 依存関係
- Phase 11: Health and Hunger
- Phase 13: Entity System（並行進行可能）

## 🔗 関連ドキュメント
- [Phase 11](./11-health-hunger.md)
- [Phase 13](./13-entity-system.md)
- [戦闘システム](../docs/explanations/game-mechanics/core-features/combat-system.md)
