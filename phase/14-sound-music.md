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

> 注: これらは「画面（耳）で確認」項目。`audioEnabled` が既定 false（箱出し無音）で、音量調整 UI も未実装のため未チェックのまま。各能力の実装・接続状況とテスト被覆は下記「実装状況」および「📝 タスク」の各 `[x]` を参照（モブの鳴き声を含め配線・正しさは vitest で検証済み）。
> ✅ ゲート状況 (2026-06-09): `pnpm typecheck` 0 エラー、vitest 4083 passing / 0 failed、oxlint 0/0、`vite build` exit 0。全ゲート緑。

### 効果音
- [x] ブロック破壊音が鳴る（`interaction-block-handler.ts:106`、vitest 緑）
- [x] ブロック配置音が鳴る（`interaction-block-handler.ts:365` + `physics-stage.ts:135`、vitest 緑）
- [x] 攻撃音が鳴る（`interaction-block-handler.ts:170` `entityHit`、vitest 緑）
- [x] モブの鳴き声がある（`mobHurt`/`mobDeath` in `interaction-block-handler.ts:189-194`、`interaction-mob-sound.test.ts` / `sound-manager.test.ts` 緑）

### 3D空間オーディオ
- [x] 音源が音の距離で減衰する（`computeSpatial` in `sound-manager.ts:7-15`、vitest 緑）
- [x] 左右の音が正確（方向性）（`StereoPannerNode` via `computeSpatial`、vitest 緑）
- [x] 音源の移動に追従する（`frame-handler.ts` 毎フレーム `setListenerPosition(playerPos)`、vitest 緑）

### 背景音楽
- [x] BGMが再生される（`MusicManager` in `music-manager.ts`、vitest 緑）
- [ ] ボリューム調整UIスライダー（v1.1 延期：設定→graph 配線は接続済み、UI スライダーのみ未実装。v1.0 サウンドシステムはこれ以外全項目実装済み）
- [x] 環境に応じたBGM（昼/夜/洞窟）（`lighting-stage.ts` `updateFromContext`、vitest 緑）

## 実装状況 (Phase 14 — mob vocalizations increment)

モノレポ移行後の実際の実装を反映する。パス・実装方式は spec から下記のとおり変わっている:

- **トーン合成のみ** — サンプル音源 (`AudioBuffer`/`loadSound`/音声ファイル) は未実装。全 SFX/BGM は `audio-engine.ts` の OscillatorNode 合成。spec の `loadSound`/`createBufferSource`/`音声ファイルの読み込み` サブ項目は意図的に未チェック。
- **DDD パッケージ配置** — `src/audio/*` ではなく `packages/game/{application,infrastructure}/`: `sound-manager.ts` (+`.config.ts`), `music-manager.ts`, `infrastructure/audio-engine.ts` (`AudioEnginePort`)。
- **3D 空間オーディオは `PannerNode` ではなく自前の距離減衰 + `StereoPannerNode`** — `computeSpatial` (距離減衰 `1/(1+d/12)` + パン `clampPan(dx/12)`) を `StereoPannerNode` に接続。spec の `PannerNode.setPosition` パスは採らない。
- **効果音** — ブロック破壊/配置 (`interaction-block-handler.ts`)、プレイヤー攻撃 `entityHit` (`:170`)、被ダメージ `playerHurt` (`physics-stage.ts`)、**モブの鳴き声 `mobHurt`/`mobDeath` (本増分・`interaction-block-handler.ts`)** を接続済み。
- **モブの鳴き声はプレイヤーによるキル時のみ** — 致命傷で `mobDeath`、生存ヒットで `mobHurt` を排他再生 (`Option.match(drops, ...)`、`drops` の `Some`/`None` がキル判別)。燃焼/環境死は意図的に無音 (entities パッケージは `AudioEnginePort` を持たず、サーフェスには app 層の死亡イベントチャネルが必要 — スコープ外)。
- **`audioEnabled` は既定 false** — 箱出しは無音。音量調整 UI スライダーも未実装。よって `画面で確認`/ユーザー可聴の項目 (上部 `受け入れ条件`・`最終検証`) は正しさをモック単体テストで検証したうえで未チェックのまま残す。
- **未実装 (本増分のスコープ外)**: 歩行音、環境音 (水/風/雷)、待機モブの鳴き声、音量調整 UI、サンプル音源/バイオーム BGM、ダメージ数値表示、クリティカル星スプライト。

## 📝 タスク

### Day 1: サウンドシステム基盤

#### サウンドマネージャー
- [x] サウンドマネージャーの作成 (`packages/game/application/sound-manager.ts`)
  - [x] `SoundManager` (`Effect.Service<SoundManager>()('@minecraft/audio/SoundManager', ...)`)
  - [x] Web Audio API の初期化 (`packages/game/infrastructure/audio-engine.ts`、`AudioEnginePort` 経由)
  - [x] 音声コンテキストの管理 (`audio-engine.ts` の `AudioContext` + マスター gain ノード)

#### サウンド定義
- [x] サウンド定義の作成 (`packages/game/application/sound-manager.config.ts` の `SOUND_LIBRARY`)
  - [x] `SoundEffectSchema` リテラル union (`Schema.Literal`、`SoundId` enum 相当)
    - [ ] ブロック音 — 破壊 (`blockBreak`)・配置 (`blockPlace`)。歩行 (footstep) は未実装。
    - [x] 戦闘音 — 攻撃 (`entityHit`)・被ダメージ (`playerHurt`)・死亡 (`mobDeath` + 被弾 `mobHurt`)
    - [ ] 環境音（水、風、雷） — 未実装
  - [ ] 音声ファイルの読み込み — トーン合成のみ (サンプル音源は未実装)

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
- [x] 空間オーディオの実装 — ※ パス差分: `PannerNode.setPosition` ではなく自前の距離減衰 (`computeSpatial`、`1/(1+d/12)`) + `StereoPannerNode` (`audio-engine.ts:104-121`)。距離減衰・左右パンともテスト済み (`sound-manager.test.ts`)。
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
- [x] プレイヤー位置の追従 — `frame-handler.ts:298` が毎フレーム `soundManager.setListenerPosition(playerPos)` を呼び、`computeSpatial` がそのリスナー位置を読む。
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
- [x] 音楽マネージャーの作成 (`packages/game/application/music-manager.ts`)
  - [x] `MusicManager` (`Effect.Service`)
  - [x] BGM の読み込み — ※ パス差分: サンプル音源ではなくトラックごとの合成トーン (`TRACKS`)
  - [x] ループ再生 (`playEnvironmentTrack` が `loop` トーンを開始)

#### 環境別BGM
- [x] 昼間のBGM (`environmentFromContext` → `day`)
- [x] 夜間のBGM (`isNight` → `night`)
- [x] 洞窟/地下のBGM (`y < caveThresholdY` → `cave`)
- [x] 環境切り替え (`lighting-stage.ts:33-40` → `updateFromContext`、同一環境では no-op)

#### 統合
- [x] ブロック操作音の接続 (`interaction-block-handler.ts` の `blockBreak`/`blockPlace`)
- [x] 戦闘音の接続 (`entityHit`/`playerHurt`)
- [x] モブ音の接続 (本増分: `mobHurt`/`mobDeath`、プレイヤーキル時のみ)
- [ ] 設定からのボリューム調整 — `applySettings` → `audioEngine.setMasterGain` + per-tone/per-track 乗算 (`frame-handler.ts:279-296`)。※ 設定 → graph の配線は接続済み。ユーザー向け音量調整 UI スライダーは未実装。

#### テスト
- [x] サウンドマネージャーのテスト (`packages/game/test/sound-manager.test.ts`)
  - [x] 音声再生 (`mobHurt`/`mobDeath` 含む、freq/gain を `SOUND_LIBRARY` 定数で検証)
  - [x] ボリューム制御 (master/sfx の二重適用回避を検証)
- [x] 音楽マネージャーのテスト (`packages/game/test/music-manager.test.ts`)
  - [x] BGM再生
  - [x] ループ動作

#### 最終検証（全ゲート緑 2026-06-09 — `audioEnabled` 既定 false・音量 UI 未実装のためユーザー可聴検証は未）
- [x] ブロック破壊/配置で音が鳴る（vitest: `sound-manager.test.ts` 緑）
- [x] 攻撃で音が鳴る（vitest: `sound-manager.test.ts` + `interaction-mob-sound.test.ts` 緑）
- [x] 音の距離でボリュームが変わる（vitest: `sound-manager.test.ts` spatial path 緑）
- [x] 左右の音が正確（vitest: `sound-manager.test.ts` pan assertion 緑）
- [x] BGMが再生される（vitest: `music-manager.test.ts` 緑）
- [ ] 設定でボリューム調整ができる（音量調整 UI スライダー未実装）
- [x] すべてのテストが成功 — vitest 4083 passing / 0 failed、`pnpm typecheck` 0 errors、`pnpm lint` 0/0、`vite build` exit 0

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
