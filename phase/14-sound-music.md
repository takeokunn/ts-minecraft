---
title: 'Phase 14 - Sound and Music'
description: '効果音と背景音楽の実装'
phase: 14
estimated_duration: '3日間'
difficulty: 'beginner'
---

# Phase 14 - Sound and Music

## 目標
効果音（SFX）と背景音楽（BGM）システムを実装する。3D空間オーディオとサウンドマネージャーを追加する。

## ✅ 受け入れ条件（画面で確認）

### 効果音
- [ ] ブロック破壊音が鳴る
- [ ] ブロック配置音が鳴る
- [ ] 攻撃音が鳴る
- [ ] モブの鳴き声がある

### 3D空間オーディオ
- [ ] 音源が音の距離で減衰する
- [ ] 左右の音が正確（方向性）
- [ ] 音源の移動に追従する

### 背景音楽
- [ ] BGMが再生される
- [ ] ボリューム調整ができる
- [ ] 環境に応じたBGM（昼/夜/洞窟）

## 📝 タスク

### Day 1: サウンドシステム基盤

#### サウンドマネージャー
- [ ] `src/audio/soundManager.ts` の作成
  - [ ] `SoundManager = Context.GenericTag<SoundManager>('@minecraft/SoundManager')`
  - [ ] Web Audio APIの初期化
  - [ ] 音声コンテキストの管理

#### サウンド定義
- [ ] `src/audio/sounds.ts` の作成
  - [ ] `SoundId` enum
    - [ ] ブロック音（破壊、配置、歩行）
    - [ ] 戦闘音（攻撃、被ダメージ、死亡）
    - [ ] 環境音（水、風、雷）
  - [ ] 音声ファイルの読み込み

#### 音声再生
  ```typescript
  const playSound = (soundId: SoundId, position?: Position) =>
    Effect.gen(function* () {
      const sound = yield* loadSound(soundId)
      const source = audioContext.createBufferSource()
      const panner = audioContext.createPanner()
      const gainNode = audioContext.createGain()

      source.buffer = sound
      if (position) {
        panner.setPosition(position.x, position.y, position.z)
        panner.connect(gainNode)
      } else {
        source.connect(gainNode)
      }
      gainNode.connect(audioContext.destination)
      source.start()
    })
  ```

### Day 2: 3D空間オーディオ

#### Pannerノード
- [ ] 空間オーディオの実装
  ```typescript
  const createPanner = (listenerPos: Position, sourcePos: Position) => {
    const panner = audioContext.createPanner()
    panner.positionX.value = sourcePos.x
    panner.positionY.value = sourcePos.y
    panner.positionZ.value = sourcePos.z
    panner.refDistance = 1
    panner.maxDistance = 100
    panner.rolloffFactor = 1
    return panner
  }
  ```

#### リスナー追従
- [ ] プレイヤー位置の追従
  ```typescript
  const updateListener = (playerPos: Position, rotation: Quaternion) => {
    const listener = audioContext.listener
    listener.positionX.value = playerPos.x
    listener.positionY.value = playerPos.y
    listener.positionZ.value = playerPos.z
    // 回転に基づく向きの更新
  }
  ```

### Day 3: 背景音楽と統合

#### 音楽マネージャー
- [ ] `src/audio/musicManager.ts` の作成
  - [ ] `MusicManager = Context.GenericTag<MusicManager>('@minecraft/MusicManager')`
  - [ ] BGMの読み込み
  - [ ] ループ再生

#### 環境別BGM
- [ ] 昼間のBGM
- [ ] 夜間のBGM
- [ ] 洞窟/地下のBGM
- [ ] 環境切り替え

#### 統合
- [ ] ブロック操作音の接続
- [ ] 戦闘音の接続
- [ ] モブ音の接続
- [ ] 設定からのボリューム調整

#### テスト
- [ ] `src/audio/soundManager.test.ts` の作成
  - [ ] 音声再生
  - [ ] ボリューム制御
- [ ] `src/audio/musicManager.test.ts` の作成
  - [ ] BGM再生
  - [ ] ループ動作

#### 最終検証
- [ ] ブロック破壊/配置で音が鳴る
- [ ] 攻撃で音が鳴る
- [ ] 音の距離でボリュームが変わる
- [ ] 左右の音が正確
- [ ] BGMが再生される
- [ ] 設定でボリューム調整ができる
- [ ] すべてのテストが成功

## 🎯 成功基準
- 効果音システムが実装されている
- 3D空間オーディオが機能している
- 背景音楽が再生されている
- Effect-TSパターンで実装されている

## 📊 依存関係
- Phase 13: Entity System

## 🔗 関連ドキュメント
- [Phase 13](./13-entity-system.md)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
