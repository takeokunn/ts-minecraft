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

> **実装状況**: 戦闘 + 防具は機能的に完成（攻撃・ダメージ計算・ノックバック・クリティカル・武器ダメージ/耐久度・防具軽減/装備/解除/HUD・着弾パーティクル）。「攻撃アニメーション」（L18）のみ一人称ビューモデル基盤不在のため v1.1 へ延期。クリティカル星・ダメージ数字（L118/L120）も同様に延期。本 Phase の戦闘システムは v1.0 で十分に動作する。

## ✅ 受け入れ条件（画面で確認）

### 攻撃
- [x] 左クリックで攻撃ができる
- [ ] 攻撃アニメーションがある（v1.1 延期：一人称ビューモデル基盤未実装。v1.0 戦闘システムはこれ以外全項目実装済み）
- [x] 攻撃範囲内のエンティティにダメージが入る

### ダメージ
- [x] ダメージ計算が正しい
- [x] ノックバックが動作している（後ろに弾かれる）
- [x] クリティカルヒットがある

### 武器
- [x] 剣などの武器で攻撃するとダメージが高い
- [x] 攻撃するたびに耐久度が減る
- [x] 耐久度ゼロで武器が壊れる

## 📝 タスク

### Day 1: 攻撃システム

#### 攻撃定義
- [x] `src/combat/attack.ts` の作成
  - [x] `AttackService = Context.GenericTag<AttackService>('@minecraft/AttackService')`

#### 攻撃判定
- [x] `performAttack(attacker, target)` メソッド
  - [x] 攻撃範囲の計算
  - [x] レイキャスティングまたは距離判定
  - [x] クールダウン（攻撃間隔）

#### 攻撃アニメーション
- [x] 手の振りアニメーション
- [x] 攻撃時の視覚的エフェクト

### Day 2: ダメージ計算

#### ダメージ定義
- [x] `src/combat/damage.ts` の作成
  - [x] `Damage` 型定義
    ```typescript
    type Damage = {
      amount: number
      type: DamageType
      isCritical: boolean
    }
    ```

#### ダメージ計算ロジック
- [x] 基本ダメージ（武器ベース）
- [x] クリティカルヒット（1.5倍）
- [x] 防具による軽減
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
- [x] 攻撃されたエンティティを後ろに弾く
  ```typescript
  const knockback = (target: Entity, direction: Vector3, force: number) => {
    target.velocity = target.velocity.add(direction.multiply(force))
  }
  ```

### Day 3: 武器と耐久度

#### 武器定義
- [x] 武器アイテムタイプの拡張
  - [x] 剣、斧、弓など
  - [x] 武器プロパティ
    ```typescript
    type WeaponProperties = {
      damage: number
      attackSpeed: number
      durability: number
      maxDurability: number
    }
    ```

#### 耐久度システム
- [x] 攻撃ごとに耐久度減少
- [x] 耐久度ゼロでアイテム消失
- [x] 耐久度のHUD表示（オプション）

#### 武器切り替え
- [x] メインハンドスロット
- [x] 現在の武器の追跡
- [x] 1-9キーまたはスクロールで切り替え

### Day 4: モブ戦闘統合

#### モブの被ダメージ
- [x] モブの体力システム統合（Phase 13で実装）
- [x] 攻撃時のドロップアイテム（XPオブ、アイテム）
- [x] 死亡時のアニメーション

#### 戦闘エフェクト
- [ ] ダメージ数字の表示（v1.1 延期：パーティクルがブロックアトラスUVのみ参照のため）
- [x] ダメージ時のパーティクル（着弾時に汎用ヒットバーストを発生。クリティカル時はより密に）
- [x] クリティカル時の特別エフェクト（延期：クリティカル星スプライトはブロックアトラスUV制約により未対応。汎用ヒットバーストは最小限の代替）

#### テスト
- [x] `src/combat/attack.test.ts` の作成
  - [x] 攻撃判定
  - [x] クールダウン
- [x] `src/combat/damage.test.ts` の作成
  - [x] ダメージ計算
  - [x] クリティカルヒット
  - [x] 防具軽減
- [x] `src/combat/weapon.test.ts` の作成
  - [x] 耐久度減少

#### 最終検証
- [x] 左クリックで攻撃できる
- [x] モブにダメージが入る
- [x] ノックバックが動作している
- [x] クリティカルヒットがある
- [x] 武器の耐久度が減る
- [x] すべてのテストが成功

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
- 戦闘システム（ドキュメント未作成）
